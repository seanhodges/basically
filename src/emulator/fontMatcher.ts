/**
 * Recovering characters from a bitmap screen by matching the machine's own font.
 *
 * Several machines keep no characters anywhere: the Spectrums, the CPCs, and the
 * Acorn machines outside mode 7 hold only pixels, and the only way back to text
 * is to compare each 8x8 cell against the glyphs the ROM would have drawn. Four
 * dialects across two CPU families need that, so the matching lives here rather
 * than in any one machine.
 *
 * Machines differ in where the font is, how the screen is addressed, and how
 * pixels are packed - a CPC mode-1 byte holds four 2-bpp pixels, a Spectrum byte
 * holds eight 1-bpp ones. All of that is the caller's; this module only ever
 * sees a glyph as eight 1-bpp mask bytes and a cell as eight more.
 */

/** Eight-byte glyph bitmap, joined, to the character code that draws it. */
export type GlyphSignatures = Map<string, number>;

const SIGNATURE_ROWS = 8;

function signatureOf(rows: readonly number[]): string {
  return rows.join(',');
}

/**
 * Index a font by what each glyph looks like.
 *
 * Codes are walked in ascending order and the first to claim a signature keeps
 * it, which is what makes an all-zero cell read as a space: space is 0x20 and
 * every blank graphics glyph sits above it. Starting the walk below 0x20 would
 * hand blank cells to a control code instead, so `firstCode` defaults there.
 */
export function buildFontSignatures(opts: {
  /** Row `row` (0-7) of the glyph for `code`, as a 1-bpp mask byte. */
  glyphByte: (code: number, row: number) => number;
  /** Lowest code to index. Defaults to 0x20, the space. */
  firstCode?: number;
  /** Highest code to index, inclusive. Defaults to 0x7E. */
  lastCode?: number;
}): GlyphSignatures {
  const { glyphByte, firstCode = 0x20, lastCode = 0x7e } = opts;
  const map: GlyphSignatures = new Map();
  for (let code = firstCode; code <= lastCode; code++) {
    const rows = Array.from({ length: SIGNATURE_ROWS }, (_, r) =>
      glyphByte(code, r),
    );
    const sig = signatureOf(rows);
    if (!map.has(sig)) map.set(sig, code);
  }
  return map;
}

/** The character a single cell draws, or undefined when nothing matches. */
export function matchCell(
  signatures: GlyphSignatures,
  rows: readonly number[],
): number | undefined {
  return signatures.get(signatureOf(rows));
}

/**
 * OCR a whole screen into fixed-width rows.
 *
 * A cell matching no glyph reads as a space rather than as a placeholder: a
 * screen of free-hand graphics is then reported as blank, which is true - there
 * is no text on it - instead of as a wall of noise a caller would have to
 * recognise and discard.
 */
export function readFontText(opts: {
  signatures: GlyphSignatures;
  cols: number;
  rows: number;
  /** The eight 1-bpp mask bytes of the cell at (`row`, `col`), top row first. */
  cellMask: (row: number, col: number) => readonly number[];
  /**
   * The character a matched code stands for, when the machine's charset says
   * something other than ASCII - the CPC's block graphics at 0x80 and up, say.
   * Must return exactly one code point; anything else reads as a space, which
   * keeps the seam's "one code point per column" contract. Defaults to
   * `String.fromCharCode`, right for a font indexed over ASCII alone.
   */
  charFor?: (code: number) => string;
}): string[] {
  const { signatures, cols, rows, cellMask, charFor } = opts;
  const lines: string[] = [];
  for (let row = 0; row < rows; row++) {
    let line = '';
    for (let col = 0; col < cols; col++) {
      const code = matchCell(signatures, cellMask(row, col));
      line += code === undefined ? ' ' : charOf(code, charFor);
    }
    lines.push(line);
  }
  return lines;
}

function charOf(code: number, charFor?: (code: number) => string): string {
  if (!charFor) return String.fromCharCode(code);
  const ch = charFor(code);
  return [...ch].length === 1 ? ch : ' ';
}
