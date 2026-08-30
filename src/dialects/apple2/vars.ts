// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MachineVariable } from '../types';
import { LOMEM, PV } from './addresses';
import { decodeSpan } from './charset';

/**
 * Walk Integer BASIC's variable table for the variable watcher. Read-only.
 *
 * The table is a singly-linked list running up from LOMEM to PV, and every
 * field below was read back off this machine's running interpreter rather than
 * taken from a manual. One entry is
 *
 *   +0  the name, one byte per character with bit 7 set
 *   +n  $40 when the name ends in `$`, absent otherwise
 *   +n  $00, closing the name
 *   +n  address of the next entry, low byte first
 *   +n  the value: two bytes for a scalar, 2*(DIM+1) for an array, and DIM+1
 *       bytes of character space for a string
 *
 * The link is what makes the walk possible at all, because the value field is
 * variable length and nothing in the entry states which of the three kinds it
 * is. What the entry does carry is the `$`, and that is enough: a numeric entry
 * with more than one value pair is an array, since `A` and `A(0)` are the same
 * variable to this interpreter - `A=1` then `DIM A(3)` grows the one entry to
 * four elements and leaves `A` reading back as `A(0)`.
 *
 * **The Apple I's table is not this one, despite the same interpreter design.**
 * That machine's entries are four bytes of header holding one letter and at
 * most one digit, the letter stored shifted left a bit; this one spells names
 * out in full - `LONGNAME` is eight bytes - and the flags live in the name
 * rather than beside it. A reader ported across without measuring would name
 * every variable something else.
 *
 * Two consequences worth naming:
 *
 *  - **`DIM A(0)` reads back as a scalar.** A one-element array and a scalar
 *    are byte-identical here, so the watcher shows `A` rather than `A()`. There
 *    is nothing in the table to tell them apart.
 *  - **Arrays are zero-based.** `DIM D(4)` reserves five elements, D(0) to
 *    D(4), so the first element sits at the start of the value field and the
 *    preview is numbered from zero. DIM does not clear them: an element never
 *    assigned reads back as whatever the workspace held.
 */

/** The `$` a string variable's name ends with, as the table spells it. */
const STRING_MARK = 0x40;

/** Closes the name, whichever kind of variable it is. */
const NAME_END = 0x00;

/** The two-byte link that follows the name. */
const LINK_BYTES = 2;

/**
 * Belt and braces against a table that does not hold together. The walk cannot
 * loop - a link is rejected unless it points past the value field it follows,
 * so each step moves up - but it can still be pointed at rubbish, and this
 * bounds how much of it is read. Above anything the machine can hold: the
 * shortest entry is six bytes and the workspace is 46K.
 */
const MAX_VARS = 8192;

/** Array elements shown inline before the preview is truncated. */
const MAX_ARRAY_PREVIEW = 8;

/** A word from the machine's own little-endian pair. */
function word(ram: ArrayLike<number>, addr: number): number {
  return (ram[addr & 0xffff] ?? 0) | ((ram[(addr + 1) & 0xffff] ?? 0) << 8);
}

/** One 16-bit value as Integer BASIC computes with it, which is signed. */
function signed(ram: ArrayLike<number>, addr: number): number {
  return (word(ram, addr) << 16) >> 16;
}

/** A parsed name, and the address the link follows it at. */
interface ParsedName {
  name: string;
  isString: boolean;
  linkAt: number;
}

/**
 * The name the entry spells, or null when it spells nothing this interpreter
 * could have written - which means the walk has lost the entry boundaries and
 * must stop rather than invent variables out of the workspace.
 *
 * A name is at least one character and every character is alphanumeric, the
 * first a letter; the interpreter imposes no length limit of its own, so the
 * only bound here is the end of the table.
 */
function parseName(
  ram: ArrayLike<number>,
  addr: number,
  end: number,
): ParsedName | null {
  let name = '';
  let a = addr;
  for (; a < end; a++) {
    const byte = ram[a]! & 0xff;
    if ((byte & 0x80) === 0) break;
    const ch = String.fromCharCode(byte & 0x7f);
    const ok = name === '' ? /[A-Z]/.test(ch) : /[A-Z0-9]/.test(ch);
    if (!ok) return null;
    name += ch;
  }
  if (name === '') return null;
  const isString = (ram[a] ?? -1) === STRING_MARK;
  if (isString) a++;
  if ((ram[a] ?? -1) !== NAME_END) return null;
  return { name: isString ? `${name}$` : name, isString, linkAt: a + 1 };
}

/**
 * The characters of a string, which run from the start of the value field until
 * a byte with bit 7 clear. Integer BASIC writes a $1E there when it stores a
 * shorter string than the one before it, which is why the DIM reserves one byte
 * more than it names: a string filling its whole DIM still has room to be
 * terminated.
 */
function stringValue(
  ram: ArrayLike<number>,
  start: number,
  end: number,
): string {
  let text = '';
  for (let a = start; a < end; a++) {
    if (((ram[a] ?? 0) & 0x80) === 0) break;
    text += decodeSpan(ram, a, end).text;
  }
  return text;
}

/** The elements of a numeric array, truncated to a readable preview. */
function arrayValue(
  ram: ArrayLike<number>,
  start: number,
  count: number,
): string {
  const shown: string[] = [];
  for (let i = 0; i < Math.min(count, MAX_ARRAY_PREVIEW); i++) {
    shown.push(String(signed(ram, start + i * 2)));
  }
  if (count > shown.length) shown.push('…');
  return shown.join(', ');
}

/**
 * Every variable the interpreter currently holds, in the order it created them.
 *
 * `ram` is the machine's memory as an array, read directly rather than through
 * the CPU's bus: the watcher polls while the program runs, and reading through
 * the recording path would paint the memory-map overlay with accesses the
 * program never made.
 */
export function readApple2Variables(ram: ArrayLike<number>): MachineVariable[] {
  const out: MachineVariable[] = [];
  const end = word(ram, PV);
  let addr = word(ram, LOMEM);
  for (let n = 0; n < MAX_VARS && addr < end; n++) {
    const parsed = parseName(ram, addr, end);
    if (parsed === null) break;
    const value = parsed.linkAt + LINK_BYTES;
    const next = word(ram, parsed.linkAt);
    // A link that leaves no room for a value, or that leaves the table, is not
    // a link: stop rather than loop or read the workspace as variables.
    if (next < value + 2 || next > end) break;
    const bytes = next - value;
    if (parsed.isString) {
      out.push({
        name: parsed.name,
        kind: 'string',
        value: `"${stringValue(ram, value, next)}"`,
      });
    } else if (bytes <= 2) {
      out.push({
        name: parsed.name,
        kind: 'number',
        value: String(signed(ram, value)),
      });
    } else {
      out.push({
        name: `${parsed.name}()`,
        kind: 'number-array',
        value: arrayValue(ram, value, bytes >> 1),
      });
    }
    addr = next;
  }
  return out;
}
