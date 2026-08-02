import { describe, expect, it, beforeAll } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';
import { makeCharsAtom } from 'jsbeeb/src/6847_fontdata.js';
import { sextantChar } from './charset';
import { sextantGlyph } from '../sextants';
import { tokenizeProgram } from './tokenizer';
import {
  AtomMachine,
  configureNodeRomPath,
} from '../../emulator/atom/atomMachine';

/**
 * The two facts the audit cites for the Atom, each pinned against the thing it
 * claims about rather than against a comment:
 *
 *  - the MC6847 draws screen code 0x40 + p as Semigraphics-6 pattern p, with
 *    the six cells numbered bit 5 top-left … bit 0 bottom-right;
 *  - the Atom kernel's write-character routine sends program byte 0xA0 + p to
 *    that screen code, so PRINTing the byte from a string literal draws the
 *    cell.
 *
 * The first is checked against the glyph table the IDE's own emulator draws
 * with, the second against the real Atom ROM, in the spirit of
 * `src/dialects/bbcmicro/mode7Graphics.test.ts` and
 * `src/dialects/sinclairGraphics.test.ts`.
 */

/** Program bytes the kernel maps onto the 64 Semigraphics-6 cells. */
const SG6_FIRST = 0xa0;
const SG6_LAST = 0xdf;

/** Screen code the kernel's WRCH produces for a program byte. */
const screenCodeFor = (code: number): number => code + 0x20;

const glyphs = makeCharsAtom();

/**
 * The six 2×3 cells as the MC6847 font draws them on the 8×12 grid: four
 * scanlines per band, and within a row byte the left half is bits 4–7 and the
 * right half bits 0–3 (jsbeeb's `blitChar` writes pixels in reverse bit order,
 * so the high bits land on the left). Listed in *Unicode* sextant order — bit
 * 0 top-left through bit 5 bottom-right — so the pattern this builds can go
 * straight into `sextantGlyph`.
 */
const CELLS = [
  { rows: [0, 3], nibble: 0xf0 }, // top-left
  { rows: [0, 3], nibble: 0x0f }, // top-right
  { rows: [4, 7], nibble: 0xf0 }, // middle-left
  { rows: [4, 7], nibble: 0x0f }, // middle-right
  { rows: [8, 11], nibble: 0xf0 }, // bottom-left
  { rows: [8, 11], nibble: 0x0f }, // bottom-right
] as const;

/**
 * The cell bitmap the font lights for a screen code, in Unicode sextant order,
 * insisting each cell is all-or-nothing (a partly-inked cell would mean the
 * entry is a text glyph, not a mosaic).
 */
function litCells(screenCode: number): number {
  const chr = screenCode & 0x7f; // jsbeeb masks bit 7 (the colour set)
  let pattern = 0;
  CELLS.forEach((cell, bit) => {
    const halves: number[] = [];
    for (let r = cell.rows[0]; r <= cell.rows[1]; r++) {
      halves.push(glyphs[chr * 12 + r]! & cell.nibble);
    }
    const solid = halves.every((h) => h === cell.nibble);
    const empty = halves.every((h) => h === 0);
    expect(
      solid || empty,
      `screen code 0x${screenCode.toString(16)} cell ${bit} is not a solid block`,
    ).toBe(true);
    if (solid) pattern |= 1 << bit;
  });
  return pattern;
}

describe('atom Semigraphics-6 mapping vs the MC6847 font', () => {
  it('gives every graphics byte the sextant the emulator actually draws', () => {
    for (let code = SG6_FIRST + 1; code <= SG6_LAST; code++) {
      const drawn = sextantGlyph(litCells(screenCodeFor(code)));
      expect(sextantChar(code), `byte 0x${code.toString(16)}`).toBe(drawn);
    }
  });

  it('draws nothing for the blank cell 0xA0, which is why it has no character', () => {
    expect(litCells(screenCodeFor(SG6_FIRST))).toBe(0);
    expect(sextantChar(SG6_FIRST)).toBeUndefined();
  });

  it('numbers the cells bit 5 top-left … bit 0 bottom-right', () => {
    // The single-cell patterns, read off the font: the MC6847 counts the six
    // cells in the exact reverse of Unicode's order, which is what makes the
    // charset's permutation a plain six-bit reversal.
    const cellOfBit = [5, 4, 3, 2, 1, 0].map((bit) =>
      litCells(0x40 + (1 << bit)),
    );
    expect(cellOfBit).toEqual([1, 2, 4, 8, 16, 32]);
  });

  it('covers all 64 patterns exactly once across 0xA0-0xDF', () => {
    const seen = new Set<number>();
    for (let code = SG6_FIRST; code <= SG6_LAST; code++) {
      seen.add(litCells(screenCodeFor(code)));
    }
    expect(seen.size).toBe(64);
  });

  it('repeats the top half of the set at 0xE0-0xFF in the other colour', () => {
    // Why those 32 bytes keep their {0xNN} escapes: the kernel sends them to
    // screen codes 0x60-0x7F, the same shapes as 0xC0-0xDF, and two bytes
    // cannot share one character.
    for (let code = 0xe0; code <= 0xff; code++) {
      expect(litCells(code - 0x80)).toBe(litCells(screenCodeFor(code - 0x20)));
      expect(sextantChar(code)).toBeUndefined();
    }
  });
});

// The kernel-ROM probe needs the real ROM, which jsbeeb ships in its package.
beforeAll(() => {
  const require = createRequire(import.meta.url);
  const utilsPath = require.resolve('jsbeeb/src/utils.js');
  configureNodeRomPath(path.dirname(path.dirname(utilsPath)));
});

/** Screen RAM as raw MC6847 codes. */
function screenCodes(machine: AtomMachine): Uint8Array {
  const out = new Uint8Array(0x400);
  for (let i = 0; i < out.length; i++) {
    out[i] = machine.processor.readmem(0x8000 + i)!;
  }
  return out;
}

/** The MC6847 screen code for a space - what an empty cell holds. */
const SCREEN_SPACE = 0x20;

/**
 * Blank screen RAM before the machine runs.
 *
 * jsbeeb's 6502 reset fills 0x8000-0x8FFF with `Math.random()` bytes to mimic
 * uninitialised hardware - and on an Atom that range *is* the screen. So the
 * search below would otherwise be hunting its two marker codes through a
 * kilobyte of random noise, and roughly one run in sixty found them there: a
 * stray 0xC1 with a stray 0xFF sixty-two cells later ended the loop on a row of
 * garbage, long before the program had printed anything.
 *
 * Clearing it restores what the search assumes - that every code on screen was
 * put there by the ROM - which is what makes finding the first and last cells
 * mean the whole run has been drawn.
 */
function blankScreen(machine: AtomMachine): void {
  for (let i = 0; i < 0x400; i++) {
    machine.processor.writemem(0x8000 + i, SCREEN_SPACE);
  }
}

describe('atom Semigraphics-6 mapping vs the real kernel ROM', () => {
  it('PRINTs each graphics byte as its Semigraphics-6 screen code', async () => {
    // One PRINT of all 64 bytes: the ROM's WRCH is what decides whether these
    // are graphics at all, so the declaration is defended by the machine.
    const bytes: number[] = [];
    for (let code = SG6_FIRST; code <= SG6_LAST; code++) bytes.push(code);

    // Build the source through the charset so the test exercises the same path
    // the editor does: sextants in, bytes out (0xA0 has only its escape).
    const text = bytes
      .map(
        (code) => sextantChar(code) ?? `{0x${code.toString(16).toUpperCase()}}`,
      )
      .join('');
    const { bytes: image, errors } = tokenizeProgram(
      `10 PRINT "${text}"\n20 END\n`,
    );
    expect(errors).toEqual([]);

    const machine = new AtomMachine();
    await machine.whenReady();
    machine.loadProgram(image);
    blankScreen(machine);

    // Run until the 64 cells appear on screen: the first graphics screen code
    // is 0xC0, which nothing in the boot banner produces. PRINT draws the row
    // left to right, so the last cell being present means every cell is.
    let row: Uint8Array | undefined;
    for (let i = 0; i < 900 && row === undefined; i++) {
      machine.runFrame();
      const screen = screenCodes(machine);
      const at = screen.indexOf(screenCodeFor(SG6_FIRST + 1));
      if (at !== -1 && screen[at + 62] === screenCodeFor(SG6_LAST)) {
        // The run starts one cell earlier (0xA0's screen code is 0xC0).
        row = screen.slice(at - 1, at + 63);
      }
      if (i % 10 === 0) await new Promise((r) => setTimeout(r, 0));
    }
    machine.dispose();

    expect(row, 'the printed graphics row never appeared').toBeDefined();
    expect(Array.from(row!)).toEqual(bytes.map(screenCodeFor));
  }, 60000);
});
