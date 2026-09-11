// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { BasicError, CompileError } from './errors';
import { Stream } from './lex';
import { checkNum } from './values';
import { evalFunction, FUNCTION_WORDS, type Ctx } from './builtins';

/**
 * The formula evaluator.
 *
 * Five arithmetic operators, and their precedence is the order the compiler's
 * own operator table lists them in: `↑` binds tightest, then `*` and `/`, then
 * `+` and `-`. `↑` is the up arrow the Teletype has where a later keyboard has
 * `^`; there is no `**`, and the machine had no `^` key to spell it with.
 *
 * There are **no relational operators here**. A comparison is not a value in
 * this dialect - it exists only inside `IF`, which the compiler decodes with a
 * reader of its own - so there is nothing to fold into an expression and no
 * true or false to represent. That is the single largest difference between
 * this evaluator and every later BASIC's.
 *
 * Equal precedence folds left to right, so `2↑3↑2` is 64.
 */
export function evalExpr(s: Stream, ctx: Ctx): number {
  return parseAdd(s, ctx);
}

function parseAdd(s: Stream, ctx: Ctx): number {
  let v = parseMul(s, ctx);
  for (;;) {
    if (s.eatPunct('+')) v = checkNum(v + parseMul(s, ctx));
    else if (s.eatPunct('-')) v = checkNum(v - parseMul(s, ctx));
    else break;
  }
  return v;
}

function parseMul(s: Stream, ctx: Ctx): number {
  let v = parseNeg(s, ctx);
  for (;;) {
    if (s.eatPunct('*')) v = checkNum(v * parseNeg(s, ctx));
    else if (s.eatPunct('/')) {
      const d = parseNeg(s, ctx);
      if (d === 0) throw new BasicError('DIVISION_BY_ZERO');
      v = checkNum(v / d);
    } else break;
  }
  return v;
}

function parseNeg(s: Stream, ctx: Ctx): number {
  if (s.eatPunct('-')) return -parseNeg(s, ctx);
  if (s.eatPunct('+')) return parseNeg(s, ctx);
  return parsePow(s, ctx);
}

function parsePow(s: Stream, ctx: Ctx): number {
  let v = parseAtom(s, ctx);
  while (s.eatPunct('↑')) v = power(v, parsePowOperand(s, ctx));
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
  return parseAtom(s, ctx);
}

/**
 * Raising to a power, with the two faults the run-time's own routine reports.
 * A negative base is one of them: the machine raised the absolute value and
 * said so rather than answering, because the exponent reaches the number
 * through a logarithm and a negative one has none.
 */
function power(base: number, exponent: number): number {
  if (base === 0 && exponent < 0) {
    throw new BasicError('ZERO_TO_NEGATIVE_POWER');
  }
  if (base < 0) throw new BasicError('NEGATIVE_TO_POWER');
  return checkNum(Math.pow(base, exponent));
}

function parseAtom(s: Stream, ctx: Ctx): number {
  const t = s.peek();
  if (!t) throw new CompileError('ILLEGAL_FORMULA');

  if (t.kind === 'num') {
    s.advance();
    return t.value;
  }
  if (t.kind === 'punct' && t.ch === '(') {
    s.advance();
    const v = evalExpr(s, ctx);
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
    if (t.word === 'FN') {
      s.advance();
      const name = s.advance();
      if (!name || name.kind !== 'name') {
        throw new CompileError('UNDEFINED_FUNCTION');
      }
      if (!s.eatPunct('(')) throw new CompileError('ILLEGAL_FORMULA');
      const arg = evalExpr(s, ctx);
      if (!s.eatPunct(')')) throw new CompileError('ILLEGAL_FORMULA');
      return ctx.callUserFn(name.name, arg);
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
