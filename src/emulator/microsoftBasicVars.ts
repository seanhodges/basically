// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MachineVariable } from '../dialects/types';

/**
 * Decoder for the variable area Microsoft 8K BASIC keeps, for the variable
 * watcher. Read-only.
 *
 * Shared by every machine here running a Microsoft 8K BASIC on an 8080 - the
 * Altair's Altair 8K BASIC and the PMD 85's BASIC-G - the way
 * `microsoftBasicLoad.ts` shares the program hand-over and `i8080/` shares the
 * flag corrections. Both layouts were read off their own booted machine, byte
 * for byte, rather than assumed from the family, and they agree in every field;
 * only the pointer addresses and the machine's character set differ, which is
 * what {@link MsBasicVarsLayout} carries.
 *
 * Two of the fields are not what a reader who knows a Commodore would expect,
 * and they are the ones a hand-written second copy would get wrong:
 *
 *  - **The name bytes are stored second character first.** `AB` is `42 41`, and
 *    a one-character name has `00` in the first byte. What is flagged is that
 *    first byte: bit 7 set means the variable is a string. (`C$` is `80 43`.)
 *  - **A string descriptor is four bytes, not three**: length, one unused byte,
 *    then the address low byte first. Reading it as the usual three points at
 *    the wrong end of memory entirely.
 *
 * Two contiguous stores are walked, located by the interpreter's own pointers:
 * scalars from `vartab` to `arytab`, six bytes each, and arrays from `arytab`
 * to `strend`.
 */

/** Bytes in one scalar entry: two of name, four of value. */
const SCALAR_ENTRY_BYTES = 6;

/** Bytes in one value, scalar or array element: a float, or a descriptor. */
const VALUE_BYTES = 4;

/** Bit 7 of the first name byte: the variable is a string. */
const STRING_FLAG = 0x80;

/** Guards against runaway parsing of a corrupt or half-initialised area. */
const MAX_VARS = 500;

/** Array elements shown inline before truncating with an ellipsis. */
const MAX_ARRAY_PREVIEW = 8;

/**
 * The non-recording half of a machine's bus. Named for `peek` rather than
 * `read`, and deliberately: the watcher polls this while the program runs, and
 * reading through the recording path would paint the memory-map overlay with
 * accesses the program never made.
 */
export interface MsBasicMemPort {
  peek(addr: number): number;
  rawReadWord(addr: number): number;
}

/** Where one machine keeps its variable pointers, and how it spells a byte. */
export interface MsBasicVarsLayout {
  /** Pointer to the start of the scalar variables (LE word). */
  vartab: number;
  /** Pointer to the end of the scalars, and the start of the arrays. */
  arytab: number;
  /** Pointer to the end of the arrays. */
  strend: number;
  /** The machine's own character decoder, for names and string contents. */
  plainChar(code: number): string | undefined;
}

/**
 * Decode a 4-byte Microsoft 8K BASIC float: mantissa low, mid, high, then the
 * excess-129 exponent. The mantissa is normalised so its top bit is always 1,
 * so that bit carries the sign instead (0 = positive) and the implied 1 is
 * restored here. A zero exponent means the value is zero.
 *
 * The byte order is the reverse of the Commodore five-byte float this project
 * also decodes (`emulator/c64/vars.ts`), which is the trap in reading one
 * having written the other.
 */
export function decodeMsBasicFloat(b: ArrayLike<number>, offset = 0): number {
  const exp = b[offset + 3]!;
  if (exp === 0) return 0;
  const msb = b[offset + 2]!;
  const negative = (msb & 0x80) !== 0;
  const mant =
    ((msb | 0x80) >>> 0) * 2 ** 16 + b[offset + 1]! * 2 ** 8 + b[offset]!;
  const value = (mant / 2 ** 23) * 2 ** (exp - 0x81);
  return negative ? -value : value;
}

function fmtNum(n: number): string {
  return Number.parseFloat(n.toPrecision(7)).toString();
}

/** The four value bytes of the entry at `addr`. */
function valueBytes(mem: MsBasicMemPort, addr: number): number[] {
  return [0, 1, 2, 3].map((i) => mem.peek((addr + i) & 0xffff));
}

/** A string's characters, through the machine's own charset. */
function decodeString(
  mem: MsBasicMemPort,
  layout: MsBasicVarsLayout,
  value: number[],
): string {
  const length = value[0]!;
  const addr = value[2]! | (value[3]! << 8);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += layout.plainChar(mem.peek((addr + i) & 0xffff)) ?? '.';
  }
  return out;
}

/** The name a pair of name bytes spells, or null for an entry to skip. */
function nameOf(
  layout: MsBasicVarsLayout,
  second: number,
  first: number,
): string | null {
  // Bit 7 on the *first* character marks a DEF FN definition, which 8K BASIC
  // keeps in this same table. It is not user data, so it is skipped.
  if (first & STRING_FLAG) return null;
  const head = layout.plainChar(first);
  if (head === undefined) return null;
  const tail = second & ~STRING_FLAG & 0xff;
  const rest = tail === 0 ? '' : (layout.plainChar(tail) ?? '');
  return head + rest;
}

/** One value, rendered as the watcher shows it. */
function showValue(
  mem: MsBasicMemPort,
  layout: MsBasicVarsLayout,
  addr: number,
  isString: boolean,
): string {
  const value = valueBytes(mem, addr);
  return isString
    ? `"${decodeString(mem, layout, value)}"`
    : fmtNum(decodeMsBasicFloat(value));
}

/** The scalar variables, in the order the interpreter created them. */
function readScalars(
  mem: MsBasicMemPort,
  layout: MsBasicVarsLayout,
): MachineVariable[] {
  const out: MachineVariable[] = [];
  const end = mem.rawReadWord(layout.arytab);
  let addr = mem.rawReadWord(layout.vartab);
  for (let n = 0; addr + SCALAR_ENTRY_BYTES <= end && n < MAX_VARS; n++) {
    const second = mem.peek(addr);
    const first = mem.peek(addr + 1);
    const name = nameOf(layout, second, first);
    if (name !== null) {
      const isString = (second & STRING_FLAG) !== 0;
      out.push({
        name: isString ? `${name}$` : name,
        kind: isString ? 'string' : 'number',
        value: showValue(mem, layout, addr + 2, isString),
      });
    }
    addr += SCALAR_ENTRY_BYTES;
  }
  return out;
}

/**
 * The arrays. An entry is the two name bytes, a 2-byte length covering
 * everything after itself, a dimension count, one 2-byte size per dimension,
 * and then the elements in ascending subscript order.
 */
function readArrays(
  mem: MsBasicMemPort,
  layout: MsBasicVarsLayout,
): MachineVariable[] {
  const out: MachineVariable[] = [];
  const end = mem.rawReadWord(layout.strend);
  let addr = mem.rawReadWord(layout.arytab);
  for (let n = 0; addr + 5 <= end && n < MAX_VARS; n++) {
    const second = mem.peek(addr);
    const first = mem.peek(addr + 1);
    const size = mem.rawReadWord(addr + 2);
    if (size <= 0) break;
    const name = nameOf(layout, second, first);
    const dims = mem.peek(addr + 4);
    const elements = addr + 5 + dims * 2;
    if (name !== null) {
      const isString = (second & STRING_FLAG) !== 0;
      const count = (addr + 4 + size - elements) / VALUE_BYTES;
      const shown: string[] = [];
      for (let i = 0; i < Math.min(count, MAX_ARRAY_PREVIEW); i++) {
        shown.push(
          showValue(mem, layout, elements + i * VALUE_BYTES, isString),
        );
      }
      if (count > shown.length) shown.push('…');
      out.push({
        name: isString ? `${name}$()` : `${name}()`,
        kind: isString ? 'string-array' : 'number-array',
        value: shown.join(', '),
      });
    }
    addr = addr + 4 + size;
  }
  return out;
}

/** Every variable the interpreter currently holds, scalars first. */
export function readMsBasicVariables(
  mem: MsBasicMemPort,
  layout: MsBasicVarsLayout,
): MachineVariable[] {
  return [...readScalars(mem, layout), ...readArrays(mem, layout)];
}
