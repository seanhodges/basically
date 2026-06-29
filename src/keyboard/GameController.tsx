import { useEffect, useMemo, useRef, useState } from 'react';
import type { MachineEmulator } from '../dialects/types';
import type { ControllerRole, KeyboardLayout } from './layoutSchema';
import {
  type ControllerOverrides,
  type GamepadMode,
  CONTROLLER_ROLE_NAMES,
  controlLabel,
  resolveControllerConfig,
  resolveRoleKeyId,
  resolveRoleTokens,
} from './controllerConfig';
import { ControllerInputEngine } from './controllerInputEngine';
import { directionsFromVector } from './dpadGeometry';
import { GlyphSvg } from './GlyphSvg';
import './GameController.css';

/** Machine-only target (the controller never types into the editor). */
export interface ControllerMachineTarget {
  getMachine(): MachineEmulator | null;
  /** Lets the emulator's rAF tick drive engine.onFrame(). Must be stable. */
  registerFrameHook(cb: (() => void) | null): void;
}

interface GameControllerProps {
  layout: KeyboardLayout;
  target: ControllerMachineTarget;
  /** True while the program runs: input is live and long-press remap is OFF. */
  enabled: boolean;
  haptics: boolean;
  /** Per-dialect user remaps (role → KeyDef id) over the layout defaults. */
  overrides: ControllerOverrides;
  dpadMode: '4-way' | '8-way';
  /** How many fire buttons to draw (1 or 2) — the global layout setting. */
  displayFireButtons: 1 | 2;
  /**
   * Independent fire buttons the machine's joystick hardware exposes (1 or 2).
   * In a joystick mode this gates `fire2`: on a single-fire port a 2-button
   * layout still wires only the primary button.
   */
  hardwareFireButtons: 1 | 2;
  /**
   * Effective input mode: a joystick mode ('native'/'kempston') drives the
   * machine's joystick interface, 'keymapped' presses key tokens. Already
   * resolved against machine support.
   */
  mode: GamepadMode;
  /** Long-press on a control (while stopped) requests a remap of this role. */
  onStartRemap(role: ControllerRole): void;
}

/**
 * Fixed control labels for the joystick modes: D-pad arrows and lettered fire
 * buttons (primary = A, secondary = B). Unlike key-mapped mode, these never
 * reflect the underlying key — the gamepad drives a hardware joystick.
 */
const CONTROLLER_LABELS: Record<ControllerRole, string> = {
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
  fire1: 'A',
  fire2: 'B',
};

/** Hold this long (ms) on a control while stopped to open the remap picker. */
const LONG_PRESS_MS = 500;
/** Pointer travel (px) that cancels a pending long-press (it's a drag). */
const LONG_PRESS_MOVE_CANCEL = 12;
/** Fraction of the pad radius the thumb must leave before a direction fires. */
const DPAD_DEADZONE = 0.3;

export function GameController({
  layout,
  target,
  enabled,
  haptics,
  overrides,
  dpadMode,
  displayFireButtons,
  hardwareFireButtons,
  mode,
  onStartRemap,
}: GameControllerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const dpadRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef(target);
  targetRef.current = target;
  const hapticsRef = useRef(haptics);
  hapticsRef.current = haptics;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const dpadModeRef = useRef(dpadMode);
  dpadModeRef.current = dpadMode;

  const config = useMemo(() => resolveControllerConfig(layout), [layout]);
  const roleTokens = useMemo(
    () => resolveRoleTokens(layout, config, overrides),
    [layout, config, overrides],
  );

  const minHold = layout.options?.minHoldFrames ?? 3;
  const engine = useMemo(
    () =>
      new ControllerInputEngine(
        roleTokens,
        { getMachine: () => targetRef.current.getMachine() },
        { mode, fireButtons: hardwareFireButtons, minHoldFrames: minHold },
      ),
    [roleTokens, minHold, mode, hardwareFireButtons],
  );
  useEffect(() => () => engine.cancelAll(), [engine]);

  const [, setVersion] = useState(0);
  useEffect(() => {
    engine.onChange = () => setVersion((v) => v + 1);
    return () => {
      engine.onChange = null;
    };
  }, [engine]);

  useEffect(() => {
    target.registerFrameHook(() => engine.onFrame());
    return () => target.registerFrameHook(null);
  }, [engine, target]);

  // Stop input the moment the program stops (and clear any held keys).
  useEffect(() => {
    if (!enabled) engine.cancelAll();
  }, [enabled, engine]);

  // Any path that can lose pointers clears all matrix state.
  useEffect(() => {
    const cancelAll = () => engine.cancelAll();
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') cancelAll();
    };
    window.addEventListener('blur', cancelAll);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', cancelAll);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [engine]);

  // Orientation drives whether the pad and buttons sit in the lower corners
  // (portrait) or hug the far bottom corners of a short, wide band (landscape).
  const [landscape, setLandscape] = useState(
    () =>
      typeof window !== 'undefined' && window.innerWidth > window.innerHeight,
  );
  useEffect(() => {
    const update = () => setLandscape(window.innerWidth > window.innerHeight);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // --- remap (long-press while stopped) ------------------------------------
  const longPress = useRef<{
    pointerId: number;
    role: ControllerRole;
    x: number;
    y: number;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);

  const clearLongPress = () => {
    if (longPress.current) {
      clearTimeout(longPress.current.timer);
      longPress.current = null;
    }
  };

  const pressFeedback = () => {
    if (hapticsRef.current) navigator.vibrate?.(8);
  };

  // --- pointers -------------------------------------------------------------
  // Each pointer drives either the d-pad (a set of directions) or one fire.
  const pointers = useRef(new Map<number, 'dpad' | ControllerRole>());

  const dpadRolesAt = (
    clientX: number,
    clientY: number,
  ): Set<ControllerRole> => {
    const pad = dpadRef.current;
    if (!pad) return new Set();
    const rect = pad.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const radius = Math.min(rect.width, rect.height) / 2 || 1;
    const dirs = directionsFromVector(
      (clientX - cx) / radius,
      (clientY - cy) / radius,
      dpadModeRef.current,
      DPAD_DEADZONE,
    );
    return dirs as Set<ControllerRole>;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    // Keep the canvas/editor focused so physical input still works.
    e.preventDefault();
    const targetEl = e.target as Element;
    const roleAttr = targetEl
      .closest('[data-role]')
      ?.getAttribute('data-role') as ControllerRole | undefined;
    const onDpad = !!targetEl.closest('[data-dpad]');

    // Stopped: controls are inert except for the long-press-to-remap gesture.
    // Remapping a role to a key is meaningless in a joystick mode (the gamepad
    // drives a hardware joystick), so the gesture is disabled there.
    if (!enabledRef.current) {
      if (mode !== 'keymapped') return;
      const role = roleAttr;
      if (!role) return;
      clearLongPress();
      longPress.current = {
        pointerId: e.pointerId,
        role,
        x: e.clientX,
        y: e.clientY,
        timer: setTimeout(() => {
          longPress.current = null;
          engine.cancelAll();
          onStartRemap(role);
        }, LONG_PRESS_MS),
      };
      rootRef.current?.setPointerCapture(e.pointerId);
      return;
    }

    // Running: drive the matrix.
    if (onDpad) {
      pointers.current.set(e.pointerId, 'dpad');
      rootRef.current?.setPointerCapture(e.pointerId);
      engine.setPointerRoles(e.pointerId, dpadRolesAt(e.clientX, e.clientY));
      pressFeedback();
    } else if (roleAttr === 'fire1' || roleAttr === 'fire2') {
      pointers.current.set(e.pointerId, roleAttr);
      rootRef.current?.setPointerCapture(e.pointerId);
      engine.pressRole(e.pointerId, roleAttr);
      pressFeedback();
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const lp = longPress.current;
    if (lp && lp.pointerId === e.pointerId) {
      if (
        Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > LONG_PRESS_MOVE_CANCEL
      )
        clearLongPress();
    }
    const kind = pointers.current.get(e.pointerId);
    if (kind === 'dpad')
      engine.setPointerRoles(e.pointerId, dpadRolesAt(e.clientX, e.clientY));
  };

  const endPointer = (e: React.PointerEvent) => {
    const lp = longPress.current;
    if (lp && lp.pointerId === e.pointerId) clearLongPress();
    if (pointers.current.delete(e.pointerId))
      engine.releasePointer(e.pointerId);
    if (rootRef.current?.hasPointerCapture(e.pointerId))
      rootRef.current.releasePointerCapture(e.pointerId);
  };

  // --- rendering ------------------------------------------------------------
  const activeRoles = engine.getActiveRoles();

  const labelFor = (role: ControllerRole) => {
    // Joystick modes show fixed arrows/numbers, never the bound key.
    if (mode !== 'keymapped') return CONTROLLER_LABELS[role];
    const override = config.labels?.[role];
    if (override) return override;
    const keyId = resolveRoleKeyId(config, overrides, role);
    const label = controlLabel(layout, keyId);
    if (!label) return null;
    return label.glyph ? (
      <GlyphSvg glyph={layout.glyphs[label.glyph]} />
    ) : (
      label.text
    );
  };

  const arm = (role: ControllerRole) => {
    const content = labelFor(role);
    const classes = ['gc-arm', `gc-arm-${role}`];
    if (activeRoles.has(role)) classes.push('gc-active');
    if (content === null) classes.push('gc-unmapped');
    return (
      <div
        className={classes.join(' ')}
        data-role={role}
        role="button"
        aria-label={`${CONTROLLER_ROLE_NAMES[role]}${content === null ? ' (unmapped)' : ''}`}
      >
        <span className="gc-arm-label">{content ?? '·'}</span>
      </div>
    );
  };

  const fireButton = (role: 'fire1' | 'fire2') => {
    const content = labelFor(role);
    const classes = ['gc-fire', `gc-${role}`];
    if (activeRoles.has(role)) classes.push('gc-active');
    if (content === null) classes.push('gc-unmapped');
    // Arcade layout: the round button up top, its key cap (same-colour border)
    // labelled underneath. The wrapper carries data-role so a tap on either the
    // button or its cap fires the control.
    return (
      <div
        key={role}
        className={`gc-fire-wrap gc-wrap-${role}`}
        data-role={role}
        role="button"
        aria-label={`${CONTROLLER_ROLE_NAMES[role]}${content === null ? ' (unmapped)' : ''}`}
      >
        <div className={classes.join(' ')} aria-hidden="true" />
        <span className="gc-fire-cap">{content ?? '·'}</span>
      </div>
    );
  };

  const rootClasses = [
    'game-controller',
    layout.theme,
    landscape ? 'gc-landscape' : 'gc-portrait',
    `gc-${dpadMode}`,
    enabled ? 'gc-enabled' : 'gc-disabled',
  ].join(' ');

  return (
    <div
      ref={rootRef}
      className={rootClasses}
      role="group"
      aria-label={`${layout.name} game controller`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
    >
      <div className="gc-dpad" data-dpad ref={dpadRef}>
        {arm('up')}
        {arm('left')}
        <div className="gc-hub" aria-hidden="true" />
        {arm('right')}
        {arm('down')}
      </div>

      <div className="gc-buttons">
        {fireButton('fire1')}
        {displayFireButtons === 2 && fireButton('fire2')}
      </div>

      {!enabled && mode === 'keymapped' && (
        <div className="gc-hint" aria-hidden="true">
          Hold a control to remap
        </div>
      )}
    </div>
  );
}
