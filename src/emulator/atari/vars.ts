// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MachineVariable } from '../../dialects/types';
import { ATARI_FLOAT_BYTES, fromAtariFloat } from '../../dialects/atari800/bcd';
import { atasciiToText } from '../../dialects/atari800/atascii';
import { BASIC_POINTERS } from '../../dialects/atari800/addresses';

/**
 * Decoder for the Atari BASIC variable tables, for the watcher. Read-only.
 *
 * Atari BASIC splits a variable in two. Every name a program mentions goes once
 * into the **variable name table** at `VNTP`, in ATASCII with bit 7 set on the
 * last character; a `$` ends a string's name and a `(` an array's, so the name
 * carries the type as the user wrote it. The **variable value table** at `VVTP`
 * then holds one fixed 8-byte entry per name, in the same order:
 *
 * | Byte | Numeric          | String                  | Array                   |
 * | ---- | ---------------- | ----------------------- | ----------------------- |
 * | 0    | type `$00`       | `$80`, `$81` when DIMed | `$40`, `$41` when DIMed |
 * | 1    | variable number  | variable number         | variable number         |
 * | 2-3  | the BCD value    | offset from `STARP`     | offset from `STARP`     |
 * | 4-5  | …                | current length          | first DIM + 1           |
 * | 6-7  | …                | DIMed length            | second DIM + 1          |
 *
 * The two tables being separate is what makes a name lookup cheap for the
 * interpreter - a statement refers to a variable by its number, and the number
 * is the index of its 8-byte entry - and it is why this walks them in lockstep
 * rather than reading a name out of each entry.
 *
 * Everything the tables point at lives in RAM below the cartridge, so the reads
 * are plain array indexing with nothing to bank in and no side effects.
 */

/** Type byte flags: what the entry describes, and whether it is allocated yet. */
const TYPE_STRING = 0x80;
const TYPE_ARRAY = 0x40;
const TYPE_DIMED = 0x01;

/** Bytes in one variable value table entry. */
const VVT_ENTRY_BYTES = 8;

/**
 * Variables Atari BASIC allows a program, and so the length of both tables.
 * Also the guard against reading a table that is not one yet: mid-injection,
 * or after a program has written over its own.
 */
const MAX_VARS = 128;

/** Array elements shown inline before the preview is cut short. */
const MAX_ARRAY_PREVIEW = 8;

/** Characters of a string shown before the preview is cut short. */
const MAX_STRING_PREVIEW = 40;

/** The machine's RAM, indexed by address; no chip register is ever read. */
export interface AtariMemPort {
  read(address: number): number;
  readWord(address: number): number;
}

/**
 * The names in the variable name table, in table order.
 *
 * A name ends at the character with bit 7 set, which is also the character that
 * says what kind it is. An unterminated run means the table is not a table -
 * the machine is part-way through an injection, or a program has overwritten
 * it - and the walk stops rather than reading on into the value table.
 */
function readNames(mem: AtariMemPort, from: number, to: number): string[] {
  const names: string[] = [];
  let name = '';
  for (let p = from; p < to && names.length < MAX_VARS; p++) {
    const byte = mem.read(p);
    name += String.fromCharCode(byte & 0x7f);
    if ((byte & 0x80) === 0) continue;
    names.push(name);
    name = '';
  }
  return names;
}

/** A number as Atari BASIC would print it: ten significant digits, no more. */
function fmtNum(value: number | null): string {
  if (value === null) return '?';
  return Number.parseFloat(value.toPrecision(10)).toString();
}

/** The BCD float `count` bytes wide at `address`. */
function readFloat(mem: AtariMemPort, address: number): number | null {
  const bytes: number[] = [];
  for (let i = 0; i < ATARI_FLOAT_BYTES; i++) bytes.push(mem.read(address + i));
  return fromAtariFloat(bytes);
}

/**
 * A string variable's characters, through the dialect's own ATASCII table so
 * the watcher spells a control code the way the editor does rather than
 * dropping it.
 */
function readString(mem: AtariMemPort, at: number, length: number): string {
  let out = '';
  for (let i = 0; i < Math.min(length, MAX_STRING_PREVIEW); i++) {
    out += atasciiToText(mem.read(at + i));
  }
  return length > MAX_STRING_PREVIEW ? out + '…' : out;
}

/**
 * One string variable: the characters it holds now, out of the string and array
 * space `STARP` points at.
 *
 * Its name already ends in the `$` the user wrote. What the entry carries is
 * the current length and the DIMed length, and only the first is what is in
 * there - the second is the buffer BASIC set aside, which nothing has to fill.
 */
function readStringVar(
  mem: AtariMemPort,
  name: string,
  entry: number,
  starp: number,
  dimed: boolean,
): MachineVariable {
  if (!dimed) return { name, kind: 'string', value: 'undimensioned' };
  const at = starp + mem.readWord(entry + 2);
  return {
    name,
    kind: 'string',
    value: `"${readString(mem, at, mem.readWord(entry + 4))}"`,
    ref: { addr: at, layout: 'string' },
  };
}

/**
 * One array's shape and the first few elements it holds.
 *
 * The two dimensions are stored as the subscript plus one - the size, since
 * `DIM A(4)` gives five elements - and the elements run with the FIRST
 * subscript changing fastest, which is the opposite of the order the elements
 * of a two-dimensional array are usually written in. A one-dimensional array is
 * a two-dimensional one whose second size is 1, so both are the same walk.
 */
function readArray(
  mem: AtariMemPort,
  name: string,
  entry: number,
  starp: number,
  dimed: boolean,
): MachineVariable {
  if (!dimed) {
    return { name, kind: 'number-array', value: 'undimensioned' };
  }
  const at = starp + mem.readWord(entry + 2);
  const first = mem.readWord(entry + 4);
  const second = mem.readWord(entry + 6);
  const shape = `[${Math.max(0, first - 1)}${second > 1 ? `,${second - 1}` : ''}]`;
  const count = first * second;
  const preview: string[] = [];
  for (let i = 0; i < count && i < MAX_ARRAY_PREVIEW; i++) {
    preview.push(fmtNum(readFloat(mem, at + i * ATARI_FLOAT_BYTES)));
  }
  const more = count > MAX_ARRAY_PREVIEW ? ', …' : '';
  return {
    name,
    kind: 'number-array',
    value: `${shape} = ${preview.join(', ')}${more}`,
    ref: { addr: at, layout: 'number-array' },
  };
}

/** Every variable the running program has, as the watcher shows them. */
export function readAtariVariables(mem: AtariMemPort): MachineVariable[] {
  const { VNTP, VNTD, VVTP, STMTAB, STARP } = BASIC_POINTERS;
  const vntp = mem.readWord(VNTP);
  const vntd = mem.readWord(VNTD);
  const vvtp = mem.readWord(VVTP);
  const stmtab = mem.readWord(STMTAB);
  const starp = mem.readWord(STARP);
  if (vntd < vntp || stmtab < vvtp) return [];

  const names = readNames(mem, vntp, vntd);
  const out: MachineVariable[] = [];
  for (let i = 0; i < names.length; i++) {
    const entry = vvtp + i * VVT_ENTRY_BYTES;
    if (entry + VVT_ENTRY_BYTES > stmtab) break;
    const name = names[i]!;
    const type = mem.read(entry);
    const dimed = (type & TYPE_DIMED) !== 0;
    if ((type & TYPE_STRING) !== 0) {
      out.push(readStringVar(mem, name, entry, starp, dimed));
    } else if ((type & TYPE_ARRAY) !== 0) {
      // The name ends in the `(` the user opened the subscript with; the
      // watcher spells it as the empty subscript every other machine here does.
      out.push(readArray(mem, `${name})`, entry, starp, dimed));
    } else {
      out.push({
        name,
        kind: 'number',
        value: fmtNum(readFloat(mem, entry + 2)),
        ref: { addr: entry + 2, layout: 'number' },
      });
    }
  }
  return out;
}
