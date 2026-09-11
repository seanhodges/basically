// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { checkNum, type Ctx } from './values';

/**
 * The library both editions draw on, and no machine offers all of it.
 *
 * The names are gated by the profile's keyword table rather than here: the
 * lexer only produces a keyword the machine's vocabulary carries, so a
 * dispatcher entry a machine has no word for is unreachable from its programs.
 * The 1965 machine's own dispatcher has a branch for ten of these first letters
 * and nothing else; the fourth edition adds `SGN` and `COT` to the ten, and
 * `NUM` and `DET` beside the matrices. Those last two are written bare, with no
 * parentheses and nothing to put in them - see {@link bareFunctionWords} - so
 * the argument they are dispatched with is ignored.
 *
 * Faults are reported through {@link Ctx.fault} rather than thrown, because
 * whether a fault stops the program is the machine's to decide: the 1965
 * run-time stopped on the square root of a negative number, while the GE-635
 * prints the fault, supplies the root of the absolute value, and carries on.
 * The substituted value beside each is the one section 2.8 names.
 *
 * `DEF` adds user functions on top of these, but they live with the
 * interpreter, which is where their parameters have to be bound.
 */

const LIBRARY: Record<string, (x: number, ctx: Ctx) => number> = {
  ABS: (x) => Math.abs(x),
  ATN: (x) => Math.atan(x),
  COS: (x) => Math.cos(x),
  // The two the matrices leave behind: how many components the last MAT INPUT
  // read, and the determinant the last MAT INV computed on its way.
  DET: (_x, ctx) => ctx.matValue('DET'),
  COT: (x, ctx) => {
    const t = Math.tan(x);
    if (t === 0) return ctx.fault('DIVISION_BY_ZERO', ctx.numbers.max);
    return checkNum(1 / t, ctx);
  },
  EXP: (x, ctx) => {
    const { expLimit, max } = ctx.numbers;
    if (expLimit !== undefined && x > expLimit) {
      return ctx.fault('EXP_TOO_LARGE', max);
    }
    return checkNum(Math.exp(x), ctx);
  },
  // Either the greatest integer not above the argument or the integer part
  // trimmed toward zero - the two machines differ, and the difference is what
  // INT(X+.5) does to a negative number.
  INT: (x, ctx) =>
    ctx.integerPart === 'floor' ? Math.floor(x) : Math.trunc(x),
  NUM: (_x, ctx) => ctx.matValue('NUM'),
  LOG: (x, ctx) => {
    if (x === 0) return ctx.fault('LOG_OF_ZERO', -ctx.numbers.max);
    if (x < 0) return ctx.fault('LOG_OF_NEGATIVE', Math.log(-x));
    return Math.log(x);
  },
  RND: (_x, ctx) => ctx.rnd(),
  SGN: (x) => Math.sign(x),
  SIN: (x) => Math.sin(x),
  SQR: (x, ctx) => {
    if (x < 0) return ctx.fault('SQR_OF_NEGATIVE', Math.sqrt(-x));
    return Math.sqrt(x);
  },
  TAN: (x) => Math.tan(x),
};

/** The names the library dispatcher recognises, across both vocabularies. */
export const FUNCTION_WORDS: ReadonlySet<string> = new Set(
  Object.keys(LIBRARY),
);

/**
 * The library words written with no argument and no parentheses. `RND` is here
 * only where the machine says so - the 1965 compiler required the parentheses
 * and the run-time never looked inside them, while section 2.2 states outright
 * that "the form of RND does not require an argument".
 */
export function bareFunctionWords(ctx: Ctx): ReadonlySet<string> {
  return ctx.rndArgument === 'none'
    ? new Set(['RND', 'NUM', 'DET'])
    : new Set(['NUM', 'DET']);
}

/** Apply one library function to its single argument. */
export function evalFunction(
  word: string,
  x: number,
  ctx: Ctx,
): number | undefined {
  return LIBRARY[word]?.(x, ctx);
}
