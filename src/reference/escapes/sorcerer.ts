// Escape-code table for the Exidy Standard BASIC page.
// Hand-written rather than seeded: scripts/gen-escape-scaffold.mts reads
// src/dialects/charsetProbes.ts, which is held to the registered dialects, so the
// generator has nothing to seed this page from until the Sorcerer registers. Kept
// honest by escapes/escape-crosscheck.test.ts from that point on.
//
// The Sorcerer has no named escapes at all. Its charset spells every code without a
// printable form as the raw `{0xNN}` byte, so what this table does is say what each
// of those codes *is* - which on this machine is more than "a byte with no glyph",
// because most of them really do draw something.
//
// Three bands need an escape, and they need it for three different reasons:
//
//  - **0x00-0x1F** are pictorial symbols in the character generator ROM - outlined
//    boxes and circles with various infills, short diagonals, a pair of arrows and a
//    question mark. Nothing in Unicode draws them, so each takes a raw-byte escape.
//    The shapes below were read out of the generator ROM's own bitmaps.
//  - **0x7F and 0x8D** are single shapes with no Unicode equivalent either, one from
//    the generator ROM and one from the standard graphics set the Monitor copies into
//    generator RAM at boot.
//  - **0xC0-0xFF** is the user-definable band, which has no shape at all until a
//    program pokes eight bitmap bytes into the generator RAM. There is nothing to
//    draw and nothing to name, so the whole band falls to the catch-all row.
//
// The trap, and the reason nine of these rows say twice as much as the rest: a code
// below 0x20 is a *symbol* in screen RAM and a *control* on its way through PRINT.
// The Monitor's screen driver acts on nine of them - the cursor moves, the clear, the
// carriage return - and silently discards the other twenty-three, so `PRINT CHR$(4)`
// puts nothing on the screen. The only way to draw one of these symbols is to POKE
// its code straight into screen RAM. Each effect below was read off the booted ROM.
import type { EscapeTableData } from '../types';

/** One code with a shape and no character, in the shared `{0xNN}` spelling. */
function symbol(code: number, description: string) {
  const hex = `0x${code.toString(16).toUpperCase().padStart(2, '0')}`;
  return {
    escape: `{${hex}}`,
    bytes: hex,
    category: 'symbols',
    description,
    codes: [code],
    example: { source: `{${hex}}`, bytes: [code] },
  };
}

/** The same, for a code the screen driver acts on when it is printed. */
function screen(code: number, description: string) {
  return { ...symbol(code, description), category: 'screen' };
}

export const sorcererEscapes: EscapeTableData = {
  title: 'Exidy Standard BASIC escape codes',
  machines: ['Exidy Sorcerer'],
  categories: [
    // The nine the Monitor acts on do several different jobs between them - a
    // screen clear, a carriage return, a line feed and five cursor moves - so
    // the chip is a grab-bag: `control`.
    { id: 'screen', label: 'Screen controls', class: 'control' },
    {
      id: 'symbols',
      label: 'Shapes without a character',
      class: 'block-graphics',
    },
    { id: 'raw', label: 'Raw bytes', class: 'raw-byte' },
  ],
  entries: [
    symbol(
      0x00,
      'A hollow square: an outlined box five dots across and seven down.',
    ),
    screen(
      0x01,
      'The top and left edges of the hollow square, a corner bracket open down and to the right. PRINT CHR$(1) moves the cursor one cell left instead, as CHR$(8) does; this is the code CTRL+A sends.',
    ),
    symbol(0x02, 'An upright standing on a base bar.'),
    symbol(
      0x03,
      'The right and bottom edges of the hollow square, a corner bracket open up and to the left.',
    ),
    symbol(
      0x04,
      'Two short diagonal strokes stepping down to the right, the lower set right of the upper.',
    ),
    symbol(
      0x05,
      'The hollow square with a small saltire in its middle three columns.',
    ),
    symbol(
      0x06,
      'A stroke descending from the top right, meeting a narrow V at the lower left.',
    ),
    symbol(
      0x07,
      'An open-topped cup: a rounded rim, two sides and a flat base.',
    ),
    screen(
      0x08,
      'A solid arrowhead at the top left with a tail stepping down to the lower right. PRINT CHR$(8) moves the cursor one cell left instead, leaving what is there - it rubs nothing out.',
    ),
    symbol(
      0x09,
      'A right-pointing arrow - a bar across the middle of the cell with the chevron meeting it at the right.',
    ),
    screen(
      0x0a,
      'Three bars across the cell: the top, the middle and the bottom. PRINT CHR$(10) moves the cursor down one row instead, keeping its column - a line feed with no carriage return.',
    ),
    symbol(
      0x0b,
      'Three uprights over a solid wedge tapering to a point at the foot.',
    ),
    screen(
      0x0c,
      'Rows of uprights and wedges stacked alternately, tapering to a point at the foot; the companion of 0x0B. PRINT CHR$(12) clears the screen and homes the cursor instead. This is the machine’s CLS: keep the trailing semicolon, or the newline PRINT adds puts everything one row low.',
    ),
    screen(
      0x0d,
      'A left-pointing arrow - a bar across the middle of the cell with the chevron meeting it at the left. PRINT CHR$(13) returns the cursor to column 0 of the row it is on instead, without advancing - a carriage return with no line feed.',
    ),
    symbol(0x0e, 'A hollow circle with a saltire inside it.'),
    symbol(0x0f, 'A hollow circle with a single dot at its centre.'),
    symbol(0x10, 'The hollow square divided by a bar across its middle.'),
    screen(
      0x11,
      'A hollow circle enclosing an elbow: a stroke down from the top, turning right at mid-height. PRINT CHR$(17) homes the cursor to the top left instead, without clearing; this is the code CTRL+Q sends.',
    ),
    symbol(
      0x12,
      'A hollow circle enclosing an elbow: a stroke in from the right at mid-height, turning down. One of four, the others at 0x11, 0x13 and 0x14.',
    ),
    screen(
      0x13,
      'A hollow circle enclosing an elbow: a stroke in from the left at mid-height, turning down. PRINT CHR$(19) moves the cursor one cell right instead, leaving the cell it passed over blank; this is the code CTRL+S sends.',
    ),
    symbol(
      0x14,
      'A hollow circle enclosing an elbow: a stroke down from the top, turning left at mid-height.',
    ),
    symbol(0x15, 'The stroke and V of 0x06 with a short bar joining them.'),
    symbol(0x16, 'Two uprights under a bar, standing on splayed feet.'),
    screen(
      0x17,
      'An upright at the right of the cell with a bar reaching left from its middle. PRINT CHR$(23) moves the cursor up one row instead, keeping its column; this is the code CTRL+W sends.',
    ),
    symbol(0x18, 'The hollow square with a saltire corner to corner.'),
    symbol(0x19, 'An upright with a three-dot swelling at its middle.'),
    screen(
      0x1a,
      'A question mark - the one pictorial symbol in this band that is also an ASCII character, at 0x3F. PRINT CHR$(26) moves the cursor down one row instead, keeping its column; this is the code CTRL+Z sends.',
    ),
    symbol(0x1b, 'A hollow circle with a bar across its middle.'),
    symbol(
      0x1c,
      'The hollow square enclosing an elbow: a stroke down from the top, turning left at mid-height. One of four, the others at 0x1D, 0x1E and 0x1F - the same set 0x11 to 0x14 draw inside a circle.',
    ),
    symbol(
      0x1d,
      'The hollow square enclosing an elbow: a stroke in from the left at mid-height, turning down.',
    ),
    symbol(
      0x1e,
      'The hollow square enclosing an elbow: a stroke in from the right at mid-height, turning down.',
    ),
    symbol(
      0x1f,
      'The hollow square enclosing an elbow: a stroke down from the top, turning right at mid-height.',
    ),
    symbol(
      0x7f,
      'A chequer of alternating dots filling the whole cell. The Monitor draws the cursor with it, parking the code in the cell the next character will go in - so it is a real byte in screen RAM rather than an overlay, and the row under the prompt is never blank.',
    ),
    symbol(
      0x8d,
      'A small pictorial glyph, and the one code of the standard graphics set (0x80-0xBF) that Unicode has nothing for - every other code in that band is a rule, junction, corner, quadrant, half, dither, disc, triangle or card suit that can be typed as itself. GRAPHIC and the SKIP key is what types it on the machine.',
    ),
    {
      escape: '{0xNN}',
      bytes: 'any',
      category: 'raw',
      description:
        'Any other byte, as two hex digits: the user-definable band 0xC0-0xFF, which has no shape until a program pokes eight bitmap bytes into the generator RAM at -1024+(code-128)*8. Recognised in strings, REM and DATA; a { that is not a well-formed escape is the literal 0x7B character, which this machine really has.',
      codes: 'rest',
      example: { source: '{0xC0}', bytes: [0xc0] },
    },
  ],
};
