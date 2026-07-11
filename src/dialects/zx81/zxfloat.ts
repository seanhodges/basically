/**
 * ZX81 5-byte floating point format (shared with the ZX Spectrum, but the
 * ZX81 has no small-integer shortcut):
 *
 *   byte 0:      exponent e+0x80, where value = mantissa * 2^e and
 *                mantissa ∈ [0.5, 1). A zero exponent byte means value 0.
 *   bytes 1..4:  mantissa, MSB first. The top bit of byte 1 - which is
 *                always 1 for a normalized mantissa - is replaced by the
 *                sign bit (0 = positive, 1 = negative).
 */

export function encodeZxFloat(n: number): Uint8Array {
  const out = new Uint8Array(5);
  if (n === 0) return out;
  if (!Number.isFinite(n))
    throw new RangeError(`Cannot encode ${n} as ZX81 float`);

  const negative = n < 0;
  const m = Math.abs(n);

  let e = Math.floor(Math.log2(m)) + 1;
  let frac = m / 2 ** e; // in [0.5, 1) up to fp error
  if (frac >= 1) {
    e += 1;
    frac /= 2;
  } else if (frac < 0.5) {
    e -= 1;
    frac *= 2;
  }

  let mant = Math.round(frac * 2 ** 32);
  if (mant >= 2 ** 32) {
    // Rounding overflowed the mantissa: 0.111...1 -> 1.0
    mant = 2 ** 31;
    e += 1;
  }

  if (e < -127 || e > 127)
    throw new RangeError(`Number out of ZX81 float range: ${n}`);

  out[0] = (e + 0x80) & 0xff;
  out[1] = (mant >>> 24) & 0xff;
  out[2] = (mant >>> 16) & 0xff;
  out[3] = (mant >>> 8) & 0xff;
  out[4] = mant & 0xff;

  const sign = negative ? 0x80 : 0x00;
  out[1] = (out[1]! & 0x7f) | sign;
  return out;
}

export function decodeZxFloat(bytes: ArrayLike<number>, offset = 0): number {
  const exp = bytes[offset]!;
  if (exp === 0) return 0;
  const b1 = bytes[offset + 1]!;
  const negative = (b1 & 0x80) !== 0;
  const mant =
    ((b1 | 0x80) >>> 0) * 2 ** 24 +
    bytes[offset + 2]! * 2 ** 16 +
    bytes[offset + 3]! * 2 ** 8 +
    bytes[offset + 4]!;
  const value = (mant / 2 ** 32) * 2 ** (exp - 0x80);
  return negative ? -value : value;
}

/**
 * The stored 5-byte float is the authoritative value the ROM runs; the printed
 * digits are just how LIST shows it. They usually agree, but "protection"
 * tricks store a float that differs from the digits (LIST shows `20`, the code
 * jumps to line 9999). To keep such programs byte-exact we emit an override
 * notation right after the digits that the tokenizer honours instead of
 * re-encoding the digits:
 *
 *   `\{=9999}`        - the float is the canonical encoding of 9999
 *   `\{=$8420000000}` - a non-canonical float, given as its raw 5 bytes
 */
export function floatOverrideNotation(stored: ArrayLike<number>): string {
  const value = decodeZxFloat(stored);
  const decimal = formatZxNumber(value);
  try {
    if (bytesEqual(encodeZxFloat(parseFloat(decimal)), stored)) {
      return `\\{=${decimal}}`;
    }
  } catch {
    // fall through to the raw-byte form
  }
  let hex = '';
  for (let k = 0; k < 5; k++)
    hex += (stored[k]! & 0xff).toString(16).padStart(2, '0');
  return `\\{=$${hex.toUpperCase()}}`;
}

/**
 * Parse a `\{=...}` float override (see {@link floatOverrideNotation}) starting
 * at index i (which must point at the backslash). Returns the 5 stored float
 * bytes and the index just past the closing brace, or null if malformed.
 */
export function parseFloatOverride(
  text: string,
  i: number,
): { bytes: number[]; end: number } | null {
  if (text[i] !== '\\' || text[i + 1] !== '{' || text[i + 2] !== '=') {
    return null;
  }
  const close = text.indexOf('}', i + 3);
  if (close === -1) return null;
  const content = text.slice(i + 3, close);
  const end = close + 1;
  if (content.startsWith('$')) {
    const hex = content.slice(1);
    if (!/^[0-9A-Fa-f]{10}$/.test(hex)) return null;
    const bytes: number[] = [];
    for (let k = 0; k < 10; k += 2)
      bytes.push(parseInt(hex.slice(k, k + 2), 16));
    return { bytes, end };
  }
  const value = Number(content);
  if (!Number.isFinite(value)) return null;
  try {
    return { bytes: Array.from(encodeZxFloat(value)), end };
  } catch {
    return null;
  }
}

/** Format a decoded ZX81 float the way its digits would most plausibly read. */
function formatZxNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);
  // A short round-trippable decimal; the caller verifies it re-encodes exactly.
  return String(value);
}

function bytesEqual(a: ArrayLike<number>, b: ArrayLike<number>): boolean {
  if (a.length < 5 || b.length < 5) return false;
  for (let k = 0; k < 5; k++)
    if ((a[k]! & 0xff) !== (b[k]! & 0xff)) return false;
  return true;
}
