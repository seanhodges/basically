import { describe, expect, it } from 'vitest';
import { Crtc, R } from './crtc';

describe('Crtc firmware defaults', () => {
  it('powers on to a 40×25, 312-line frame with 200 active lines', () => {
    const crtc = new Crtc();
    expect(crtc.displayedChars).toBe(40);
    expect(crtc.displayedRows).toBe(25);
    expect(crtc.rastersPerRow).toBe(8);
    expect(crtc.linesPerFrame()).toBe(312);
    expect(crtc.displayedLines()).toBe(200);
  });

  it('places the screen base at &C000 from R12/R13', () => {
    const crtc = new Crtc();
    expect(crtc.startAddress).toBe(0x3000);
    // MA start 0x3000 → CPU A15/A14 = 11 → &C000.
    expect(crtc.byteAddress(0, 0, 0)).toBe(0xc000);
  });

  it('puts VSYNC at char row 30 (scanline 240)', () => {
    const crtc = new Crtc();
    expect(crtc.vsyncStartLine()).toBe(240);
    expect(crtc.inVsync(240)).toBe(true);
    expect(crtc.inVsync(239)).toBe(false);
  });
});

describe('Crtc register access', () => {
  it('latches a register then reads back only R12-R17', () => {
    const crtc = new Crtc();
    crtc.selectRegister(R.START_ADDR_HIGH); // R12 reads back
    crtc.writeData(0x20);
    expect(crtc.readData()).toBe(0x20);
    crtc.selectRegister(R.H_TOTAL); // R0 does not read back
    crtc.writeData(50);
    expect(crtc.readData()).toBe(0);
    expect(crtc.get(R.H_TOTAL)).toBe(50);
  });

  it('ignores writes to the read-only status registers R16/R17', () => {
    const crtc = new Crtc();
    crtc.selectRegister(16);
    crtc.writeData(0xff);
    expect(crtc.get(16)).toBe(0);
  });

  it('follows R12 when the program moves the screen to &4000', () => {
    const crtc = new Crtc();
    crtc.selectRegister(R.START_ADDR_HIGH);
    crtc.writeData(0x10); // MA bits 12-13 = 01 → &4000
    expect(crtc.byteAddress(0, 0, 0)).toBe(0x4000);
  });
});

describe('Crtc CPC screen-address interleave', () => {
  it('steps successive rasters of a char row by &0800', () => {
    const crtc = new Crtc();
    // The eight scanlines of character row 0 sit 0x800 apart (the CPC's
    // classic non-linear screen layout).
    expect(crtc.byteAddress(0, 0, 0)).toBe(0xc000);
    expect(crtc.byteAddress(0, 1, 0)).toBe(0xc800);
    expect(crtc.byteAddress(0, 7, 0)).toBe(0xf800);
  });

  it('steps successive char rows by &0050 (80 bytes/line)', () => {
    const crtc = new Crtc();
    expect(crtc.byteAddress(1, 0, 0)).toBe(0xc000 + 0x50);
    expect(crtc.byteAddress(2, 0, 0)).toBe(0xc000 + 0xa0);
  });

  it('steps character columns by two CPU bytes each', () => {
    const crtc = new Crtc();
    expect(crtc.byteAddress(0, 0, 1)).toBe(0xc002);
    expect(crtc.byteAddress(0, 0, 39)).toBe(0xc000 + 39 * 2);
  });
});
