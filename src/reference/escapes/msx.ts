// Escape-code table for the MSX BASIC page.
// Hand-authored rather than seeded: the escape scaffolder is driven by the
// shared charset probes, which only take a registered dialect. Kept honest by
// escapes/escape-crosscheck.test.ts once this machine registers.
//
// MSX has no named escapes at all. Its character set covers 0x20-0xFE with real
// glyphs - accented letters, block graphics, Greek and mathematics - so the only
// bytes needing an escape are the control codes below 0x20, the 0x7F delete and
// the 0xFF cursor cell, and every one of them spells as the raw `{0xNN}` form.
// The rows below are therefore about what each byte *does* when it is printed,
// which was read off the running machine one code at a time rather than out of a
// manual: 0x00-0x07 and 0x0E-0x1A change nothing on screen and are left to the
// catch-all, and the twelve that do something have a row apiece.
//
// The one two-byte spelling is the graphic header: 0x01 followed by a code plus
// 0x40 prints the *glyph* of a code below 0x20 instead of obeying it. Only the
// four cursor arrows have a citable shape, so they are the four rows in the
// graphics category; the rest of that range is written as the pair of escapes
// and comes back byte for byte.
import type { EscapeTableData } from '../types';

export const msxEscapes: EscapeTableData = {
  title: 'MSX BASIC',
  machines: ['Sony HB-10P'],
  categories: [
    { id: 'cursor', label: 'Cursor', class: 'cursor' },
    { id: 'editing', label: 'Editing', class: 'editing' },
    { id: 'screen', label: 'Screen', class: 'screen-effect' },
    { id: 'graphics', label: 'Graphic characters', class: 'block-graphics' },
    { id: 'control', label: 'Other control codes', class: 'control' },
    { id: 'raw', label: 'Raw bytes', class: 'raw-byte' },
  ],
  entries: [
    {
      escape: '{0x01}',
      bytes: '0x01',
      category: 'control',
      description:
        'The graphic header. The next byte is printed as the glyph of that byte minus 0x40, which is how the shapes of codes 0x00-0x1F are put on screen at all: as commands they would clear the screen or move the cursor instead.',
      codes: [0x01],
      example: { source: '{0x01}', bytes: [0x01] },
    },
    {
      escape: '{0x07}',
      bytes: '0x07',
      category: 'control',
      description:
        'Sounds the beeper, exactly as BEEP does - the same envelope on the same sound chip. Nothing changes on screen.',
      codes: [0x07],
      example: { source: '{0x07}', bytes: [0x07] },
    },
    {
      escape: '{0x08}',
      bytes: '0x08',
      category: 'cursor',
      description:
        'Moves the cursor one column left without erasing anything. Code 0x7F is the destructive version.',
      codes: [0x08],
      example: { source: '{0x08}', bytes: [0x08] },
    },
    {
      escape: '{0x09}',
      bytes: '0x09',
      category: 'cursor',
      description:
        'Tab: advances to the next eight-column stop, writing spaces over what it passes.',
      codes: [0x09],
      example: { source: '{0x09}', bytes: [0x09] },
    },
    {
      escape: '{0x0A}',
      bytes: '0x0A',
      category: 'cursor',
      description:
        'Line feed: moves down one row and keeps the column, scrolling the screen at the bottom.',
      codes: [0x0a],
      example: { source: '{0x0A}', bytes: [0x0a] },
    },
    {
      escape: '{0x0B}',
      bytes: '0x0B',
      category: 'cursor',
      description:
        'Home: moves the cursor to the top left. The screen is left as it is - code 0x0C is the one that clears it.',
      codes: [0x0b],
      example: { source: '{0x0B}', bytes: [0x0b] },
    },
    {
      escape: '{0x0C}',
      bytes: '0x0C',
      category: 'screen',
      description:
        'Clears the screen and homes the cursor, exactly as CLS does.',
      codes: [0x0c],
      example: { source: '{0x0C}', bytes: [0x0c] },
    },
    {
      escape: '{0x0D}',
      bytes: '0x0D',
      category: 'cursor',
      description:
        'Carriage return: moves to column 0 of the row the cursor is already on, without moving down.',
      codes: [0x0d],
      example: { source: '{0x0D}', bytes: [0x0d] },
    },
    {
      escape: '{0x1B}',
      bytes: '0x1B',
      category: 'screen',
      description:
        'Escape: what follows is read as a screen command rather than printed. The machine takes a small VT-52-style set - E clears the screen, J erases to the end of it, K erases to the end of the line, L inserts a line, M deletes one, and A, B, C and D move the cursor.',
      codes: [0x1b],
      example: { source: '{0x1B}', bytes: [0x1b] },
    },
    {
      escape: '{0x1C}',
      bytes: '0x1C',
      category: 'cursor',
      description: 'Moves the cursor one column right.',
      codes: [0x1c],
      example: { source: '{0x1C}', bytes: [0x1c] },
    },
    {
      escape: '{0x1D}',
      bytes: '0x1D',
      category: 'cursor',
      description: 'Moves the cursor one column left.',
      codes: [0x1d],
      example: { source: '{0x1D}', bytes: [0x1d] },
    },
    {
      escape: '{0x1E}',
      bytes: '0x1E',
      category: 'cursor',
      description: 'Moves the cursor one row up.',
      codes: [0x1e],
      example: { source: '{0x1E}', bytes: [0x1e] },
    },
    {
      escape: '{0x1F}',
      bytes: '0x1F',
      category: 'cursor',
      description: 'Moves the cursor one row down.',
      codes: [0x1f],
      example: { source: '{0x1F}', bytes: [0x1f] },
    },
    {
      escape: '{0x7F}',
      bytes: '0x7F',
      category: 'editing',
      description:
        'Erases the character to the left of the cursor and moves there. Nothing after it is pulled along.',
      codes: [0x7f],
      example: { source: '{0x7F}', bytes: [0x7f] },
    },
    {
      escape: '⇨',
      bytes: '0x01 0x51',
      category: 'graphics',
      description:
        'The right arrow: the glyph of code 0x11, reached through the graphic header. One character in the editor, two bytes in the program.',
      aliases: ['{0x01}{0x51}'],
      example: { source: '⇨', bytes: [0x01, 0x51] },
    },
    {
      escape: '⇦',
      bytes: '0x01 0x52',
      category: 'graphics',
      description: 'The left arrow: the glyph of code 0x12.',
      aliases: ['{0x01}{0x52}'],
      example: { source: '⇦', bytes: [0x01, 0x52] },
    },
    {
      escape: '⇧',
      bytes: '0x01 0x53',
      category: 'graphics',
      description: 'The up arrow: the glyph of code 0x13.',
      aliases: ['{0x01}{0x53}'],
      example: { source: '⇧', bytes: [0x01, 0x53] },
    },
    {
      escape: '⇩',
      bytes: '0x01 0x54',
      category: 'graphics',
      description: 'The down arrow: the glyph of code 0x14.',
      aliases: ['{0x01}{0x54}'],
      example: { source: '⇩', bytes: [0x01, 0x54] },
    },
    {
      escape: '{0xNN}',
      bytes: 'any',
      category: 'raw',
      description:
        'Any byte with no character of its own, written as two hexadecimal digits: the control codes not listed above, which this machine prints as nothing at all, and code 0xFF, the cursor cell, which has no shape to stand for it. A brace pair that spells no such escape is ordinary text, the machine having real braces at 0x7B and 0x7D.',
      codes: 'rest',
      example: { source: '{0xFF}', bytes: [0xff] },
    },
  ],
};
