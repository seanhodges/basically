// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { CompileError } from './errors';
import { Stream } from './lex';
import { asNumber, checkNum, type BasicValue, type Ctx } from './values';
import { bareFunctionWords, evalFunction, FUNCTION_WORDS } from './builtins';

/**
 * The formula evaluator.
 *
 * Five arithmetic operators, and their precedence is section 1.2's own order:
 * `↑` binds tightest, then `*` and `/`, then `+` and `-`. `↑` is the up arrow
 * the Teletype has where a later keyboard has `^`; there is no `**`, and no
 * machine here had a `^` key to spell it with. Equal precedence folds left to
 * right, so `2↑3↑2` is 64 - which section 1.2 states outright.
 *
 * There are **no relational operators here**. A comparison is not a value in
 * either edition - it exists only inside `IF`, which the executor decodes with
 * a reader of its own - so there is nothing to fold into an expression and no
 * true or false to represent. That is the single largest difference between
 * this evaluator and every later BASIC's.
 *
 * A string can be the *whole* of an expression but never part of one: the
 * fourth edition adds string values without adding an operator that combines
 * them, so every operator below coerces through {@link asNumber} and a string
 * reaching one is the `MISMATCHED STRING OPERATION` fault.
 */
export function evalValue(s: Stream, ctx: Ctx): BasicValue {
  return parseAdd(s, ctx);
}

/** The same expression where only a number will do. */
export function evalExpr(s: Stream, ctx: Ctx): number {
  return asNumber(evalValue(s, ctx));
}

function parseAdd(s: Stream, ctx: Ctx): BasicValue {
  let v = parseMul(s, ctx);
  for (;;) {
    if (s.eatPunct('+')) {
      v = checkNum(asNumber(v) + asNumber(parseMul(s, ctx)), ctx);
    } else if (s.eatPunct('-')) {
      v = checkNum(asNumber(v) - asNumber(parseMul(s, ctx)), ctx);
    } else break;
  }
  return v;
}

function parseMul(s: Stream, ctx: Ctx): BasicValue {
  let v = parseNeg(s, ctx);
  for (;;) {
    if (s.eatPunct('*')) {
      v = checkNum(asNumber(v) * asNumber(parseNeg(s, ctx)), ctx);
    } else if (s.eatPunct('/')) {
      const d = asNumber(parseNeg(s, ctx));
      // A machine that survives this one takes the largest number its format
      // holds for the infinity it cannot represent, whatever the numerator's
      // sign: section 2.8 says the answer is assumed to be +∞.
      if (d === 0) v = ctx.fault('DIVISION_BY_ZERO', ctx.numbers.max);
      else v = checkNum(asNumber(v) / d, ctx);
    } else break;
  }
  return v;
}

function parseNeg(s: Stream, ctx: Ctx): BasicValue {
  if (s.eatPunct('-')) return -asNumber(parseNeg(s, ctx));
  if (s.eatPunct('+')) return asNumber(parseNeg(s, ctx));
  return parsePow(s, ctx);
}

function parsePow(s: Stream, ctx: Ctx): BasicValue {
  let v = parseAtom(s, ctx);
  while (s.eatPunct('↑')) {
    v = power(asNumber(v), parsePowOperand(s, ctx), ctx);
  }
  return v;
}

/**
 * The right operand of `↑`: one atom with any sign of its own. Deliberately not
 * {@link parseNeg}, which would descend back through parsePow and make the
 * operator right-associative.
 */
function parsePowOperand(s: Stream, ctx: Ctx): number {
  if (s.eatPunct('-')) return -parsePowOperand(s, ctx);
  if (s.eatPunct('+')) return parsePowOperand(s, ctx);
  return asNumber(parseAtom(s, ctx));
}

/**
 * Raising to a power, and what a negative base does to it is the one place the
 * two run-times' arithmetic differs outright.
 *
 * Both reach the answer through a logarithm, which a negative number has none
 * of. The 1965 routine stops there and says so. The GE-635's first asks whether
 * the exponent is a whole number, in which case it multiplies the base out and
 * gets the sign right - section 2.8 says as much beside its fault: "(-3)↑3 is
 * correctly computed to give -27" - and only falls back to the absolute value,
 * with the fault printed, for an exponent like 2.7.
 */
function power(base: number, exponent: number, ctx: Ctx): number {
  if (base === 0 && exponent < 0) {
    return ctx.fault('ZERO_TO_NEGATIVE_POWER', ctx.numbers.max);
  }
  if (base < 0) {
    if (ctx.powerOfNegative === 'fault' || !Number.isInteger(exponent)) {
      return ctx.fault('NEGATIVE_TO_POWER', Math.pow(-base, exponent));
    }
  }
  return checkNum(Math.pow(base, exponent), ctx);
}

function parseAtom(s: Stream, ctx: Ctx): BasicValue {
  const t = s.peek();
  if (!t) throw new CompileError('ILLEGAL_FORMULA');

  if (t.kind === 'num') {
    s.advance();
    return t.value;
  }
  // A quoted literal is a value only where the machine has string values at
  // all; on the 1965 machine it is something PRINT prints and nothing else, so
  // one reaching a formula there stays the compiler's "bad formula".
  if (t.kind === 'str' && ctx.strings) {
    s.advance();
    return t.value;
  }
  if (t.kind === 'punct' && t.ch === '(') {
    s.advance();
    const v = evalValue(s, ctx);
    if (!s.eatPunct(')')) throw new CompileError('ILLEGAL_FORMULA');
    return v;
  }
  if (t.kind === 'name') {
    s.advance();
    if (s.eatPunct('(')) {
      const indices = [evalExpr(s, ctx)];
      if (s.eatPunct(',')) indices.push(evalExpr(s, ctx));
      if (!s.eatPunct(')')) throw new CompileError('ILLEGAL_FORMULA');
      return ctx.getElem(t.name, indices);
    }
    return ctx.getVar(t.name);
  }
  if (t.kind === 'kw') {
    if (t.word === 'FN') return callUserFunction(s, ctx);
    if (bareFunctionWords(ctx).has(t.word)) {
      s.advance();
      return evalFunction(t.word, 0, ctx)!;
    }
    if (FUNCTION_WORDS.has(t.word)) {
      s.advance();
      if (!s.eatPunct('(')) throw new CompileError('ILLEGAL_FORMULA');
      const arg = evalExpr(s, ctx);
      if (!s.eatPunct(')')) throw new CompileError('ILLEGAL_FORMULA');
      const value = evalFunction(t.word, arg, ctx);
      if (value === undefined) throw new CompileError('ILLEGAL_FORMULA');
      return value;
    }
  }
  throw new CompileError('ILLEGAL_FORMULA');
}

/**
 * `FNx(...)`, and how many arguments it may carry is the machine's. The 1965
 * `DEF` binds exactly one; section 2.2 says a fourth-edition function "may have
 * zero, one, two, or more variables", and a name written bare is either such a
 * definition called with none or, inside a multiple-line `DEF`, the temporary
 * the body is building its answer in.
 */
function callUserFunction(s: Stream, ctx: Ctx): number {
  s.advance(); // FN
  const name = s.advance();
  if (!name || name.kind !== 'name') {
    throw new CompileError('UNDEFINED_FUNCTION');
  }
  const args: number[] = [];
  if (s.eatPunct('(')) {
    do {
      args.push(evalExpr(s, ctx));
    } while (ctx.functionParameters === 'any' && s.eatPunct(','));
    if (!s.eatPunct(')')) throw new CompileError('ILLEGAL_FORMULA');
  } else if (ctx.functionParameters === 'one') {
    throw new CompileError('ILLEGAL_FORMULA');
  }
  return ctx.callUserFn(name.name, args);
}
