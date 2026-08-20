// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MachineVariable } from '../types';
import { ARYTAB, STREND, VARTAB } from './addresses';
import { plainChar } from './charset';

/**
 * Decoder for BASIC-G's variable area, for the variable watcher. Read-only.
 *
 * The shape is Microsoft 8K BASIC's, and every field below was read off a
 * booted machine rather than assumed from the family - two of them are not what
 * a reader who knows a Commodore would expect:
 *
 *  - **The name bytes are stored second character first.** `AB` is `42 41`, and
 *    a one-character name has `00` in the first byte. What is flagged is that
 *    first byte: bit 7 set means the variable is a string. (`C$` is `80 43`.)
 *  - **A string descriptor is four bytes, not three**: length, one unused byte,
 *    then the address low byte first. Reading it as the usual three puts `HI`
 *    at 0x1300 instead of at 0x2413, which is in the program text where a
 *    literal assignment really points.
 *
 * Two contiguous stores are walked, located by the interpreter's own pointers:
 * scalars from {@link VARTAB} to {@link ARYTAB}, six bytes each, and arrays from
 * {@link ARYTAB} to {@link STREND}.
 */

/** Bytes in one scalar entry: two of name, four of value. */
const SCALAR_ENTRY_BYTES = 6;

/** Bit 7 of the first name byte: the variable is a string. */
const STRING_FLAG = 0x80;

/** Guards against runaway parsing of a corrupt or half-initialised area. */
const MAX_VARS = 500;

/** Array elements shown inline before truncating with an ellipsis. */
const MAX_ARRAY_PREVIEW = 8;

export interface Pmd85MemPort {
  read(addr: number): number;
  readWord(addr: number): number;
}

/**
 * Decode a 4-byte BASIC-G float: mantissa low, mid, high, then the excess-129
 * exponent. The mantissa is normalised so its top bit is always 1, so that bit
 * carries the sign instead (0 = positive) and the implied 1 is restored here.
 * A zero exponent means the value is zero.
 */
export function decodePmd85Float(b: ArrayLike<number>, offset = 0): number {
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
function valueBytes(mem: Pmd85MemPort, addr: number): number[] {
  return [0, 1, 2, 3].map((i) => mem.read((addr + i) & 0xffff));
}

/** A string's characters, through the machine's own charset. */
function decodeString(mem: Pmd85MemPort, value: number[]): string {
  const length = value[0]!;
  const addr = value[2]! | (value[3]! << 8);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += plainChar(mem.read((addr + i) & 0xffff)) ?? '.';
  }
  return out;
}

/** The name a pair of name bytes spells, or null for an entry to skip. */
function nameOf(second: number, first: number): string | null {
  // Bit 7 on the *first* character marks a DEF FNC definition, which 8K BASIC
  // keeps in this same table. It is not user data, so it is skipped.
  if (first & STRING_FLAG) return null;
  const head = plainChar(first);
  if (head === undefined) return null;
  const tail = second & ~STRING_FLAG & 0xff;
  const rest = tail === 0 ? '' : (plainChar(tail) ?? '');
  return head + rest;
}

/** The scalar variables, in the order the interpreter created them. */
function readScalars(mem: Pmd85MemPort): MachineVariable[] {
  const out: MachineVariable[] = [];
  const end = mem.readWord(ARYTAB);
  let addr = mem.readWord(VARTAB);
  for (let n = 0; addr + SCALAR_ENTRY_BYTES <= end && n < MAX_VARS; n++) {
    const second = mem.read(addr);
    const first = mem.read(addr + 1);
    const name = nameOf(second, first);
    const value = valueBytes(mem, addr + 2);
    if (name !== null) {
      const isString = (second & STRING_FLAG) !== 0;
      out.push({
        name: isString ? `${name}$` : name,
        kind: isString ? 'string' : 'number',
        value: isString
          ? `"${decodeString(mem, value)}"`
          : fmtNum(decodePmd85Float(value)),
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
function readArrays(mem: Pmd85MemPort): MachineVariable[] {
  const out: MachineVariable[] = [];
  const end = mem.readWord(STREND);
  let addr = mem.readWord(ARYTAB);
  for (let n = 0; addr + 5 <= end && n < MAX_VARS; n++) {
    const second = mem.read(addr);
    const first = mem.read(addr + 1);
    const size = mem.readWord(addr + 2);
    if (size <= 0) break;
    const name = nameOf(second, first);
    const dims = mem.read(addr + 4);
    const elements = addr + 5 + dims * 2;
    if (name !== null) {
      const isString = (second & STRING_FLAG) !== 0;
      const count = (addr + 4 + size - elements) / 4;
      const shown: string[] = [];
      for (let i = 0; i < Math.min(count, MAX_ARRAY_PREVIEW); i++) {
        const value = valueBytes(mem, elements + i * 4);
        shown.push(
          isString
            ? `"${decodeString(mem, value)}"`
            : fmtNum(decodePmd85Float(value)),
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

/** Every BASIC-G variable the machine currently holds, scalars first. */
export function readPmd85Variables(mem: Pmd85MemPort): MachineVariable[] {
  return [...readScalars(mem), ...readArrays(mem)];
}
