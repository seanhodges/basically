// Escape-code table for the Acorn Atom escapes page. Grounded in
// src/dialects/atom/charset.ts and pinned against the implementation by
// escapes/escape-crosscheck.test.ts.
import type { EscapeTableData } from '../types';
import { range } from './util';

export const atomEscapes: EscapeTableData = {
  title: 'Acorn Atom escape codes',
  machines: ['Acorn Atom'],
  categories: [
    { id: 'inverse', label: 'Inverse video' },
    { id: 'raw', label: 'Raw bytes' },
  ],
  entries: [
    {
      escape: '{0x80}…{0xFF}',
      bytes: '0x80–0xFF',
      category: 'inverse',
      description:
        'Inverse video: byte 0x80+c displays character c inverted ({0xC1} is inverse A). There is no %c prefix - on the floating-point ROM %A–%Z name the FP variables, so % stays a literal character.',
      codes: range(0x80, 0xff),
      example: { source: '{0xC1}', bytes: [0xc1] },
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
