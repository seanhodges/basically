// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { BasicError } from './errors';
import { checkNum } from './values';

/**
 * The whole library, and it is exactly ten functions: the machine's own
 * dispatcher has a branch for each of these first letters and nothing else.
 * There is no `SGN`, no `TAB`, and no string function of any kind. `RND` takes
 * an argument it ignores, which is not an oddity of this emulation - the
 * compiler required the parentheses and the run-time never looked inside them.
 *
 * `DEF` adds user functions on top of these, but they live with the
 * interpreter, which is where their one parameter has to be bound.
 */

/** What the evaluator hands a function so it can reach the program's state. */
export interface Ctx {
  getVar(name: string): number;
  getElem(name: string, indices: number[]): number;
  callUserFn(name: string, arg: number): number;
  /** The next number from the run's fixed random sequence, in [0,1). */
  rnd(): number;
}

const LIBRARY: Record<string, (x: number, ctx: Ctx) => number> = {
  ABS: (x) => Math.abs(x),
  ATN: (x) => Math.atan(x),
  COS: (x) => Math.cos(x),
  EXP: (x) => checkNum(Math.exp(x)),
  // The greatest integer not above x, so INT(-2.5) is -3 and not -2.
  INT: (x) => Math.floor(x),
  LOG: (x) => {
    if (x === 0) throw new BasicError('LOG_OF_ZERO');
    if (x < 0) throw new BasicError('LOG_OF_NEGATIVE');
    return Math.log(x);
  },
  RND: (_x, ctx) => ctx.rnd(),
  SIN: (x) => Math.sin(x),
  SQR: (x) => {
    if (x < 0) throw new BasicError('SQR_OF_NEGATIVE');
    return Math.sqrt(x);
  },
  TAN: (x) => Math.tan(x),
};

/** The ten names the library dispatcher recognises. */
export const FUNCTION_WORDS: ReadonlySet<string> = new Set(
  Object.keys(LIBRARY),
);

/** Apply one library function to its single argument. */
export function evalFunction(
  word: string,
  x: number,
  ctx: Ctx,
): number | undefined {
  return LIBRARY[word]?.(x, ctx);
}
