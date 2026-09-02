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
import {
  parseChar as altairParseChar,
  decodeSpan as altairDecodeSpan,
} from './altair8800/charset';
import {
  parseChar as pmd85ParseChar,
  decodeSpan as pmd85DecodeSpan,
} from './pmd85/charset';
import {
  parseChar as apple1ParseChar,
  decodeSpan as apple1DecodeSpan,
} from './apple1/charset';
import {
  parseChar as apple2ParseChar,
  decodeSpan as apple2DecodeSpan,
} from './apple2/charset';
import { atariCharset } from './atari800/charset';
import { parseAtariChar } from './atari800/atascii';
import {
  parseChar as msxParseChar,
  decodeSpan as msxDecodeSpan,
} from './hb10p/charset';
import {
  parseChar as ge235ParseChar,
  decodeSpan as ge235DecodeSpan,
} from './ge235/charset';
import {
  parseChar as samcoupeParseChar,
  decodeSpan as samcoupeDecodeSpan,
} from './samcoupe/charset';

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
 * are driven from this one table: separate copies are how the scaffolder's
 * Commodore entry drifted into naming a file and a machine list the docs had
 * stopped using.
 *
 * The doc-facing fields (`varName`, `title`, `machines`, `rawSpelling`) live
 * here rather than in the scaffolder so that a new dialect is described in one
 * place; nothing in the app reads them.
 */
export interface CharsetProbe {
  /** Charset-family id, and the name of its scaffold source. */
  id: string;
  /**
   * The escapes page this family's rows live on, where that is not the family
   * id. A reference page covers a family of BASIC and a charset is a property
   * of the machine, so the two part company wherever one BASIC was carried by
   * two character generators: the Apple I and the Apple II share the Integer
   * BASIC page and decode bytes quite differently, as do the ZX81 and the
   * Spectrums on the Sinclair page. Rows belonging to one of them are scoped
   * with `onlyOn`, and the crosscheck reads each probe against its own.
   */
  page?: string;
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
  /**
   * How many codes the set has, where that is not a byte's worth. The GE-235's
   * are six bits, so its 64 codes are the whole set and a "byte" above 63 is
   * not a code at all - every consumer that walks a charset end to end reads
   * this rather than assuming 256.
   */
  codeCount?: number;
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
// Atari escapes spell a raw code point `{$xx}`, not `{0xNN}` - lower case,
// always two digits, matching `atasciiToText`'s fallback in
// `./atari800/atascii`. The parser itself accepts either case and one or two
// digits (see `parseAtariChar`), but this is the canonical spelling a decode
// produces.
const RAW_HEX_DOLLAR_BRACE = /^\{\$[0-9a-f]{2}\}$/;
// The GE-235's codes are six bits and its listings are octal throughout, so its
// raw escape names a code in octal rather than in hex: two digits, always.
const RAW_OCTAL_BRACE = /^\{0o[0-7]{2}\}$/;

/**
 * Everything about the Apple II's character generator, shared by the two
 * machines that carry it: the II and the II Plus differ in their ROM sockets,
 * not in their video.
 */
const APPLE2_CHARSET = {
  decode: (b: number) => apple2DecodeSpan(Uint8Array.of(b), 0, 1).text,
  ...parseAll(apple2ParseChar),
  isEscapeForm: BRACED_ESCAPE_FORM,
  rawPattern: RAW_HEX_BRACE,
  rawSpelling: '{0xNN}',
};

export const CHARSET_PROBES: CharsetProbe[] = [
  {
    id: 'zx81',
    page: 'sinclair',
    varName: 'sinclairEscapes',
    title: 'Sinclair BASIC escape codes',
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
    page: 'sinclair',
    varName: 'sinclairEscapes',
    title: 'Sinclair BASIC escape codes',
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
    machines: ['Amstrad CPC 464', 'Amstrad CPC 664', 'Amstrad CPC 6128'],
    dialects: ['cpc464', 'cpc664', 'cpc6128'],
    decode: (b) => cpcDecodeSpan(Uint8Array.of(b), 0, 1).text,
    ...parseAllMulti(cpcParseChar),
    isEscapeForm: BRACED_ESCAPE_FORM,
    rawPattern: RAW_HEX_BRACE,
    rawSpelling: '{0xNN}',
  },
  {
    // The one charset here with no pictures in it: the Altair has no video
    // hardware and no character generator, so the "character set" is whatever
    // 7-bit ASCII the terminal on the far end of the serial line can print.
    // Everything else - the control codes and the whole 0x80-0xFF range the
    // console never displays - is a raw-byte escape.
    id: 'altair8800',
    varName: 'altair8800Escapes',
    title: 'Altair 8800 escape codes',
    machines: ['MITS Altair 8800'],
    dialects: ['altair8800'],
    decode: (b) => altairDecodeSpan(Uint8Array.of(b), 0, 1).text,
    ...parseAll(altairParseChar),
    isEscapeForm: BRACED_ESCAPE_FORM,
    rawPattern: RAW_HEX_BRACE,
    rawSpelling: '{0xNN}',
  },
  {
    // A Czechoslovak machine whose character generator holds no accented
    // letter: Monitor 2's font is 7-bit ASCII plus one solid cell at 0x7F, and
    // nothing else in the 256 codes has a glyph. So this set has one picture
    // in it, and everything outside 0x20-0x7F is a raw-byte escape.
    id: 'pmd85',
    varName: 'pmd85Escapes',
    title: 'PMD 85 escape codes',
    machines: ['Tesla PMD 85-2'],
    dialects: ['pmd85'],
    decode: (b) => pmd85DecodeSpan(Uint8Array.of(b), 0, 1).text,
    ...parseAll(pmd85ParseChar),
    isEscapeForm: BRACED_ESCAPE_FORM,
    rawPattern: RAW_HEX_BRACE,
    rawSpelling: '{0xNN}',
  },
  {
    // The one set here that is not 7-bit: the Apple I's keyboard has PA7
    // strapped high and its display reads bit 7 as part of the code, so the 64
    // glyphs of the Signetics 2513 sit at 0xA0-0xDF rather than at 0x20-0x5F.
    // Everything else - including the whole low half - is a raw-byte escape.
    id: 'apple1',
    page: 'integer-basic',
    varName: 'integerBasicEscapes',
    title: 'Integer BASIC escape codes',
    machines: ['Apple I'],
    dialects: ['apple1'],
    decode: (b) => apple1DecodeSpan(Uint8Array.of(b), 0, 1).text,
    ...parseAll(apple1ParseChar),
    isEscapeForm: BRACED_ESCAPE_FORM,
    rawPattern: RAW_HEX_BRACE,
    rawSpelling: '{0xNN}',
  },
  {
    // The same 64 shapes of the 2513 as the Apple I, and not 7-bit either, but
    // for a different reason: here the top two bits of a screen byte pick the
    // video mode rather than another shape, so the glyphs repeat four times
    // over the byte range. 0xA0-0xDF is the normal run plain text decodes to;
    // the inverse and flashing halves are escapes, and so is the second normal
    // run, which would otherwise break the round trip.
    ...APPLE2_CHARSET,
    id: 'apple2',
    page: 'integer-basic',
    varName: 'integerBasicEscapes',
    title: 'Integer BASIC escape codes',
    machines: ['Apple II'],
    dialects: ['apple2'],
  },
  {
    // The II Plus is that same board with another BASIC in its ROM sockets, and
    // `apple2plus/index.ts` imports the sibling's charset outright - so this is
    // the entry above with the page header changed, not a second reading of one
    // character generator. The pair takes a reference page each because the two
    // BASICs share no tokens, which is the only reason there are two entries.
    ...APPLE2_CHARSET,
    id: 'applesoft',
    varName: 'applesoftEscapes',
    title: 'Applesoft BASIC escape codes',
    machines: ['Apple II Plus'],
    dialects: ['apple2plus'],
  },
  {
    id: 'atari',
    varName: 'atariEscapes',
    title: 'Atari escape codes',
    machines: ['Atari 800', 'Atari 400'],
    dialects: ['atari800', 'atari400'],
    decode: (b) => atariCharset.glyph(b),
    ...parseAll(parseAtariChar),
    isEscapeForm: BRACED_ESCAPE_FORM,
    rawPattern: RAW_HEX_DOLLAR_BRACE,
    rawSpelling: '{$NN}',
  },
  {
    id: 'msx',
    varName: 'msxEscapes',
    title: 'MSX BASIC escape codes',
    machines: ['Sony HB-10P'],
    dialects: ['hb10p'],
    decode: (b) => msxDecodeSpan(Uint8Array.of(b), 0, 1).text,
    // Multi-byte in both directions: a graphic character (0x00-0x1F's shape) is
    // one editor character and the two bytes 0x01 and code+0x40.
    ...parseAllMulti(msxParseChar),
    isEscapeForm: BRACED_ESCAPE_FORM,
    rawPattern: RAW_HEX_BRACE,
    rawSpelling: '{0xNN}',
  },
  {
    // Six bits, not eight: the Teletype's set is 64 BCD codes, 57 of them
    // printing, and there is no second half to escape. Nor is there a picture
    // in it - the terminal is a paper roll, so a code either strikes a type bar
    // or works the carriage.
    id: 'dartmouth',
    varName: 'dartmouthEscapes',
    title: 'GE-235 escape codes',
    machines: ['GE-235'],
    dialects: ['ge235'],
    codeCount: 64,
    decode: (b) => ge235DecodeSpan(Uint8Array.of(b), 0).text,
    ...parseAll(ge235ParseChar),
    isEscapeForm: BRACED_ESCAPE_FORM,
    rawPattern: RAW_OCTAL_BRACE,
    rawSpelling: '{0oNN}',
  },
  {
    id: 'samcoupe',
    varName: 'samcoupeEscapes',
    title: 'SAM BASIC escape codes',
    machines: ['MGT SAM Coupé'],
    dialects: ['samcoupe'],
    decode: (b) => samcoupeDecodeSpan(Uint8Array.of(b), 0, 1).text,
    // Multi-byte in both directions: an embedded print control carries one or
    // two operand bytes, so `{AT 1,3}` is one unit and three bytes.
    ...parseAllMulti(samcoupeParseChar),
    // Two escape forms rather than one: the braces are the print-control
    // directives and the raw bytes, and `\\a`-`\\y` are the user-defined
    // graphics, which is why this is not BRACED_ESCAPE_FORM.
    isEscapeForm: (t) => /^\{.+\}$/.test(t) || t.startsWith('\\'),
    rawPattern: RAW_HEX_BRACE,
    rawSpelling: '{0xNN}',
  },
];

/** The number of codes a probe's set holds - a byte's worth unless it says otherwise. */
export function codeCountOf(probe: CharsetProbe): number {
  return probe.codeCount ?? 256;
}

const byDialect = new Map<string, CharsetProbe>();
for (const probe of CHARSET_PROBES) {
  for (const id of probe.dialects) byDialect.set(id, probe);
}

/** The charset probe for a registered dialect id, or undefined if unknown. */
export function probeFor(dialectId: string): CharsetProbe | undefined {
  return byDialect.get(dialectId);
}
