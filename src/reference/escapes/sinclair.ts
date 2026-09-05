// Escape-code table for the Sinclair BASIC escapes page, which covers the ZX81
// and both Spectrums. Grounded in src/dialects/zx81/charset.ts (+
// sinclairCharset.ts, zxfloat.ts) and src/dialects/zxspectrum/charset.ts (+
// floatOverride.ts), and pinned against both by
// escapes/escape-crosscheck.test.ts.
//
// One page, two character sets, and no code common to both: the ZX81 spells its
// block graphics `\\' ` and its raw bytes `\\{NN}`, while the Spectrum carries
// colour and position as `{INK n}`-style directives and spells a raw byte
// `{0xNN}`. So every row here belongs to one family, and the two lists are kept
// apart below and scoped in one place rather than badged row by row.
import type { EscapeEntry, EscapeTableData } from '../types';
import { range } from './util';

/** The ZX81's own codes. */
const zx81Entries: EscapeEntry[] = [
  // Backslash graphics escapes (zxtext2p convention): two characters naming
  // the left and right column of the cell - ' = top, . = bottom, : = full,
  // space = empty; ! = grey, | = inverse grey. Codes with an exact unicode
  // block glyph decode to the glyph, so those spellings are parse-only.
  {
    escape: "\\' ",
    bytes: '0x01',
    category: 'graphics',
    description: 'Top-left quarter block.',
    aliases: ['▘'],
    parseOnly: true,
    example: { source: "\\' ", bytes: [0x01] },
  },
  {
    escape: "\\ '",
    bytes: '0x02',
    category: 'graphics',
    description: 'Top-right quarter block.',
    aliases: ['▝'],
    parseOnly: true,
    example: { source: "\\ '", bytes: [0x02] },
  },
  {
    escape: "\\''",
    bytes: '0x03',
    category: 'graphics',
    description: 'Top half block.',
    aliases: ['▀'],
    parseOnly: true,
    example: { source: "\\''", bytes: [0x03] },
  },
  {
    escape: '\\. ',
    bytes: '0x04',
    category: 'graphics',
    description: 'Bottom-left quarter block.',
    aliases: ['▖'],
    parseOnly: true,
    example: { source: '\\. ', bytes: [0x04] },
  },
  {
    escape: '\\: ',
    bytes: '0x05',
    category: 'graphics',
    description: 'Left half block.',
    aliases: ['▌'],
    parseOnly: true,
    example: { source: '\\: ', bytes: [0x05] },
  },
  {
    escape: "\\.'",
    bytes: '0x06',
    category: 'graphics',
    description: 'Bottom-left and top-right quarters.',
    aliases: ['▞'],
    parseOnly: true,
    example: { source: "\\.'", bytes: [0x06] },
  },
  {
    escape: "\\:'",
    bytes: '0x07',
    category: 'graphics',
    description: 'All quarters except bottom-right.',
    aliases: ['▛'],
    parseOnly: true,
    example: { source: "\\:'", bytes: [0x07] },
  },
  {
    escape: '\\!!',
    bytes: '0x08',
    category: 'graphics',
    description: 'Grey (chequerboard) block.',
    aliases: ['▒'],
    parseOnly: true,
    example: { source: '\\!!', bytes: [0x08] },
  },
  {
    escape: "\\!'",
    bytes: '0x0A',
    category: 'graphics',
    description: 'Grey upper half.',
    aliases: ['🮎'],
    parseOnly: true,
    example: { source: "\\!'", bytes: [0x0a] },
  },
  {
    escape: '\\!.',
    bytes: '0x09',
    category: 'graphics',
    description: 'Grey lower half.',
    aliases: ['🮏'],
    parseOnly: true,
    example: { source: '\\!.', bytes: [0x09] },
  },
  {
    escape: '\\::',
    bytes: '0x80',
    category: 'graphics',
    description: 'Full block (inverse space).',
    aliases: ['█'],
    parseOnly: true,
    example: { source: '\\::', bytes: [0x80] },
  },
  {
    escape: '\\.:',
    bytes: '0x81',
    category: 'graphics',
    description: 'All quarters except top-left.',
    aliases: ['▟'],
    parseOnly: true,
    example: { source: '\\.:', bytes: [0x81] },
  },
  {
    escape: '\\:.',
    bytes: '0x82',
    category: 'graphics',
    description: 'All quarters except top-right.',
    aliases: ['▙'],
    parseOnly: true,
    example: { source: '\\:.', bytes: [0x82] },
  },
  {
    escape: '\\..',
    bytes: '0x83',
    category: 'graphics',
    description: 'Bottom half block.',
    aliases: ['▄'],
    parseOnly: true,
    example: { source: '\\..', bytes: [0x83] },
  },
  {
    escape: "\\':",
    bytes: '0x84',
    category: 'graphics',
    description: 'All quarters except bottom-left.',
    aliases: ['▜'],
    parseOnly: true,
    example: { source: "\\':", bytes: [0x84] },
  },
  {
    escape: '\\ :',
    bytes: '0x85',
    category: 'graphics',
    description: 'Right half block.',
    aliases: ['▐'],
    parseOnly: true,
    example: { source: '\\ :', bytes: [0x85] },
  },
  {
    escape: "\\'.",
    bytes: '0x86',
    category: 'graphics',
    description: 'Top-left and bottom-right quarters.',
    aliases: ['▚'],
    parseOnly: true,
    example: { source: "\\'.", bytes: [0x86] },
  },
  {
    escape: '\\ .',
    bytes: '0x87',
    category: 'graphics',
    description: 'Bottom-right quarter block.',
    aliases: ['▗'],
    parseOnly: true,
    example: { source: '\\ .', bytes: [0x87] },
  },
  {
    escape: '\\||',
    bytes: '0x88',
    category: 'graphics',
    description: 'Inverse grey block.',
    aliases: ['🮐'],
    parseOnly: true,
    example: { source: '\\||', bytes: [0x88] },
  },
  {
    escape: "\\|'",
    bytes: '0x8A',
    category: 'graphics',
    description: 'Inverse grey upper half over solid lower half.',
    aliases: ['🮒'],
    parseOnly: true,
    example: { source: "\\|'", bytes: [0x8a] },
  },
  {
    escape: '\\|.',
    bytes: '0x89',
    category: 'graphics',
    description: 'Solid upper half over inverse grey lower half.',
    aliases: ['🮑'],
    parseOnly: true,
    example: { source: '\\|.', bytes: [0x89] },
  },
  {
    escape: '%c',
    bytes: '0x8B–0xBF',
    category: 'inverse',
    description:
      'Inverse video: % before a letter, digit or punctuation character stores its inverse-video code, e.g. %A is inverse A.',
    codes: range(0x8b, 0xbf),
    example: { source: '%A', bytes: [0xa6] },
  },
  {
    escape: '\\{=n}',
    bytes: '0x7E + 5-byte float',
    category: 'numeric',
    description:
      'Numeric override after a literal: the hidden 5-byte float stored with the printed digits encodes n instead (protection tricks, e.g. 20\\{=9999}). Emitted on import when the stored float disagrees with the digits.',
    probe: 'float',
    example: { source: '\\{=9999}', bytes: [0x8e, 0x1c, 0x3c, 0x00, 0x00] },
  },
  {
    escape: '\\{=$HHHHHHHHHH}',
    bytes: '0x7E + 5-byte float',
    category: 'numeric',
    description:
      'Raw form of a numeric override whose 5 stored bytes are not the canonical encoding of any decimal value.',
    probe: 'float',
    example: {
      source: '\\{=$8E1C3C0000}',
      bytes: [0x8e, 0x1c, 0x3c, 0x00, 0x00],
    },
  },
  {
    escape: '\\{NN}',
    bytes: 'any',
    category: 'raw',
    description:
      'Any raw byte as two hex digits - keyword tokens inside strings, control codes (e.g. \\{76} NEWLINE), trailing REM spaces (\\{00}) and every other byte with no printable form.',
    codes: 'rest',
    example: { source: '\\{76}', bytes: [0x76] },
  },
];

/** The Spectrums' own codes; two UDG rows carry a narrower scoping of their own. */
const spectrumEntries: EscapeEntry[] = [
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
];

/**
 * Badge and scope one family's rows, leaving alone any row that already scopes
 * itself more narrowly - the two UDGs a 128K reads as tokens.
 */
function on(
  entries: EscapeEntry[],
  onlyOn: string[],
  tag: string,
): EscapeEntry[] {
  return entries.map((e) => (e.onlyOn ? e : { ...e, tag, onlyOn }));
}

export const sinclairEscapes: EscapeTableData = {
  title: 'Sinclair BASIC escape codes',
  machines: [
    'Sinclair ZX81',
    'Sinclair ZX Spectrum 48K',
    'Sinclair ZX Spectrum 128K',
  ],
  categories: [
    { id: 'graphics', label: 'Block graphics', class: 'block-graphics' },
    { id: 'inverse', label: 'Inverse video', class: 'inverse-video' },
    // INK, PAPER, AT, TAB, OVER and the rest share one chip, so the class is the
    // grab-bag one - the Spectrum's colour codes are not filed as colour here.
    { id: 'control', label: 'Control directives', class: 'control' },
    { id: 'udg', label: 'UDGs', class: 'user-defined-graphics' },
    { id: 'literal', label: 'Literals', class: 'literal' },
    { id: 'numeric', label: 'Numeric overrides', class: 'embedded-number' },
    { id: 'raw', label: 'Raw bytes', class: 'raw-byte' },
  ],
  entries: [
    ...on(zx81Entries, ['zx81'], 'ZX81 only'),
    ...on(spectrumEntries, ['zxspectrum', 'zxspectrum128'], 'Spectrum only'),
  ],
};
