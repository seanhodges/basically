import { BasicError } from './errors';

/** A Level II value at runtime: either a number or a string. */
export type BasicValue = number | string;

export function isStr(v: BasicValue): v is string {
  return typeof v === 'string';
}

/** Coerce to number or raise a Type Mismatch (the Level II `?TM ERROR`). */
export function asNum(v: BasicValue): number {
  if (typeof v === 'number') return v;
  throw new BasicError('TM');
}

/** Coerce to string or raise a Type Mismatch. */
export function asStr(v: BasicValue): string {
  if (typeof v === 'string') return v;
  throw new BasicError('TM');
}

/** Guard a freshly computed number against overflow (Level II `?OV ERROR`). */
export function checkNum(n: number): number {
  if (!Number.isFinite(n)) throw new BasicError('OV');
  return n;
}

/**
 * Format a number the way Level II PRINT / STR$ does: a leading space stands in
 * for the sign of a non-negative value, ~6 significant digits (single
 * precision), trailing zeros trimmed, and `E±nn` notation outside roughly
 * 0.1 ≤ |x| < 1e7.
 *
 * This is a pragmatic match, not a bit-for-bit reproduction of the ROM's binary
 * float formatter — small integers and simple decimals render identically;
 * edge-case rounding of long fractions may differ (a documented divergence).
 */
export function formatNumber(n: number): string {
  if (Number.isNaN(n)) return ' NAN';
  if (!Number.isFinite(n)) return n < 0 ? '-INF' : ' INF';
  const sign = n < 0 ? '-' : ' ';
  const a = Math.abs(n);
  if (a === 0) return `${sign}0`;

  const exp = Math.floor(Math.log10(a) + 1e-10);
  let body: string;
  if (exp < -1 || exp >= 7) {
    const [mant, e] = a.toExponential(5).split('e');
    const en = parseInt(e!, 10);
    const es = (en < 0 ? '-' : '+') + String(Math.abs(en)).padStart(2, '0');
    body = `${trimZeros(mant!)}E${es}`;
  } else {
    const decimals = Math.max(0, 6 - 1 - exp);
    body = trimZeros(a.toFixed(Math.min(decimals, 9)));
    if (body.startsWith('0.')) body = body.slice(1); // Level II drops the 0
  }
  return sign + body;
}

function trimZeros(s: string): string {
  if (!s.includes('.')) return s;
  s = s.replace(/0+$/, '');
  if (s.endsWith('.')) s = s.slice(0, -1);
  return s;
}
