import type { MachineVariable } from '../../dialects/types';

/**
 * Decoder for the BBC BASIC (6502, BASIC II/IV) variables area, used by the
 * jsbeeb-backed {@link BbcMachine} for both the BBC Micro and BBC Master (their
 * BASICs share this in-memory layout). Read-only.
 *
 * Two stores are walked:
 *
 *  - **Resident integers** `A%`–`Z%` at fixed addresses `&0404`–`&0467`
 *    (4-byte little-endian two's-complement each). These always exist, so only
 *    the non-zero ones are surfaced; `@%` (`&0400`, a print-format control) is
 *    skipped as it isn't user data.
 *  - **Dynamic variables** (reals, strings, arrays, and lowercase/multi-char
 *    integers) held in linked-list chains. A pointer table at `&0480`–`&04F5`
 *    has one 2-byte LE head pointer per first character `c`, at
 *    `0x0480 + (c - 0x40) * 2`; a zero head means no chain. Each entry is
 *    `[next: 2 LE][rest-of-name…][0x00][value]`; the full name is the first
 *    character + rest, and its final character tags the type (`%` integer,
 *    `$` string, `(` array, otherwise real).
 */
export interface BbcMemPort {
  read(addr: number): number;
  readWord(addr: number): number;
}

/** First resident integer (`A%`); `@%` at &0400 is skipped. */
const RESIDENT_A = 0x0404;
/** Head-pointer table base; entry for char `c` is at TABLE + (c - 0x40) * 2. */
const PTR_TABLE = 0x0480;
/** Guards against runaway parsing of a corrupt or unexpected variables area. */
const MAX_VARS = 1000;
/** Longest name suffix we read before assuming the area is corrupt. */
const MAX_NAME = 16;
/** Array elements shown inline before truncating with an ellipsis. */
const MAX_ARRAY_PREVIEW = 8;

function fmtNum(n: number): string {
  return Number.parseFloat(n.toPrecision(9)).toString();
}

/** 4-byte little-endian two's-complement integer; JS bitwise OR yields it. */
function readInt32(mem: BbcMemPort, addr: number): number {
  return (
    mem.read(addr) |
    (mem.read(addr + 1) << 8) |
    (mem.read(addr + 2) << 16) |
    (mem.read(addr + 3) << 24) |
    0
  );
}

/**
 * Decode a 5-byte BBC real as held in a variable: exponent first (excess-&80),
 * then the 4-byte mantissa big-endian (MSB first). The mantissa is normalized
 * so its top bit is always 1; that bit holds the sign instead (0 = positive),
 * and the implied 1 is restored here. A zero exponent means the value is zero.
 * This is byte-for-byte the Sinclair 5-byte float (see decodeZxFloat).
 */
export function decodeBbcReal(b: ArrayLike<number>, offset = 0): number {
  const exp = b[offset]!;
  if (exp === 0) return 0;
  const msb = b[offset + 1]!;
  const negative = (msb & 0x80) !== 0;
  const mant =
    ((msb | 0x80) >>> 0) * 2 ** 24 +
    b[offset + 2]! * 2 ** 16 +
    b[offset + 3]! * 2 ** 8 +
    b[offset + 4]!;
  const value = (mant / 2 ** 32) * 2 ** (exp - 0x80);
  return negative ? -value : value;
}

/** Decode BBC character codes to a display string (BBC text is ASCII). */
function decodeString(mem: BbcMemPort, addr: number, len: number): string {
  let s = '';
  for (let i = 0; i < len; i++) {
    const c = mem.read(addr + i);
    s += c >= 0x20 && c < 0x7f ? String.fromCharCode(c) : '.';
  }
  return s;
}

export function readBbcVariables(mem: BbcMemPort): MachineVariable[] {
  const out: MachineVariable[] = [];

  // Resident integers A%–Z%, non-zero only.
  for (let n = 0; n < 26; n++) {
    const addr = RESIDENT_A + n * 4;
    const v = readInt32(mem, addr);
    if (v === 0) continue;
    out.push({
      name: String.fromCharCode(0x41 + n) + '%',
      kind: 'number',
      value: String(v),
      ref: { addr, layout: 'int' },
    });
  }

  // Dynamic variable chains, one per first-character slot (letters only).
  for (let c = 0x41; c <= 0x7a; c++) {
    if (c > 0x5a && c < 0x61) continue; // skip [ \ ] ^ _ ` between Z and a
    let p = mem.readWord(PTR_TABLE + (c - 0x40) * 2);
    let guard = 0;
    while (p !== 0 && out.length < MAX_VARS && guard++ < MAX_VARS) {
      const next = mem.readWord(p);
      let q = p + 2;
      let rest = '';
      for (let i = 0; i < MAX_NAME; i++) {
        const ch = mem.read(q++);
        if (ch === 0) break;
        rest += String.fromCharCode(ch);
      }
      const name = String.fromCharCode(c) + rest;
      decodeEntry(mem, name, q, out);
      p = next;
    }
  }

  return out;
}

/** Decode one heap entry's value (at `vp`) given its already-read `name`. */
function decodeEntry(
  mem: BbcMemPort,
  name: string,
  vp: number,
  out: MachineVariable[],
): void {
  const last = name[name.length - 1];

  if (last === '(') {
    // Array: element type is the character before '(' ('%' int, '$' string).
    const elemTag = name[name.length - 2];
    decodeArray(mem, name, elemTag, vp, out);
    return;
  }
  if (last === '%') {
    out.push({
      name,
      kind: 'number',
      value: String(readInt32(mem, vp)),
      ref: { addr: vp, layout: 'int' },
    });
    return;
  }
  if (last === '$') {
    // String descriptor: pointer (2 LE), bytes allocated, current length.
    const ptr = mem.readWord(vp);
    const len = mem.read(vp + 3);
    out.push({
      name,
      kind: 'string',
      value: '"' + decodeString(mem, ptr, len) + '"',
      ref: { addr: vp, layout: 'string' },
    });
    return;
  }
  // Real scalar.
  const bytes = [
    mem.read(vp),
    mem.read(vp + 1),
    mem.read(vp + 2),
    mem.read(vp + 3),
    mem.read(vp + 4),
  ];
  out.push({
    name,
    kind: 'number',
    value: fmtNum(decodeBbcReal(bytes)),
    ref: { addr: vp, layout: 'real' },
  });
}

function decodeArray(
  mem: BbcMemPort,
  name: string,
  elemTag: string | undefined,
  vp: number,
  out: MachineVariable[],
): void {
  const isString = elemTag === '$';
  const isInt = elemTag === '%';
  // The descriptor starts with its own byte length (1 + 2 per dimension);
  // each dimension is then a 2-byte LE element count (DIM subscript + 1), and
  // the elements follow immediately after.
  const headerLen = mem.read(vp);
  const ndim = Math.min(8, Math.max(0, (headerLen - 1) >> 1));
  const dims: number[] = [];
  for (let i = 0; i < ndim; i++) dims.push(mem.readWord(vp + 1 + i * 2));
  // Show the DIM bounds the user wrote (subscript = count - 1).
  const shape = '[' + dims.map((d) => Math.max(0, d - 1)).join(',') + ']';
  const elemBase = vp + headerLen;

  if (isString) {
    out.push({
      name,
      kind: 'string-array',
      value: shape,
      ref: { addr: elemBase, layout: 'string-array' },
    });
    return;
  }

  const count = dims.reduce((a, b) => a * b, 1);
  const stride = isInt ? 4 : 5;
  const p = elemBase;
  const preview: string[] = [];
  for (let i = 0; i < count && i < MAX_ARRAY_PREVIEW; i++) {
    const ep = p + i * stride;
    preview.push(
      isInt
        ? String(readInt32(mem, ep))
        : fmtNum(
            decodeBbcReal([
              mem.read(ep),
              mem.read(ep + 1),
              mem.read(ep + 2),
              mem.read(ep + 3),
              mem.read(ep + 4),
            ]),
          ),
    );
  }
  const more = count > MAX_ARRAY_PREVIEW ? ', …' : '';
  out.push({
    name,
    kind: 'number-array',
    value: `${shape} = ${preview.join(', ')}${more}`,
    ref: { addr: p, layout: 'number-array' },
  });
}
