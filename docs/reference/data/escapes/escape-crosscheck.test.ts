/**
 * Pins every escape-table row (and the tables' completeness) to the real
 * dialect implementations, so the docs cannot drift from the code:
 *
 *  1. Probe: each row's `example.source` (and each alias) must parse to
 *     exactly `example.bytes` through the dialect's own charset parser, and
 *     a canonical single-byte row must decode back to its spelling.
 *  2. Coverage: enumerating 0x00–0xFF, every byte whose canonical decode is
 *     an escape form must be claimed by a row's `codes` or fall to the
 *     table's `'rest'` row (whose decode must match the raw-escape pattern).
 *     A new named escape added in a charset fails here until the docs row
 *     exists - "every escape code" stays true as the code evolves.
 *  3. Table-driven extras: parse-only spellings that never appear in decode
 *     enumeration (Sinclair backslash graphics, petcat aliases, {CBM-x} and
 *     {SHIFT-x}) are checked against their source tables.
 *
 * This test may import src/ freely: vitest runs it in node and the VitePress
 * bundle never includes *.test.ts, so the docs pages themselves stay free of
 * dialect code.
 */
import { describe, expect, it } from 'vitest';
import type { EscapeEntry, EscapeTableData } from '../types';

import { zx81Escapes } from './zx81';
import { zx80Escapes } from './zx80';
import { zxspectrumEscapes } from './zxspectrum';
import { bbcEscapes } from './bbc';
import { commodore64Escapes } from './commodore64';
import { trs80Escapes } from './trs80';
import { atomEscapes } from './atom';
import { cpcEscapes } from './cpc';

import {
  parseChar as zx81ParseChar,
  zx81Charset,
  ESCAPES as ZX81_ESCAPES,
  GRAPHIC_UNICODE as ZX81_GRAPHICS,
} from '../../../../src/dialects/zx81/charset';
import {
  parseChar as zx80ParseChar,
  zx80Charset,
  ESCAPES as ZX80_ESCAPES,
  GRAPHIC_UNICODE as ZX80_GRAPHICS,
} from '../../../../src/dialects/zx80/charset';
import {
  floatOverrideNotation as zx81FloatNotation,
  parseFloatOverride as zx81ParseFloat,
} from '../../../../src/dialects/zx81/zxfloat';
import {
  parseChar as spectrumParseChar,
  decodeSpan as spectrumDecodeSpan,
} from '../../../../src/dialects/zxspectrum/charset';
import {
  floatOverrideNotation as spectrumFloatNotation,
  parseFloatOverride as spectrumParseFloat,
} from '../../../../src/dialects/zxspectrum/floatOverride';
import {
  parseChar as bbcParseChar,
  decodeSpan as bbcDecodeSpan,
  TELETEXT_NAMES,
} from '../../../../src/dialects/bbcmicro/charset';
import {
  parseC64Char,
  petsciiToText,
  PETCAT_ALIASES,
} from '../../../../src/dialects/commodore64/petscii';
import {
  C64_COMMODORE_GRAPHICS,
  C64_SHIFT_GRAPHICS,
} from '../../../../src/dialects/commodore64/graphics';
import {
  parseChar as trs80ParseChar,
  decodeSpan as trs80DecodeSpan,
} from '../../../../src/dialects/trs80/charset';
import {
  parseChar as atomParseChar,
  decodeSpan as atomDecodeSpan,
} from '../../../../src/dialects/atom/charset';
import {
  parseChar as cpcParseChar,
  decodeSpan as cpcDecodeSpan,
} from '../../../../src/dialects/cpc464/charset';

interface Adapter {
  data: EscapeTableData;
  /** Parse a full source string to machine bytes via the dialect charset. */
  parse(text: string): number[];
  /** Canonical decode of one byte (string/literal context). */
  decode(byte: number): string;
  /** True when a decode form is an escape (not a plain printable). */
  isEscapeForm(text: string): boolean;
  /** What the 'rest' row's decode forms look like. */
  rawPattern: RegExp;
  /** For probe:'float' rows. */
  float?: {
    parse(source: string): number[] | null;
    notation(bytes: number[]): string;
  };
}

/** Drive a `{code,length}`-shaped per-unit parser over a whole string. */
function parseAll(
  text: string,
  unit: (text: string, i: number) => { code: number; length: number },
): number[] {
  const out: number[] = [];
  let i = 0;
  while (i < text.length) {
    const { code, length } = unit(text, i);
    out.push(code);
    i += length;
  }
  return out;
}

/** Same, for the `{codes,length}` shape (Spectrum, BBC). */
function parseAllMulti(
  text: string,
  unit: (text: string, i: number) => { codes: number[]; length: number },
): number[] {
  const out: number[] = [];
  let i = 0;
  while (i < text.length) {
    const { codes, length } = unit(text, i);
    out.push(...codes);
    i += length;
  }
  return out;
}

const ADAPTERS: [string, Adapter][] = [
  [
    'zx81',
    {
      data: zx81Escapes,
      parse: (t) => parseAll(t, zx81ParseChar),
      decode: (b) => zx81Charset.glyph(b),
      isEscapeForm: (t) => t.startsWith('\\') || t.startsWith('%'),
      rawPattern: /^\\\{[0-9A-F]{2}\}$/,
      float: {
        parse: floatParserFor(zx81ParseFloat),
        notation: zx81FloatNotation,
      },
    },
  ],
  [
    'zx80',
    {
      data: zx80Escapes,
      parse: (t) => parseAll(t, zx80ParseChar),
      decode: (b) => zx80Charset.glyph(b),
      isEscapeForm: (t) => t.startsWith('\\') || t.startsWith('%'),
      rawPattern: /^\\\{[0-9A-F]{2}\}$/,
    },
  ],
  [
    'zxspectrum',
    {
      data: zxspectrumEscapes,
      parse: (t) => parseAllMulti(t, spectrumParseChar),
      decode: (b) => spectrumDecodeSpan(Uint8Array.of(b), 0, 1).text,
      isEscapeForm: (t) => t.startsWith('\\') || /^\{.*\}$/.test(t),
      rawPattern: /^\{0x[0-9A-F]{2}\}$/,
      float: {
        parse: floatParserFor(spectrumParseFloat),
        notation: spectrumFloatNotation,
      },
    },
  ],
  [
    'bbc',
    {
      data: bbcEscapes,
      parse: (t) => parseAllMulti(t, bbcParseChar),
      decode: (b) => bbcDecodeSpan(Uint8Array.of(b), 0, 1).text,
      isEscapeForm: (t) => /^\{.*\}$/.test(t),
      rawPattern: /^\{0x[0-9A-F]{2}\}$/,
    },
  ],
  [
    'commodore64',
    {
      data: commodore64Escapes,
      parse: (t) => parseAll(t, parseC64Char),
      decode: (b) => petsciiToText(b),
      isEscapeForm: (t) => /^\{.*\}$/.test(t),
      rawPattern: /^\{\$[0-9a-f]{2}\}$/,
    },
  ],
  [
    'trs80',
    {
      data: trs80Escapes,
      parse: (t) => parseAll(t, trs80ParseChar),
      decode: (b) => trs80DecodeSpan(Uint8Array.of(b), 0, 1).text,
      isEscapeForm: (t) => /^\{.+\}$/.test(t),
      rawPattern: /^\{0x[0-9A-F]{2}\}$/,
    },
  ],
  [
    'atom',
    {
      data: atomEscapes,
      parse: (t) => parseAll(t, atomParseChar),
      decode: (b) => atomDecodeSpan(Uint8Array.of(b), 0, 1).text,
      isEscapeForm: (t) => /^\{.+\}$/.test(t),
      rawPattern: /^\{0x[0-9A-F]{2}\}$/,
    },
  ],
  [
    'cpc',
    {
      data: cpcEscapes,
      parse: (t) => parseAllMulti(t, cpcParseChar),
      decode: (b) => cpcDecodeSpan(Uint8Array.of(b), 0, 1).text,
      isEscapeForm: (t) => /^\{.+\}$/.test(t),
      rawPattern: /^\{0x[0-9A-F]{2}\}$/,
    },
  ],
];

/** Adapt a parseFloatOverride to a whole-source parser. */
function floatParserFor(
  parseOverride: (
    text: string,
    i: number,
  ) => { bytes: number[]; end: number } | null,
): (source: string) => number[] | null {
  return (source) => {
    const parsed = parseOverride(source, 0);
    if (!parsed || parsed.end !== source.length) return null;
    return parsed.bytes;
  };
}

describe.each(ADAPTERS)('escape cross-check: %s', (_id, adapter) => {
  const { data } = adapter;

  it('every example (and alias) parses to its documented bytes', () => {
    for (const e of data.entries) {
      if (e.probe === 'float') continue;
      expect(adapter.parse(e.example.source), e.escape).toEqual(
        e.example.bytes,
      );
      for (const alias of e.aliases ?? []) {
        expect(adapter.parse(alias), `${e.escape} alias ${alias}`).toEqual(
          e.example.bytes,
        );
      }
    }
  });

  it('canonical single-byte rows decode back to their spelling', () => {
    for (const e of data.entries) {
      if (e.probe === 'float' || e.parseOnly) continue;
      if (!Array.isArray(e.codes) || e.codes.length !== 1) continue;
      // Operand-carrying escapes ({INK n}: 2+ stored bytes) can't be decoded
      // from their control byte alone; the parse probe already pins them.
      if (e.example.bytes.length !== 1) continue;
      expect(adapter.decode(e.codes[0]!), e.escape).toBe(e.example.source);
    }
  });

  it('float-override rows survive a parse/notation round-trip', () => {
    const floats = data.entries.filter((e) => e.probe === 'float');
    if (floats.length === 0) return;
    expect(adapter.float, 'float adapter').toBeDefined();
    for (const e of floats) {
      const bytes = adapter.float!.parse(e.example.source);
      expect(bytes, e.escape).toEqual(e.example.bytes);
      // The notation for those bytes must itself parse back to the same
      // bytes (the canonical spelling may be the decimal form).
      const notation = adapter.float!.notation(e.example.bytes);
      expect(adapter.float!.parse(notation), `${e.escape} notation`).toEqual(
        e.example.bytes,
      );
    }
  });

  it('covers every escape-needing byte 0x00-0xFF', () => {
    const claimed = new Map<number, string>();
    let restRow: EscapeEntry | undefined;
    for (const e of data.entries) {
      if (e.codes === 'rest') {
        restRow = e;
      } else {
        for (const c of e.codes ?? []) {
          expect(claimed.has(c), `byte ${c} claimed twice`).toBe(false);
          claimed.set(c, e.escape);
        }
      }
    }
    for (let b = 0; b < 256; b++) {
      const text = adapter.decode(b);
      const needsEscape = adapter.isEscapeForm(text);
      const claim = claimed.get(b);
      if (claim !== undefined) {
        // A claimed byte must genuinely decode to an escape form.
        expect(
          needsEscape,
          `${claim} claims 0x${b.toString(16)} (${text})`,
        ).toBe(true);
      } else if (needsEscape) {
        // Unclaimed escape byte: it must be the raw catch-all's shape.
        expect(
          restRow,
          `no rest row for 0x${b.toString(16)} (${text})`,
        ).toBeDefined();
        expect(
          adapter.rawPattern.test(text),
          `0x${b.toString(16)} decodes to ${text}, which no row documents`,
        ).toBe(true);
      }
    }
  });
});

describe('escape cross-check: table-driven extras', () => {
  it('every BBC teletext name has a row', () => {
    const spellings = new Set(bbcEscapes.entries.map((e) => e.escape));
    for (const name of Object.values(TELETEXT_NAMES)) {
      expect(spellings.has(`{${name}}`), name).toBe(true);
    }
  });

  it('every petcat alias appears as a C64 row or alias', () => {
    const spellings = new Set(
      commodore64Escapes.entries.flatMap((e) => [
        e.escape,
        ...(e.aliases ?? []),
      ]),
    );
    for (const name of Object.keys(PETCAT_ALIASES)) {
      expect(spellings.has(`{${name}}`), name).toBe(true);
    }
  });

  it('every C64 letter-key graphic has a {CBM-x}/{SHIFT-x} row', () => {
    const spellings = new Set(commodore64Escapes.entries.map((e) => e.escape));
    for (const { key } of C64_COMMODORE_GRAPHICS) {
      if (/^[A-Z]$/.test(key)) {
        expect(spellings.has(`{CBM-${key.toLowerCase()}}`), key).toBe(true);
      }
    }
    for (const { key } of C64_SHIFT_GRAPHICS) {
      if (/^[A-Z]$/.test(key)) {
        expect(spellings.has(`{SHIFT-${key.toLowerCase()}}`), key).toBe(true);
      }
    }
  });

  it('every Sinclair backslash escape has a row, with its glyph as alias', () => {
    for (const [table, escapes, graphics] of [
      [zx81Escapes, ZX81_ESCAPES, ZX81_GRAPHICS],
      [zx80Escapes, ZX80_ESCAPES, ZX80_GRAPHICS],
    ] as const) {
      const byEscape = new Map(table.entries.map((e) => [e.escape, e]));
      for (const [key, code] of Object.entries(escapes)) {
        const row = byEscape.get(`\\${key}`);
        expect(row, `${table.title}: \\${key}`).toBeDefined();
        expect(row!.example.bytes, `${table.title}: \\${key}`).toEqual([code]);
        const glyph = graphics[code];
        if (glyph !== undefined) {
          expect(
            row!.aliases ?? [],
            `${table.title}: \\${key} glyph`,
          ).toContain(glyph);
        }
      }
    }
  });
});
