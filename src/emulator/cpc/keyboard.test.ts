import { describe, expect, it } from 'vitest';
import { CpcKeyboard, MATRIX } from './keyboard';

describe('CpcKeyboard matrix', () => {
  it('reads all lines high (nothing pressed) at power-on', () => {
    const kb = new CpcKeyboard();
    for (let line = 0; line < 10; line++) expect(kb.readLine(line)).toBe(0xff);
  });

  it('pulls exactly one bit low for a pressed key (active-low)', () => {
    const kb = new CpcKeyboard();
    // "A" is line 8, bit 1.
    kb.setKey('A', true);
    expect(kb.readLine(8)).toBe(0xff & ~0b10);
    kb.setKey('A', false);
    expect(kb.readLine(8)).toBe(0xff);
  });

  it('places Return and the keypad Enter on different cells', () => {
    const kb = new CpcKeyboard();
    kb.setKey('Return', true); // line 2, bit 5
    expect(kb.readLine(2) & (1 << 5)).toBe(0);
    kb.setKey('Enter', true); // line 6, bit 7 (keypad)
    expect(kb.readLine(6) & (1 << 7)).toBe(0);
  });

  it('holds several keys at once without cross-talk', () => {
    const kb = new CpcKeyboard();
    kb.setKey('Shift', true); // line 5, bit 5
    kb.setKey('E', true); // line 2, bit 0
    expect(kb.readLine(5) & (1 << 5)).toBe(0);
    expect(kb.readLine(2) & (1 << 0)).toBe(0);
    expect(kb.readLine(0)).toBe(0xff); // untouched line
  });

  it('releaseAll lifts every held key', () => {
    const kb = new CpcKeyboard();
    kb.setKey('Space', true);
    kb.setKey('JoyUp', true);
    kb.releaseAll();
    for (let line = 0; line < 10; line++) expect(kb.readLine(line)).toBe(0xff);
  });
});

describe('CpcKeyboard physical key events', () => {
  it('maps browser codes to matrix keys and consumes them', () => {
    const kb = new CpcKeyboard();
    const ev = { code: 'KeyA' } as KeyboardEvent;
    expect(kb.handleKey(ev, true)).toBe(true);
    expect(kb.readLine(8) & 0b10).toBe(0); // A pressed
    expect(kb.handleKey({ code: 'F13' } as KeyboardEvent, true)).toBe(false);
  });

  it('routes the arrow keys to the cursor cluster', () => {
    const kb = new CpcKeyboard();
    kb.handleKey({ code: 'ArrowUp' } as KeyboardEvent, true); // line 0 bit 7
    expect(kb.readLine(0) & (1 << 7)).toBe(0);
  });
});

describe('CpcKeyboard matrix table', () => {
  it('is 10 lines of 8 cells with unique, valid tokens', () => {
    expect(MATRIX).toHaveLength(10);
    const seen = new Set<string>();
    for (const line of MATRIX) {
      expect(line).toHaveLength(8);
      for (const tok of line) {
        if (tok === null) continue;
        expect(seen.has(tok)).toBe(false); // no token appears twice
        seen.add(tok);
      }
    }
    // The five function keys, joystick and letters are all present.
    for (const t of ['A', 'Z', 'Space', 'Return', 'JoyFire1', 'F0'])
      expect(seen.has(t)).toBe(true);
  });
});
