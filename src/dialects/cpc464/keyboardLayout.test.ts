import { describe, expect, it } from 'vitest';
import { cpc464KeyboardLayout as layout } from './keyboardLayout';
import { resolveEditorAction } from '../../keyboard/editorActions';
import { CONTROLLER_ROLES } from '../../keyboard/controllerConfig';
import {
  CpcKeyboard,
  MATRIX,
  CODE_TO_TOKEN,
} from '../../emulator/cpc/keyboard';

const allKeys = [
  ...layout.rows.flat(),
  ...(layout.functionKeys ?? []),
  ...(layout.controllerKeys ?? []),
];
const byId = new Map(allKeys.map((k) => [k.id, k]));

describe('cpc464 keyboard layout', () => {
  it('uses the standard 40-column, 5-row template', () => {
    expect(layout.gridColumns).toBe(40);
    expect(layout.rows).toHaveLength(5);
    expect(layout.functionKeys).toHaveLength(10); // f0-f9
  });

  it('every row spans exactly the grid width', () => {
    layout.rows.forEach((row, i) => {
      const total = row.reduce((n, k) => n + k.spanX, 0);
      expect(total, `row ${i}`).toBe(40);
    });
  });

  it('labels are index-aligned with the layers', () => {
    for (const k of allKeys) {
      if (k.style === 'spacer') continue;
      expect(k.labels.length, k.id).toBe(layout.layers.length);
    }
  });

  it('every referenced modifier exists', () => {
    const modIds = new Set(layout.modifiers.map((m) => m.id));
    for (const k of allKeys) {
      if (k.modifier) expect(modIds.has(k.modifier), k.id).toBe(true);
    }
  });

  it('spot checks the editor actions across layers', () => {
    expect(resolveEditorAction(layout, byId.get('Return')!, 'base')).toEqual({
      action: 'newline',
    });
    expect(resolveEditorAction(layout, byId.get('Space')!, 'base')).toEqual({
      insert: ' ',
    });
    expect(resolveEditorAction(layout, byId.get('Del')!, 'base')).toEqual({
      action: 'backspace',
    });
    // SHIFT and SYM layers surface the punctuation as editor inserts.
    expect(resolveEditorAction(layout, byId.get('Digit1')!, 'shifted')).toEqual(
      {
        insert: '!',
      },
    );
    expect(resolveEditorAction(layout, byId.get('Digit5')!, 'sym')).toEqual({
      insert: '^',
    });
    // CURSOR mode overlays the caret moves onto W/A/S/D.
    expect(resolveEditorAction(layout, byId.get('W')!, 'cursor')).toEqual({
      action: 'up',
    });
    expect(resolveEditorAction(layout, byId.get('A')!, 'cursor')).toEqual({
      action: 'left',
    });
    expect(resolveEditorAction(layout, byId.get('S')!, 'cursor')).toEqual({
      action: 'down',
    });
    expect(resolveEditorAction(layout, byId.get('D')!, 'cursor')).toEqual({
      action: 'right',
    });
    // A letter outside the WASD cluster falls back to typing itself in CURSOR
    // mode (only W/A/S/D carry the overlay).
    expect(resolveEditorAction(layout, byId.get('F')!, 'cursor')).toEqual({
      insert: 'F',
    });
    // The bottom-row quote key inserts a double quote.
    expect(resolveEditorAction(layout, byId.get('Quote')!, 'base')).toEqual({
      insert: '"',
    });
  });
});

describe('cpc464 keyboard matrix coverage', () => {
  const matrixTokens = new Set<string>();
  for (const line of MATRIX) for (const t of line) if (t) matrixTokens.add(t);
  const virtualTokens = new Set(allKeys.flatMap((k) => k.emits));
  const physicalTokens = new Set(Object.values(CODE_TO_TOKEN));

  it('only emits tokens that are real matrix cells the emulator decodes', () => {
    const kb = new CpcKeyboard();
    for (const tok of virtualTokens) {
      expect(matrixTokens.has(tok), tok).toBe(true);
      // setKey must actually pull a cell low (nothing orphaned/misspelt).
      kb.releaseAll();
      kb.setKey(tok, true);
      const pressed = Array.from({ length: 10 }, (_, l) => kb.readLine(l)).some(
        (b) => b !== 0xff,
      );
      expect(pressed, tok).toBe(true);
    }
  });

  it('the physical + virtual union reaches every non-joystick cell', () => {
    for (const tok of matrixTokens) {
      // The joystick row (row 9 directions/fire) is driven by setJoystick
      // (Stage 6), not the keyboard; everything else must be typeable.
      if (tok.startsWith('Joy')) continue;
      expect(physicalTokens.has(tok) || virtualTokens.has(tok), tok).toBe(true);
    }
  });

  it('covers the full alphabet, digits and function keys on the layout', () => {
    for (let c = 65; c <= 90; c++) {
      expect(virtualTokens.has(String.fromCharCode(c)), `letter ${c}`).toBe(
        true,
      );
    }
    for (let d = 0; d <= 9; d++) {
      expect(virtualTokens.has(`Digit${d}`), `Digit${d}`).toBe(true);
      expect(virtualTokens.has(`F${d}`), `F${d}`).toBe(true);
    }
  });
});

describe('cpc464 controller', () => {
  it('binds every role to a real key that drives the joystick matrix', () => {
    const cfg = layout.controller!;
    for (const role of CONTROLLER_ROLES) {
      const id = cfg.bindings[role];
      expect(id, role).toBeDefined();
      const def = byId.get(id!);
      expect(def, `${role} -> ${id}`).toBeDefined();
      expect(def!.emits.length, id).toBeGreaterThan(0);
    }
  });

  it('steers with the cursor cluster via controller-only keys', () => {
    const cfg = layout.controller!;
    const renderedIds = new Set(
      [...layout.rows.flat(), ...(layout.functionKeys ?? [])].map((k) => k.id),
    );
    // The directions bind to the real CursorUp/… matrix cells, which live in
    // controllerKeys and are never drawn as keycaps (the CURSOR overlay is on
    // WASD instead).
    for (const [role, token] of [
      ['up', 'CursorUp'],
      ['down', 'CursorDown'],
      ['left', 'CursorLeft'],
      ['right', 'CursorRight'],
    ] as const) {
      expect(cfg.bindings[role]).toBe(token);
      expect(renderedIds.has(token), `${token} not rendered`).toBe(false);
      expect(byId.get(token)!.emits).toEqual([token]);
    }
  });
});
