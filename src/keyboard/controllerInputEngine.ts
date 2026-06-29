import type { MachineEmulator } from '../dialects/types';
import { rolesToJoystick, type GamepadMode } from './controllerConfig';
import type { ControllerRole } from './layoutSchema';

/** Where the engine drives matrix presses (mirrors the keyboard's target). */
export interface ControllerEngineTarget {
  getMachine(): MachineEmulator | null;
}

/** Machine tokens each role presses (undefined = the role is unbound). */
export type RoleTokens = Record<ControllerRole, string[] | undefined>;

const DEFAULT_MIN_HOLD_FRAMES = 3;

/** How the engine turns held roles into emulator input. */
export interface ControllerEngineOptions {
  /** 'keymapped' presses key tokens; a joystick mode drives `setJoystick`. */
  mode: GamepadMode;
  /** Hardware fire-button count; gates `fire2` in joystick modes. */
  fireButtons?: 1 | 2;
  /** Min-hold frames for key-mapped releases (unused in joystick modes). */
  minHoldFrames?: number;
}

interface ActivePress {
  tokens: string[];
  pressedAtFrame: number;
}

interface PendingRelease {
  tokens: string[];
  releaseAtFrame: number;
}

/**
 * Drives the emulator key matrix from game-controller input. DOM-independent
 * and unit-testable: the component forwards pointer state in and calls onFrame()
 * once per emulated frame.
 *
 * Borrows the three mechanics the keyboard's {@link KeyboardInputEngine} proved:
 *  - frame-counted **min-hold** so a quick tap survives the ROM's once-per-frame
 *    key scan (releases defer to pressedAtFrame + minHoldFrames);
 *  - per-token **ref-counting** so a token shared by two controls (or held by a
 *    second pointer) only clears on the last release;
 *  - **releaseAllKeys** on cancelAll (stop / blur / dialect swap).
 *
 * Unlike the keyboard engine it maps one pointer to a *set* of roles, so a
 * single thumb can hold two cardinal directions at once (an 8-way diagonal).
 */
export class ControllerInputEngine {
  private readonly mode: GamepadMode;
  private readonly fireButtons: 1 | 2;
  private readonly minHoldFrames: number;
  private frame = 0;
  /** role-press keyed by `${pointerId}:${role}` → tokens + when pressed. */
  private readonly active = new Map<string, ActivePress>();
  /** Roles currently held per pointer (for diffing + visual highlight). */
  private readonly pointerRoles = new Map<number, Set<ControllerRole>>();
  private readonly pendingReleases: PendingRelease[] = [];
  /** Per-token press counts; the matrix cell clears only when this hits 0. */
  private readonly tokenCounts = new Map<string, number>();
  /** Notifies the UI that the active-role set changed (for press feedback). */
  onChange: (() => void) | null = null;

  constructor(
    private readonly roleTokens: RoleTokens,
    private readonly target: ControllerEngineTarget,
    options: ControllerEngineOptions,
  ) {
    this.mode = options.mode;
    this.fireButtons = options.fireButtons ?? 1;
    this.minHoldFrames = options.minHoldFrames ?? DEFAULT_MIN_HOLD_FRAMES;
  }

  /**
   * Set the exact roles a pointer holds. Diffs against the pointer's previous
   * set: newly-held roles press, released roles schedule a min-hold release.
   * Sliding the thumb up→up-right keeps `up` down and just adds `right`.
   */
  setPointerRoles(pointerId: number, roles: Set<ControllerRole>): void {
    const prev = this.pointerRoles.get(pointerId) ?? new Set<ControllerRole>();
    let changed = false;
    for (const role of roles) {
      if (!prev.has(role)) {
        this.activate(pointerId, role);
        changed = true;
      }
    }
    for (const role of prev) {
      if (!roles.has(role)) {
        this.deactivate(pointerId, role);
        changed = true;
      }
    }
    if (roles.size === 0) this.pointerRoles.delete(pointerId);
    else this.pointerRoles.set(pointerId, new Set(roles));
    if (changed) {
      if (this.mode !== 'keymapped') this.applyJoystick();
      this.notify();
    }
  }

  /** A fire-button press: that pointer holds exactly the one role. */
  pressRole(pointerId: number, role: ControllerRole): void {
    this.setPointerRoles(pointerId, new Set([role]));
  }

  /** Release everything a pointer holds (pointerup / pointercancel). */
  releasePointer(pointerId: number): void {
    this.setPointerRoles(pointerId, new Set());
  }

  /** Called once per emulated frame; flushes min-hold-deferred releases. */
  onFrame(): void {
    this.frame++;
    if (this.pendingReleases.length === 0) return;
    let changed = false;
    for (let i = this.pendingReleases.length - 1; i >= 0; i--) {
      const pending = this.pendingReleases[i]!;
      if (this.frame >= pending.releaseAtFrame) {
        this.pendingReleases.splice(i, 1);
        for (const token of pending.tokens) this.releaseToken(token);
        changed = true;
      }
    }
    if (changed) this.notify();
  }

  /** Release everything everywhere (stop, blur, machine swap, unmount). */
  cancelAll(): void {
    this.active.clear();
    this.pointerRoles.clear();
    this.pendingReleases.length = 0;
    this.tokenCounts.clear();
    this.target.getMachine()?.releaseAllKeys();
    // Centre the joystick / drop fire so nothing is left held after a stop.
    if (this.mode !== 'keymapped') this.applyJoystick();
    this.notify();
  }

  /** Roles currently held by any pointer (for visual press feedback). */
  getActiveRoles(): Set<ControllerRole> {
    const roles = new Set<ControllerRole>();
    for (const set of this.pointerRoles.values())
      for (const role of set) roles.add(role);
    return roles;
  }

  // ---- internals ----------------------------------------------------------

  private activate(pointerId: number, role: ControllerRole): void {
    const key = `${pointerId}:${role}`;
    if (this.active.has(key)) return;
    const tokens = this.roleTokens[role] ?? [];
    this.active.set(key, { tokens, pressedAtFrame: this.frame });
    // Joystick modes drive the port directly; min-hold/token presses are a
    // key-mapped-only concern (they survive the ROM's matrix scan).
    if (this.mode === 'keymapped')
      for (const token of tokens) this.pressToken(token);
  }

  private deactivate(pointerId: number, role: ControllerRole): void {
    const key = `${pointerId}:${role}`;
    const press = this.active.get(key);
    if (!press) return;
    this.active.delete(key);
    if (this.mode !== 'keymapped') return;
    const releaseAtFrame = press.pressedAtFrame + this.minHoldFrames;
    if (this.frame >= releaseAtFrame) {
      for (const token of press.tokens) this.releaseToken(token);
    } else {
      this.pendingReleases.push({ tokens: press.tokens, releaseAtFrame });
    }
  }

  /** Push the current direction/fire state to the machine's joystick interface. */
  private applyJoystick(): void {
    if (this.mode === 'keymapped') return;
    this.target
      .getMachine()
      ?.setJoystick?.(
        this.mode,
        rolesToJoystick(this.getActiveRoles(), this.fireButtons),
      );
  }

  private pressToken(token: string): void {
    const count = (this.tokenCounts.get(token) ?? 0) + 1;
    this.tokenCounts.set(token, count);
    if (count === 1) this.target.getMachine()?.setKey(token, true);
  }

  private releaseToken(token: string): void {
    const count = this.tokenCounts.get(token) ?? 0;
    if (count <= 1) {
      this.tokenCounts.delete(token);
      if (count === 1) this.target.getMachine()?.setKey(token, false);
    } else {
      this.tokenCounts.set(token, count - 1);
    }
  }

  private notify(): void {
    this.onChange?.();
  }
}
