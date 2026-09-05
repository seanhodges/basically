import { describe, it, expect } from 'vitest';
import { SamKeyboard, SAMCOUPE_KEY_TOKENS } from './keyboard';

/** The row-select high byte that selects matrix row `r` alone. */
const selectRow = (r: number) => 0xff & ~(1 << r);

describe('samcoupe keyboard', () => {
  it('reads the low five bits of a row on the keyboard port', () => {
    const kb = new SamKeyboard();
    // Row 0 is the Spectrum's own: SHIFT, Z, X, C, V on bits 0-4.
    expect(kb.readKeyPort(selectRow(0))).toBe(0x1f);
    kb.setKey('KeyZ', true);
    expect(kb.readKeyPort(selectRow(0))).toBe(0x1f & ~0x02);
    // A row nobody selected reads clear of it.
    expect(kb.readKeyPort(selectRow(1))).toBe(0x1f);
    kb.setKey('KeyZ', false);
    expect(kb.readKeyPort(selectRow(0))).toBe(0x1f);
  });

  it('reads the top three bits of a row on the status port', () => {
    const kb = new SamKeyboard();
    // The keys the Spectrum's five-bit matrix had no room for live here: F1-F9,
    // ESC, TAB, CAPS, DELETE, EDIT and INV.
    expect(kb.readStatusKeys(selectRow(3))).toBe(0xe0);
    kb.setKey('Escape', true);
    expect(kb.readStatusKeys(selectRow(3))).toBe(0xe0 & ~0x20);
    // The same press is invisible on the keyboard port, which only carries
    // bits 0-4.
    expect(kb.readKeyPort(selectRow(3))).toBe(0x1f);
  });

  it('puts the cursor cluster in a row of its own, reached with no row selected', () => {
    const kb = new SamKeyboard();
    kb.setKey('ArrowLeft', true);
    // Row 8 answers only when no address line is pulled low.
    expect(kb.readKeyPort(0xff)).toBe(0x1f & ~0x08);
    expect(kb.readKeyPort(selectRow(0))).toBe(0x1f);
    // And it is not reachable on the status port at all.
    expect(kb.readStatusKeys(0xff)).toBe(0xe0);
  });

  it('maps host key codes the SAM spells differently', () => {
    const kb = new SamKeyboard();
    const press = (code: string) =>
      kb.handleKey({ code } as KeyboardEvent, true);
    // Both host control keys reach the SAM's single CONTROL.
    expect(press('ControlRight')).toBe(true);
    expect(kb.readKeyPort(0xff)).toBe(0x1f & ~0x01);
    // A key this machine has no equivalent for is not consumed, so the host
    // keeps it.
    expect(kb.handleKey({ code: 'F13' } as KeyboardEvent, true)).toBe(false);
  });

  it('wires the joystick onto the keys the SAM reads it as', () => {
    const kb = new SamKeyboard();
    const off = {
      up: false,
      down: false,
      left: false,
      right: false,
      fire1: false,
      fire2: false,
    };
    // Left is key 6 and fire is key 0, both in row 4 - the same wiring the
    // Sinclair interface used, and why a SAM program can read the stick by
    // reading those keys.
    kb.setJoystick({ ...off, left: true, fire1: true });
    expect(kb.readKeyPort(selectRow(4))).toBe(0x1f & ~0x11);
    // Releasing a key does not release the stick, and vice versa.
    kb.setKey('Digit9', true);
    expect(kb.readKeyPort(selectRow(4))).toBe(0x1f & ~0x13);
    kb.setJoystick(off);
    expect(kb.readKeyPort(selectRow(4))).toBe(0x1f & ~0x02);
  });

  it('names every key the matrix can press exactly once', () => {
    // The layout is built against this list, so a duplicate token would give
    // two keycaps the same matrix position without either being wrong.
    expect(new Set(SAMCOUPE_KEY_TOKENS).size).toBe(SAMCOUPE_KEY_TOKENS.length);
    expect(SAMCOUPE_KEY_TOKENS).toHaveLength(69);
  });
});
