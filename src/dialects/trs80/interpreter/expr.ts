import { BasicError } from './errors';
import { Stream } from './lex';
import { asNum, asStr, checkNum, isStr, type BasicValue } from './values';
import { evalFunction, FUNCTION_WORDS, NOPAREN, type Ctx } from './builtins';

const TRUE = -1;
const FALSE = 0;

function toInt16(n: number): number {
  const v = Math.round(n) & 0xffff;
  return v >= 0x8000 ? v - 0x10000 : v;
}

/** Evaluate a full expression at the cursor (Level II operator precedence). */
export function evalExpr(s: Stream, ctx: Ctx): BasicValue {
  return parseOr(s, ctx);
}

function parseOr(s: Stream, ctx: Ctx): BasicValue {
  let v = parseAnd(s, ctx);
  while (s.eatKw('OR'))
    v = toInt16(asNum(v)) | toInt16(asNum(parseAnd(s, ctx)));
  return v;
}

function parseAnd(s: Stream, ctx: Ctx): BasicValue {
  let v = parseNot(s, ctx);
  while (s.eatKw('AND'))
    v = toInt16(asNum(v)) & toInt16(asNum(parseNot(s, ctx)));
  return v;
}

function parseNot(s: Stream, ctx: Ctx): BasicValue {
  if (s.eatKw('NOT')) return toInt16(~toInt16(asNum(parseNot(s, ctx))));
  return parseRel(s, ctx);
}

const REL_OPS = new Set(['=', '<', '>']);

function parseRel(s: Stream, ctx: Ctx): BasicValue {
  const left = parseAdd(s, ctx);
  let op = '';
  while (op.length < 2) {
    const w = s.peekKw();
    if (w && REL_OPS.has(w)) {
      op += w;
      s.advance();
    } else break;
  }
  if (op === '') return left;
  const right = parseAdd(s, ctx);
  return compare(left, normalizeRel(op), right);
}

function normalizeRel(op: string): string {
  if (op.length === 1) return op;
  const has = (c: string) => op.includes(c);
  if (has('<') && has('>')) return '<>';
  if (has('=') && has('<')) return '<=';
  if (has('=') && has('>')) return '>=';
  return op[0]!; // e.g. '==' -> '='
}

function compare(a: BasicValue, op: string, b: BasicValue): number {
  let cmp: number;
  if (isStr(a) && isStr(b)) cmp = a < b ? -1 : a > b ? 1 : 0;
  else cmp = asNum(a) - asNum(b);
  let result: boolean;
  switch (op) {
    case '=':
      result = cmp === 0;
      break;
    case '<>':
      result = cmp !== 0;
      break;
    case '<':
      result = cmp < 0;
      break;
    case '>':
      result = cmp > 0;
      break;
    case '<=':
      result = cmp <= 0;
      break;
    case '>=':
      result = cmp >= 0;
      break;
    default:
      throw new BasicError('SN');
  }
  return result ? TRUE : FALSE;
}

function parseAdd(s: Stream, ctx: Ctx): BasicValue {
  let v = parseMul(s, ctx);
  for (;;) {
    if (s.eatKw('+')) {
      const r = parseMul(s, ctx);
      v = isStr(v) || isStr(r) ? asStr(v) + asStr(r) : asNum(v) + asNum(r);
    } else if (s.eatKw('-')) {
      v = checkNum(asNum(v) - asNum(parseMul(s, ctx)));
    } else break;
  }
  return v;
}

function parseMul(s: Stream, ctx: Ctx): BasicValue {
  let v = parseNeg(s, ctx);
  for (;;) {
    if (s.eatKw('*')) v = checkNum(asNum(v) * asNum(parseNeg(s, ctx)));
    else if (s.eatKw('/')) {
      const d = asNum(parseNeg(s, ctx));
      if (d === 0) throw new BasicError('/0');
      v = checkNum(asNum(v) / d);
    } else break;
  }
  return v;
}

function parseNeg(s: Stream, ctx: Ctx): BasicValue {
  if (s.eatKw('-')) return -asNum(parseNeg(s, ctx));
  if (s.eatKw('+')) return parseNeg(s, ctx);
  return parsePow(s, ctx);
}

function parsePow(s: Stream, ctx: Ctx): BasicValue {
  const base = parseAtom(s, ctx);
  if (s.eatKw('↑')) {
    // Right-associative; the exponent may carry its own unary sign.
    return checkNum(Math.pow(asNum(base), asNum(parseNeg(s, ctx))));
  }
  return base;
}

function parseArgs(s: Stream, ctx: Ctx): BasicValue[] {
  const args: BasicValue[] = [];
  if (s.peekPunct() === ')') return args;
  do {
    args.push(evalExpr(s, ctx));
  } while (s.eatPunct(','));
  return args;
}

function parseAtom(s: Stream, ctx: Ctx): BasicValue {
  const t = s.peek();
  if (!t) throw new BasicError('SN');

  if (t.kind === 'num') {
    s.advance();
    return t.value;
  }
  if (t.kind === 'str') {
    s.advance();
    return t.value;
  }
  if (t.kind === 'punct' && t.ch === '(') {
    s.advance();
    const v = evalExpr(s, ctx);
    if (!s.eatPunct(')')) throw new BasicError('SN');
    return v;
  }
  if (t.kind === 'name') {
    s.advance();
    if (s.eatPunct('(')) {
      const idx = parseArgs(s, ctx).map((a) => asNum(a));
      if (!s.eatPunct(')')) throw new BasicError('SN');
      return ctx.getElem(t.name, idx);
    }
    return ctx.getVar(t.name);
  }
  if (t.kind === 'kw') {
    const word = t.word;
    if (word === 'FN') {
      s.advance();
      const name = s.advance();
      if (!name || name.kind !== 'name') throw new BasicError('SN');
      let args: BasicValue[] = [];
      if (s.eatPunct('(')) {
        args = parseArgs(s, ctx);
        if (!s.eatPunct(')')) throw new BasicError('SN');
      }
      return ctx.callUserFn(name.name, args);
    }
    if (NOPAREN.has(word)) {
      s.advance();
      return evalFunction(word, [], ctx);
    }
    if (FUNCTION_WORDS.has(word) && word !== 'TAB(' && word !== 'SPC(') {
      s.advance();
      if (!s.eatPunct('(')) throw new BasicError('SN');
      const args = parseArgs(s, ctx);
      if (!s.eatPunct(')')) throw new BasicError('SN');
      return evalFunction(word, args, ctx);
    }
  }
  throw new BasicError('SN');
}
