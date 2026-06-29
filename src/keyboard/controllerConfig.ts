import type { Dialect, JoystickMode, JoystickState } from '../dialects/types';
import type {
  ControllerConfig,
  ControllerRole,
  KeyDef,
  KeyLabel,
  KeyboardLayout,
} from './layoutSchema';

/**
 * The virtual-gamepad input mode the user can prefer: a hardware
 * {@link JoystickMode} (`native`/`kempston`) or `keymapped` (press keys).
 */
export type GamepadMode = JoystickMode | 'keymapped';

/** Every controller role, in display order (directions then fire buttons). */
export const CONTROLLER_ROLES: ControllerRole[] = [
  'up',
  'down',
  'left',
  'right',
  'fire1',
  'fire2',
];

/** Human-readable label for each controller role (UI copy). */
export const CONTROLLER_ROLE_NAMES: Record<ControllerRole, string> = {
  up: 'Up',
  down: 'Down',
  left: 'Left',
  right: 'Right',
  fire1: 'Fire 1',
  fire2: 'Fire 2',
};

/** User remap overrides for a dialect: role → KeyDef id. */
export type ControllerOverrides = Partial<Record<ControllerRole, string>>;

/** Index every key in a layout (rows + top-strip function keys) by id. */
export function indexKeyDefs(layout: KeyboardLayout): Map<string, KeyDef> {
  const map = new Map<string, KeyDef>();
  for (const row of layout.rows) for (const k of row) map.set(k.id, k);
  for (const k of layout.functionKeys ?? []) map.set(k.id, k);
  return map;
}

/** The base (unmodified) layer of a layout. */
function baseLayerIndex(layout: KeyboardLayout): number {
  const idx = layout.layers.findIndex((l) => l.activeWhen.length === 0);
  return idx >= 0 ? idx : 0;
}

/**
 * The label to print on a control bound to `keyId`: the key's base-layer legend
 * (its big white character), falling back to its first non-null legend. Returns
 * null when the key is unknown or carries no legend.
 */
export function controlLabel(
  layout: KeyboardLayout,
  keyId: string | undefined,
): KeyLabel | null {
  if (!keyId) return null;
  const def = indexKeyDefs(layout).get(keyId);
  if (!def) return null;
  const baseIdx = baseLayerIndex(layout);
  return def.labels[baseIdx] ?? def.labels.find((l) => l != null) ?? null;
}

/** First id in `candidates` that exists as a key in the layout, else undefined. */
function firstPresent(
  index: Map<string, KeyDef>,
  candidates: string[],
): string | undefined {
  return candidates.find((id) => index.has(id));
}

/**
 * Derive a sensible controller config for a layout that doesn't ship one:
 * WASD movement + Space fire, probing both DOM-code (`KeyW`) and bare-letter
 * (`W`) key ids. Roles with no resolvable key are left unbound (the UI shows
 * them as needing a mapping).
 */
function deriveControllerConfig(layout: KeyboardLayout): ControllerConfig {
  const index = indexKeyDefs(layout);
  const bindings: ControllerOverrides = {
    up: firstPresent(index, ['KeyW', 'W']),
    down: firstPresent(index, ['KeyS', 'S']),
    left: firstPresent(index, ['KeyA', 'A']),
    right: firstPresent(index, ['KeyD', 'D']),
    fire1: firstPresent(index, ['Space']),
  };
  return { fireButtons: 1, dpadMode: '4-way', bindings };
}

/** The layout's explicit controller config, or a derived WASD fallback. */
export function resolveControllerConfig(
  layout: KeyboardLayout,
): ControllerConfig {
  return layout.controller ?? deriveControllerConfig(layout);
}

/**
 * Resolve each role to the machine tokens it should press, applying user
 * overrides over the config defaults. A role with no binding (or whose bound
 * key isn't in the layout) maps to undefined and drives nothing.
 */
export function resolveRoleTokens(
  layout: KeyboardLayout,
  config: ControllerConfig,
  overrides: ControllerOverrides,
): Record<ControllerRole, string[] | undefined> {
  const index = indexKeyDefs(layout);
  const out = {} as Record<ControllerRole, string[] | undefined>;
  for (const role of CONTROLLER_ROLES) {
    const keyId = overrides[role] ?? config.bindings[role];
    out[role] = keyId ? index.get(keyId)?.emits : undefined;
  }
  return out;
}

/** The resolved KeyDef id a role currently uses (override ?? default). */
export function resolveRoleKeyId(
  config: ControllerConfig,
  overrides: ControllerOverrides,
  role: ControllerRole,
): string | undefined {
  return overrides[role] ?? config.bindings[role];
}

/**
 * Collapse the set of currently-held controller roles into a JoystickState for
 * "Controller" mode. `fire2` is forced off on single-fire machines/layouts.
 */
export function rolesToJoystick(
  roles: Set<ControllerRole>,
  fireButtons: 1 | 2,
): JoystickState {
  return {
    up: roles.has('up'),
    down: roles.has('down'),
    left: roles.has('left'),
    right: roles.has('right'),
    fire1: roles.has('fire1'),
    fire2: fireButtons >= 2 && roles.has('fire2'),
  };
}

/**
 * The gamepad mode actually in effect: the preferred hardware joystick mode only
 * when the current dialect's emulator can service it, otherwise 'keymapped'.
 * Computable while stopped (no machine built).
 */
export function effectiveGamepadMode(
  dialect: Pick<Dialect, 'joystickModes'>,
  pref: GamepadMode,
): GamepadMode {
  if (pref === 'keymapped') return 'keymapped';
  return dialect.joystickModes?.includes(pref) ? pref : 'keymapped';
}

/** Keys the remap picker offers: every layout key that drives the matrix. */
export function pickableKeys(layout: KeyboardLayout): KeyDef[] {
  const seen = new Set<string>();
  const keys: KeyDef[] = [];
  for (const def of [...layout.rows.flat(), ...(layout.functionKeys ?? [])]) {
    if (def.emits.length === 0 || seen.has(def.id)) continue;
    seen.add(def.id);
    keys.push(def);
  }
  return keys;
}
