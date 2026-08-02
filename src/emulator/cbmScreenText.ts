import { screenToPetscii } from '../dialects/glyphSources';
import { petsciiToText } from '../dialects/commodore64/petscii';
import type { MachineScreenText } from '../dialects/types';
import type { CbmScreenLayout } from './c64/reports';

/**
 * Reading a Commodore screen matrix back as characters, shared by the PET, the
 * VIC-20 and the C64 - the whole CBM lineage stores screen *codes* in a
 * rectangular matrix, and only the base address and the matrix size moved
 * between machines.
 *
 * Two conversions stand between a stored byte and a character. Screen codes are
 * not PETSCII ({@link screenToPetscii} is the mapping the KERNAL does on the way
 * in, inverted), and PETSCII is not text ({@link petsciiToText} owns that, and is
 * the same function the editor and the reference pages use - which is what makes
 * a screen read agree with a listing).
 */

/**
 * Which character set the video chip is currently pointing at. The lineage
 * ships two 128-glyph sets in one ROM and switches between them at runtime, and
 * the switch changes what a screen code *means*: in the text set the codes that
 * draw upper-case letters in the graphics set draw lower-case ones instead.
 * A reader that ignored this would report `HELLO` for a screen showing `hello`.
 */
export type CbmCharSet = 'graphics' | 'text';

/**
 * The PETSCII code a screen code stands for in the active set.
 *
 * In the graphics set (the boot default) screen codes 0x01-0x1A are the
 * upper-case letters, and {@link screenToPetscii} maps them straight. The text
 * set moves upper case to 0x41-0x5A and puts lower case where upper case was,
 * so those two ranges swap.
 */
function petsciiFor(screenCode: number, set: CbmCharSet): number | undefined {
  const c = screenCode & 0x7f;
  if (set === 'text') {
    if (c >= 0x01 && c <= 0x1a) return c + 0x60; // lower-case a-z
    if (c >= 0x41 && c <= 0x5a) return c; // upper-case A-Z
  }
  return screenToPetscii(c);
}

/**
 * Decode one screen code to a single character, or a space when it has none.
 *
 * A handful of codes have no glyph of their own - PETSCII keeps them as
 * `{$xx}` escapes rather than characters - and a screen read wants one
 * character per cell, so those read as spaces. Same rule the other machines
 * apply to codes with no printable form.
 */
export function cbmScreenChar(screenCode: number, set: CbmCharSet): string {
  const petscii = petsciiFor(screenCode, set);
  if (petscii === undefined) return ' ';
  const text = petsciiToText(petscii);
  return [...text].length === 1 ? text : ' ';
}

/** Read a CBM screen matrix into fixed-width rows of characters. */
export function readCbmScreenText(opts: {
  /** Side-effect-free byte read, already banking-aware. */
  read: (addr: number) => number;
  /** Where the matrix is and how big it is, derived from the machine. */
  layout: CbmScreenLayout;
  /** Which set the video chip is pointing at, read from the machine. */
  set: CbmCharSet;
}): MachineScreenText {
  const { read, layout, set } = opts;
  const { screen, cols, rows } = layout;
  const lines: string[] = [];
  for (let row = 0; row < rows; row++) {
    let line = '';
    for (let col = 0; col < cols; col++) {
      line += cbmScreenChar(read(screen + row * cols + col), set);
    }
    lines.push(line);
  }
  return { lines, cols, rows };
}
