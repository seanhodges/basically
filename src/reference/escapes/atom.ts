// Escape-code table for the Acorn Atom escapes page. Grounded in
// src/dialects/atom/charset.ts and pinned against the implementation by
// escapes/escape-crosscheck.test.ts.
import type { EscapeTableData } from '../types';
import { range } from './util';

export const atomEscapes: EscapeTableData = {
  title: 'Acorn Atom escape codes',
  machines: ['Acorn Atom'],
  categories: [
    { id: 'inverse', label: 'Inverse video', class: 'inverse-video' },
    // Semigraphics 6 cells - the same shapes the Sinclair and TRS-80 pages file
    // under their own `graphics` chips.
    { id: 'graphics', label: 'Graphics', class: 'block-graphics' },
    { id: 'raw', label: 'Raw bytes', class: 'raw-byte' },
  ],
  entries: [
    {
      escape: '{0x80}…{0x9F}',
      bytes: '0x80–0x9F',
      category: 'inverse',
      description:
        'Inverse video digits and punctuation: byte 0x80+c displays character 0x20+c reversed ({0x81} is an inverse !). These have no unicode form of their own, so they stay escapes. There is no %c prefix - on the floating-point ROM %A–%Z name the FP variables, so % stays a literal character. Inverse capitals are not escapes at all: they are the lower-case letters 0x60–0x7E, which the machine displays reversed because it has no lower case.',
      codes: range(0x80, 0x9f),
      example: { source: '{0x81}', bytes: [0x81] },
    },
    {
      escape: '{0xA0}',
      bytes: '0xA0',
      category: 'graphics',
      description:
        'The blank Semigraphics 6 cell (all six blocks off) - escaped because its glyph would be indistinguishable from a space. The other graphics bytes 0xA1–0xDF are typed as their unicode sextant glyphs (🬀…█), not escapes: PRINTing byte 0xA0+p draws pattern p, and the GRAPHICS palette on the on-screen keyboard inserts them.',
      codes: [0xa0],
      example: { source: '{0xA0}', bytes: [0xa0] },
    },
    {
      escape: '{0xE0}…{0xFF}',
      bytes: '0xE0–0xFF',
      category: 'graphics',
      description:
        'The second colour set: these draw the same 32 shapes as 0xC0–0xDF, in the other MC6847 colour pair. Editor text carries shape but not colour, and one glyph cannot stand for two different bytes, so these keep their escapes - a program using them still exports and re-imports exactly.',
      codes: range(0xe0, 0xff),
      example: { source: '{0xE0}', bytes: [0xe0] },
    },
    {
      escape: '{0xNN}',
      bytes: 'any',
      category: 'raw',
      description:
        'Any raw byte as two hex digits - the control codes 0x00–0x1F and delete (0x7F). The Atom stores source as near-plain ASCII, so escapes are recognised everywhere in a line; a {...} that is not an escape is literal text.',
      codes: 'rest',
      example: { source: '{0x0C}', bytes: [0x0c] },
    },
  ],
};
