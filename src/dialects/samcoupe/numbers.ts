/**
 * SAM BASIC numeric literal encoding.
 *
 * A numeric constant in a stored line is its printable digits followed by the
 * marker 0x0E and five hidden bytes holding the value, which is what the
 * interpreter actually evaluates - `NUMBER` in the ROM's main.asm skips exactly
 * six bytes past the marker. Two layouts share the five bytes, told apart by
 * the first:
 *
 *  - Small integer (first byte 0): `[0x00, sign, low, high, 0x00]` for
 *    -65535..65535, sign 0x00 positive or 0xFF negative. `STACKBC` in tadjm.asm
 *    builds exactly this - it moves the integer to C/D and zeroes A, B and E,
 *    and `STKSTORE` writes them in the order A, E, D, C, B.
 *  - Floating point (first byte non-zero): the exponent biased by 0x80, then a
 *    four-byte mantissa normalized to [0.5, 1), most significant byte first,
 *    whose top bit carries the sign. `AMPEND` in rom1fns.asm assembles a hex
 *    literal in that shape, and printfp.asm's own note - "numbers less than 1
 *    have exponents of 1-80H" - fixes the bias.
 *
 * The interpreter reads whichever form is present, so either encodes a given
 * value; the compact integer form is emitted where it fits.
 */

export function encodeSamNumber(n: number): Uint8Array {
  if (!Number.isFinite(n))
    throw new RangeError(`Cannot encode ${n} as a SAM Coupé number`);

  const out = new Uint8Array(5);
  if (n === 0) return out;

  if (Number.isInteger(n) && Math.abs(n) <= 0xffff) {
    const magnitude = Math.abs(n);
    out[1] = n < 0 ? 0xff : 0x00;
    out[2] = magnitude & 0xff;
    out[3] = (magnitude >> 8) & 0xff;
    return out;
  }

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
    mant = 2 ** 31;
    e += 1;
  }
  if (e < -127 || e > 127)
    throw new RangeError(`Number out of SAM Coupé float range: ${n}`);

  out[0] = (e + 0x80) & 0xff;
  out[1] = ((mant >>> 24) & 0x7f) | (negative ? 0x80 : 0x00);
  out[2] = (mant >>> 16) & 0xff;
  out[3] = (mant >>> 8) & 0xff;
  out[4] = mant & 0xff;
  return out;
}

export function decodeSamNumber(bytes: ArrayLike<number>, offset = 0): number {
  const exp = bytes[offset]!;
  if (exp === 0) {
    const sign = bytes[offset + 1]! === 0xff ? -1 : 1;
    return sign * (bytes[offset + 2]! | (bytes[offset + 3]! << 8));
  }
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
