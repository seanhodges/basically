import { describe, it, expect } from 'vitest';
import { samcoupeKeyboardLayout } from './keyboardLayout';
import { samcoupeCharset } from './charset';
import { SAMCOUPE_KEY_TOKENS } from './emulator/keyboard';
import {
  resolveEditorAction,
  resolveEmits,
} from '../../keyboard/editorActions';

const layout = samcoupeKeyboardLayout;
const allKeys = layout.rows.flat();

const editorLayerIds = [
  ...(layout.editorModes ?? []).map((m) => m.layer),
  'caps',
  'symbols',
  'symbols2',
];

/**
 * Matrix keys with no keycap, no SYM cell and no CURSOR legend, and why.
 *
 * Both still reach the matrix from a host keyboard (`Tab`, and either Control
 * key), so nothing on the machine is unreachable; what they have no on-screen
 * route to is the *template*, which has five bands and no room for a key whose
 * only job is to select legends the editor's own completion already offers.
 */
const HOST_ONLY: Record<string, string> = {
  Tab: 'moves the cursor a tab stop; nothing the editor target can use',
  Control:
    'selects the keyword faces printed on the keycaps, which the completion list offers instead',
};

describe('samcoupe keyboard layout', () => {
  it('labels are index-aligned with the layers', () => {
    for (const key of allKeys) {
      if (key.style === 'spacer') continue; // inert filler, no labels
      expect(key.labels.length, key.id).toBe(layout.layers.length);
    }
    for (const key of layout.functionKeys ?? []) {
      expect(key.labels.length, key.id).toBe(layout.layers.length);
    }
  });

  it('presses every key the matrix has, or says why not', () => {
    const pressed = new Set<string>();
    const collect = (tokens: readonly string[]) => {
      for (const t of tokens) pressed.add(t);
    };
    for (const key of [...allKeys, ...(layout.functionKeys ?? [])]) {
      collect(key.emits);
      for (const label of key.labels) collect(label?.emits ?? []);
    }
    for (const mod of layout.modifiers) {
      collect(mod.emits);
      collect(mod.caseLock?.emits ?? []);
      collect(mod.caseLock?.releaseEmits ?? []);
    }
    const missing = SAMCOUPE_KEY_TOKENS.filter((t) => !pressed.has(t));
    expect(missing.sort()).toEqual(Object.keys(HOST_ONLY).sort());
    // And nothing is pressed that the matrix would not recognise.
    const matrix = new Set(SAMCOUPE_KEY_TOKENS);
    expect([...pressed].filter((t) => !matrix.has(t))).toEqual([]);
  });

  it('every insert in every reachable mode is valid SAM Coupé charset text', () => {
    for (const key of allKeys) {
      for (const layerId of editorLayerIds) {
        const action = resolveEditorAction(layout, key, layerId);
        if (action && 'insert' in action) {
          expect(
            () => samcoupeCharset.toMachine(action.insert),
            `${key.id} on layer ${layerId}: ${JSON.stringify(action.insert)}`,
          ).not.toThrow();
        }
      }
    }
  });

  it('spot checks the headline keys', () => {
    const byId = new Map(allKeys.map((k) => [k.id, k]));
    expect(resolveEditorAction(layout, byId.get('KeyP')!, 'base')).toEqual({
      insert: 'p',
    });
    expect(resolveEditorAction(layout, byId.get('KeyP')!, 'caps')).toEqual({
      insert: 'P',
    });
    expect(resolveEditorAction(layout, byId.get('Enter')!, 'base')).toEqual({
      action: 'newline',
    });
    expect(resolveEditorAction(layout, byId.get('Space')!, 'base')).toEqual({
      insert: ' ',
    });
    expect(resolveEditorAction(layout, byId.get('Quote')!, 'base')).toEqual({
      insert: '"',
    });
    expect(resolveEditorAction(layout, byId.get('Delete')!, 'base')).toEqual({
      action: 'backspace',
    });
    // ESC and EDIT press the machine and type nothing.
    for (const id of ['Escape', 'Edit']) {
      expect(resolveEditorAction(layout, byId.get(id)!, 'base'), id).toBeNull();
    }
  });

  it('types each symbol with the chord the ROM answers it with', () => {
    // Every pair here was read back off the booted v3.0 ROM by pressing it and
    // asking the machine for the character CODE it produced, so a wrong shift
    // pair - which would still show the right legend - fails here.
    const byId = new Map(allKeys.map((k) => [k.id, k]));
    const chords: [string, string, string[]][] = [
      // slot key      insert  what the machine is asked to press
      ['KeyQ', '+', ['Plus']],
      ['KeyW', '!', ['ShiftLeft', 'Digit1']],
      ['KeyE', '?', ['SymShift', 'KeyZ']],
      ['KeyY', '£', ['SymShift', 'KeyL']],
      ['KeyU', '<', ['SymShift', 'Comma']],
      ['KeyH', '&', ['ShiftLeft', 'Digit6']],
      ['KeyG', '↑', ['SymShift', 'KeyH']],
      ['KeyM', '.', ['Period']],
    ];
    for (const [id, insert, emits] of chords) {
      const key = byId.get(id)!;
      expect(resolveEditorAction(layout, key, 'symbols'), id).toEqual({
        insert,
      });
      expect(resolveEmits(layout, key, 'symbols'), id).toEqual(emits);
    }
    // The `^` slot shows and types the machine's own `↑`, its power operator.
    const caret = layout.layers.findIndex((l) => l.id === 'symbols');
    expect(byId.get('KeyG')!.labels[caret]?.text).toBe('↑');
    // The backslash is the one three-key chord on this keyboard.
    expect(resolveEmits(layout, byId.get('KeyE')!, 'symbols2')).toEqual([
      'ShiftLeft',
      'SymShift',
      'Inv',
    ]);
  });

  it('overlays the cursor keys on W/A/S/D and presses the real cluster', () => {
    const byId = new Map(allKeys.map((k) => [k.id, k]));
    const arrows: [string, 'up' | 'left' | 'down' | 'right', string][] = [
      ['KeyW', 'up', 'ArrowUp'],
      ['KeyA', 'left', 'ArrowLeft'],
      ['KeyS', 'down', 'ArrowDown'],
      ['KeyD', 'right', 'ArrowRight'],
    ];
    for (const [id, action, token] of arrows) {
      const key = byId.get(id)!;
      expect(resolveEditorAction(layout, key, 'cursor'), id).toEqual({
        action,
      });
      expect(resolveEmits(layout, key, 'cursor'), id).toEqual([token]);
    }
  });

  it('binds the controller to the keys the joystick port is wired to', () => {
    // The SAM reads its 9-pin port as keys 6, 7, 8, 9 and 0 on the matrix, so
    // the pad has to press those and not some other arrangement.
    expect(layout.controller?.bindings).toEqual({
      up: 'Digit9',
      down: 'Digit8',
      left: 'Digit6',
      right: 'Digit7',
      fire1: 'Digit0',
      fire2: 'Space',
    });
  });

  it('offers the ten function keys as machine keys only', () => {
    const strip = layout.functionKeys ?? [];
    expect(strip.map((k) => k.id)).toEqual([
      'F1',
      'F2',
      'F3',
      'F4',
      'F5',
      'F6',
      'F7',
      'F8',
      'F9',
      'F0',
    ]);
    for (const key of strip) {
      expect(resolveEditorAction(layout, key, 'base'), key.id).toBeNull();
    }
  });
});
