// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * MSX BASIC's typed numeric constants: the half of the program format that a
 * hand-written keyword table cannot cover.
 *
 * A number in a tokenized line is never its own text. A one-byte prefix says
 * what follows - octal, hex, a line reference, a small integer, a two-byte
 * integer, a single or a double - and the value follows in the machine's own
 * form. The floats are the part that surprises a reader who knows the rest of
 * the Microsoft family: MSX BASIC keeps them in **binary-coded decimal**, not
 * in Microsoft binary format, which is why the machine's double precision is
 * exactly fourteen decimal digits rather than an awkward binary approximation
 * of them. A value is `0.<mantissa digits> x 10^<exponent>`, the exponent byte
 * carries the sign in bit 7 and the exponent in excess-64, and the mantissa is
 * two digits per byte with the first digit non-zero.
 *
 * Because the storage is decimal, a decimal literal round-trips exactly as far
 * as its precision goes: 0.1 is 0.1 here, not 0.1000000000000000055.
 */

/** Prefix bytes introducing a typed constant. */
export const TOK_OCTAL = 0x0b;
export const TOK_HEX = 0x0c;
export const TOK_LINE_PTR = 0x0d;
export const TOK_LINE_REF = 0x0e;
export const TOK_BYTE = 0x0f;
/** 0x11-0x1A hold the constants 0-9 in the token itself. */
export const TOK_DIGIT_0 = 0x11;
export const TOK_DIGIT_9 = 0x1a;
export const TOK_INT16 = 0x1c;
export const TOK_SINGLE = 0x1d;
export const TOK_DOUBLE = 0x1f;

/** Mantissa bytes, and therefore BCD digits, in each float type. */
const SINGLE_BYTES = 3;
const DOUBLE_BYTES = 7;
const SINGLE_DIGITS = SINGLE_BYTES * 2;
const DOUBLE_DIGITS = DOUBLE_BYTES * 2;

/** Excess-64 bias on the exponent byte, and the sign bit above it. */
const EXP_BIAS = 0x40;
const SIGN_BIT = 0x80;

/** The largest line number MSX BASIC accepts. */
export const MAX_LINE = 65529;

/** A decimal value as the machine holds it: 0.digits x 10^exp. */
interface Decimal {
  /** Significant digits, no leading or trailing zero. Empty means zero. */
  digits: string;
  exp: number;
  negative: boolean;
}

type NumType = 'integer' | 'single' | 'double';

const ZERO: Decimal = { digits: '', exp: 0, negative: false };

/** The decimal's value as a JavaScript number. */
function decimalValue(dec: Decimal): number {
  if (dec.digits === '') return 0;
  return Number(`${dec.negative ? '-' : ''}0.${dec.digits}e${dec.exp}`);
}

/** Split a literal's digits into the normalized `0.digits x 10^exp` form. */
function toDecimal(intPart: string, fracPart: string, exp10: number): Decimal {
  let digits = intPart + fracPart;
  let exp = intPart.length + exp10;
  let lead = 0;
  while (lead < digits.length && digits[lead] === '0') {
    lead++;
    exp--;
  }
  digits = digits.slice(lead).replace(/0+$/, '');
  return digits === '' ? ZERO : { digits, exp, negative: false };
}

/** Round a decimal to `n` significant digits, half away from zero. */
function roundTo(dec: Decimal, n: number): Decimal {
  if (dec.digits.length <= n) return dec;
  let kept = dec.digits.slice(0, n);
  let exp = dec.exp;
  if (dec.digits.charCodeAt(n) >= 0x35) {
    // Increment the kept digits as a decimal string; a carry off the top
    // shortens the mantissa to a single 1 and raises the exponent.
    const carried = (BigInt(kept) + 1n).toString();
    if (carried.length > n) {
      kept = carried.slice(0, n);
      exp += 1;
    } else {
      kept = carried.padStart(n, '0');
    }
  }
  const digits = kept.replace(/0+$/, '');
  return digits === '' ? ZERO : { digits, exp, negative: dec.negative };
}

/** Pack a decimal into its exponent byte and BCD mantissa. */
function encodeFloat(dec: Decimal, mantissaBytes: number): number[] {
  const bytes = new Array<number>(mantissaBytes + 1).fill(0);
  if (dec.digits === '') return bytes;
  bytes[0] = (dec.negative ? SIGN_BIT : 0) | ((EXP_BIAS + dec.exp) & 0x7f);
  const digits = dec.digits.padEnd(mantissaBytes * 2, '0');
  for (let i = 0; i < mantissaBytes; i++) {
    bytes[i + 1] =
      (digits.charCodeAt(i * 2) - 0x30) * 16 +
      (digits.charCodeAt(i * 2 + 1) - 0x30);
  }
  return bytes;
}

/** Unpack an exponent byte and BCD mantissa back to a decimal. */
function decodeFloat(
  bytes: ArrayLike<number>,
  i: number,
  mantissaBytes: number,
): Decimal {
  const head = bytes[i]!;
  if ((head & 0x7f) === 0) return ZERO;
  let digits = '';
  for (let k = 1; k <= mantissaBytes; k++) {
    const b = bytes[i + k] ?? 0;
    digits += String(b >> 4) + String(b & 0x0f);
  }
  digits = digits.replace(/0+$/, '');
  if (digits === '') return ZERO;
  return {
    digits,
    exp: (head & 0x7f) - EXP_BIAS,
    negative: (head & SIGN_BIT) !== 0,
  };
}

/**
 * Render a decimal as program text. Fixed notation while the point sits inside
 * or just beside the digits, exponent notation beyond that - `E` for a single
 * and `D` for a double, which is how the machine tells the two apart in text.
 */
function formatDecimal(dec: Decimal, type: NumType): string {
  if (dec.digits === '') return '0';
  const sign = dec.negative ? '-' : '';
  const maxDigits = type === 'double' ? DOUBLE_DIGITS : SINGLE_DIGITS;
  const { digits, exp } = dec;
  if (exp > 0 && exp <= maxDigits) {
    const whole = digits.slice(0, exp).padEnd(exp, '0');
    const frac = digits.slice(exp);
    return sign + whole + (frac ? `.${frac}` : '');
  }
  if (exp <= 0 && exp > -3) {
    return `${sign}.${'0'.repeat(-exp)}${digits}`;
  }
  const mantissa =
    digits.length > 1 ? `${digits[0]}.${digits.slice(1)}` : digits[0]!;
  const e = exp - 1;
  return `${sign}${mantissa}${type === 'double' ? 'D' : 'E'}${e < 0 ? '-' : '+'}${Math.abs(e)}`;
}

/** Encode a whole number 0-32767 in the shortest integer form. */
export function encodeInteger(value: number): number[] {
  if (value <= 9) return [TOK_DIGIT_0 + value];
  if (value <= 0xff) return [TOK_BYTE, value];
  return [TOK_INT16, value & 0xff, (value >> 8) & 0xff];
}

/** Encode a line reference: always the two-byte form, whatever the value. */
export function encodeLineRef(line: number): number[] {
  return [TOK_LINE_REF, line & 0xff, (line >> 8) & 0xff];
}

/** What type a literal's own shape asks for, before its magnitude is known. */
function declaredType(
  suffix: string,
  exponentLetter: string,
  hasPoint: boolean,
  significant: number,
): NumType {
  if (suffix === '%') return 'integer';
  if (suffix === '!') return 'single';
  if (suffix === '#') return 'double';
  if (exponentLetter === 'D') return 'double';
  if (exponentLetter === 'E') return 'single';
  if (!hasPoint) return significant > SINGLE_DIGITS ? 'double' : 'integer';
  return significant > SINGLE_DIGITS ? 'double' : 'single';
}

export interface ParsedNumber {
  bytes: number[];
  /** Source characters consumed. */
  length: number;
  /** Set when the machine would refuse the literal (an overflow). */
  error?: string;
}

const NUMBER_RE = /^(\d*)(?:\.(\d*))?(?:([EeDd])([+-]?)(\d+))?([%!#]?)/;

/**
 * Read the numeric literal at `i`, or return null when nothing there is one.
 *
 * `&H` and `&O` (and a bare `&`, which the machine reads as octal too) become
 * their own two-byte tokens. `&B` does not: MSX BASIC has no binary constant
 * token, so it stores the literal as the text `&B` and its digits and parses
 * it again every time the line runs.
 */
export function parseNumber(text: string, i: number): ParsedNumber | null {
  if (text[i] === '&') {
    const radix = /^&([HhOoBb]?)([0-9A-Fa-f]*)/.exec(text.slice(i));
    if (!radix) return null;
    const marker = radix[1]!.toUpperCase();
    if (marker === 'B') {
      const bits = /^[01]*/.exec(text.slice(i + 2))![0];
      if (bits === '') return null;
      const literal = `&B${bits}`;
      return {
        bytes: [...literal].map((c) => c.charCodeAt(0)),
        length: literal.length,
      };
    }
    const isHex = marker === 'H';
    const body = isHex
      ? /^[0-9A-Fa-f]*/.exec(text.slice(i + 2))![0]
      : /^[0-7]*/.exec(text.slice(i + (marker === 'O' ? 2 : 1)))![0];
    if (body === '') return null;
    const value = parseInt(body, isHex ? 16 : 8) & 0xffff;
    return {
      bytes: [isHex ? TOK_HEX : TOK_OCTAL, value & 0xff, (value >> 8) & 0xff],
      length: (isHex || marker === 'O' ? 2 : 1) + body.length,
    };
  }

  const m = NUMBER_RE.exec(text.slice(i));
  if (!m) return null;
  const intPart = m[1]!;
  const fracPart = m[2];
  const expLetter = (m[3] ?? '').toUpperCase();
  const expDigits = m[5] ?? '';
  const suffix = m[6]!;
  if (intPart === '' && (fracPart === undefined || fracPart === ''))
    return null;

  const exp10 =
    expLetter === '' ? 0 : Number(`${m[4] === '-' ? '-' : ''}${expDigits}`);
  const dec = toDecimal(intPart, fracPart ?? '', exp10);
  const significant = dec.digits.length;
  const type = declaredType(
    suffix,
    expLetter,
    fracPart !== undefined,
    significant,
  );
  const length = m[0]!.length;

  if (type === 'integer') {
    // `%` rounds its literal to a whole number, as CINT does; anything else
    // reaching here has no fractional part to lose.
    const value = Math.round(decimalValue(dec));
    if (value >= 0 && value <= 32767) {
      return { bytes: encodeInteger(value), length };
    }
    if (suffix === '%') {
      return { bytes: [], length, error: 'Number out of range' };
    }
    // A whole number too big for two bytes is stored as a float instead, the
    // integer token having nowhere to put it.
    return {
      bytes: [
        TOK_SINGLE,
        ...encodeFloat(roundTo(dec, SINGLE_DIGITS), SINGLE_BYTES),
      ],
      length,
    };
  }

  const digits = type === 'double' ? DOUBLE_DIGITS : SINGLE_DIGITS;
  const mantissa = type === 'double' ? DOUBLE_BYTES : SINGLE_BYTES;
  const rounded = roundTo(dec, digits);
  if (rounded.digits !== '' && (rounded.exp > 63 || rounded.exp < -63)) {
    return { bytes: [], length, error: 'Number out of range' };
  }
  return {
    bytes: [
      type === 'double' ? TOK_DOUBLE : TOK_SINGLE,
      ...encodeFloat(rounded, mantissa),
    ],
    length,
  };
}

/**
 * Decode the constant at `i`, or return null when the byte there does not
 * introduce one.
 *
 * A float's text gets a `!` or `#` marker whenever the digits alone would read
 * back as a different type - `5!` rather than `5`, which the tokenizer would
 * store as the integer 5 - so that decoding and re-tokenizing is byte-exact.
 */
export function decodeNumber(
  bytes: ArrayLike<number>,
  i: number,
): { text: string; length: number } | null {
  const b = bytes[i]!;
  const word = (): number => (bytes[i + 1]! | (bytes[i + 2]! << 8)) & 0xffff;
  if (b >= TOK_DIGIT_0 && b <= TOK_DIGIT_9) {
    return { text: String(b - TOK_DIGIT_0), length: 1 };
  }
  switch (b) {
    case TOK_BYTE:
      return { text: String(bytes[i + 1]!), length: 2 };
    case TOK_INT16: {
      const v = word();
      return { text: String(v >= 0x8000 ? v - 0x10000 : v), length: 3 };
    }
    case TOK_LINE_REF:
    case TOK_LINE_PTR:
      return { text: String(word()), length: 3 };
    case TOK_HEX:
      return {
        text: `&H${word().toString(16).toUpperCase()}`,
        length: 3,
      };
    case TOK_OCTAL:
      return { text: `&O${word().toString(8)}`, length: 3 };
    case TOK_SINGLE:
    case TOK_DOUBLE: {
      const isDouble = b === TOK_DOUBLE;
      const mantissa = isDouble ? DOUBLE_BYTES : SINGLE_BYTES;
      const type: NumType = isDouble ? 'double' : 'single';
      const dec = decodeFloat(bytes, i + 1, mantissa);
      const text = formatDecimal(dec, type);
      const reread = parseNumber(text, 0);
      const marker =
        reread && reread.bytes[0] === b ? '' : isDouble ? '#' : '!';
      return { text: text + marker, length: mantissa + 2 };
    }
    default:
      return null;
  }
}
