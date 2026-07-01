import { useEffect, useMemo, useRef, useState } from 'react';
import { useIdeStore, type MobileTab } from '../app/store';
import {
  useMediaQuery,
  MOBILE_QUERY,
  LANDSCAPE_MOBILE_QUERY,
} from '../app/useMediaQuery';
import { useInputOverlays } from '../app/useInputOverlays';
import { useProgramStats, ramBudget } from '../app/useProgramStats';
import {
  setSplitRatio as persistSplitRatio,
  MIN_SPLIT_RATIO,
  MAX_SPLIT_RATIO,
} from '../storage/settings';
import type { ControllerRole, EditorKeyAction } from '../keyboard/layoutSchema';
import { CONTROLLER_ROLE_NAMES } from '../keyboard/controllerConfig';
import {
  VirtualKeyboard,
  type KeyboardTarget,
} from '../keyboard/VirtualKeyboard';
import {
  GameController,
  type ControllerMachineTarget,
} from '../keyboard/GameController';
import { effectiveGamepadMode } from '../keyboard/controllerConfig';
import { CodeMirrorHost } from './CodeMirrorHost';
import { EmulatorPane, type MachineApi } from './EmulatorPane';
import { AiPanel } from './AiPanel';
import { SettingsForm } from './SettingsForm';
import styles from './Workspace.module.css';

const DIVIDER_WIDTH = 6;

function ProgramStats() {
  const dialect = useIdeStore((s) => s.dialect);
  const fileName = useIdeStore((s) => s.fileName);
  const dirty = useIdeStore((s) => s.dirty);
  const emulatorStatus = useIdeStore((s) => s.emulatorStatus);
  const stats = useProgramStats();

  const { pct, label } = ramBudget(stats.bytes, dialect.programRamBytes);

  return (
    <div className={styles.programStats}>
      <h3>Program</h3>
      <p>
        {fileName}
        {dirty ? ' •' : ''} — {dialect.name}
      </p>
      <p title="Tokenized program size">
        {stats.bytes.toLocaleString()} bytes ({pct}% of {label} budget)
      </p>
      <p className={stats.errors > 0 ? styles.statusErrors : ''}>
        {stats.errors === 0
          ? 'no errors'
          : `${stats.errors} error${stats.errors > 1 ? 's' : ''}`}
      </p>
      <p
        className={`${styles.statusEmu} ${
          emulatorStatus === 'running' ? styles.running : ''
        }`}
      >
        emulator: {emulatorStatus}
      </p>
    </div>
  );
}

export function Workspace() {
  const dialect = useIdeStore((s) => s.dialect);
  const docOverride = useIdeStore((s) => s.docOverride);
  const setSource = useIdeStore((s) => s.setSource);
  const aiPanelOpen = useIdeStore((s) => s.aiPanelOpen);
  const mobileTab = useIdeStore((s) => s.mobileTab);
  const splitRatio = useIdeStore((s) => s.splitRatio);
  const setSplitRatio = useIdeStore((s) => s.setSplitRatio);
  const requestRun = useIdeStore((s) => s.requestRun);

  const setKeyboardEnabled = useIdeStore((s) => s.setKeyboardEnabled);
  const keyboardAutoShow = useIdeStore((s) => s.keyboardAutoShow);
  const editorFocused = useIdeStore((s) => s.editorFocused);
  const emulatorStatus = useIdeStore((s) => s.emulatorStatus);
  const keyboardSound = useIdeStore((s) => s.keyboardSound);
  const keyboardHaptics = useIdeStore((s) => s.keyboardHaptics);
  const keyboardKeyDisplay = useIdeStore((s) => s.keyboardKeyDisplay);
  const controllerBindings = useIdeStore((s) => s.controllerBindings);
  const controllerDpadMode = useIdeStore((s) => s.controllerDpadMode);
  const controllerFireButtons = useIdeStore((s) => s.controllerFireButtons);
  const gamepadMode = useIdeStore((s) => s.gamepadMode);
  const setControllerBinding = useIdeStore((s) => s.setControllerBinding);
  const resetController = useIdeStore((s) => s.resetController);

  const isMobile = useMediaQuery(MOBILE_QUERY);
  // A touch phone in landscape uses the single-pane tab layout too (its width can
  // exceed the 768px breakpoint, so `isMobile` alone misses it), plus a few
  // landscape-only tweaks (left rail, flanking gamepad).
  const landscape = useMediaQuery(LANDSCAPE_MOBILE_QUERY);
  const tabbed = isMobile || landscape;
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  // The controller role currently being remapped: while non-null the on-screen
  // keyboard replaces the controller as a key picker.
  const [remapRole, setRemapRole] = useState<ControllerRole | null>(null);

  // The virtual keyboard types into the editor through this handle; presses
  // preventDefault so the editor never loses focus while typing.
  const editorInputRef = useRef<((action: EditorKeyAction) => void) | null>(
    null,
  );
  const editorTarget = useMemo<KeyboardTarget>(
    () => ({
      kind: 'editor',
      apply: (action) => editorInputRef.current?.(action),
    }),
    [],
  );

  // The single keyboard routes to the emulator through a handle EmulatorPane
  // populates. Empty deps keep the object identity stable, which VirtualKeyboard
  // requires; the indirection reads the latest handle.
  const machineApiRef = useRef<MachineApi | null>(null);
  const machineTarget = useMemo<KeyboardTarget>(
    () => ({
      kind: 'machine',
      getMachine: () => machineApiRef.current?.getMachine() ?? null,
      registerFrameHook: (cb) => machineApiRef.current?.registerFrameHook(cb),
    }),
    [],
  );
  // The controller only ever drives the machine; a stable handle like above.
  const controllerTarget = useMemo<ControllerMachineTarget>(
    () => ({
      getMachine: () => machineApiRef.current?.getMachine() ?? null,
      registerFrameHook: (cb) => machineApiRef.current?.registerFrameHook(cb),
    }),
    [],
  );

  // The gamepad/keyboard overlay visibility and editor routing are resolved in
  // one shared hook (see useInputOverlays) so this component and EmulatorPane
  // can't disagree on which overlay is up during focus transitions.
  const { controllerVisible, keyboardVisible, routeToEditor } =
    useInputOverlays();

  // Resolve the user's gamepad preference against this machine's joystick
  // support; machines that don't support the chosen mode silently fall back to
  // key mapping.
  const effectiveMode = effectiveGamepadMode(dialect, gamepadMode);

  // With auto-show on, re-open the keyboard if it was hidden when the editor
  // regains focus. Edge-triggered (only on the false→true transition) so a
  // manual close while the editor stays focused isn't immediately undone. Gated
  // to the setting so users who prefer a physical keyboard never get a surprise
  // keyboard.
  const prevEditorFocused = useRef(editorFocused);
  useEffect(() => {
    if (
      keyboardAutoShow &&
      editorFocused &&
      !prevEditorFocused.current &&
      !useIdeStore.getState().keyboardEnabled
    ) {
      setKeyboardEnabled(true);
    }
    prevEditorFocused.current = editorFocused;
  }, [editorFocused, keyboardAutoShow, setKeyboardEnabled]);

  const hidden = (tab: MobileTab) =>
    tabbed && mobileTab !== tab ? styles.tabHidden : '';

  // On the split layout the preview and the AI panel share the right-hand column;
  // exactly one shows at a time and the AI panel wins when open. (On the tab
  // layout the tab logic in `hidden()` governs instead, so this is a no-op.)
  const slotHidden = (view: 'preview' | 'ai') => {
    if (tabbed) return '';
    const active = aiPanelOpen ? 'ai' : 'preview';
    return view === active ? '' : styles.slotHidden;
  };

  const onDividerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };

  const onDividerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const rect = workspace.getBoundingClientRect();
    const width = rect.width;
    if (width <= 0) return;
    const ratio = (e.clientX - rect.left) / width;
    setSplitRatio(Math.min(MAX_SPLIT_RATIO, Math.max(MIN_SPLIT_RATIO, ratio)));
  };

  const onDividerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setDragging(false);
    persistSplitRatio(useIdeStore.getState().splitRatio);
  };

  const cols = tabbed
    ? undefined
    : `${(splitRatio * 100).toFixed(2)}% ${DIVIDER_WIDTH}px 1fr`;

  return (
    <div
      className={`${styles.workspace} ${tabbed ? styles.mobile : ''} ${
        landscape ? styles.landscape : ''
      } ${dragging ? styles.dragging : ''} ${
        keyboardVisible && routeToEditor ? styles.kbOpen : ''
      }`}
      ref={workspaceRef}
      style={cols ? { gridTemplateColumns: cols } : undefined}
    >
      {/* The mobile tab bar lives in the toolbar (merged into a single row);
          switching tabs swaps the panel shown below. */}
      <div className={`${styles.editorPane} ${hidden('editor')}`}>
        {/* The FAB anchors to this box so the docked keyboard below never
            sits underneath it. */}
        <div className={styles.editorMain}>
          <CodeMirrorHost
            dialect={dialect}
            override={docOverride}
            onChange={setSource}
            inputRef={editorInputRef}
          />
          {tabbed && mobileTab === 'editor' && (
            <button
              className={styles.fabRun}
              onClick={requestRun}
              title="Build and run in the emulator"
            >
              ▶
            </button>
          )}
        </div>
      </div>
      <div
        className={styles.divider}
        onPointerDown={onDividerDown}
        onPointerMove={onDividerMove}
        onPointerUp={onDividerUp}
      />
      <div
        className={`${styles.monitorPane} ${hidden('preview')} ${slotHidden(
          'preview',
        )}`}
      >
        <EmulatorPane apiRef={machineApiRef} />
      </div>
      {tabbed && (
        <div className={`${styles.settingsPane} ${hidden('settings')}`}>
          <SettingsForm />
          <ProgramStats />
        </div>
      )}
      {(aiPanelOpen || tabbed) && (
        <div className={`${styles.aiHost} ${hidden('ai')} ${slotHidden('ai')}`}>
          <AiPanel />
        </div>
      )}
      {/* A single full-width keyboard overlay for every layout, routed to the
          editor when it's the active surface, otherwise to the emulator. Keyed
          by the route so each target switch remounts cleanly (no stale
          engine/pointer state) and the first key after a switch isn't lost. */}
      {keyboardVisible && (
        <div className={styles.workspaceVkOverlay}>
          <VirtualKeyboard
            key={routeToEditor ? 'editor' : 'machine'}
            layout={dialect.keyboardLayout}
            target={routeToEditor ? editorTarget : machineTarget}
            enabled={routeToEditor || emulatorStatus === 'running'}
            sound={keyboardSound}
            haptics={keyboardHaptics}
            keyDisplay={keyboardKeyDisplay}
          />
        </div>
      )}
      {/* The game-controller overlay floats over the bottom half (transparent
          gaps fall through to the screen). Keyed by dialect so a machine swap
          remounts a clean engine — no stuck keys. While a remap is in progress
          the controller hides and the keyboard picker below takes its place. */}
      {controllerVisible && remapRole === null && (
        <div
          className={`${styles.workspaceVkOverlay} ${styles.workspaceGcOverlay}`}
        >
          <GameController
            key={`${dialect.id}:${effectiveMode}`}
            layout={dialect.keyboardLayout}
            target={controllerTarget}
            enabled={emulatorStatus === 'running'}
            haptics={keyboardHaptics}
            overrides={controllerBindings}
            dpadMode={controllerDpadMode}
            displayFireButtons={controllerFireButtons}
            hardwareFireButtons={dialect.joystickFireButtons ?? 1}
            mode={effectiveMode}
            onStartRemap={setRemapRole}
          />
        </div>
      )}
      {/* Remap picker: the machine's real keyboard. Tapping a key binds the
          long-pressed control to it. */}
      {controllerVisible && remapRole !== null && (
        <div
          className={`${styles.workspaceVkOverlay} ${styles.gamepadRemapOverlay}`}
        >
          <div className={styles.gamepadRemapBanner}>
            <span>
              Tap a key to map{' '}
              <strong>{CONTROLLER_ROLE_NAMES[remapRole]}</strong>
            </span>
            <button
              onClick={() => {
                resetController();
                setRemapRole(null);
              }}
            >
              Reset to defaults
            </button>
            <button onClick={() => setRemapRole(null)}>Cancel</button>
          </div>
          <VirtualKeyboard
            layout={dialect.keyboardLayout}
            target={machineTarget}
            enabled
            sound={keyboardSound}
            haptics={keyboardHaptics}
            keyDisplay={keyboardKeyDisplay}
            onPickKey={(keyId) => {
              setControllerBinding(remapRole, keyId);
              setRemapRole(null);
            }}
          />
        </div>
      )}
    </div>
  );
}
