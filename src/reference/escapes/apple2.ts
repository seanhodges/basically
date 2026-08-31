// Escape-code table for the Apple II escapes page. Grounded in
// src/dialects/apple2/charset.ts and pinned against the implementation by
// escapes/escape-crosscheck.test.ts.
//
// Three rows, and the shape of them is the machine's rather than an editorial
// choice. The character generator holds 64 shapes - ASCII 0x20-0x5F - and the
// top two bits of a screen byte pick which video mode that shape is drawn in
// rather than picking another shape, so the same 64 glyphs appear four times
// over the byte range. The normal run the machine's own printing produces,
// 0xA0-0xDF, is where plain characters live and needs no escape at all; the
// inverse and flashing halves are named, because a program pokes them into the
// text page deliberately; and the second normal run draws the same shapes the
// first does, so it keeps a raw-byte escape rather than a text form that would
// break the round trip.
import type { EscapeTableData } from '../types';
import { range } from './util';

export const apple2Escapes: EscapeTableData = {
  title: 'Apple II escape codes',
  machines: ['Apple II'],
  categories: [
    { id: 'inverse', label: 'Inverse video', class: 'inverse-video' },
    { id: 'flashing', label: 'Flashing', class: 'screen-effect' },
    { id: 'raw', label: 'Raw bytes', class: 'raw-byte' },
  ],
  entries: [
    {
      escape: '{INV<c>}',
      bytes: '0x00-0x3F',
      category: 'inverse',
      description:
        'The character <c> drawn in inverse video - black on white - where <c> is any of the 64 characters the machine has: {INVA} is an inverse A, {INV } an inverse space. These are screen bytes and nothing else: POKE one into the text page, since a byte below 0x80 inside a program line is a token rather than a character - or set the monitor output mask with POKE 50,63, which draws everything printed afterwards in inverse until POKE 50,255.',
      codes: range(0x00, 0x3f),
      example: { source: '{INVA}', bytes: [0x01] },
    },
    {
      escape: '{FLASH<c>}',
      bytes: '0x40-0x7F',
      category: 'flashing',
      description:
        'The character <c> drawn flashing, alternating between normal and inverse about four times a second. The video counter drives the flash, so it costs the program nothing to leave one on screen. POKE these into the text page as well, or print them by setting the output mask with POKE 50,127.',
      codes: range(0x40, 0x7f),
      example: { source: '{FLASHA}', bytes: [0x41] },
    },
    {
      escape: '{0xNN}',
      bytes: 'any',
      category: 'raw',
      description:
        'Any byte with no text form, as two hex digits: 0x80-0x9F and 0xE0-0xFF, which are the second of the two normal-video runs. They draw exactly the shapes 0xA0-0xDF draw, and the machine itself never produces one, so they keep an escape rather than a duplicate spelling that would not round-trip. Escapes are recognised in string literals and in REM; { and } are not characters this machine has, so an escape is the only way either reaches a program.',
      codes: 'rest',
      example: { source: '{0x80}', bytes: [0x80] },
    },
  ],
};
