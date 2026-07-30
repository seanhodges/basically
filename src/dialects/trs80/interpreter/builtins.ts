import { trs80Keywords } from '../keywords';
import { codeToRuntimeChar, runtimeCharToCode } from '../charset';
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
  /** EOF(n) for a sequential file open for input (Disk BASIC). */
  fileEof(fd: number): boolean;
  /** LOC(n): records read or written so far on an open file. */
  fileLoc(fd: number): number;
  /** LOF(n): records the open file holds. */
  fileLof(fd: number): number;
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

/** A char code -> the interpreter string character for it (byte-preserving). */
function chr(code: number): string {
  return codeToRuntimeChar(((code % 256) + 256) % 256);
}

/**
 * Split a string into its characters. A TRS-80 string is a byte string, but the
 * block-graphics codes 0x81–0xBF map to astral Unicode sextants that occupy two
 * UTF-16 units each - so every length and slice has to count code points, or a
 * graphics character would measure 2 and a slice could cut a surrogate pair in
 * half.
 */
function chars(s: string): string[] {
  return Array.from(s);
}

/** Bytes -> an interpreter string, one character per byte. */
function stringFromBytes(bytes: readonly number[]): string {
  return bytes.map((b) => chr(b)).join('');
}

/** The first `n` bytes of a string, or `?FC ERROR` if it is too short. */
function bytesFromString(s: string, n: number): number[] {
  const out: number[] = [];
  for (const ch of s) {
    if (out.length === n) break;
    const code = runtimeCharToCode(ch);
    if (code === undefined) throw new BasicError('FC');
    out.push(code);
  }
  if (out.length < n) throw new BasicError('FC');
  return out;
}

/**
 * Microsoft binary format, the layout MKS$/MKD$ write and CVS/CVD read: the
 * mantissa little-endian with its implicit leading 1 replaced by the sign bit,
 * then a final exponent byte biased by 128 (0 for the value zero). A 4-byte
 * string holds single precision, an 8-byte string double.
 *
 * Mantissa bits beyond the host double's 53 are zero, so an 8-byte value
 * round-trips to full JavaScript precision rather than the ROM's full 56 bits.
 */
function mbfFromNumber(value: number, size: number): number[] {
  const out = new Array<number>(size).fill(0);
  if (value === 0 || !Number.isFinite(value)) return out;
  let a = Math.abs(value);
  let exp = 0;
  while (a >= 1) {
    a /= 2;
    exp++;
  }
  while (a < 0.5) {
    a *= 2;
    exp--;
  }
  const mantBytes = size - 1;
  const bits: number[] = [];
  for (let i = 0; i < mantBytes * 8; i++) {
    a *= 2;
    const bit = a >= 1 ? 1 : 0;
    if (bit) a -= 1;
    bits.push(bit);
  }
  bits[0] = value < 0 ? 1 : 0; // the sign sits where the leading 1 would be
  for (let b = 0; b < mantBytes; b++) {
    let byte = 0;
    for (let k = 0; k < 8; k++) byte = (byte << 1) | bits[b * 8 + k]!;
    out[mantBytes - 1 - b] = byte; // bits run most-significant first
  }
  out[size - 1] = (exp + 128) & 0xff;
  return out;
}

function numberFromMbf(bytes: readonly number[]): number {
  const size = bytes.length;
  const exp = bytes[size - 1]!;
  if (exp === 0) return 0;
  const high = bytes[size - 2]!;
  let mant = 0.5; // the implicit leading 1
  let weight = 0.25;
  for (let k = 6; k >= 0; k--) {
    if (high & (1 << k)) mant += weight;
    weight /= 2;
  }
  for (let b = size - 3; b >= 0; b--) {
    for (let k = 7; k >= 0; k--) {
      if (bytes[b]! & (1 << k)) mant += weight;
      weight /= 2;
    }
  }
  const value = mant * Math.pow(2, exp - 128);
  return (high & 0x80) !== 0 ? -value : value;
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
    case 'EOF':
      return ctx.fileEof(Math.floor(one(args))) ? REL_TRUE : REL_FALSE;
    case 'LOC':
      return ctx.fileLoc(Math.floor(one(args)));
    case 'LOF':
      return ctx.fileLof(Math.floor(one(args)));

    // --- number <-> byte-string conversions (Disk BASIC) ------------------
    case 'MKI$': {
      const n = Math.round(one(args)) & 0xffff;
      return stringFromBytes([n & 0xff, (n >> 8) & 0xff]);
    }
    case 'MKS$':
      return stringFromBytes(mbfFromNumber(one(args), 4));
    case 'MKD$':
      return stringFromBytes(mbfFromNumber(one(args), 8));
    case 'CVI': {
      const [lo, hi] = bytesFromString(asStr(args[0]!), 2);
      const v = lo! | (hi! << 8);
      return v >= 0x8000 ? v - 0x10000 : v;
    }
    case 'CVS':
      return numberFromMbf(bytesFromString(asStr(args[0]!), 4));
    case 'CVD':
      return numberFromMbf(bytesFromString(asStr(args[0]!), 8));

    // --- strings -------------------------------------------------------
    case 'LEN':
      return chars(asStr(args[0]!)).length;
    case 'ASC': {
      const s = asStr(args[0]!);
      if (s.length === 0) throw new BasicError('FC');
      const first = String.fromCodePoint(s.codePointAt(0)!);
      const code = runtimeCharToCode(first);
      if (code === undefined) throw new BasicError('FC');
      return code;
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
      const s = chars(asStr(args[0]!));
      return s.slice(0, Math.max(0, asNum(args[1]!))).join('');
    }
    case 'RIGHT$': {
      const s = chars(asStr(args[0]!));
      const n = Math.max(0, asNum(args[1]!));
      return (n >= s.length ? s : s.slice(s.length - n)).join('');
    }
    case 'MID$': {
      const s = chars(asStr(args[0]!));
      const start = Math.max(1, Math.floor(asNum(args[1]!)));
      const len = args.length >= 3 ? Math.max(0, asNum(args[2]!)) : s.length;
      return s.slice(start - 1, start - 1 + len).join('');
    }
    case 'STRING$': {
      const n = Math.max(0, Math.floor(asNum(args[0]!)));
      const c = isStr(args[1]!)
        ? (chars(asStr(args[1]!))[0] ?? ' ')
        : chr(asNum(args[1]!));
      return c.repeat(n);
    }
    case 'INSTR': {
      // INSTR([start,] s$, t$) - positions count characters, not UTF-16 units.
      let from = 0;
      let s: string;
      let t: string;
      if (args.length === 3) {
        from = Math.max(1, Math.floor(asNum(args[0]!))) - 1;
        s = asStr(args[1]!);
        t = asStr(args[2]!);
      } else if (args.length === 2) {
        s = asStr(args[0]!);
        t = asStr(args[1]!);
      } else {
        throw new BasicError('FC');
      }
      const hay = chars(s);
      const needle = chars(t);
      for (let i = from; i + needle.length <= hay.length; i++) {
        if (needle.every((c, k) => hay[i + k] === c)) return i + 1;
      }
      return 0;
    }

    default:
      // VARPTR (no authentic variable storage to point at) and USR (no Z80 in
      // this backend) have nothing meaningful to return here.
      throw new BasicError('FC');
  }
}
