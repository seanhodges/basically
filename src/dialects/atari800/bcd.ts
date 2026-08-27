// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The Atari 6-byte binary-coded-decimal float, which is how Atari BASIC stores
 * every numeric constant in a program and every numeric variable's value.
 *
 * ```
 *   byte 0   S EEEEEEE   sign bit, then an excess-64 exponent - of 100, not 10
 *   byte 1-5  BCD pairs  ten decimal digits, two to a byte
 * ```
 *
 * The mantissa is normalised so byte 1 is non-zero, and the value is
 *
 * ```
 *   ± I × 100^(E - 68)
 * ```
 *
 * where `I` is the ten digits read as one integer and `E` the low seven bits of
 * byte 0. (The `- 68` rather than `- 64` is the four byte-pairs that sit to the
 * right of byte 1: the exponent is written for a mantissa of `b1.b2b3b4b5`, and
 * `I` counts all five.) Zero is the one value with no normalised form, and is
 * stored as six zero bytes.
 *
 * Being decimal, the format holds exactly the numbers a listing can spell -
 * `0.1` is exact here where a binary float only approximates it - but it holds
 * only ten significant digits, so encoding a JavaScript number rounds to ten
 * and is not reversible beyond that.
 */

/** Bytes in one Atari float. */
export const ATARI_FLOAT_BYTES = 6;

/** The exponent bias, adjusted for the four byte-pairs right of the point. */
const EXPONENT_BIAS = 68;

/** Largest magnitude the format holds: ten nines at the top exponent. */
export const ATARI_FLOAT_MAX = 9.999999999e97;

/** Smallest non-zero magnitude; anything under it underflows to zero. */
export const ATARI_FLOAT_MIN = 1e-98;

/** The `count` most significant decimal digits of `n`, and its decimal scale. */
function significand(
  n: number,
  count: number,
): { digits: string; exponent: number } {
  // toExponential rounds for us, and reports any carry in its own exponent -
  // 9.9999999996e4 to nine digits is 1.00000000e5, not 10.0000000e4.
  const parsed = /^(\d)(?:\.(\d*))?e([+-]\d+)$/.exec(
    n.toExponential(count - 1),
  );
  if (!parsed) throw new Error(`Cannot represent ${n} as an Atari float`);
  return {
    digits: parsed[1]! + (parsed[2] ?? ''),
    exponent: Number(parsed[3]),
  };
}

/**
 * `value` as six Atari float bytes, rounded to the format's ten digits.
 *
 * Throws on a value the format cannot hold - an infinity, a NaN, or a magnitude
 * outside roughly 1e-98 to 1e98. Callers that must not throw check
 * {@link isRepresentable} first.
 */
export function toAtariFloat(value: number): Uint8Array {
  const out = new Uint8Array(ATARI_FLOAT_BYTES);
  if (value === 0) return out;
  if (!Number.isFinite(value)) {
    throw new Error(`Cannot represent ${value} as an Atari float`);
  }

  const negative = value < 0;
  const magnitude = Math.abs(value);
  if (magnitude < ATARI_FLOAT_MIN || magnitude > ATARI_FLOAT_MAX) {
    throw new Error(`${value} is outside the Atari float range`);
  }

  // The mantissa is ten digits, but its decimal point falls between byte pairs,
  // so only an even power of ten is reachable. Where ten digits would need an
  // odd one, nine digits and a leading zero reach the same value.
  const { digits: tenDigits, exponent } = significand(magnitude, 10);
  let digits = tenDigits;
  let scale = exponent + 1 - 10;
  if (scale % 2 !== 0) {
    const shorter = significand(magnitude, 9);
    if (shorter.exponent === exponent) {
      digits = `0${shorter.digits}`;
      scale = exponent + 1 - 9;
    } else {
      // Rounding to nine digits carried into a new decimal place, which lands
      // the value on an even power after all: pad it back out to ten.
      digits = `${shorter.digits}0`;
      scale = shorter.exponent + 1 - 10;
    }
  }

  out[0] = (negative ? 0x80 : 0) | (EXPONENT_BIAS + scale / 2);
  for (let i = 0; i < 5; i++) {
    const pair = digits.slice(i * 2, i * 2 + 2);
    out[1 + i] = ((Number(pair[0]) << 4) | Number(pair[1])) & 0xff;
  }
  return out;
}

/** Whether {@link toAtariFloat} can encode `value` without throwing. */
export function isRepresentable(value: number): boolean {
  if (value === 0) return true;
  if (!Number.isFinite(value)) return false;
  const magnitude = Math.abs(value);
  return magnitude >= ATARI_FLOAT_MIN && magnitude <= ATARI_FLOAT_MAX;
}

/**
 * The number six Atari float bytes stand for, or null when the mantissa holds a
 * nibble above 9 - which no encoder produces and so marks the bytes as
 * something other than a float.
 */
export function fromAtariFloat(bytes: ArrayLike<number>): number | null {
  if (bytes.length < ATARI_FLOAT_BYTES) return null;

  let digits = '';
  for (let i = 1; i < ATARI_FLOAT_BYTES; i++) {
    const byte = bytes[i]! & 0xff;
    const high = byte >> 4;
    const low = byte & 0x0f;
    if (high > 9 || low > 9) return null;
    digits += `${high}${low}`;
  }

  const head = bytes[0]! & 0xff;
  const biased = head & 0x7f;
  // Six zero bytes are the stored zero. A zero mantissa under any other
  // exponent is unnormalised; the ROM never writes one, and it is still zero.
  if (digits === '0000000000') return 0;

  const scale = 2 * (biased - EXPONENT_BIAS);
  // Built as a decimal string rather than multiplied by a power of ten, so the
  // exactly-representable decimals the format is chosen for stay exact.
  const magnitude = Number(`${digits}e${scale}`);
  return head & 0x80 ? -magnitude : magnitude;
}
