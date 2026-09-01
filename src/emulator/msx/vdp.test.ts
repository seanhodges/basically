import { describe, expect, it } from 'vitest';
import {
  REGISTER_COUNT,
  STATUS_COLLISION,
  STATUS_FIFTH_SPRITE,
  STATUS_FRAME,
  Tms9918,
  VRAM_SIZE,
  type VdpMode,
} from './vdp';
import type { MsxModel } from './model';

const MODEL: MsxModel = {
  ramKb: 64,
  ramSlot: 3,
  region: 'pal',
  vdp: 't6950',
  keyboardId: 'international',
  slot0Page3: 'ram-mirror',
};

const vdp = (): Tms9918 => {
  const chip = new Tms9918(MODEL);
  chip.reset();
  return chip;
};

/** Port 0x99's two-byte pair: write a register. */
function setRegister(chip: Tms9918, reg: number, value: number): void {
  chip.writeControl(value);
  chip.writeControl(0x80 | reg);
}

/** Port 0x99's two-byte pair: point the data port at `addr` for writing. */
function setWriteAddress(chip: Tms9918, addr: number): void {
  chip.writeControl(addr & 0xff);
  chip.writeControl(0x40 | ((addr >> 8) & 0x3f));
}

function setReadAddress(chip: Tms9918, addr: number): void {
  chip.writeControl(addr & 0xff);
  chip.writeControl((addr >> 8) & 0x3f);
}

describe('Tms9918 ports', () => {
  it('writes VRAM through the auto-incrementing address latch', () => {
    const chip = vdp();
    setWriteAddress(chip, 0x1234);
    for (const b of [1, 2, 3]) chip.writeData(b);
    expect([...chip.vram.subarray(0x1234, 0x1237)]).toEqual([1, 2, 3]);
  });

  it('reads a byte behind the CPU, as the read-ahead latch makes it', () => {
    const chip = vdp();
    chip.vram.set([0x11, 0x22, 0x33], 0x0100);
    // Setting a read address prefetches, so the first read is the right byte.
    setReadAddress(chip, 0x0100);
    expect(chip.readData()).toBe(0x11);
    expect(chip.readData()).toBe(0x22);
    expect(chip.readData()).toBe(0x33);
  });

  it('wraps the address within the 16KB the standard fits', () => {
    const chip = vdp();
    setWriteAddress(chip, VRAM_SIZE - 1);
    chip.writeData(0xaa);
    chip.writeData(0xbb);
    expect(chip.vram[VRAM_SIZE - 1]).toBe(0xaa);
    expect(chip.vram[0]).toBe(0xbb);
  });

  it('writes registers, and ignores writes past the eight it has', () => {
    const chip = vdp();
    setRegister(chip, 7, 0xf4);
    expect(chip.registers[7]).toBe(0xf4);
    expect(chip.textColour).toBe(0x0f);
    expect(chip.backdropColour).toBe(0x04);
    // The register number is three bits wide, so there is nothing above 7 to
    // reach and a write there must not run off the end of the register file.
    setRegister(chip, REGISTER_COUNT, 0x99);
    expect(chip.registers.length).toBe(REGISTER_COUNT);
  });

  it('clears the frame and collision flags on a status read', () => {
    const chip = vdp();
    chip.endActiveDisplay();
    chip.reportSprites(true, 7);
    const status = chip.readStatus();
    expect(status & STATUS_FRAME).toBe(STATUS_FRAME);
    expect(status & STATUS_COLLISION).toBe(STATUS_COLLISION);
    expect(status & STATUS_FIFTH_SPRITE).toBe(STATUS_FIFTH_SPRITE);
    expect(status & 0x1f).toBe(7); // the fifth sprite's number
    // The three flags clear; the fifth sprite's number is not a flag and stays
    // in the low bits, where it means nothing until 5S is set again.
    expect(chip.readStatus() & 0xe0).toBe(0);
  });

  it('raises the interrupt only while the flag stands and register 1 enables it', () => {
    const chip = vdp();
    chip.endActiveDisplay();
    expect(chip.irq).toBe(false); // interrupts still disabled
    setRegister(chip, 1, 0x20);
    expect(chip.irq).toBe(true);
    chip.readStatus();
    expect(chip.irq).toBe(false);
  });

  it('abandons a half-written address pair on a status read', () => {
    const chip = vdp();
    setWriteAddress(chip, 0x0010);
    chip.writeControl(0x99); // first byte of a pair...
    chip.readStatus(); // ...which this discards
    chip.writeControl(0x40); // so this is a first byte, not a second
    chip.writeControl(0x40);
    chip.writeData(0x5a);
    expect(chip.vram[0x0040]).toBe(0x5a);
  });
});

describe('Tms9918 modes', () => {
  it('decodes each documented mode from M1, M2 and M3', () => {
    const rows: [number, number, VdpMode][] = [
      // [register 0, register 1, mode]
      [0x00, 0x00, 'graphic1'],
      [0x02, 0x00, 'graphic2'],
      [0x00, 0x08, 'multicolour'],
      [0x00, 0x10, 'text'],
      // Two mode bits at once is an undocumented mixed mode the T6950 in this
      // machine does not implement, so it is named rather than approximated.
      [0x02, 0x10, 'undocumented'],
      [0x00, 0x18, 'undocumented'],
    ];
    for (const [r0, r1, mode] of rows) {
      const chip = vdp();
      setRegister(chip, 0, r0);
      setRegister(chip, 1, r1);
      expect(chip.mode, `R0=${r0} R1=${r1}`).toBe(mode);
    }
  });

  it('splits registers 3 and 4 differently in graphic 2', () => {
    const chip = vdp();
    setRegister(chip, 2, 0x06); //  name table at 0x1800
    setRegister(chip, 3, 0xff);
    setRegister(chip, 4, 0x03);
    expect(chip.mode).toBe('graphic1');
    expect(chip.nameTable).toBe(0x1800);
    expect(chip.colourTable).toBe(0x3fc0);
    expect(chip.patternTable).toBe(0x1800);

    // The same registers in graphic 2 - MSX BASIC's own SCREEN 2 setting -
    // mean a half each and a fully open mask, not a base address.
    setRegister(chip, 0, 0x02);
    expect(chip.mode).toBe('graphic2');
    expect(chip.colourTable).toBe(0x2000);
    expect(chip.patternTable).toBe(0x0000);
    expect(chip.patternMask).toBe(0x3ff);
    expect(chip.colourMask).toBe(0x3ff);
  });

  it('narrows the graphic 2 masks when a program closes a bank', () => {
    const chip = vdp();
    setRegister(chip, 0, 0x02);
    setRegister(chip, 3, 0x80);
    setRegister(chip, 4, 0x00);
    expect(chip.patternMask).toBe(0x0ff);
    expect(chip.colourMask).toBe(0x007);
  });

  it('has no sprites in text mode', () => {
    const chip = vdp();
    setRegister(chip, 1, 0x10);
    expect(chip.spritesVisible).toBe(false);
    setRegister(chip, 1, 0x00);
    expect(chip.spritesVisible).toBe(true);
  });
});
