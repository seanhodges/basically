import { describe, expect, it } from 'vitest';
import { readScreenText } from './screenText';
import { Tms9918 } from './vdp';
import { hb10pCharset } from '../../dialects/hb10p/charset';
import type { MsxModel } from './model';

const MODEL: MsxModel = {
  ramKb: 64,
  ramSlot: 3,
  region: 'pal',
  vdp: 't6950',
  keyboardId: 'international',
  slot0Page3: 'ram-mirror',
};

/** A chip in `mode` with `text` written across the top of its name table. */
function withText(register1: number, text: number[]): Tms9918 {
  const chip = new Tms9918(MODEL);
  chip.reset();
  chip.registers[1] = 0x40 | register1;
  chip.vram.fill(0x20);
  chip.vram.set(text, 0);
  return chip;
}

const read = (chip: Tms9918) => readScreenText(chip, hb10pCharset);
const ascii = (s: string): number[] => [...s].map((c) => c.charCodeAt(0));

describe('readScreenText', () => {
  it('reads 40 columns in text mode and 32 in graphic 1', () => {
    const text = read(withText(0x10, ascii('HELLO')))!;
    expect(text.cols).toBe(40);
    expect(text.rows).toBe(24);
    expect(text.lines).toHaveLength(24);
    expect(text.lines[0]).toBe('HELLO'.padEnd(40));

    const graphic1 = read(withText(0x00, ascii('HELLO')))!;
    expect(graphic1.cols).toBe(32);
    expect(graphic1.lines[0]).toBe('HELLO'.padEnd(32));
    // Row 1 starts 32 cells on, not 40: a reader using the wrong stride would
    // return text that drifts a column further left down the screen.
    expect(graphic1.lines[1]).toBe(' '.repeat(32));
  });

  it('has no answer in the modes that hold no characters', () => {
    expect(read(withText(0x08, []))).toBe(null); // multicolour
    const graphic2 = new Tms9918(MODEL);
    graphic2.reset();
    graphic2.registers[0] = 0x02;
    graphic2.registers[1] = 0x40;
    expect(read(graphic2)).toBe(null);
  });

  it('follows the name table wherever register 2 points it', () => {
    const chip = withText(0x10, []);
    chip.registers[2] = 0x06; // 0x1800
    chip.vram.set(ascii('MOVED'), 0x1800);
    expect(read(chip)!.lines[0]!.trimEnd()).toBe('MOVED');
  });

  it('decodes through the dialect charset, blanking a code with no character', () => {
    // 0x9C is the pound sign on this machine's international set, and 0xFF is
    // the cursor cell, which has no character to stand for it.
    const chip = withText(0x10, [0x9c, 0x41, 0xff, 0x3f]);
    const line = read(chip)!.lines[0]!;
    expect(line.slice(0, 4)).toBe('£A ?');
    // Every row is exactly `cols` code points, blanked cells included.
    for (const row of read(chip)!.lines) expect([...row]).toHaveLength(40);
  });
});
