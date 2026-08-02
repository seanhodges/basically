import type { CharsetMapping, MachineScreenText } from './types';

/**
 * Reading a ZX80 / ZX81 display file back as characters.
 *
 * Neither machine has a screen rectangle. The display file is a list of
 * variable-length rows, each terminated by NEWLINE (0x76), preceded by one
 * leading NEWLINE - and on a machine short of RAM the ROM collapses an empty
 * row to its terminator alone, so the file can be far shorter than 24x33 bytes.
 * The walk below is deliberately the same one the renderers perform, so what is
 * read can never disagree with what is drawn.
 *
 * The contract is a fixed rectangle whatever the ROM stored, so short rows and
 * a short file are padded with spaces.
 */

export const SINCLAIR_SCREEN_COLS = 32;
export const SINCLAIR_SCREEN_ROWS = 24;

/** The lowest address a display file can legitimately start at. */
const MIN_DFILE = 0x4000;

/**
 * One display-file code as the character it draws.
 *
 * A code carries its glyph in the low six bits and inverse video in bit 7, so
 * an inverse cell reports the character it draws rather than a marker. Decoding
 * goes through the dialect's own charset, so the block graphics come back as
 * the same Unicode a listing shows. Codes with no single-character form -
 * keyword tokens seen as data, unused slots - read as spaces, the same rule
 * every other machine applies.
 */
export function sinclairScreenChar(
  charset: CharsetMapping,
  code: number,
): string {
  const text = charset.glyph(code & 0x3f);
  return [...text].length === 1 ? text : ' ';
}

/** Walk a display file into fixed-width rows of characters. */
export function readSinclairScreenText(opts: {
  read: (addr: number) => number;
  /** The machine's D_FILE pointer, already dereferenced. */
  dfile: number;
  charset: CharsetMapping;
  newline: number;
}): MachineScreenText | null {
  const { read, dfile, charset, newline } = opts;
  if (dfile < MIN_DFILE || dfile > 0xffff) return null;
  let addr = dfile;
  if (read(addr) === newline) addr++; // leading NEWLINE
  const lines: string[] = [];
  for (let row = 0; row < SINCLAIR_SCREEN_ROWS; row++) {
    let line = '';
    let col = 0;
    for (;;) {
      const c = read(addr);
      addr++;
      if (c === newline) break;
      if (col >= SINCLAIR_SCREEN_COLS) break;
      line += sinclairScreenChar(charset, c);
      col++;
    }
    lines.push(line + ' '.repeat(SINCLAIR_SCREEN_COLS - col));
  }
  return {
    lines,
    cols: SINCLAIR_SCREEN_COLS,
    rows: SINCLAIR_SCREEN_ROWS,
  };
}
