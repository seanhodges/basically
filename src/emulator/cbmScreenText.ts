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
 * The letter a screen code draws while the text set is in force, or null where
 * it draws something else.
 *
 * Answered here rather than by going round through {@link screenToPetscii} and
 * {@link petsciiToText}, because that pair speaks for the *graphics* set and
 * cannot speak for this one. The codes are the same bytes in both sets; only
 * the shapes differ. Screen codes 0x01-0x1A draw `A`-`Z` in the graphics set
 * and `a`-`z` here, and 0x41-0x5A draw graphics there and `A`-`Z` here - and
 * PETSCII has no code at all that means "the lower-case letter", because on
 * this machine one stored character draws either case depending on the set.
 * Routing a text-set letter through the shared table therefore lands on a
 * graphics code, which has no single character, and the letter used to read
 * back as a blank.
 */
function textSetLetter(screenCode: number): string | null {
  const c = screenCode & 0x7f;
  if (c >= 0x01 && c <= 0x1a) return String.fromCharCode(c + 0x60); // a-z
  if (c >= 0x41 && c <= 0x5a) return String.fromCharCode(c); // A-Z
  return null;
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
  if (set === 'text') {
    const letter = textSetLetter(screenCode);
    if (letter !== null) return letter;
  }
  const petscii = screenToPetscii(screenCode & 0x7f);
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
