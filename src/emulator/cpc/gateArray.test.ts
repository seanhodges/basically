import { describe, expect, it } from 'vitest';
import { GateArray, FIRMWARE_INK_RGB, HW_TO_FIRMWARE_INK } from './gateArray';

describe('GateArray palette', () => {
  it('has 27 distinct firmware inks over the 3×3×3 level cube', () => {
    const levels = new Set<number>();
    for (const [r, g, b] of FIRMWARE_INK_RGB) {
      levels.add(r);
      levels.add(g);
      levels.add(b);
    }
    expect(FIRMWARE_INK_RGB).toHaveLength(27);
    expect([...levels].sort((a, b) => a - b)).toEqual([0, 128, 255]);
    const unique = new Set(FIRMWARE_INK_RGB.map((c) => c.join(',')));
    expect(unique.size).toBe(27); // every ink is a different colour
  });

  it('maps all 32 hardware colours onto valid firmware inks', () => {
    expect(HW_TO_FIRMWARE_INK).toHaveLength(32);
    for (const ink of HW_TO_FIRMWARE_INK) {
      expect(ink).toBeGreaterThanOrEqual(0);
      expect(ink).toBeLessThan(27);
    }
    // Exactly 27 of the 32 hardware codes are distinct (5 duplicate colours).
    expect(new Set(HW_TO_FIRMWARE_INK).size).toBe(27);
  });

  it('matches known hardware-colour RGB values (cpctech/grimware)', () => {
    const ga = new GateArray();
    const hwRgb = (hw: number) => {
      ga.writePort(0x00); // select pen 0
      ga.writePort(0x40 | hw); // colour hw
      return ga.penRgb(0);
    };
    expect(hwRgb(20)).toEqual([0, 0, 0]); // hardware 20 = Black
    expect(hwRgb(4)).toEqual([0, 0, 128]); // hardware 4 = Blue
    expect(hwRgb(11)).toEqual([255, 255, 255]); // hardware 11 = Bright White
    expect(hwRgb(12)).toEqual([255, 0, 0]); // hardware 12 = Bright Red
  });

  it('sets a pen colour via pen-select then colour-select', () => {
    const ga = new GateArray();
    ga.writePort(0x00 | 2); // select pen 2
    ga.writePort(0x40 | 5); // hardware colour 5
    expect(ga.hardwareColour(2)).toBe(5);
    const [r, g, b] = ga.penRgb(2);
    expect(FIRMWARE_INK_RGB[HW_TO_FIRMWARE_INK[5]!]).toEqual([r, g, b]);
  });

  it('routes bit 4 of a pen-select to the border (pen 16)', () => {
    const ga = new GateArray();
    ga.writePort(0x00 | 0x10); // select border
    ga.writePort(0x40 | 7);
    expect(ga.hardwareColour(16)).toBe(7);
    expect(ga.borderRgb()).toEqual(ga.penRgb(16));
  });
});

describe('GateArray mode + ROM byte', () => {
  it('decodes the screen mode from bits 0-1', () => {
    const ga = new GateArray();
    ga.writePort(0x80 | 0); // mode 0
    expect(ga.mode).toBe(0);
    ga.writePort(0x80 | 2); // mode 2
    expect(ga.mode).toBe(2);
  });

  it('toggles each ROM overlay from bits 2 (lower) and 3 (upper)', () => {
    const ga = new GateArray();
    ga.writePort(0x80); // both bits clear → both enabled
    expect(ga.lowerRomEnabled).toBe(true);
    expect(ga.upperRomEnabled).toBe(true);
    ga.writePort(0x80 | 0x04); // disable lower
    expect(ga.lowerRomEnabled).toBe(false);
    expect(ga.upperRomEnabled).toBe(true);
    ga.writePort(0x80 | 0x08); // disable upper only
    expect(ga.lowerRomEnabled).toBe(true);
    expect(ga.upperRomEnabled).toBe(false);
  });
});

describe('GateArray raster interrupt', () => {
  it('fires every 52 HSYNCs (six times over a 312-line frame)', () => {
    const ga = new GateArray();
    ga.reset();
    let fires = 0;
    for (let line = 0; line < 312; line++) {
      // No VSYNC pulse in this synthetic sweep; pure 52-line counting.
      if (ga.onHsync(false)) fires++;
    }
    expect(fires).toBe(6);
  });

  it('marks an interrupt pending and clears it on acknowledge', () => {
    const ga = new GateArray();
    ga.reset();
    for (let i = 0; i < 52; i++) ga.onHsync(false);
    expect(ga.interruptPending).toBe(true);
    ga.acknowledgeInterrupt();
    expect(ga.interruptPending).toBe(false);
  });

  it('resets the counter (and pending) when the mode/ROM byte bit 4 is set', () => {
    const ga = new GateArray();
    ga.reset();
    for (let i = 0; i < 51; i++) ga.onHsync(false); // one short of firing
    ga.writePort(0x80 | 0x10); // interrupt-reset bit
    expect(ga.interruptPending).toBe(false);
    // Counter is back to zero, so it now takes a full 52 more lines to fire.
    let fired = false;
    for (let i = 0; i < 52; i++) fired = ga.onHsync(false) || fired;
    expect(fired).toBe(true);
  });

  it('generates a resync interrupt at VSYNC only when the count is below 32', () => {
    // Count < 32 at the VSYNC+2 check → an extra interrupt fires and resets.
    const low = new GateArray();
    low.reset();
    for (let i = 0; i < 10; i++) low.onHsync(false); // counter = 10
    low.onHsync(true); // VSYNC rising edge, arms the 2-line delay
    low.onHsync(true); // 1
    expect(low.onHsync(true)).toBe(true); // 2 → resync fires (10 < 32)

    // Count >= 32 at the check → no extra interrupt, just a reset.
    const high = new GateArray();
    high.reset();
    for (let i = 0; i < 40; i++) high.onHsync(false); // counter = 40
    high.onHsync(true);
    high.onHsync(true);
    expect(high.onHsync(true)).toBe(false); // 40 >= 32 → suppressed
  });

  it('clears bit 5 of the counter on acknowledge', () => {
    const ga = new GateArray();
    ga.reset();
    // Drive to a count with bit 5 set (>=32) without hitting 52.
    for (let i = 0; i < 40; i++) ga.onHsync(false);
    ga.acknowledgeInterrupt();
    // After clearing bit 5, count is 40 & 0x1F = 8, so 44 more lines to fire.
    let lines = 0;
    while (!ga.onHsync(false)) lines++;
    expect(lines).toBe(52 - 8 - 1);
  });
});
