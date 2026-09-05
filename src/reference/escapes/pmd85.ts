// Escape-code table for the PMD 85 escapes page. Seeded from the dialect
// charset by scripts/gen-escape-scaffold.mts, then hand-enriched. Edit by hand;
// the generator skips this file once it exists. Kept honest by
// escapes/escape-crosscheck.test.ts.
//
// Almost as short as the Altair's, and for a related reason: Monitor 2's
// character generator is 96 ASCII glyphs plus one solid cell, with no accented
// letters and no block graphics in it at all - so 0x20-0x7E is itself, 0x7F is
// the block, and everything else is the raw-byte escape. The Czechoslovak
// machine with no háčeks in its font is the surprise here, and it is the ROM's
// answer rather than an omission of this project's (see the font comparison in
// src/dialects/pmd85/charset.test.ts).
//
// The four control codes the Monitor's screen driver acts on are documented as
// rows so a program can be written against them, but they keep the `{0xNN}`
// spelling every other non-printing byte has: the machine never gave them names.
import type { EscapeTableData } from '../types';

/** One individually documented control code, in the shared `{0xNN}` spelling. */
function control(code: number, description: string) {
  const hex = `0x${code.toString(16).toUpperCase().padStart(2, '0')}`;
  return {
    escape: `{${hex}}`,
    bytes: hex,
    category: 'control',
    description,
    codes: [code],
    example: { source: `{${hex}}`, bytes: [code] },
  };
}

export const pmd85Escapes: EscapeTableData = {
  title: 'PMD 85 escape codes',
  machines: ['Tesla PMD 85-2'],
  categories: [
    { id: 'block', label: 'Solid cell', class: 'block-graphics' },
    { id: 'control', label: 'Screen controls', class: 'control' },
    { id: 'raw', label: 'Raw bytes', class: 'raw-byte' },
  ],
  entries: [
    {
      escape: '█',
      bytes: '0x7F',
      category: 'block',
      description:
        'The one glyph in the character generator that is not ASCII: a solid cell filling all six columns of the first seven pixel rows. It is a character rather than an escape - typed and listed as itself, the way the Sinclair and Amstrad charsets spell their own solid block - which is why it claims no code in the escape ranges below.',
      example: { source: '█', bytes: [0x7f] },
    },
    control(
      0x08,
      "Backspace: the print position moves one cell left and the character there is erased. This is what the keyboard's ← key sends.",
    ),
    control(
      0x0a,
      'Line feed, which the screen driver ignores: BASIC-G ends a line with 0x0D alone, so a program porting CHR$(10) from another machine gets nothing.',
    ),
    control(
      0x0d,
      'Carriage return: start of the next line, scrolling the text area when it is at the bottom.',
    ),
    control(
      0x1c,
      'Clear screen and home the print position - what GCLEAR prints, and the only way to blank the display short of drawing over it.',
    ),
    {
      escape: '{0xNN}',
      bytes: 'any',
      category: 'raw',
      description:
        'Any byte with no glyph, as two hex digits: the rest of the control codes 0x00-0x1F, and the whole of 0x80-0xFF. The screen draws the Monitor’s placeholder for the high range, but a string can hold it and ASC(CHR$(255)) really is 255. Recognised in strings, REM and DATA; a { that is not an escape is the literal 0x7B character.',
      codes: 'rest',
      example: { source: '{0x00}', bytes: [0x00] },
    },
  ],
};
