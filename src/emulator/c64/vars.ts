import type { MachineVariable } from '../../dialects/types';

/**
 * Decoder for the Commodore 64 BASIC (CBM BASIC V2) variables area, used by the
 * viciious-backed {@link import('./c64Machine').C64Machine}. Read-only.
 *
 * Three contiguous stores are walked, located by zero-page pointers:
 *
 *  - **Scalars** from `VARTAB` (`$2D`) up to `ARYTAB` (`$2F`), 7 bytes each:
 *    two name bytes followed by a 5-byte value.
 *  - **Arrays** from `ARYTAB` (`$2F`) up to `STREND` (`$31`): a header (name +
 *    a 2-byte LE offset to the next array + dimension table) followed by the
 *    elements.
 *
 * In both stores the variable's type is encoded in the high (bit-7) flags of
 * the two name bytes: both clear → real, both set → integer (`%`), first clear /
 * second set → string (`$`), first set / second clear → a `DEF FN` definition
 * (skipped — not user data). The low 7 bits of each name byte are the PETSCII
 * name characters; a masked second byte of `0` means a single-character name.
 *
 * All variable data lives in always-RAM regions below `$A000`, so reads go
 * straight through the bus with no bank switching and no side effects.
 */
export interface C64MemPort {
  read(addr: number): number;
  readWord(addr: number): number;
}

/** Zero-page pointer to the start of scalar variables (LE word). */
const VARTAB = 0x2d;
/** Zero-page pointer to the start of array variables / end of scalars. */
const ARYTAB = 0x2f;
/** Zero-page pointer to the end of array variables. */
const STREND = 0x31;
/** Guards against runaway parsing of a corrupt or unexpected variables area. */
const MAX_VARS = 1000;
/** Array elements shown inline before truncating with an ellipsis. */
const MAX_ARRAY_PREVIEW = 8;

function fmtNum(n: number): string {
  return Number.parseFloat(n.toPrecision(9)).toString();
}

/**
 * Decode a 5-byte C64 float (Microsoft MFLPT): exponent first (excess-`$80`),
 * then a 4-byte mantissa big-endian (MSB first). The mantissa is normalized so
 * its top bit is always 1; that bit holds the sign instead (0 = positive), and
 * the implied 1 is restored here. A zero exponent means the value is zero. This
 * is byte-for-byte the Sinclair / BBC 5-byte float (see decodeBbcReal).
 */
export function decodeC64Float(b: ArrayLike<number>, offset = 0): number {
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

/** Signed 16-bit big-endian, as integer (`%`) variables and array dims store. */
function readInt16BE(hi: number, lo: number): number {
  const v = (hi << 8) | lo;
  return v >= 0x8000 ? v - 0x10000 : v;
}

/** The four C64-specific PETSCII glyphs outside the plain ASCII range. */
const PETSCII_SPECIAL: Record<number, string> = {
  0x5c: '£',
  0x5e: '↑',
  0x5f: '←',
  0xff: 'π',
};

/**
 * Minimal PETSCII -> display text for the watcher: the printable ASCII span and
 * the four C64-specific glyphs, everything else a dot. Mirrors the BBC decoder's
 * printable-or-dot policy and stays free of any dialect import.
 */
function decodeString(mem: C64MemPort, addr: number, len: number): string {
  let s = '';
  for (let i = 0; i < len; i++) {
    const c = mem.read((addr + i) & 0xffff);
    const special = PETSCII_SPECIAL[c];
    if (special !== undefined) s += special;
    else if (c >= 0x20 && c <= 0x5d) s += String.fromCharCode(c);
    else s += '.';
  }
  return s;
}

/** Variable type from the two name bytes' high (bit-7) flags. */
type VarType = 'real' | 'int' | 'string' | 'fn';
function typeOf(b0: number, b1: number): VarType {
  const hi0 = (b0 & 0x80) !== 0;
  const hi1 = (b1 & 0x80) !== 0;
  if (hi0 && hi1) return 'int';
  if (!hi0 && hi1) return 'string';
  if (hi0 && !hi1) return 'fn';
  return 'real';
}

/** Display name from the two name bytes (`$`/`%` suffix added by the caller). */
function nameOf(b0: number, b1: number): string {
  let name = String.fromCharCode(b0 & 0x7f);
  const c1 = b1 & 0x7f;
  if (c1 !== 0) name += String.fromCharCode(c1);
  return name;
}

export function readC64Variables(mem: C64MemPort): MachineVariable[] {
  const out: MachineVariable[] = [];
  const varTab = mem.readWord(VARTAB);
  const aryTab = mem.readWord(ARYTAB);
  const strEnd = mem.readWord(STREND);

  // Scalars: VARTAB .. ARYTAB, 7 bytes each.
  for (let p = varTab; p + 7 <= aryTab && out.length < MAX_VARS; p += 7) {
    const b0 = mem.read(p);
    const b1 = mem.read(p + 1);
    const vp = p + 2;
    const base = nameOf(b0, b1);
    switch (typeOf(b0, b1)) {
      case 'real':
        out.push({
          name: base,
          kind: 'number',
          value: fmtNum(
            decodeC64Float([
              mem.read(vp),
              mem.read(vp + 1),
              mem.read(vp + 2),
              mem.read(vp + 3),
              mem.read(vp + 4),
            ]),
          ),
          ref: { addr: vp, layout: 'real' },
        });
        break;
      case 'int':
        out.push({
          name: base + '%',
          kind: 'number',
          value: String(readInt16BE(mem.read(vp), mem.read(vp + 1))),
          ref: { addr: vp, layout: 'int' },
        });
        break;
      case 'string': {
        const len = mem.read(vp);
        const ptr = mem.read(vp + 1) | (mem.read(vp + 2) << 8);
        out.push({
          name: base + '$',
          kind: 'string',
          value: '"' + decodeString(mem, ptr, len) + '"',
          ref: { addr: vp, layout: 'string' },
        });
        break;
      }
      case 'fn':
        // DEF FN definition, not a user variable; skip.
        break;
    }
  }

  // Arrays: ARYTAB .. STREND, variable length per the entry's own offset.
  let p = aryTab;
  let guard = 0;
  while (p + 5 <= strEnd && out.length < MAX_VARS && guard++ < MAX_VARS) {
    const b0 = mem.read(p);
    const b1 = mem.read(p + 1);
    const offset = mem.readWord(p + 2);
    if (offset <= 0) break;
    decodeArray(mem, b0, b1, p, out);
    p += offset;
  }

  return out;
}

function decodeArray(
  mem: C64MemPort,
  b0: number,
  b1: number,
  p: number,
  out: MachineVariable[],
): void {
  const type = typeOf(b0, b1);
  if (type === 'fn') return; // no FN arrays
  const base = nameOf(b0, b1);
  const ndim = mem.read(p + 4);
  // Dimension sizes: 2-byte big-endian each, stored reverse of DIM order.
  const dims: number[] = [];
  for (let i = 0; i < ndim; i++) {
    const dp = p + 5 + i * 2;
    dims.push((mem.read(dp) << 8) | mem.read(dp + 1));
  }
  dims.reverse();
  // Show the DIM bounds the user wrote (subscript = size - 1).
  const shape = '[' + dims.map((d) => Math.max(0, d - 1)).join(',') + ']';
  const elemBase = p + 5 + ndim * 2;
  const count = dims.reduce((a, b) => a * b, 1);

  if (type === 'string') {
    out.push({
      name: base + '$()',
      kind: 'string-array',
      value: shape,
      ref: { addr: elemBase, layout: 'string-array' },
    });
    return;
  }

  const isInt = type === 'int';
  const stride = isInt ? 2 : 5;
  const preview: string[] = [];
  for (let i = 0; i < count && i < MAX_ARRAY_PREVIEW; i++) {
    const ep = elemBase + i * stride;
    preview.push(
      isInt
        ? String(readInt16BE(mem.read(ep), mem.read(ep + 1)))
        : fmtNum(
            decodeC64Float([
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
    name: base + (isInt ? '%()' : '()'),
    kind: 'number-array',
    value: `${shape} = ${preview.join(', ')}${more}`,
    ref: { addr: elemBase, layout: 'number-array' },
  });
}
