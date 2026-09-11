// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * What the GE-635's arithmetic could hold, and how its run-time printed it.
 *
 * **The internal layout is unattested and is not reconstructed here.** The
 * GE-235 in this registry states its floating format - a pair of 20-bit words,
 * exponent in the top nine bits of the first - because its 1965 compiler
 * listing survives to read it off. Nothing equivalent survives for this
 * machine: *BASIC, Fourth Edition* documents what a number looks like on paper
 * and the two magnitudes a program can reach, and never once says how a word is
 * divided. So every rule below is keyed to printed output and to section 2.8's
 * two limits, and the word itself is left undescribed rather than guessed at
 * from the sibling's.
 */

/**
 * The magnitudes section 2.8 names, as the two faults that reach them. Overflow
 * is "a number larger than about 1.70141 E+38"; underflow "a number in absolute
 * size smaller than about 1.46937E-39". Neither stops the program - the
 * run-time supplies an infinity or a zero and carries on - and the larger of
 * the two is also the value it puts in place of a division by zero.
 */
export const GE635_MAX = 1.70141e38;
export const GE635_MIN = 1.46937e-39;

/**
 * Where the exponential gives up, which section 2.8 states as its own fault
 * rather than folding into the overflow: "the argument of the exponential
 * function is > 88.029".
 */
export const GE635_EXP_LIMIT = 88.029;

/** Significant digits the printer keeps: section 2.1's rule 2. */
const SIGNIFICANT_DIGITS = 6;

/**
 * Digits an integer may have before it prints in the exponent form instead.
 * Section 2.1's rule 1: "if the integer contains more than eight digits, the
 * teletype will give you the first digit, followed by (a) a decimal point, (b)
 * the next five digits, and (c) an E followed by the appropriate integer. For
 * example, it will take 32,437,580,259 and write it as 3.24376E+10."
 */
const INTEGER_DIGITS = 8;

/**
 * Decimal places a number below a tenth may use before it prints in the
 * exponent form. Section 2.1's rule 3: "for a number less than 0.1, the E
 * notation is used unless the entire significant part of the number can be
 * printed as a six decimal number. Thus, 0.03456 means that the number is
 * exactly .0345600000, while 3.45600E-2 means that the number has been rounded
 * to .0345600."
 */
const SMALL_DECIMALS = 6;

/**
 * A number as this Teletype printed it, including the field's own spacing.
 *
 * Section 2.1 gives the field with the semicolon: "first, a minus sign or a
 * space (if it is positive), then, the numerical value, then, a single space."
 * One trailing blank rather than the GE-235's two, which is the whole of why
 * fourth-edition output packs tighter than its sibling's.
 *
 * The exponent form is written with a blank before the `E` - `1.34218 E+8`,
 * `5.00548 E-2` - which is how it appears in both of the printed teletype runs
 * section 2.2 reproduces. The manual's own prose writes the same form closed up
 * (`3.24376E+10`), so the two disagree; the printed listings are the machine's
 * output and the prose is the authors' typing, so the listings win. The
 * exponent itself is not padded: `E+8`, not `E+08`.
 */
export function formatNumber(n: number): string {
  const sign = n < 0 ? '-' : ' ';
  const magnitude = Math.abs(n);
  return `${sign}${digitsOf(magnitude)} `;
}

function digitsOf(magnitude: number): string {
  // Unreachable through arithmetic, which is guarded against the format's own
  // limits - but the formatter is not the place to find that out.
  if (!Number.isFinite(magnitude)) return '9.99999 E+38';

  // Rule 1 is about the number itself, not about a rounded copy of it: an
  // integer prints whole while it fits the field, which is why the manual's own
  // run of the powers of two prints 67108864 and not 67108900. Only past eight
  // digits does it move to the exponent form, and only then are six significant
  // digits all that survive.
  if (Number.isInteger(magnitude)) {
    const digits = magnitude.toFixed(0);
    return digits.length <= INTEGER_DIGITS ? digits : exponentForm(magnitude);
  }

  const rounded = Number(magnitude.toPrecision(SIGNIFICANT_DIGITS));
  // Rounding to six digits can make a whole number of one that was not, and it
  // prints as one: 1234567.8 is 1234570.
  if (Number.isInteger(rounded)) {
    const digits = rounded.toFixed(0);
    return digits.length <= INTEGER_DIGITS ? digits : exponentForm(magnitude);
  }
  // Rule 3, read against the value itself rather than the rounded one: a number
  // the six decimals cannot say exactly is the one that "has been rounded", and
  // so the one that prints in the E notation.
  if (
    magnitude < 0.1 &&
    Number(magnitude.toFixed(SMALL_DECIMALS)) !== magnitude
  ) {
    return exponentForm(magnitude);
  }
  // Rule 4: trailing zeros after the decimal point are not printed.
  return trimZeros(rounded.toString());
}

function exponentForm(magnitude: number): string {
  const [mantissa, exponent] = magnitude
    .toExponential(SIGNIFICANT_DIGITS - 1)
    .split('e');
  const power = Number(exponent);
  return `${mantissa} E${power < 0 ? '-' : '+'}${Math.abs(power)}`;
}

function trimZeros(text: string): string {
  return text.includes('.') ? text.replace(/0+$/, '').replace(/\.$/, '') : text;
}

/**
 * The line the executive closed a run with: `TIME: .06 SECS.`, as every sample
 * session in the manual ends. Two decimal places and no leading zero, which is
 * how the printed runs in sections 2.1, 2.2 and 2.6 all read.
 */
export function elapsedLine(seconds: number): string {
  return `time: ${seconds.toFixed(2).replace(/^0\./, '.')} secs.`;
}
