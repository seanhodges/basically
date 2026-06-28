import { describe, it, expect } from 'vitest';
import type { KeyDef, KeyboardLayout } from './layoutSchema';
import {
  controlLabel,
  effectiveGamepadMode,
  pickableKeys,
  resolveControllerConfig,
  resolveRoleKeyId,
  resolveRoleTokens,
  rolesToJoystick,
} from './controllerConfig';
import type { ControllerRole } from './layoutSchema';
import { zx81KeyboardLayout } from '../dialects/zx81/keyboardLayout';
import { c64KeyboardLayout } from '../dialects/commodore64/keyboardLayout';

const key = (id: string, text: string): KeyDef => ({
  id,
  spanX: 1,
  emits: [id],
  labels: [{ text }],
});

/** A layout with no explicit controller config but standard WASD + Space keys. */
const wasdLayout: KeyboardLayout = {
  id: 'mini',
  name: 'Mini',
  theme: '',
  gridColumns: 5,
  layers: [{ id: 'main', position: 'center', activeWhen: [] }],
  modifiers: [],
  rows: [
    [
      key('KeyW', 'w'),
      key('KeyA', 'a'),
      key('KeyS', 's'),
      key('KeyD', 'd'),
      key('Space', 'SPACE'),
    ],
  ],
  glyphs: {},
};

describe('resolveControllerConfig', () => {
  it('returns the layout’s explicit config when present', () => {
    const config = resolveControllerConfig(zx81KeyboardLayout);
    expect(config.bindings.up).toBe('Digit7');
    expect(config.bindings.fire1).toBe('Digit0');
    expect(config.fireButtons).toBe(1);
  });

  it('derives a WASD + Space fallback when absent', () => {
    const config = resolveControllerConfig(wasdLayout);
    expect(config.bindings).toMatchObject({
      up: 'KeyW',
      down: 'KeyS',
      left: 'KeyA',
      right: 'KeyD',
      fire1: 'Space',
    });
    expect(config.fireButtons).toBe(1);
  });
});

describe('resolveRoleTokens', () => {
  it('maps each role’s KeyDef id to its emits', () => {
    const config = resolveControllerConfig(zx81KeyboardLayout);
    const tokens = resolveRoleTokens(zx81KeyboardLayout, config, {});
    expect(tokens.up).toEqual(['Digit7']);
    expect(tokens.fire1).toEqual(['Digit0']);
  });

  it('applies user overrides over the defaults', () => {
    const config = resolveControllerConfig(zx81KeyboardLayout);
    const tokens = resolveRoleTokens(zx81KeyboardLayout, config, {
      up: 'Digit8',
    });
    expect(tokens.up).toEqual(['Digit8']);
    expect(resolveRoleKeyId(config, { up: 'Digit8' }, 'up')).toBe('Digit8');
  });

  it('leaves an unbound role undefined', () => {
    const config = resolveControllerConfig(zx81KeyboardLayout);
    const tokens = resolveRoleTokens(zx81KeyboardLayout, config, {});
    expect(tokens.fire2).toBeUndefined();
  });
});

describe('controlLabel', () => {
  it('reads the base-layer legend of a bound key', () => {
    expect(controlLabel(zx81KeyboardLayout, 'Digit5')?.text).toBe('5');
    // The C64 binds movement to bare-letter key ids; its keycaps are uppercase.
    expect(controlLabel(c64KeyboardLayout, 'W')?.text).toBe('W');
  });

  it('returns null for an unknown key', () => {
    expect(controlLabel(zx81KeyboardLayout, 'Nope')).toBeNull();
    expect(controlLabel(zx81KeyboardLayout, undefined)).toBeNull();
  });
});

describe('pickableKeys', () => {
  it('lists matrix-driving keys without duplicates', () => {
    const keys = pickableKeys(zx81KeyboardLayout);
    const ids = keys.map((k) => k.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(keys.every((k) => k.emits.length > 0)).toBe(true);
  });
});

describe('rolesToJoystick', () => {
  const set = (...r: ControllerRole[]) => new Set<ControllerRole>(r);

  it('maps held roles to direction/fire booleans', () => {
    expect(rolesToJoystick(set('up', 'right', 'fire1'), 2)).toEqual({
      up: true,
      down: false,
      left: false,
      right: true,
      fire1: true,
      fire2: false,
    });
  });

  it('drops fire2 on single-fire machines', () => {
    expect(rolesToJoystick(set('fire2'), 1).fire2).toBe(false);
    expect(rolesToJoystick(set('fire2'), 2).fire2).toBe(true);
  });
});

describe('effectiveGamepadMode', () => {
  it('keeps controller only when the dialect supports it', () => {
    expect(
      effectiveGamepadMode({ controllerSupport: true }, 'controller'),
    ).toBe('controller');
    expect(
      effectiveGamepadMode({ controllerSupport: false }, 'controller'),
    ).toBe('keymapped');
    expect(effectiveGamepadMode({}, 'controller')).toBe('keymapped');
  });

  it('always honours an explicit keymapped preference', () => {
    expect(effectiveGamepadMode({ controllerSupport: true }, 'keymapped')).toBe(
      'keymapped',
    );
  });
});
