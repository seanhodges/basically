// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * How the GE-235's run-time printed a number, and what its arithmetic could
 * hold. Both are read off `BA-1`, the 1965 compiler and run-time source, which
 * is what lets this machine state its floating-point format rather than only
 * its observable edges.
 */

/**
 * The largest integer the run-time will print as one. Above it a value prints
 * in the floating form even when it is whole, because the integer printer works
 * from a 30-bit fixed-point field.
 */
const INTEGER_LIMIT = 2 ** 30;

/** Significant digits the floating printer keeps, rounding away the seventh. */
const SIGNIFICANT_DIGITS = 6;

/**
 * Characters the fixed-point form is allowed, sign included. Wider than this
 * and the number prints in the exponent form instead, which is how the
 * run-time's own formatter chooses between its 9- and 15-character fields.
 */
const FIXED_FIELD = 9;

/**
 * The magnitude limits of the machine's floating format. A number is a pair of
 * 20-bit words whose exponent field is the top nine bits of the first (the
 * run-time masks it with `0o3774000`), so the binary exponent runs to about
 * ±255 and the decimal magnitude to a little under 10^77 either way. Reaching
 * the top is an overflow; falling off the bottom is an underflow, and both stop
 * the program - the machine had no quiet zero to fall back to.
 *
 * The ceiling is written as the last magnitude *below* 2^255 rather than as
 * 2^255 itself, because reaching the exponent's top is the overflow: the
 * largest number the format holds is the one before it.
 */
export const GE235_MAX = 2 ** 255 * (1 - Number.EPSILON);
export const GE235_MIN = 2 ** -256;

/**
 * A number as the Teletype printed it, including the field's own spacing.
 *
 * Two shapes, and the run-time picks between them by asking whether the value
 * is a whole number it can hold in 30 bits:
 *
 *  - **Whole numbers** print as a sign, the digits, and two trailing blanks.
 *    The sign is a blank for a positive number rather than a `+`, so `PRINT
 *    1;2` reads ` 1   2  ` - the gap between the two is the pair of blanks the
 *    first one carries, which is why a `;` needs to add nothing of its own.
 *  - **Everything else** prints to six significant digits, the seventh rounding
 *    the sixth, with trailing zeros dropped. It stays in plain decimal while it
 *    fits the formatter's field and otherwise moves to the exponent form, whose
 *    mantissa is scaled to below one: `.123456 E 07`. There is no `+` there
 *    either - a positive exponent is a blank - and no lower-case `e`.
 *
 * The six digits are the machine's; the choice of exactly where the plain form
 * gives out is a pragmatic reading of a formatter that shuffles digits through
 * a fixed buffer, so a value near the boundary may pick the other form than the
 * hardware would.
 */
export function formatNumber(n: number): string {
  const sign = n < 0 ? '-' : ' ';
  const magnitude = Math.abs(n);

  if (Number.isInteger(n) && magnitude < INTEGER_LIMIT) {
    return `${sign}${magnitude.toFixed(0)}  `;
  }
  // Unreachable through arithmetic, which is guarded, and through a constant,
  // which the compiler rejects - but the formatter is not the place to find out.
  if (!Number.isFinite(n)) return `${sign}9.99999 E 99  `;

  const [mantissa, exponent] = magnitude
    .toExponential(SIGNIFICANT_DIGITS - 1)
    .split('e');
  // Scale to a mantissa below one, the way the run-time normalises: 12.5 is
  // .125 with a decimal exponent of 2.
  const scale = Number(exponent) + 1;
  const digits = mantissa!.replace('.', '').replace(/0+$/, '');

  const plain =
    sign +
    (scale <= 0
      ? `.${'0'.repeat(-scale)}${digits}`
      : scale >= digits.length
        ? digits + '0'.repeat(scale - digits.length)
        : `${digits.slice(0, scale)}.${digits.slice(scale)}`);
  if (plain.length <= FIXED_FIELD) return `${plain}  `;

  const expSign = scale < 0 ? '-' : ' ';
  const expDigits = String(Math.abs(scale)).padStart(2, '0');
  return `${sign}.${digits} E${expSign}${expDigits}  `;
}

/**
 * The line the executive closed a run with. Time-sharing charged for processor
 * time and said what it had used, to the second.
 */
export function elapsedLine(seconds: number): string {
  return `time${formatNumber(Math.round(seconds))}secs.`;
}
