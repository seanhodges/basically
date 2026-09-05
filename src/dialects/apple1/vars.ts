// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MachineVariable } from '../types';
import { LOMEM, PV } from './addresses';
import { decodeSpan } from './charset';

/**
 * Walk Integer BASIC's variable table for the variable watcher. Read-only.
 *
 * The table is a singly-linked list running up from LOMEM to PV, and every
 * field below was read back off the running interpreter rather than taken from
 * a manual. One entry is
 *
 *   +0  first letter, shifted left one bit ('A' is $41, so the byte is $82)
 *   +1  $00, or the string flag $40, or $80 + the trailing digit
 *   +2  address of the next entry, low byte first
 *   +4  the value: two bytes for a scalar, 2n for an n-element array, and
 *       DIM+1 bytes of character space for a string
 *
 * The link is what makes the walk possible at all, because the value field is
 * variable length and nothing in the entry states which of the three kinds it
 * is. What the entry does carry is the string flag, and that is enough: a
 * numeric entry with more than one value pair is an array, since `A` and `A(1)`
 * are the same variable to this interpreter - `DIM A(3)` after `A=1` answers
 * *** DIM ERR rather than creating a second entry.
 *
 * Two consequences worth naming:
 *
 *  - **`DIM A(1)` reads back as a scalar.** A one-element array and a scalar
 *    are byte-identical here, so the watcher shows `A` rather than `A()`. There
 *    is nothing in the table to tell them apart.
 *  - **Arrays are one-based.** `DIM D(4)` reserves four elements, D(1) to D(4),
 *    and D(0) answers *** RANGE ERR - so the first element sits at +4 and the
 *    preview is numbered from one.
 */

/** Name bytes plus the link, before the value field starts. */
const HEADER_BYTES = 4;

/** Bit 6 of the second name byte: the variable is a string. */
const STRING_FLAG = 0x40;

/** Bit 7 of the second name byte: a digit follows the letter. */
const DIGIT_FLAG = 0x80;

/** What is left of the second name byte once the two flags are masked off. */
const DIGIT_MASK = 0x3f;

/**
 * Guards the walk against a half-initialised or overwritten table. Well above
 * anything the machine can hold: an entry is at least six bytes and the fitted
 * RAM is four kilobytes of it.
 */
const MAX_VARS = 1024;

/** Array elements shown inline before the preview is truncated. */
const MAX_ARRAY_PREVIEW = 8;

/** A word from the machine's own little-endian pair. */
function word(ram: Uint8Array, addr: number): number {
  return (ram[addr & 0xffff] ?? 0) | ((ram[(addr + 1) & 0xffff] ?? 0) << 8);
}

/** One 16-bit value as Integer BASIC computes with it, which is signed. */
function signed(ram: Uint8Array, addr: number): number {
  return (word(ram, addr) << 16) >> 16;
}

/**
 * The name the two name bytes spell, or null when they spell nothing this
 * interpreter could have written - which means the walk has lost the entry
 * boundaries and must stop rather than invent variables out of the workspace.
 */
function nameOf(first: number, second: number): string | null {
  if ((first & 1) !== 0) return null;
  const letter = String.fromCharCode(first >> 1);
  if (letter < 'A' || letter > 'Z') return null;
  if ((second & DIGIT_FLAG) === 0) return letter;
  const digit = String.fromCharCode(second & DIGIT_MASK);
  return digit >= '0' && digit <= '9' ? letter + digit : null;
}

/**
 * The characters of a string, which run from the start of the value field until
 * a byte with bit 7 clear. Integer BASIC writes a $1E there when it stores a
 * shorter string than the one before it, which is why the DIM reserves one byte
 * more than it names: a string filling its whole DIM still has room to be
 * terminated.
 */
function stringValue(ram: Uint8Array, start: number, end: number): string {
  let text = '';
  for (let a = start; a < end; a++) {
    const byte = ram[a]!;
    if ((byte & 0x80) === 0) break;
    text += decodeSpan(ram, a, end).text;
  }
  return text;
}

/** The elements of a numeric array, truncated to a readable preview. */
function arrayValue(ram: Uint8Array, start: number, count: number): string {
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
export function readApple1Variables(ram: Uint8Array): MachineVariable[] {
  const out: MachineVariable[] = [];
  const end = word(ram, PV);
  let addr = word(ram, LOMEM);
  for (let n = 0; n < MAX_VARS && addr + HEADER_BYTES <= end; n++) {
    const name = nameOf(ram[addr]!, ram[addr + 1]!);
    const next = word(ram, addr + 2);
    // A link that leaves no room for a value, or that leaves the table, is not
    // a link: stop rather than loop or read the program text as variables.
    if (name === null || next < addr + HEADER_BYTES + 2 || next > end) break;
    const value = addr + HEADER_BYTES;
    const bytes = next - value;
    if ((ram[addr + 1]! & STRING_FLAG) !== 0) {
      out.push({
        name: `${name}$`,
        kind: 'string',
        value: `"${stringValue(ram, value, next)}"`,
      });
    } else if (bytes <= 2) {
      out.push({ name, kind: 'number', value: String(signed(ram, value)) });
    } else {
      out.push({
        name: `${name}()`,
        kind: 'number-array',
        value: arrayValue(ram, value, bytes >> 1),
      });
    }
    addr = next;
  }
  return out;
}
