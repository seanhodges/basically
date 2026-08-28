// Escape-code table for the Atari escape codes page. Seeded from the dialect
// charset by scripts/gen-escape-scaffold.mts, then hand-enriched (categories,
// descriptions, parse-only alias rows). Edit by hand; the generator skips this
// file once it exists. Kept honest by escapes/escape-crosscheck.test.ts.
//
// ATASCII escapes far less than the machines around it, and for a reason worth
// stating: most of its low codes are *drawings* rather than controls. 0x00-0x1A
// are the block and line graphics printed on the fronts of the keycaps, so they
// come through as their own characters and need no escape at all. What is left
// is the fourteen codes that move the cursor or edit the screen, plus the whole
// inverse-video half of the table, which has no glyphs of its own because ANTIC
// draws inverse video by turning the pixels of the ordinary glyph over.
//
// The names are the ones the key tops and the Atari manuals use, lower case and
// spelled out: {clear} is what SHIFT+CLEAR sends, {delete line} what
// SHIFT+DELETE does. {eol} is 0x9B, which is this machine's end of line - it is
// what RETURN stores, what terminates every record on tape and disk, and what a
// LIST writes between lines where another machine would write 0x0D.
import type { EscapeTableData } from '../types';

/** One named control code: the escape is `{name}` and the byte is fixed. */
function control(
  name: string,
  code: number,
  category: string,
  description: string,
) {
  return {
    escape: `{${name}}`,
    bytes: `0x${code.toString(16).toUpperCase().padStart(2, '0')}`,
    category,
    description,
    codes: [code],
    example: { source: `{${name}}`, bytes: [code] },
  };
}

export const atariEscapes: EscapeTableData = {
  title: 'Atari escape codes',
  machines: ['Atari 800', 'Atari 400'],
  categories: [
    { id: 'cursor', label: 'Cursor', class: 'cursor' },
    { id: 'editing', label: 'Editing', class: 'editing' },
    { id: 'control', label: 'Control', class: 'control' },
    { id: 'inverse', label: 'Inverse video', class: 'inverse-video' },
  ],
  entries: [
    control(
      'up',
      0x1c,
      'cursor',
      'Moves the cursor up one row, wrapping to the bottom of the screen from the top row. CTRL and the up arrow on the keyboard.',
    ),
    control(
      'down',
      0x1d,
      'cursor',
      'Moves the cursor down one row, scrolling the screen when it is already on the bottom one.',
    ),
    control(
      'left',
      0x1e,
      'cursor',
      'Moves the cursor one column left, wrapping to the end of the row above.',
    ),
    control(
      'right',
      0x1f,
      'cursor',
      'Moves the cursor one column right, wrapping to the start of the row below.',
    ),
    control(
      'clear',
      0x7d,
      'editing',
      'Blanks the screen and puts the cursor in the top left corner. This is the code every program prints first, and it is what SHIFT+CLEAR sends.',
    ),
    control(
      'insert line',
      0x9d,
      'editing',
      'Opens a blank row where the cursor is, pushing the rows below it down and losing the bottom one.',
    ),
    control(
      'delete line',
      0x9c,
      'editing',
      'Removes the row the cursor is on and pulls the rows below it up.',
    ),
    control(
      'insert char',
      0xff,
      'editing',
      'Opens a space at the cursor, pushing the rest of the logical line right.',
    ),
    control(
      'delete char',
      0xfe,
      'editing',
      'Removes the character at the cursor and pulls the rest of the logical line left. Backspace is not this code: it is 0x7E, which this charset carries as the arrow the character generator draws for it rather than as an escape.',
    ),
    control(
      'set tab',
      0x9f,
      'editing',
      'Sets a tab stop at the cursor’s column. The stops are what CTRL+TAB moves between.',
    ),
    control(
      'clear tab',
      0x9e,
      'editing',
      'Clears the tab stop at the cursor’s column.',
    ),
    control(
      'eol',
      0x9b,
      'control',
      'End of line. This machine ends a line with 0x9B rather than a carriage return, so it is what RETURN stores, what separates the lines of a LIST listing, and what terminates every record the cassette and disk handlers read or write.',
    ),
    control(
      'esc',
      0x1b,
      'control',
      'Escape. The screen editor swallows it and shows the code after it as a character instead of acting on it, which is how one of the codes above is put into a program line rather than obeyed. It has a shape of its own once it is sitting in screen memory.',
    ),
    control(
      'bell',
      0xfd,
      'control',
      'Rings the console buzzer. It is a sound the speaker makes directly rather than one of POKEY’s four voices, so it plays through whatever SOUND is doing.',
    ),
    {
      escape: '{$xx}',
      bytes: 'any',
      category: 'inverse',
      description:
        'Any code with no character of its own, written as two hex digits — which here is the whole inverse-video half, 0x80 to 0xFF, less the eight codes named above. Inverse video is simply the top bit set: 0x80 plus a code draws the same shape with its pixels turned over, so {$a0} is a solid block and CHR$(160) is the same thing computed. This is also the escape the editor accepts for a code that already has a glyph, so {$41} is another way of writing A.',
      codes: 'rest',
      example: { source: '{$a0}', bytes: [0xa0] },
    },
  ],
};
