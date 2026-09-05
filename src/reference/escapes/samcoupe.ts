// Escape-code table for the SAM BASIC escapes page.
// Hand-authored rather than scaffolded, and grounded in
// src/dialects/samcoupe/charset.ts and its graphics table; pinned against them
// by escapes/escape-crosscheck.test.ts.
//
// The SAM's own font covers 0x20-0x7F with a real glyph for every code, and
// 0x80-0xA8 are the block graphics and the twenty-five user-defined characters,
// which have Unicode equivalents and are written as those. So the only escapes
// are the eight print-control directives, the backslash that has to escape
// itself, and the raw form for everything with no printable shape.
import type { EscapeEntry, EscapeTableData } from '../types';

/** The eight embedded print controls, 0x10-0x17. */
const controls: EscapeEntry[] = [
  {
    escape: '{PEN n}',
    bytes: '0x10 n',
    category: 'control',
    description:
      'Embedded PEN control: sets the foreground colour from this point in the string, as one of the sixteen palette slots.',
    codes: [0x10],
    example: { source: '{PEN 2}', bytes: [0x10, 0x02] },
  },
  {
    escape: '{INK n}',
    bytes: '0x10 n',
    category: 'control',
    description:
      'Accepted as a spelling of {PEN n}, the way the keyword INK is accepted for PEN. It stores the same byte and lists back as {PEN n}.',
    parseOnly: true,
    example: { source: '{INK 2}', bytes: [0x10, 0x02] },
  },
  {
    escape: '{PAPER n}',
    bytes: '0x11 n',
    category: 'control',
    description: 'Embedded PAPER control: sets the background colour.',
    codes: [0x11],
    example: { source: '{PAPER 6}', bytes: [0x11, 0x06] },
  },
  {
    escape: '{FLASH n}',
    bytes: '0x12 n',
    category: 'control',
    description:
      'Embedded FLASH control: n = 1 alternates pen and paper, 0 is steady. An attribute bit, so it shows in mode 1 only.',
    codes: [0x12],
    example: { source: '{FLASH 1}', bytes: [0x12, 0x01] },
  },
  {
    escape: '{BRIGHT n}',
    bytes: '0x13 n',
    category: 'control',
    description:
      'Embedded BRIGHT control: n = 1 selects the bright half of the colour pair, 0 the normal one. Mode 1 only, for the same reason as FLASH.',
    codes: [0x13],
    example: { source: '{BRIGHT 1}', bytes: [0x13, 0x01] },
  },
  {
    escape: '{INVERSE n}',
    bytes: '0x14 n',
    category: 'control',
    description:
      'Embedded INVERSE control: n = 1 swaps pen and paper as the characters are drawn, 0 is normal. Works in every mode.',
    codes: [0x14],
    example: { source: '{INVERSE 1}', bytes: [0x14, 0x01] },
  },
  {
    escape: '{OVER n}',
    bytes: '0x15 n',
    category: 'control',
    description:
      'Embedded OVER control: n = 1 combines with what is already on screen, 0 replaces it.',
    codes: [0x15],
    example: { source: '{OVER 1}', bytes: [0x15, 0x01] },
  },
  {
    escape: '{AT r,c}',
    bytes: '0x16 r c',
    category: 'control',
    description:
      'Embedded AT control: moves the print position to row r, column c. Rows 19 and 20 are the lower window and are off screen to it.',
    codes: [0x16],
    example: { source: '{AT 1,2}', bytes: [0x16, 0x01, 0x02] },
  },
  {
    escape: '{TAB n}',
    bytes: '0x17 n 0x00',
    category: 'control',
    description:
      'Embedded TAB control: moves the print position to column n. The ROM reads two operand bytes and discards the second, so the directive writes a zero for it; a stored non-zero second byte has no spelling and comes back as raw bytes.',
    codes: [0x17],
    example: { source: '{TAB 5}', bytes: [0x17, 0x05, 0x00] },
  },
];

/**
 * The twenty-five user-defined graphics, 0x90-0xA8, one row each so a search
 * for the letter or the byte finds it. `UDG` in the ROM's system variables
 * points at 0x90, which is UDG "A", so the codes run A to Y.
 *
 * Each is written as the squared capital of its letter, so the `\a`-`\y`
 * spellings are parse-only alternatives rather than what a decode produces.
 */
const udgs: EscapeEntry[] = Array.from({ length: 25 }, (_, i) => {
  const letter = String.fromCharCode(0x61 + i);
  const code = 0x90 + i;
  const char = String.fromCodePoint(0x1f130 + i);
  return {
    escape: `\\${letter}`,
    bytes: `0x${code.toString(16).toUpperCase()}`,
    category: 'udg',
    description: `User-defined graphic ${letter.toUpperCase()} (CHR$ ${code}), written ${char}. Its shape is the eight bytes at UDG "${letter}".`,
    aliases: [char],
    parseOnly: true,
    example: { source: `\\${letter}`, bytes: [code] },
  };
});

export const samcoupeEscapes: EscapeTableData = {
  title: 'SAM BASIC escape codes',
  machines: ['MGT SAM Coupé'],
  categories: [
    // PEN, PAPER, AT, TAB and the rest share one chip, so the class is the
    // grab-bag one rather than colour: the directives do several jobs.
    { id: 'control', label: 'Control directives', class: 'control' },
    { id: 'udg', label: 'UDGs', class: 'user-defined-graphics' },
    { id: 'literal', label: 'Literals', class: 'literal' },
    { id: 'raw', label: 'Raw bytes', class: 'raw-byte' },
  ],
  entries: [
    ...controls,
    ...udgs,
    {
      escape: '\\\\',
      bytes: '0x5C',
      category: 'literal',
      description:
        'A literal backslash, which the SAM really has at 0x5C. It needs escaping because a lone backslash opens a UDG escape.',
      codes: [0x5c],
      example: { source: '\\\\', bytes: [0x5c] },
    },
    {
      escape: '{0xNN}',
      bytes: 'any',
      category: 'raw',
      description:
        'Any raw byte as two hex digits — the control codes with no directive, the blank block graphic at 0x80, the keyword-token bytes from 0xA9 up inside a string, and a control directive whose operands are truncated. A {…} spelling no directive is ordinary text, the SAM having real braces at 0x7B and 0x7D.',
      codes: 'rest',
      example: { source: '{0x80}', bytes: [0x80] },
    },
  ],
};
