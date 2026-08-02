import { parseChar as zx81ParseChar, zx81Charset } from './zx81/charset';
import { parseChar as zx80ParseChar, zx80Charset } from './zx80/charset';
import {
  parseChar as spectrumParseChar,
  decodeSpan as spectrumDecodeSpan,
} from './zxspectrum/charset';
import {
  parseChar as bbcParseChar,
  decodeSpan as bbcDecodeSpan,
} from './bbcmicro/charset';
import { parseC64Char, petsciiToText } from './commodore64/petscii';
import {
  parseChar as trs80ParseChar,
  decodeSpan as trs80DecodeSpan,
} from './trs80/charset';
import {
  parseChar as atomParseChar,
  decodeSpan as atomDecodeSpan,
} from './atom/charset';
import {
  parseChar as cpcParseChar,
  decodeSpan as cpcDecodeSpan,
} from './cpc464/charset';

/**
 * How to drive each charset generically: the canonical decode of a byte, a
 * whole-string parse back to bytes, and what an escape looks like on this
 * machine.
 *
 * Several dialects share one charset (the two Spectrums, the two BBCs, the two
 * CPCs, and all three Commodores), so probes are keyed by *charset family*
 * rather than by dialect - the same grouping the reference pages use. The
 * `dialects` field maps each family back onto the ids in {@link ./registry},
 * and `charsetProbes.test.ts` pins that the two agree.
 *
 * Four consumers read this table, which is the reason it exists: the escape
 * scaffolder (`scripts/gen-escape-scaffold.mts`), the escape cross-check
 * (`src/reference/escapes/escape-crosscheck.test.ts`), the semigraphics
 * audit ({@link ./semigraphicsAudit}), and the program analyser behind the
 * porting guide's narrowing ({@link ../app/programVocabulary}), which walks a
 * string literal a unit at a time through {@link CharsetProbe.parseUnit}. They
 * each used to carry their own copy, which is how the scaffolder's Commodore
 * entry drifted into naming a file and a machine list the docs no longer used.
 *
 * The doc-facing fields (`varName`, `title`, `machines`, `rawSpelling`) live
 * here rather than in the scaffolder so that a new dialect is described in one
 * place; nothing in the app reads them.
 */
export interface CharsetProbe {
  /** Charset-family id; matches `src/reference/escapes/<id>.ts`. */
  id: string;
  /** Name of the exported table in that data file. */
  varName: string;
  /** Reference-page title. */
  title: string;
  /** Human-readable machines the family covers. */
  machines: string[];
  /** Registered dialect ids sharing this charset. */
  dialects: string[];
  /** Canonical decode of one byte, in string/literal context. */
  decode(byte: number): string;
  /** Parse a whole source string to machine bytes through the dialect charset. */
  parse(text: string): number[];
  /**
   * Parse the single unit starting at `i`: the bytes it produces and how many
   * source characters it consumed. This is the step {@link parse} already
   * iterates - exposed because a caller that wants to tell an escape from a
   * plain character needs the source span, which the flattened byte list has
   * thrown away (`{white}` and `\`` are one byte each, spanning seven source
   * characters and two).
   */
  parseUnit(text: string, i: number): { codes: number[]; length: number };
  /** True when a decode form is an escape rather than a plain printable. */
  isEscapeForm(text: string): boolean;
  /** Shape of the catch-all raw-byte escape. */
  rawPattern: RegExp;
  /** How that raw-byte escape is spelled in the docs. */
  rawSpelling: string;
}

/** The per-unit parser shape most charsets expose (one byte per unit). */
type SingleUnitParser = (
  text: string,
  i: number,
) => { code: number; length: number };
/** The shape the multi-byte charsets expose (Spectrum, BBC, CPC). */
type MultiUnitParser = (
  text: string,
  i: number,
) => { codes: number[]; length: number };

/** The pair of parse entry points, derived from one per-unit parser. */
type Parsers = Pick<CharsetProbe, 'parse' | 'parseUnit'>;

/** Drive a per-unit parser over a whole string. */
function parseAllWith(text: string, unit: MultiUnitParser): number[] {
  const out: number[] = [];
  let i = 0;
  while (i < text.length) {
    const { codes, length } = unit(text, i);
    out.push(...codes);
    i += length;
  }
  return out;
}

/**
 * Both entry points from one per-unit parser, so `parse` is by construction the
 * whole-string drive of `parseUnit` rather than a second implementation that
 * could drift from it (`charsetProbes.test.ts` pins that they agree anyway).
 */
function parseAll(unit: SingleUnitParser): Parsers {
  return parseAllMulti((text, i) => {
    const { code, length } = unit(text, i);
    return { codes: [code], length };
  });
}

/** Same, for the `{codes,length}` shape (Spectrum, BBC, CPC). */
function parseAllMulti(unit: MultiUnitParser): Parsers {
  return { parse: (t) => parseAllWith(t, unit), parseUnit: unit };
}

const SINCLAIR_ESCAPE_FORM = (t: string) =>
  t.startsWith('\\') || t.startsWith('%');
const BRACED_ESCAPE_FORM = (t: string) => /^\{.+\}$/.test(t);
const RAW_HEX_BRACE = /^\{0x[0-9A-F]{2}\}$/;

export const CHARSET_PROBES: CharsetProbe[] = [
  {
    id: 'zx81',
    varName: 'zx81Escapes',
    title: 'ZX81 escape codes',
    machines: ['Sinclair ZX81'],
    dialects: ['zx81'],
    decode: (b) => zx81Charset.glyph(b),
    ...parseAll(zx81ParseChar),
    isEscapeForm: SINCLAIR_ESCAPE_FORM,
    rawPattern: /^\\\{[0-9A-F]{2}\}$/,
    rawSpelling: '\\{NN}',
  },
  {
    id: 'zx80',
    varName: 'zx80Escapes',
    title: 'ZX80 escape codes',
    machines: ['Sinclair ZX80'],
    dialects: ['zx80'],
    decode: (b) => zx80Charset.glyph(b),
    ...parseAll(zx80ParseChar),
    isEscapeForm: SINCLAIR_ESCAPE_FORM,
    rawPattern: /^\\\{[0-9A-F]{2}\}$/,
    rawSpelling: '\\{NN}',
  },
  {
    id: 'zxspectrum',
    varName: 'zxspectrumEscapes',
    title: 'ZX Spectrum escape codes',
    machines: ['Sinclair ZX Spectrum 48K', 'Sinclair ZX Spectrum 128K'],
    dialects: ['zxspectrum', 'zxspectrum128'],
    decode: (b) => spectrumDecodeSpan(Uint8Array.of(b), 0, 1).text,
    ...parseAllMulti(spectrumParseChar),
    // The Spectrum has both the zmakebas UDG escapes (`\a`) and braced
    // directives (`{INK 2}`), so it admits either opener.
    isEscapeForm: (t) => t.startsWith('\\') || /^\{.*\}$/.test(t),
    rawPattern: RAW_HEX_BRACE,
    rawSpelling: '{0xNN}',
  },
  {
    id: 'bbc',
    varName: 'bbcEscapes',
    title: 'BBC escape codes',
    machines: ['BBC Micro Model B', 'BBC Master'],
    dialects: ['bbcmicro', 'bbcmaster'],
    decode: (b) => bbcDecodeSpan(Uint8Array.of(b), 0, 1).text,
    ...parseAllMulti(bbcParseChar),
    isEscapeForm: (t) => /^\{.*\}$/.test(t),
    rawPattern: RAW_HEX_BRACE,
    rawSpelling: '{0xNN}',
  },
  {
    id: 'commodore',
    varName: 'commodoreEscapes',
    title: 'Commodore escape codes',
    machines: ['Commodore 64', 'Commodore VIC-20', 'Commodore PET'],
    dialects: ['commodore64', 'vic20', 'pet'],
    decode: (b) => petsciiToText(b),
    ...parseAll(parseC64Char),
    isEscapeForm: (t) => /^\{.*\}$/.test(t),
    rawPattern: /^\{\$[0-9a-f]{2}\}$/,
    rawSpelling: '{$xx}',
  },
  {
    id: 'trs80',
    varName: 'trs80Escapes',
    title: 'TRS-80 escape codes',
    machines: ['TRS-80 Model I (Level II BASIC)'],
    dialects: ['trs80'],
    decode: (b) => trs80DecodeSpan(Uint8Array.of(b), 0, 1).text,
    ...parseAll(trs80ParseChar),
    isEscapeForm: BRACED_ESCAPE_FORM,
    rawPattern: RAW_HEX_BRACE,
    rawSpelling: '{0xNN}',
  },
  {
    id: 'atom',
    varName: 'atomEscapes',
    title: 'Acorn Atom escape codes',
    machines: ['Acorn Atom'],
    dialects: ['atom'],
    decode: (b) => atomDecodeSpan(Uint8Array.of(b), 0, 1).text,
    ...parseAll(atomParseChar),
    isEscapeForm: BRACED_ESCAPE_FORM,
    rawPattern: RAW_HEX_BRACE,
    rawSpelling: '{0xNN}',
  },
  {
    id: 'cpc',
    varName: 'cpcEscapes',
    title: 'Amstrad CPC escape codes',
    machines: ['Amstrad CPC 464', 'Amstrad CPC 6128'],
    dialects: ['cpc464', 'cpc6128'],
    decode: (b) => cpcDecodeSpan(Uint8Array.of(b), 0, 1).text,
    ...parseAllMulti(cpcParseChar),
    isEscapeForm: BRACED_ESCAPE_FORM,
    rawPattern: RAW_HEX_BRACE,
    rawSpelling: '{0xNN}',
  },
];

const byDialect = new Map<string, CharsetProbe>();
for (const probe of CHARSET_PROBES) {
  for (const id of probe.dialects) byDialect.set(id, probe);
}

/** The charset probe for a registered dialect id, or undefined if unknown. */
export function probeFor(dialectId: string): CharsetProbe | undefined {
  return byDialect.get(dialectId);
}
