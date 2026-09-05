// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MachineVariable } from '../types';
import {
  ARYTAB,
  DEFTBL,
  STREND,
  VARTAB,
  type MsxMemPort,
} from '../../emulator/msx/workspace';
import { hb10pCharset } from './charset';
import { formatFloatBytes } from './numbers';

/**
 * The running program's variables, walked from the interpreter's own pointers.
 *
 * MSX BASIC is BASIC-80 derived and carries four value types, so its entry
 * layout is not the one the shared Microsoft 8K decoder walks. The real layout
 * was read off the booted machine byte for byte, and it is simpler than 8K
 * BASIC's rather than an extension of it - the leading byte says how big the
 * value is, and the size *is* the type:
 *
 * ```
 *   scalar:  type(1)  name(2)  value(type bytes)
 *   array:   type(1)  name(2)  size(2)  dims(1)  bounds(2 x dims)  elements
 * ```
 *
 * Three things a reader who knows the 8K layout would get wrong:
 *
 *  - **The name is stored first character first**, unflagged, with a zero
 *    second byte for a one-character name. 8K BASIC stores it backwards and
 *    hides the string flag in it; here the type byte carries everything.
 *  - **A string descriptor is three bytes** - length then the address - not the
 *    four-byte one 8K BASIC keeps.
 *  - **An array's bound list runs last dimension first.** `DIM A(1,2)` stores
 *    3 then 2, so a decoder that reads them in source order transposes the
 *    shape it reports.
 *
 * An array entry's `size` covers everything from the dimension count onwards,
 * so the next entry starts `5 + size` bytes on.
 */

/** Value size in bytes, which is also the type byte the entry starts with. */
const TYPE_INTEGER = 2;
const TYPE_STRING = 3;
const TYPE_SINGLE = 4;
const TYPE_DOUBLE = 8;

/** Bytes of header before an array's dimension count: type, name and size. */
const ARRAY_HEADER_BYTES = 5;

/** Guards against runaway parsing of a corrupt or half-initialised area. */
const MAX_ENTRIES = 500;
/** Array elements shown inline before truncating with an ellipsis. */
const MAX_ARRAY_PREVIEW = 8;

/**
 * The suffix the machine itself would need to name this variable.
 *
 * MSX BASIC stores no suffix: a name is two characters and a type byte, and
 * which suffix that type needs depends on what DEFINT/DEFSNG/DEFDBL/DEFSTR
 * last set for that initial letter. So the default table is read back and the
 * suffix shown only where the type differs from it - which on a clean boot,
 * where every letter defaults to double, means `A=1` shows as `A` and `A%=1`
 * as `A%`, exactly as the program spells them.
 */
function suffixFor(mem: MsxMemPort, name: string, type: number): string {
  const letter = name.charCodeAt(0) - 0x41;
  const preferred =
    letter >= 0 && letter < 26 ? mem.peek(DEFTBL + letter) : TYPE_DOUBLE;
  if (type === preferred) return '';
  switch (type) {
    case TYPE_INTEGER:
      return '%';
    case TYPE_STRING:
      return '$';
    case TYPE_SINGLE:
      return '!';
    default:
      return '#';
  }
}

/** The name at `addr`: one or two characters, the second zero when unused. */
function nameAt(mem: MsxMemPort, addr: number): string {
  const first = mem.peek(addr);
  const second = mem.peek(addr + 1);
  return second === 0
    ? String.fromCharCode(first)
    : String.fromCharCode(first, second);
}

/** A 16-bit word read as MSX BASIC's signed integer type. */
function signed16(word: number): number {
  return word >= 0x8000 ? word - 0x10000 : word;
}

/** One value of `type` bytes at `addr`, as the watcher shows it. */
function valueAt(mem: MsxMemPort, addr: number, type: number): string {
  if (type === TYPE_INTEGER) return String(signed16(mem.peekWord(addr)));
  if (type === TYPE_STRING) {
    const length = mem.peek(addr);
    const at = mem.peekWord(addr + 1);
    const codes: number[] = [];
    for (let i = 0; i < length; i++) codes.push(mem.peek((at + i) & 0xffff));
    return `"${hb10pCharset.toUnicode(codes)}"`;
  }
  const bytes: number[] = [];
  for (let i = 0; i < type; i++) bytes.push(mem.peek((addr + i) & 0xffff));
  return formatFloatBytes(bytes, 0, type - 1);
}

/** True for a type byte the interpreter can actually have written. */
function isValueType(type: number): boolean {
  return (
    type === TYPE_INTEGER ||
    type === TYPE_STRING ||
    type === TYPE_SINGLE ||
    type === TYPE_DOUBLE
  );
}

/** The scalar variables, in the order the interpreter created them. */
function readScalars(mem: MsxMemPort): MachineVariable[] {
  const out: MachineVariable[] = [];
  const end = mem.peekWord(ARYTAB);
  let addr = mem.peekWord(VARTAB);
  for (let n = 0; addr < end && n < MAX_ENTRIES; n++) {
    const type = mem.peek(addr);
    // An unknown type byte means the area is not what it should be; stop
    // rather than walk on emitting garbage from a wrong stride.
    if (!isValueType(type)) break;
    const name = nameAt(mem, addr + 1);
    out.push({
      name: name + suffixFor(mem, name, type),
      kind: type === TYPE_STRING ? 'string' : 'number',
      value: valueAt(mem, addr + 3, type),
    });
    addr += 3 + type;
  }
  return out;
}

/** The arrays, with their shape and the first few elements of each. */
function readArrays(mem: MsxMemPort): MachineVariable[] {
  const out: MachineVariable[] = [];
  const end = mem.peekWord(STREND);
  let addr = mem.peekWord(ARYTAB);
  for (let n = 0; addr < end && n < MAX_ENTRIES; n++) {
    const type = mem.peek(addr);
    if (!isValueType(type)) break;
    const name = nameAt(mem, addr + 1);
    const size = mem.peekWord(addr + 3);
    const dims = mem.peek(addr + ARRAY_HEADER_BYTES);
    if (size <= 0 || dims <= 0) break;
    // The bounds are stored last dimension first, so they are read back to
    // front to report the shape the program DIMmed.
    const bounds: number[] = [];
    for (let d = dims - 1; d >= 0; d--) {
      bounds.push(mem.peekWord(addr + ARRAY_HEADER_BYTES + 1 + d * 2));
    }
    const elements = addr + ARRAY_HEADER_BYTES + 1 + dims * 2;
    const count = bounds.reduce((a, b) => a * b, 1);
    const preview: string[] = [];
    for (let i = 0; i < Math.min(count, MAX_ARRAY_PREVIEW); i++) {
      preview.push(valueAt(mem, elements + i * type, type));
    }
    if (count > preview.length) preview.push('…');
    out.push({
      name: `${name}${suffixFor(mem, name, type)}()`,
      kind: type === TYPE_STRING ? 'string-array' : 'number-array',
      value: `[${bounds.join(',')}] = ${preview.join(', ')}`,
    });
    addr += ARRAY_HEADER_BYTES + size;
  }
  return out;
}

/**
 * Every variable the interpreter currently holds, scalars first.
 *
 * Empty rather than partial when the pointers are implausible: they are laid
 * down partway through the ROM's own start-up and rewritten wholesale by an
 * injected program, so a walk started at the wrong moment would report the
 * previous program's storage as this one's.
 */
export function readVariables(mem: MsxMemPort): MachineVariable[] {
  const vartab = mem.peekWord(VARTAB);
  const arytab = mem.peekWord(ARYTAB);
  const strend = mem.peekWord(STREND);
  if (vartab > arytab || arytab > strend) return [];
  return [...readScalars(mem), ...readArrays(mem)];
}
