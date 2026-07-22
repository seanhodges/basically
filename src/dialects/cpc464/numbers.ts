/**
 * Locomotive BASIC binary number encodings.
 *
 * Tokenized lines store numeric constants in binary, not ASCII: small
 * integers as one-byte tokens, bytes/words with `&19`/`&1A`, and everything
 * else in the 5-byte real format - bytes 0-3 a little-endian 32-bit mantissa
 * whose top bit is replaced by the sign (the leading 1 is implied), byte 4
 * the exponent biased by 128; all five bytes zero means zero. Verified
 * against the ROM's own PI constant (`A2 DA 0F 49 82`).
 */

const MANTISSA_SPAN = 2 ** 32;
const MANTISSA_MIN = 2 ** 31;

/**
 * Encode a value into the 5-byte Locomotive real format. Throws RangeError
 * when the magnitude overflows the format; magnitudes below its smallest
 * normalized value underflow to zero, as the ROM's own arithmetic does.
 */
export function encodeLocoFloat(value: number): number[] {
  if (!Number.isFinite(value)) {
    throw new RangeError(`Cannot encode ${value} as a Locomotive real`);
  }
  if (value === 0) return [0, 0, 0, 0, 0];

  const sign = value < 0;
  const m = Math.abs(value);
  let exp = Math.floor(Math.log2(m)) + 1;
  let mant = Math.round(m * 2 ** (32 - exp));
  // Re-normalize when log2 rounding or mantissa rounding crossed a binade.
  if (mant >= MANTISSA_SPAN) {
    exp++;
    mant = Math.round(m * 2 ** (32 - exp));
  } else if (mant < MANTISSA_MIN) {
    exp--;
    mant = Math.round(m * 2 ** (32 - exp));
    if (mant >= MANTISSA_SPAN) {
      exp++;
      mant = Math.round(m * 2 ** (32 - exp));
    }
  }

  const biased = exp + 128;
  if (biased > 255) {
    throw new RangeError(`Number out of range: ${value}`);
  }
  if (biased < 1) return [0, 0, 0, 0, 0]; // underflow

  return [
    mant & 0xff,
    (mant >>> 8) & 0xff,
    (mant >>> 16) & 0xff,
    ((mant >>> 24) & 0x7f) | (sign ? 0x80 : 0),
    biased,
  ];
}

/** Decode a 5-byte Locomotive real starting at `offset`. */
export function decodeLocoFloat(
  bytes: ArrayLike<number>,
  offset: number,
): number {
  const biased = bytes[offset + 4]!;
  if (biased === 0) return 0;
  const mant =
    bytes[offset]! +
    bytes[offset + 1]! * 0x100 +
    bytes[offset + 2]! * 0x10000 +
    ((bytes[offset + 3]! & 0x7f) | 0x80) * 0x1000000;
  const value = mant * 2 ** (biased - 128 - 32);
  return bytes[offset + 3]! & 0x80 ? -value : value;
}

/** Strip redundant zeros/dots and normalize exponent notation to `E+n`. */
function cleanNumberText(text: string): string {
  const exp = /^(-?)(\d+(?:\.\d+)?)e([+-])(\d+)$/i.exec(text);
  if (exp) {
    const mant = exp[2]!.includes('.')
      ? exp[2]!.replace(/0+$/, '').replace(/\.$/, '')
      : exp[2]!;
    return `${exp[1]}${mant}E${exp[3]}${parseInt(exp[4]!, 10)}`;
  }
  if (text.includes('.')) {
    return text.replace(/0+$/, '').replace(/\.$/, '');
  }
  return text;
}

/**
 * Format a 5-byte-real value losslessly in Locomotive's display style: the
 * fewest decimal digits whose re-encoding reproduces the same five bytes
 * (a 32-bit mantissa can need up to 11 significant digits to pin down).
 */
export function formatLocoFloat(value: number): string {
  const bytes = encodeLocoFloat(value);
  const matches = (text: string): boolean => {
    const reEncoded = encodeLocoFloat(parseFloat(text));
    return reEncoded.every((b, i) => b === bytes[i]);
  };

  if (Number.isInteger(value) && Math.abs(value) < MANTISSA_SPAN) {
    const text = value.toFixed(0);
    if (matches(text)) return text;
  }
  for (let digits = 1; digits <= 11; digits++) {
    const text = cleanNumberText(value.toPrecision(digits));
    if (matches(text)) return text;
  }
  return cleanNumberText(value.toString());
}
