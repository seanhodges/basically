import { trs80Keywords } from '../keywords';
import { trs80Charset } from '../charset';
import { BasicError } from './errors';
import {
  asNum,
  asStr,
  checkNum,
  formatNumber,
  isStr,
  type BasicValue,
} from './values';

/**
 * State the built-in functions reach into. The interpreter implements this; the
 * evaluator and the function table take it as their context so neither has to
 * know about the machine wiring directly.
 */
export interface Ctx {
  getVar(name: string): BasicValue;
  getElem(name: string, indices: number[]): BasicValue;
  rnd(x: number): number;
  peek(addr: number): number;
  point(x: number, y: number): boolean;
  inkey(): string;
  column(): number;
  callUserFn(name: string, args: BasicValue[]): BasicValue;
}

/** Keyword words that are functions (drive expression parsing). */
export const FUNCTION_WORDS = new Set(
  trs80Keywords.filter((k) => k.kind === 'function').map((k) => k.word),
);
/** Functions written without parentheses. */
export const NOPAREN = new Set(['INKEY$', 'MEM', 'TIME$', 'ERL', 'ERR']);

const REL_TRUE = -1;
const REL_FALSE = 0;

function one(args: BasicValue[]): number {
  if (args.length !== 1) throw new BasicError('FC');
  return asNum(args[0]!);
}

/** A char code -> the editor string for it (ASCII or a graphics glyph). */
function chr(code: number): string {
  return trs80Charset.glyph(((code % 256) + 256) % 256);
}

export function evalFunction(
  word: string,
  args: BasicValue[],
  ctx: Ctx,
): BasicValue {
  switch (word) {
    case 'SGN':
      return Math.sign(one(args));
    case 'INT':
      return Math.floor(one(args));
    case 'FIX':
      return Math.trunc(one(args));
    case 'ABS':
      return Math.abs(one(args));
    case 'SQR': {
      const x = one(args);
      if (x < 0) throw new BasicError('FC');
      return Math.sqrt(x);
    }
    case 'SIN':
      return Math.sin(one(args));
    case 'COS':
      return Math.cos(one(args));
    case 'TAN':
      return Math.tan(one(args));
    case 'ATN':
      return Math.atan(one(args));
    case 'LOG': {
      const x = one(args);
      if (x <= 0) throw new BasicError('FC');
      return Math.log(x);
    }
    case 'EXP':
      return checkNum(Math.exp(one(args)));
    case 'CINT':
      return Math.round(one(args));
    case 'CSNG':
    case 'CDBL':
      return one(args);
    case 'RND':
      return ctx.rnd(one(args));
    case 'PEEK':
      return ctx.peek(one(args));
    case 'POINT':
      if (args.length !== 2) throw new BasicError('FC');
      return ctx.point(asNum(args[0]!), asNum(args[1]!)) ? REL_TRUE : REL_FALSE;
    case 'POS':
      return ctx.column();
    case 'INP':
      return 0; // no I/O ports in the interpreter
    case 'FRE':
      // numeric arg -> free numeric bytes; string arg -> free string space.
      return args.length && isStr(args[0]!) ? 32000 : 48000;
    case 'MEM':
      return 48000;
    case 'INKEY$':
      return ctx.inkey();
    case 'TIME$':
      return '';
    case 'ERL':
    case 'ERR':
      return 0;

    // --- strings -------------------------------------------------------
    case 'LEN':
      return asStr(args[0]!).length;
    case 'ASC': {
      const s = asStr(args[0]!);
      if (s.length === 0) throw new BasicError('FC');
      return trs80Charset.toMachine(s[0]!)[0]!;
    }
    case 'CHR$':
      return chr(one(args));
    case 'STR$':
      return formatNumber(one(args));
    case 'VAL': {
      const m = /^\s*[+-]?(\d+\.?\d*|\.\d+)([ED][+-]?\d+)?/i.exec(
        asStr(args[0]!),
      );
      return m ? Number(m[0].replace(/[dD]/, 'E')) : 0;
    }
    case 'LEFT$': {
      const s = asStr(args[0]!);
      return s.slice(0, Math.max(0, asNum(args[1]!)));
    }
    case 'RIGHT$': {
      const s = asStr(args[0]!);
      const n = Math.max(0, asNum(args[1]!));
      return n >= s.length ? s : s.slice(s.length - n);
    }
    case 'MID$': {
      const s = asStr(args[0]!);
      const start = Math.max(1, Math.floor(asNum(args[1]!)));
      const len = args.length >= 3 ? Math.max(0, asNum(args[2]!)) : s.length;
      return s.substr(start - 1, len);
    }
    case 'STRING$': {
      const n = Math.max(0, Math.floor(asNum(args[0]!)));
      const c = isStr(args[1]!)
        ? (asStr(args[1]!)[0] ?? ' ')
        : chr(asNum(args[1]!));
      return c.repeat(n);
    }
    case 'INSTR': {
      // INSTR([start,] s$, t$)
      let i = 0;
      let s: string;
      let t: string;
      if (args.length === 3) {
        i = Math.max(1, Math.floor(asNum(args[0]!))) - 1;
        s = asStr(args[1]!);
        t = asStr(args[2]!);
      } else if (args.length === 2) {
        s = asStr(args[0]!);
        t = asStr(args[1]!);
      } else {
        throw new BasicError('FC');
      }
      return s.indexOf(t, i) + 1;
    }

    default:
      // VARPTR, USR, CVI/CVS/CVD, MKI$…, and any disk-only function.
      throw new BasicError('FC');
  }
}
