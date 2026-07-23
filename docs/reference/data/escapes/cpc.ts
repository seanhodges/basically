// Escape-code table for the Amstrad CPC escape codes page.
// Seeded from the dialect charset by scripts/gen-escape-scaffold.mts, then
// hand-enriched (categories, descriptions, parse-only alias rows). Edit by
// hand; the generator skips this file once it exists. Kept honest by
// escapes/escape-crosscheck.test.ts.
//
// The CPC charset (src/dialects/cpc464/charset.ts) has no NAMED escapes: block
// graphics are typed as their Unicode glyphs, and every code with no printable
// form is written as a raw `{0xNN}` byte. The genuinely useful escape content
// is therefore the firmware's printable control codes 0x00-0x1F - the CHR$
// codes that drive the text VDU (colours, cursor, MODE, LOCATE, SYMBOL, INK…).
// Each stores its single introducer byte; several then read further bytes from
// the print stream (noted per row). Everything else falls to the raw catch-all.
import type { EscapeTableData } from '../types';

/** Build a control-code row: `{0xNN}` stores the single introducer byte NN. */
function control(code: number, description: string) {
  const hex = `0x${code.toString(16).padStart(2, '0').toUpperCase()}`;
  return {
    escape: `{${hex}}`,
    bytes: hex,
    category: 'control',
    description,
    codes: [code],
    example: { source: `{${hex}}`, bytes: [code] },
  };
}

export const cpcEscapes: EscapeTableData = {
  title: 'Amstrad CPC escape codes',
  machines: ['Amstrad CPC 464', 'Amstrad CPC 6128'],
  categories: [
    { id: 'control', label: 'Text VDU control codes' },
    { id: 'raw', label: 'Raw bytes' },
  ],
  entries: [
    control(0x00, 'NUL — ignored; prints nothing.'),
    control(
      0x01,
      'Print the following code as a symbol even if it is itself a control code (PRINT CHR$(1);CHR$(n)).',
    ),
    control(0x02, 'Disable the text cursor (cursor off).'),
    control(0x03, 'Enable the text cursor (cursor on).'),
    control(
      0x04,
      'Select screen MODE — the next byte is the mode (0, 1 or 2).',
    ),
    control(
      0x05,
      'Print the next character at the graphics cursor rather than the text cursor.',
    ),
    control(0x06, 'Enable the text screen (text VDU on).'),
    control(0x07, 'BEL — sound the buzzer (a short beep).'),
    control(0x08, 'Move the cursor one column left (backspace).'),
    control(0x09, 'Move the cursor one column right (tab).'),
    control(0x0a, 'Move the cursor one line down (line feed).'),
    control(0x0b, 'Move the cursor one line up.'),
    control(0x0c, 'Clear the whole text window (CLS).'),
    control(
      0x0d,
      'Move the cursor to the start of the line (carriage return).',
    ),
    control(0x0e, 'Set the PAPER (background) ink — the next byte is the pen.'),
    control(0x0f, 'Set the PEN (text) ink — the next byte is the pen.'),
    control(0x10, 'Delete the character under the cursor.'),
    control(0x11, 'Clear from the start of the line to the cursor.'),
    control(0x12, 'Clear from the cursor to the end of the line.'),
    control(0x13, 'Clear from the start of the screen to the cursor.'),
    control(0x14, 'Clear from the cursor to the end of the screen.'),
    control(0x15, 'Disable the text screen (text VDU off).'),
    control(
      0x16,
      'Set transparent-print mode — the next byte is 0 (off) or 1.',
    ),
    control(0x17, 'Set the graphics write mode — the next byte selects 0–3.'),
    control(0x18, 'Exchange PEN and PAPER (inverse video).'),
    control(
      0x19,
      'Define a character matrix (SYMBOL) — the next 9 bytes are the code then eight row bit-patterns.',
    ),
    control(
      0x1a,
      'Set the text window — the next 4 bytes are left, right, top and bottom columns/rows.',
    ),
    control(0x1b, 'ESC — ignored.'),
    control(
      0x1c,
      'Set an INK — the next 3 bytes are the pen and its two flashing colours.',
    ),
    control(
      0x1d,
      'Set the BORDER — the next 2 bytes are its two flashing colours.',
    ),
    control(0x1e, 'Move the cursor to the top-left of the window (home).'),
    control(
      0x1f,
      'Move the cursor (LOCATE) — the next 2 bytes are the column and row.',
    ),
    {
      escape: '{0xNN}',
      bytes: '0x20–0xFF with no glyph',
      category: 'raw',
      description:
        'Any code with no plain or Unicode glyph — DEL (0x7F) and the upper-half graphics/symbols that have no faithful Unicode form (0x80, 0xA0, and the Legacy-Computing-only mosaics/shades). Typed and stored byte-for-byte so imported listings round-trip exactly; CHR$(n) is the usual way to print them.',
      codes: 'rest',
      example: { source: '{0x80}', bytes: [0x80] },
    },
  ],
};
