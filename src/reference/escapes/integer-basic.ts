// Escape-code table for the Integer BASIC escapes page, which covers the Apple I
// and the Apple II. Grounded in src/dialects/apple1/charset.ts and
// src/dialects/apple2/charset.ts, and pinned against both by
// escapes/escape-crosscheck.test.ts.
//
// One page, two character generators, and almost nothing in common but the
// catch-all: every named row here belongs to one machine and says so.
//
// The Apple I has 64 characters and no sixty-fifth. Its generator holds ASCII
// 0x20-0x5F, which the machine carries with bit 7 set - so 0xA0-0xDF are the
// printable codes and every one of the other 192 is the raw-byte escape. There
// are no named escapes at all: no colour, no cursor controls, no block graphics
// and no lower case. The three codes the machine itself acts on are documented
// as rows so a program can be written against them, but they keep the {0xNN}
// spelling every other non-printing byte has, because the machine never gave
// them names either.
//
// The Apple II draws the same 64 shapes, and the top two bits of a screen byte
// pick which video mode that shape is drawn in rather than picking another
// shape - so the same glyphs appear four times over the byte range. The normal
// run the machine's own printing produces, 0xA0-0xDF, needs no escape; the
// inverse and flashing halves are named, because a program pokes them into the
// text page deliberately; and the second normal run keeps a raw-byte escape
// rather than a text form that would break the round trip.
import type { EscapeTableData } from '../types';
import { range } from './util';

/** One individually documented Apple I code, in the shared `{0xNN}` spelling. */
function control(code: number, description: string) {
  const hex = `0x${code.toString(16).toUpperCase().padStart(2, '0')}`;
  return {
    escape: `{${hex}}`,
    bytes: hex,
    category: 'control',
    description,
    codes: [code],
    tag: 'Apple I only',
    onlyOn: ['apple1'],
    example: { source: `{${hex}}`, bytes: [code] },
  };
}

export const integerBasicEscapes: EscapeTableData = {
  title: 'Integer BASIC escape codes',
  machines: ['Apple I', 'Apple II'],
  categories: [
    { id: 'control', label: 'Codes the machine acts on', class: 'control' },
    { id: 'inverse', label: 'Inverse video', class: 'inverse-video' },
    { id: 'flashing', label: 'Flashing', class: 'screen-effect' },
    { id: 'raw', label: 'Raw bytes', class: 'raw-byte' },
  ],
  entries: [
    control(
      0x83,
      'CTRL-C. Sent by the keyboard as the letter with bits 5 and 6 cleared, and the code that breaks a running program - although so does every other key, because BASIC takes whatever is waiting and reports STOPPED AT.',
    ),
    control(
      0x8d,
      'Carriage return: the start of the next line. The only code the display decodes at all - there is no line feed, no backspace, no clear-screen and no cursor addressing, so this is the whole of the line discipline.',
    ),
    control(
      0x9b,
      'Escape. The monitor reads it as "abandon the line being typed"; the display prints nothing for it.',
    ),
    {
      escape: '{INV<c>}',
      bytes: '0x00-0x3F',
      category: 'inverse',
      description:
        'The character <c> drawn in inverse video - black on white - where <c> is any of the 64 characters the machine has: {INVA} is an inverse A, {INV } an inverse space. These are screen bytes and nothing else: POKE one into the text page, since a byte below 0x80 inside a program line is a token rather than a character - or set the monitor output mask with POKE 50,63, which draws everything printed afterwards in inverse until POKE 50,255.',
      codes: range(0x00, 0x3f),
      tag: 'Apple II only',
      onlyOn: ['apple2'],
      example: { source: '{INVA}', bytes: [0x01] },
    },
    {
      escape: '{FLASH<c>}',
      bytes: '0x40-0x7F',
      category: 'flashing',
      description:
        'The character <c> drawn flashing, alternating between normal and inverse about four times a second. The video counter drives the flash, so it costs the program nothing to leave one on screen. POKE these into the text page as well, or print them by setting the output mask with POKE 50,127.',
      codes: range(0x40, 0x7f),
      tag: 'Apple II only',
      onlyOn: ['apple2'],
      example: { source: '{FLASHA}', bytes: [0x41] },
    },
    {
      escape: '{0xNN}',
      bytes: 'any',
      category: 'raw',
      description:
        'Any byte with no text form, as two hex digits. On the Apple I that is everything outside 0xA0-0xDF - the whole of 0x00-0x9F and 0xE0-0xFF - and the display discards a code it has no glyph for rather than guessing at one, though a string can still hold it. On the Apple II it is 0x80-0x9F and 0xE0-0xFF, the second of the two normal-video runs: they draw exactly the shapes 0xA0-0xDF draw and the machine itself never produces one, so they keep an escape rather than a duplicate spelling that would not round-trip. Recognised in string literals and in REM; { and } are not characters either machine has, so an escape is the only way either reaches a program at all.',
      codes: 'rest',
      example: { source: '{0x80}', bytes: [0x80] },
    },
  ],
};
