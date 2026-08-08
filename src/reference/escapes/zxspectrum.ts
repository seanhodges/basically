// Escape-code table for the ZX Spectrum escapes page (48K and 128K - the 128
// shares the 48K charset; the differences are tagged). Grounded in
// src/dialects/zxspectrum/charset.ts (+ floatOverride.ts) and pinned against
// the implementation by escapes/escape-crosscheck.test.ts.
import type { EscapeTableData } from '../types';

export const zxspectrumEscapes: EscapeTableData = {
  title: 'ZX Spectrum escape codes',
  machines: ['Sinclair ZX Spectrum 48K', 'Sinclair ZX Spectrum 128K'],
  categories: [
    // INK, PAPER, AT, TAB, OVER and the rest share one chip, so the class is the
    // grab-bag one - the Spectrum's colour codes are not filed as colour here.
    { id: 'control', label: 'Control directives', class: 'control' },
    { id: 'udg', label: 'UDGs', class: 'user-defined-graphics' },
    { id: 'literal', label: 'Literals', class: 'literal' },
    { id: 'numeric', label: 'Numeric overrides', class: 'embedded-number' },
    { id: 'raw', label: 'Raw bytes', class: 'raw-byte' },
  ],
  entries: [
    {
      escape: '{INK n}',
      bytes: '0x10 n',
      category: 'control',
      description:
        'Embedded INK control: sets the text colour (n = 0–9) from this point in the string.',
      codes: [0x10],
      example: { source: '{INK 2}', bytes: [0x10, 0x02] },
    },
    {
      escape: '{PAPER n}',
      bytes: '0x11 n',
      category: 'control',
      description:
        'Embedded PAPER control: sets the background colour (n = 0–9).',
      codes: [0x11],
      example: { source: '{PAPER 6}', bytes: [0x11, 0x06] },
    },
    {
      escape: '{FLASH n}',
      bytes: '0x12 n',
      category: 'control',
      description: 'Embedded FLASH control: n = 1 flashing, 0 steady.',
      codes: [0x12],
      example: { source: '{FLASH 1}', bytes: [0x12, 0x01] },
    },
    {
      escape: '{BRIGHT n}',
      bytes: '0x13 n',
      category: 'control',
      description: 'Embedded BRIGHT control: n = 1 bright, 0 normal.',
      codes: [0x13],
      example: { source: '{BRIGHT 1}', bytes: [0x13, 0x01] },
    },
    {
      escape: '{INVERSE n}',
      bytes: '0x14 n',
      category: 'control',
      description: 'Embedded INVERSE control: n = 1 inverse video, 0 normal.',
      codes: [0x14],
      example: { source: '{INVERSE 1}', bytes: [0x14, 0x01] },
    },
    {
      escape: '{OVER n}',
      bytes: '0x15 n',
      category: 'control',
      description: 'Embedded OVER control: n = 1 overprint mode, 0 normal.',
      codes: [0x15],
      example: { source: '{OVER 1}', bytes: [0x15, 0x01] },
    },
    {
      escape: '{AT r,c}',
      bytes: '0x16 r c',
      category: 'control',
      description:
        'Embedded AT control: moves the print position to row r, column c.',
      codes: [0x16],
      example: { source: '{AT 1,2}', bytes: [0x16, 0x01, 0x02] },
    },
    {
      escape: '{TAB n}',
      bytes: '0x17 n 0x00',
      category: 'control',
      description:
        'Embedded TAB control: moves the print position to column n (stored as a 16-bit little-endian operand).',
      codes: [0x17],
      example: { source: '{TAB 5}', bytes: [0x17, 0x05, 0x00] },
    },
    // UDGs. Each is written as the squared capital of the key that types it
    // (🄰-🅄), so the `\a`-`\u` escapes (the zmakebas convention this used to
    // render) are parse-only spellings now. One row per letter so a search for
    // the letter or the byte finds it.
    ...Array.from({ length: 21 }, (_, i) => {
      const letter = String.fromCharCode(0x61 + i);
      const code = 0x90 + i;
      const char = String.fromCodePoint(0x1f130 + i);
      const is128Token = code >= 0xa3;
      return {
        escape: `\\${letter}`,
        bytes: `0x${code.toString(16).toUpperCase()}`,
        category: 'udg',
        description: `User-defined graphic ${letter.toUpperCase()} (CHR$ ${code}), written ${char}.${
          is128Token
            ? ` On the 128K this byte is the ${code === 0xa3 ? 'SPECTRUM' : 'PLAY'} token, not a UDG - the tokenizer warns (non-fatally).`
            : ''
        }`,
        // The only escape rows in the tree that belong to one machine rather
        // than a whole page: 0xA3/0xA4 are UDGs on a 48K and the SPECTRUM/PLAY
        // tokens on a 128K, so a port to the 128 must not be told it loses two
        // graphics it never had.
        ...(is128Token ? { tag: '48K only', onlyOn: ['zxspectrum'] } : {}),
        aliases: [char],
        parseOnly: true,
        example: { source: `\\${letter}`, bytes: [code] },
      };
    }),
    {
      escape: '\\\\',
      bytes: '0x5C',
      category: 'literal',
      description:
        'A literal backslash (needed because a lone backslash opens a UDG escape).',
      codes: [0x5c],
      example: { source: '\\\\', bytes: [0x5c] },
    },
    {
      escape: '{=n}',
      bytes: '0x0E + 5-byte form',
      category: 'numeric',
      description:
        'Numeric override after a literal: the hidden 5-byte form stored with the printed digits encodes n instead (protection tricks, e.g. 30 GO TO 20{=9999}). Emitted on import when the stored form disagrees with the digits.',
      probe: 'float',
      example: { source: '{=9999}', bytes: [0x00, 0x00, 0x0f, 0x27, 0x00] },
    },
    {
      escape: '{=$HHHHHHHHHH}',
      bytes: '0x0E + 5-byte form',
      category: 'numeric',
      description:
        'Raw form of a numeric override whose 5 stored bytes are not the canonical encoding of any decimal value.',
      probe: 'float',
      example: {
        source: '{=$00000F2700}',
        bytes: [0x00, 0x00, 0x0f, 0x27, 0x00],
      },
    },
    {
      escape: '{0xNN}',
      bytes: 'any',
      category: 'raw',
      description:
        'Any raw byte as two hex digits - unassigned control codes, 0x80, keyword-token bytes inside strings and a control directive with its operands truncated. A {...} that is not a recognised directive stays literal text.',
      codes: 'rest',
      example: { source: '{0x80}', bytes: [0x80] },
    },
  ],
};
