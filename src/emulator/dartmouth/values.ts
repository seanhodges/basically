// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { CompileError } from './errors';
import type { RunErrorCode } from './errors';
import type { DartmouthNumbers } from './profile';

/**
 * A value in a Dartmouth program, and which of the two it may be is the
 * language's largest single change between the editions this folder serves.
 *
 * The February 1965 language has numbers and nothing else: no string variables,
 * no string functions and no string expressions, so the only text a program can
 * produce is a literal inside `PRINT`, which never becomes a value. The fourth
 * edition adds strings as values - assigned, compared, read, input and carried
 * in vectors - but adds no operator that combines them, so a string reaching
 * any arithmetic operator is the `MISMATCHED STRING OPERATION` fault rather
 * than a concatenation.
 *
 * Which of the two a machine gets is `DartmouthLanguage.strings`; the union is
 * shared because the evaluator is.
 */
export type BasicValue = number | string;

/** What the evaluator hands a function so it can reach the program's state. */
export interface Ctx {
  getVar(name: string): BasicValue;
  getElem(name: string, indices: number[]): BasicValue;
  callUserFn(name: string, args: number[]): number;
  /** The next number from the run's random sequence, in [0,1). */
  rnd(): number;
  /**
   * What the matrices left behind: `NUM` is how many components the last
   * `MAT INPUT` read, `DET` the determinant the last `MAT INV` computed.
   */
  matValue(word: 'NUM' | 'DET'): number;
  /** What the machine's arithmetic can hold, and how it prints. */
  readonly numbers: DartmouthNumbers;
  /** Whether this machine has string values at all. */
  readonly strings: boolean;
  /** The executor rules the evaluator needs, as the profile states them. */
  readonly integerPart: 'floor' | 'truncate';
  readonly rndArgument: 'required' | 'none';
  readonly powerOfNegative: 'integer-exponent' | 'fault';
  readonly functionParameters: 'one' | 'any';
  /**
   * Report an arithmetic fault. On a machine that stops for this code it
   * throws; on one that prints the fault and carries on it prints it and
   * returns `supplied`, the value the run-time put in place of the answer.
   */
  fault(code: RunErrorCode, supplied: number): number;
}

/** A value as a number, or the fault a machine reports for using text as one. */
export function asNumber(value: BasicValue): number {
  if (typeof value === 'string') throw new CompileError('MISMATCHED_STRING');
  return value;
}

/** A value as a string, or the same fault the other way round. */
export function asString(value: BasicValue): string {
  if (typeof value === 'number') throw new CompileError('MISMATCHED_STRING');
  return value;
}

/**
 * Guard a freshly computed number against the format's own limits. A machine
 * that survives overflow gets the largest magnitude it can hold in place of the
 * answer, and one that survives underflow gets zero - which is what both
 * run-times substituted where they substituted anything at all.
 */
export function checkNum(n: number, ctx: Ctx): number {
  const { max, min } = ctx.numbers;
  if (Number.isNaN(n)) return ctx.fault('OVERFLOW', max);
  if (Math.abs(n) > max) return ctx.fault('OVERFLOW', n < 0 ? -max : max);
  if (n !== 0 && Math.abs(n) < min) return ctx.fault('UNDERFLOW', 0);
  return n;
}
