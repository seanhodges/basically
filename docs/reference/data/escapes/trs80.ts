// Escape-code table for the TRS-80 escapes page. Grounded in
// src/dialects/trs80/charset.ts and the display-driver control codes the
// interpreter honours (Stage 7); pinned against the implementation by
// escapes/escape-crosscheck.test.ts.
import type { EscapeTableData } from '../types';
import { range } from './util';

/** Build one individually documented `{0xNN}` control row. */
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

export const trs80Escapes: EscapeTableData = {
  title: 'TRS-80 escape codes',
  machines: ['TRS-80 Model I (Level II BASIC)'],
  categories: [
    { id: 'control', label: 'Display controls' },
    { id: 'graphics', label: 'Graphics' },
    { id: 'compression', label: 'Space compression' },
    { id: 'raw', label: 'Raw bytes' },
  ],
  entries: [
    control(0x08, 'Backspace and erase the previous character.'),
    control(0x0d, 'Newline: move to the start of the next row.'),
    control(0x0e, 'Turn the cursor on.'),
    control(0x0f, 'Turn the cursor off.'),
    control(0x12, 'Backspace without erasing.'),
    control(
      0x17,
      'Switch to double-width (32 character) display mode - recognised as a mode change, no glyph.',
    ),
    control(0x1c, 'Cursor home: top-left of the screen.'),
    control(0x1d, 'Carriage return to the start of the current row.'),
    control(0x1e, 'Clear from the cursor to the end of the row.'),
    control(0x1f, 'Clear from the cursor to the end of the screen.'),
    {
      escape: '{0x80}',
      bytes: '0x80',
      category: 'graphics',
      description:
        'The blank block-graphics cell (all six pixels off) - escaped because its glyph would be indistinguishable from a space. The other graphics bytes 0x81–0xBF are typed as their unicode sextant glyphs (🬀…█), not escapes.',
      codes: [0x80],
      example: { source: '{0x80}', bytes: [0x80] },
    },
    {
      escape: '{0xC0}…{0xFF}',
      bytes: '0xC0–0xFF',
      category: 'compression',
      description:
        'Space-compression codes: byte 0xC0+n prints n spaces (0xC3 = 3 spaces). Stored on tape by Level II string packing.',
      codes: range(0xc0, 0xff),
      example: { source: '{0xC3}', bytes: [0xc3] },
    },
    {
      escape: '{0xNN}',
      bytes: 'any',
      category: 'raw',
      description:
        'Any raw byte as two hex digits - the remaining control codes 0x00–0x1F and delete (0x7F). Recognised in strings, REM and DATA; a { that is not an escape is the literal 0x7B character.',
      codes: 'rest',
      example: { source: '{0x7F}', bytes: [0x7f] },
    },
  ],
};
