import { describe, it, expect } from 'vitest';
import {
  BORDER_SCREEN_OFF,
  INT_ACTIVE_CYCLES,
  PALETTE_COLOURS,
  SamAsic,
  STATUS_INT_FRAME,
  STATUS_INT_LINE,
  STATUS_INT_NONE,
  SCREEN_LINES,
  TOP_BORDER_LINES,
  borderClutIndex,
  paletteRgb,
} from './asic';

describe('samcoupe asic', () => {
  it('decodes the 128-colour palette from the index bits', () => {
    // Every component is three bits, and bit 3 is the half-step all three
    // share - which is what makes the palette pairs of the same hue rather
    // than a hue plus a brightness control.
    expect(paletteRgb(0)).toEqual([0, 0, 0]);
    expect(paletteRgb(0x7f)).toEqual([255, 255, 255]);
    // The same white without the shared half-step is a step dimmer everywhere.
    expect(paletteRgb(0x77)).toEqual([219, 219, 219]);
    expect(paletteRgb(0x02)).toEqual([73, 0, 0]); // red alone, level 2 of 7
    expect(paletteRgb(0x04)).toEqual([0, 73, 0]);
    expect(paletteRgb(0x01)).toEqual([0, 0, 73]);
    // Bit 3 lifts all three by one step at once.
    expect(paletteRgb(0x08)).toEqual([36, 36, 36]);
    // Only seven bits are decoded; anything above wraps.
    expect(paletteRgb(PALETTE_COLOURS + 0x02)).toEqual(paletteRgb(0x02));
  });

  it('takes the CLUT index off the port`s high byte, not the data', () => {
    const asic = new SamAsic();
    asic.writePort(0x0af8, 0x77);
    expect(asic.clut[10]).toBe(0x77);
    // The value is seven bits; the eighth is not a colour.
    asic.writePort(0x00f8, 0xff);
    expect(asic.clut[0]).toBe(0x7f);
  });

  it('reads the mode and the display page out of VMPR', () => {
    const asic = new SamAsic();
    asic.writePort(0xfc, 0x00 | 7);
    expect(asic.mode).toBe(1);
    expect(asic.screenPage).toBe(7);
    // Modes 3 and 4 need 24K, which spans two pages, so the ASIC ignores the
    // page field's bottom bit for them.
    asic.writePort(0xfc, 0x60 | 7);
    expect(asic.mode).toBe(4);
    expect(asic.screenPage).toBe(6);
  });

  it('blanks the screen only in the modes whose fetch can be turned off', () => {
    const asic = new SamAsic();
    asic.writePort(0xfc, 0x60); // MODE 4
    asic.writePort(0xfe, BORDER_SCREEN_OFF);
    expect(asic.screenOff).toBe(true);
    // The same bit in a 16K mode does nothing: there are no contended cycles
    // to buy back there.
    asic.writePort(0xfc, 0x00); // MODE 1
    expect(asic.screenOff).toBe(false);
  });

  it('splits the border colour across bits 0-2 and bit 5', () => {
    expect(borderClutIndex(0x00)).toBe(0);
    expect(borderClutIndex(0x07)).toBe(7);
    expect(borderClutIndex(0x20)).toBe(8);
    expect(borderClutIndex(0x27)).toBe(15);
    // Everything else on the port - the speaker, the tape output, screen-off -
    // is not part of the colour.
    expect(borderClutIndex(0xd8)).toBe(0);
  });

  it('holds each interrupt source low for its own window', () => {
    const asic = new SamAsic();
    expect(asic.interruptPending).toBe(false);

    asic.raiseInterrupt(STATUS_INT_FRAME, 0);
    expect(asic.status & STATUS_INT_FRAME).toBe(0);
    expect(asic.interruptPending).toBe(true);

    // A line interrupt raised inside the frame interrupt's window is visible
    // beside it: the handler tells them apart by reading the status port, so
    // both bits have to be readable at once.
    asic.raiseInterrupt(STATUS_INT_LINE, 64);
    expect(asic.status & (STATUS_INT_FRAME | STATUS_INT_LINE)).toBe(0);

    // Each is let go on its own schedule.
    asic.releaseExpiredInterrupts(INT_ACTIVE_CYCLES);
    expect(asic.status & STATUS_INT_FRAME).toBe(STATUS_INT_FRAME);
    expect(asic.status & STATUS_INT_LINE).toBe(0);
    asic.releaseExpiredInterrupts(64 + INT_ACTIVE_CYCLES);
    expect(asic.status).toBe(STATUS_INT_NONE);
    expect(asic.interruptPending).toBe(false);
  });

  it('times the line interrupt against the top border', () => {
    const asic = new SamAsic();
    const cyclesPerLine = 384;
    // Nothing armed after a reset: the register reads 0xFF, which is past the
    // last display line.
    expect(asic.lineInterruptCycle(cyclesPerLine)).toBeNull();
    asic.writePort(0xf9, 0);
    expect(asic.lineInterruptCycle(cyclesPerLine)).toBe(
      TOP_BORDER_LINES * cyclesPerLine,
    );
    asic.writePort(0xf9, SCREEN_LINES - 1);
    expect(asic.lineInterruptCycle(cyclesPerLine)).toBe(
      (SCREEN_LINES - 1 + TOP_BORDER_LINES) * cyclesPerLine,
    );
    asic.writePort(0xf9, SCREEN_LINES);
    expect(asic.lineInterruptCycle(cyclesPerLine)).toBeNull();
  });
});
