import { describe, expect, it } from 'vitest';
import {
  ACTIVE_HEIGHT,
  ACTIVE_WIDTH,
  BORDER_X,
  BORDER_Y,
  DISPLAY_HEIGHT,
  DISPLAY_WIDTH,
  MsxDisplay,
  TMS9918_PALETTE,
} from './display';
import { Tms9918 } from './vdp';
import type { MsxModel } from './model';

const MODEL: MsxModel = {
  ramKb: 64,
  ramSlot: 3,
  region: 'pal',
  vdp: 't6950',
  keyboardId: 'international',
  slot0Page3: 'ram-mirror',
};

/** A chip with the display and the given registers on, ready to be drawn. */
function chipWith(registers: Partial<Record<number, number>>): Tms9918 {
  const chip = new Tms9918(MODEL);
  chip.reset();
  chip.registers[1] = 0x40; // display enabled, graphic 1, 8x8 sprites
  for (const [reg, value] of Object.entries(registers)) {
    chip.registers[Number(reg)] = value!;
  }
  return chip;
}

function draw(chip: Tms9918): {
  frame: Uint8ClampedArray;
  colourAt: (x: number, y: number) => string;
} {
  const frame = new Uint8ClampedArray(DISPLAY_WIDTH * DISPLAY_HEIGHT * 4);
  new MsxDisplay().render(chip, frame);
  return {
    frame,
    colourAt: (x, y) => {
      const i = (y * DISPLAY_WIDTH + x) * 4;
      return `${frame[i]},${frame[i + 1]},${frame[i + 2]}`;
    },
  };
}

const rgb = (colour: number): string => TMS9918_PALETTE[colour]!.join(',');

/** A checkerboard-free pattern whose top row is set and the rest clear. */
const TOP_ROW_ONLY = [0xff, 0, 0, 0, 0, 0, 0, 0];

describe('MsxDisplay geometry', () => {
  it('surrounds the active window with the backdrop colour', () => {
    const chip = chipWith({ 7: 0x04 }); // backdrop dark blue
    const { colourAt } = draw(chip);
    expect(colourAt(0, 0)).toBe(rgb(4));
    expect(colourAt(DISPLAY_WIDTH - 1, DISPLAY_HEIGHT - 1)).toBe(rgb(4));
    expect(colourAt(BORDER_X - 1, BORDER_Y + 10)).toBe(rgb(4));
    expect(DISPLAY_WIDTH).toBe(ACTIVE_WIDTH + 2 * BORDER_X);
    expect(DISPLAY_HEIGHT).toBe(ACTIVE_HEIGHT + 2 * BORDER_Y);
  });

  it('paints the whole frame the backdrop while the display is off', () => {
    const chip = chipWith({ 1: 0x00, 7: 0x06 });
    const { colourAt } = draw(chip);
    expect(colourAt(BORDER_X + 100, BORDER_Y + 100)).toBe(rgb(6));
  });
});

describe('MsxDisplay screen modes', () => {
  it('draws text mode in the two colours of register 7, six pixels wide', () => {
    // Pattern 1 has its top row lit; put one of it at the top-left cell.
    const chip = chipWith({ 0: 0x00, 1: 0x50, 4: 0x01, 7: 0xf4 });
    chip.vram.set(TOP_ROW_ONLY, 0x0800 + 8);
    chip.vram[0] = 1;
    expect(chip.mode).toBe('text');
    const { colourAt } = draw(chip);
    // The 40 six-pixel columns are 240 wide, so they sit eight pixels in.
    const x0 = BORDER_X + (ACTIVE_WIDTH - 240) / 2;
    for (let i = 0; i < 6; i++) {
      expect(colourAt(x0 + i, BORDER_Y)).toBe(rgb(15));
    }
    expect(colourAt(x0 + 6, BORDER_Y)).toBe(rgb(4)); // the next cell, blank
    expect(colourAt(x0, BORDER_Y + 1)).toBe(rgb(4)); // row 1 of the pattern
    expect(colourAt(BORDER_X, BORDER_Y)).toBe(rgb(4)); // the eight-pixel margin
  });

  it('colours graphic 1 a group of eight patterns at a time', () => {
    const chip = chipWith({ 3: 0x01, 4: 0x01, 7: 0x01 });
    // Colour table entry 0 covers patterns 0-7, entry 1 covers 8-15.
    chip.vram[0x0040] = 0x2f; // green on white
    chip.vram[0x0041] = 0x6a; // dark red on dark yellow
    chip.vram.set(TOP_ROW_ONLY, 0x0800 + 1 * 8);
    chip.vram.set(TOP_ROW_ONLY, 0x0800 + 9 * 8);
    chip.vram[0] = 1; // cell 0: pattern 1, so colour entry 0
    chip.vram[1] = 9; // cell 1: pattern 9, so colour entry 1
    const { colourAt } = draw(chip);
    expect(colourAt(BORDER_X, BORDER_Y)).toBe(rgb(2));
    expect(colourAt(BORDER_X, BORDER_Y + 1)).toBe(rgb(15));
    expect(colourAt(BORDER_X + 8, BORDER_Y)).toBe(rgb(6));
    expect(colourAt(BORDER_X + 8, BORDER_Y + 1)).toBe(rgb(10));
  });

  it('colours graphic 2 one pixel row at a time, per bank of the screen', () => {
    // MSX BASIC's own SCREEN 2 setting: names at 0x1800, patterns at 0x0000,
    // colours at 0x2000, with every bank open.
    const chip = chipWith({ 0: 0x02, 2: 0x06, 3: 0xff, 4: 0x03, 7: 0x01 });
    expect(chip.mode).toBe('graphic2');
    // The name table holds 0 everywhere, so each third of the screen reads its
    // own bank: pattern 0, pattern 256 and pattern 512.
    for (const [bank, ink] of [
      [0, 0x20],
      [256, 0x30],
      [512, 0x40],
    ]) {
      chip.vram.set(TOP_ROW_ONLY, bank! * 8);
      chip.vram[0x2000 + bank! * 8] = ink!; // top row's colour, background 0
    }
    const { colourAt } = draw(chip);
    expect(colourAt(BORDER_X, BORDER_Y)).toBe(rgb(2));
    expect(colourAt(BORDER_X, BORDER_Y + 64)).toBe(rgb(3));
    expect(colourAt(BORDER_X, BORDER_Y + 128)).toBe(rgb(4));
  });

  it('draws multicolour as four-pixel blocks, two per pattern byte', () => {
    const chip = chipWith({ 0: 0x00, 1: 0x48, 4: 0x00 });
    expect(chip.mode).toBe('multicolour');

    // Cell 0 holds pattern 0 (the cleared name table already says so), and
    // screen row 0 reads that pattern's first two bytes: byte 0 for the first
    // four pixel rows, byte 1 for the next four.
    chip.registers[4] = 0x01; // patterns at 0x0800, clear of the name table
    chip.vram[0x0800] = 0x2e; // rows 0-3: green then grey
    chip.vram[0x0801] = 0x81; // rows 4-7: medium red then black
    const { colourAt } = draw(chip);
    expect(colourAt(BORDER_X, BORDER_Y)).toBe(rgb(2));
    expect(colourAt(BORDER_X + 4, BORDER_Y + 3)).toBe(rgb(14));
    expect(colourAt(BORDER_X, BORDER_Y + 4)).toBe(rgb(8));
    expect(colourAt(BORDER_X + 4, BORDER_Y + 7)).toBe(rgb(1));
  });
});

describe('MsxDisplay sprites', () => {
  /** Put sprite `s` at (x, y) with pattern `pattern` in colour `ink`. */
  function place(
    chip: Tms9918,
    s: number,
    y: number,
    x: number,
    pattern: number,
    ink: number,
  ): void {
    const attr = chip.spriteAttributeTable + s * 4;
    chip.vram.set([y, x, pattern, ink], attr);
    chip.vram[attr + 4] = 0xd0; // terminate the list after this sprite
  }

  it('draws a sprite one line below its Y attribute', () => {
    const chip = chipWith({ 5: 0x20, 6: 0x01, 7: 0x01 }); // attrs 0x1000, patterns 0x0800
    chip.vram.fill(0xff, 0x0800, 0x0808); // pattern 0: a solid 8x8 block
    place(chip, 0, 40, 60, 0, 15);
    const { colourAt } = draw(chip);
    expect(colourAt(BORDER_X + 60, BORDER_Y + 40)).not.toBe(rgb(15));
    expect(colourAt(BORDER_X + 60, BORDER_Y + 41)).toBe(rgb(15));
    expect(colourAt(BORDER_X + 67, BORDER_Y + 48)).toBe(rgb(15));
    expect(colourAt(BORDER_X + 68, BORDER_Y + 48)).not.toBe(rgb(15));
  });

  it('reports a collision when two sprites overlap, and not when they miss', () => {
    const overlap = (secondX: number): boolean => {
      const chip = chipWith({ 5: 0x20, 6: 0x01 });
      chip.vram.fill(0xff, 0x0800, 0x0808);
      const attrs = chip.spriteAttributeTable;
      chip.vram.set([40, 60, 0, 15], attrs);
      chip.vram.set([40, secondX, 0, 6], attrs + 4);
      chip.vram[attrs + 8] = 0xd0;
      const frame = new Uint8ClampedArray(DISPLAY_WIDTH * DISPLAY_HEIGHT * 4);
      return new MsxDisplay().render(chip, frame).collision;
    };
    expect(overlap(64)).toBe(true);
    expect(overlap(68)).toBe(false);
  });

  it('shows four sprites on a line and latches the fifth', () => {
    const chip = chipWith({ 5: 0x20, 6: 0x01 });
    chip.vram.fill(0xff, 0x0800, 0x0808);
    const attrs = chip.spriteAttributeTable;
    for (let s = 0; s < 5; s++) {
      chip.vram.set([40, 10 + s * 16, 0, 15], attrs + s * 4);
    }
    chip.vram[attrs + 5 * 4] = 0xd0;
    const frame = new Uint8ClampedArray(DISPLAY_WIDTH * DISPLAY_HEIGHT * 4);
    const report = new MsxDisplay().render(chip, frame);
    expect(report.fifthSprite).toBe(4);
    expect(report.collision).toBe(false);
    const at = (x: number): string => {
      const i = ((BORDER_Y + 41) * DISPLAY_WIDTH + BORDER_X + x) * 4;
      return `${frame[i]},${frame[i + 1]},${frame[i + 2]}`;
    };
    expect(at(10 + 3 * 16)).toBe(rgb(15)); // the fourth is drawn
    expect(at(10 + 4 * 16)).not.toBe(rgb(15)); // the fifth is not
  });

  it('takes a 16x16 sprite as two halves of sixteen rows', () => {
    const chip = chipWith({ 1: 0x42, 5: 0x20, 6: 0x01 }); // 16x16 sprites
    // Left half solid, right half clear: bytes 0-15 then 16-31.
    chip.vram.fill(0xff, 0x0800, 0x0810);
    chip.vram.fill(0x00, 0x0810, 0x0820);
    place(chip, 0, 40, 60, 0, 15);
    const { colourAt } = draw(chip);
    expect(colourAt(BORDER_X + 60, BORDER_Y + 56)).toBe(rgb(15)); // row 15
    expect(colourAt(BORDER_X + 68, BORDER_Y + 41)).not.toBe(rgb(15)); // right half
  });

  it('shifts a sprite left by 32 pixels on the early-clock bit', () => {
    const chip = chipWith({ 5: 0x20, 6: 0x01 });
    chip.vram.fill(0xff, 0x0800, 0x0808);
    place(chip, 0, 40, 40, 0, 0x8f); // early clock + white
    const { colourAt } = draw(chip);
    expect(colourAt(BORDER_X + 8, BORDER_Y + 41)).toBe(rgb(15));
    expect(colourAt(BORDER_X + 40, BORDER_Y + 41)).not.toBe(rgb(15));
  });

  it('draws no sprites in text mode', () => {
    const chip = chipWith({ 1: 0x50, 4: 0x01, 5: 0x20, 6: 0x02 });
    chip.vram.fill(0xff, 0x1000, 0x1008);
    place(chip, 0, 40, 60, 0, 15);
    const { colourAt } = draw(chip);
    expect(colourAt(BORDER_X + 60, BORDER_Y + 41)).not.toBe(rgb(15));
  });
});
