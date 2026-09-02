import type { MachineVariable } from '../types';
import { samcoupeCharset } from './charset';
import { decodeSamNumber } from './numbers';

/**
 * SAM BASIC's variables, for the watcher.
 *
 * The machine keeps two areas rather than one list, with a gap between them the
 * numeric one grows into, and neither is the Sinclair layout `sinclairVars.ts`
 * walks - a SAM name is up to 32 characters, so it cannot be packed into the
 * five spare bits of a tag byte.
 *
 * **Numbers** live between `NVARS` and `NUMEND`, and are found by first letter
 * rather than by walking: `NVARS` opens on a table of 26 words, one per letter
 * a-z, each a displacement to the first variable starting with it. Each record
 * then carries the displacement to the next of the same letter, and a
 * displacement whose high byte is 0xFF ends the chain. A record is
 *
 *     [type/length] [next lo] [next hi] [2nd..last letter] [5-byte value]
 *
 * with the *first* letter implied by which chain the record hangs on. The
 * type byte's low five bits are the letters after the first (so 0 is a
 * one-letter name), bit 6 marks a FOR control variable - whose value is
 * followed by its limit, step and loop position - and bit 7 a name a PROC has
 * hidden. The displacement is measured from the record's own "next hi" byte,
 * and the chain runs forward, so it is plain addition on a flat address.
 *
 * **Strings and arrays** start at `SAVARS` and run up to the edit line as a
 * plain list, ended by a 0xFF type byte, each record
 *
 *     [type/length] [name, padded to 10] [length in pages] [length mod 16K] [data]
 *
 * so its length is 14 bytes plus the data. Here the type byte's low five bits
 * are the true name length (SAM caps these names at ten characters), bit 5
 * marks a numeric array and bit 6 a string array; both clear is a simple
 * string, and the data is then the characters themselves. The name field is
 * padded to its ten bytes with whatever the match buffer last held rather than
 * with spaces, so only the first `length` of them mean anything. An array's data
 * opens on a dimension count and that many 16-bit dimension sizes, then the
 * elements row-major - five bytes each for numbers, one for characters.
 *
 * Every address here is flat: page * 16K plus the offset in it. The ROM's own
 * pointers are page-form (a page and an address in the 0x8000-0xBFFF window it
 * appears at), and the caller converts.
 *
 * Read out of the ROM's own source: `LOOKVARS` and `STARYLK` in lookvar.asm for
 * both record shapes, `DIM` in assign.asm for the array header.
 */
export interface SamVarsPort {
  /** A byte at a flat BASIC-area address. */
  read(addr: number): number;
  /** Flat address of the numeric area: the 26-word first-letter table. */
  nvars: number;
  /** Flat address of the end of the numeric area. */
  numend: number;
  /** Flat address of the string and array list. */
  savars: number;
  /** Flat address of the edit line, which is where that list ends. */
  eline: number;
}

/** Letters a numeric chain can start with, and the size of the table over them. */
const LETTERS = 26;

/** Guards against a runaway walk of a corrupt or half-built area. */
const MAX_VARS = 1000;

/** Array elements shown inline before truncating with an ellipsis. */
const MAX_ARRAY_PREVIEW = 8;

/** Bytes before the data in a string or array record: type, name, length. */
const STRING_HEADER_BYTES = 14;
/** The name field inside that header, blank-padded to a fixed width. */
const STRING_NAME_BYTES = 10;

/** A five-byte number, the unit both a scalar and a numeric array element take. */
const NUMBER_BYTES = 5;

function fmtNum(n: number): string {
  return Number.parseFloat(n.toPrecision(9)).toString();
}

function readN(
  read: (addr: number) => number,
  start: number,
  count: number,
): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push(read(start + i));
  return out;
}

/** Letters as the user writes them; the ROM stores every name folded to lower case. */
function name(codes: number[]): string {
  return String.fromCharCode(...codes)
    .trim()
    .toUpperCase();
}

/** Walk the 26 numeric chains, in the order the letters come. */
function readNumbers(port: SamVarsPort, out: MachineVariable[]): void {
  const { read, nvars, numend } = port;
  const table = nvars;
  const first = table + LETTERS * 2;
  for (let letter = 0; letter < LETTERS; letter++) {
    let slot = table + letter * 2;
    for (let guard = 0; guard < MAX_VARS; guard++) {
      const high = read(slot + 1);
      if (high === 0xff) break; // no more variables start with this letter
      const record = slot + 1 + (read(slot) | (high << 8));
      if (record < first || record + 3 > numend) break;
      const type = read(record);
      const extra = type & 0x1f;
      const value = record + 3 + extra;
      if (value + NUMBER_BYTES > numend) break;
      out.push({
        name:
          String.fromCharCode(0x41 + letter) +
          name(readN(read, record + 3, extra)),
        kind: 'number',
        // A FOR variable's limit, step and loop position follow the value; the
        // value itself is the live loop counter, and is all the watcher shows.
        value: fmtNum(decodeSamNumber(readN(read, value, NUMBER_BYTES))),
        ref: { addr: value, layout: 'number' },
      });
      slot = record + 1;
    }
  }
}

/** Walk the string and array list, which is contiguous and self-sizing. */
function readStringsAndArrays(port: SamVarsPort, out: MachineVariable[]): void {
  const { read, savars, eline } = port;
  let addr = savars;
  for (
    let guard = 0;
    guard < MAX_VARS && addr + STRING_HEADER_BYTES <= eline;
    guard++
  ) {
    const type = read(addr);
    if (type === 0xff) break; // end-of-list stopper
    const nameLength = type & 0x1f;
    if (nameLength < 1 || nameLength > STRING_NAME_BYTES) break;
    const label = name(readN(read, addr + 1, nameLength));
    const length =
      read(addr + STRING_NAME_BYTES + 1) * 0x4000 +
      (read(addr + STRING_NAME_BYTES + 2) |
        (read(addr + STRING_NAME_BYTES + 3) << 8));
    const data = addr + STRING_HEADER_BYTES;
    const next = data + length;
    if (next > eline) break;

    const numericArray = (type & 0x20) !== 0;
    const stringArray = (type & 0x40) !== 0;
    if (numericArray || stringArray) {
      describeArray(port, data, length, label, stringArray, out);
    } else {
      out.push({
        name: `${label}$`,
        kind: 'string',
        value: `"${samcoupeCharset.toUnicode(readN(read, data, length))}"`,
        ref: { addr: data, layout: 'string', len: length },
      });
    }
    addr = next;
  }
}

/** One array record's shape and, for a numeric one, the first few elements. */
function describeArray(
  port: SamVarsPort,
  data: number,
  length: number,
  label: string,
  stringArray: boolean,
  out: MachineVariable[],
): void {
  const { read } = port;
  const end = data + length;
  const dimCount = read(data);
  const dims: number[] = [];
  let p = data + 1;
  for (let i = 0; i < dimCount && p + 1 < end; i++, p += 2) {
    dims.push(read(p) | (read(p + 1) << 8));
  }
  const shape = `[${dims.join(',')}]`;

  if (stringArray) {
    out.push({
      name: `${label}$()`,
      kind: 'string-array',
      value: shape,
      ref: { addr: p, layout: 'string-array' },
    });
    return;
  }
  const count = dims.reduce((a, b) => a * b, 1);
  const preview: string[] = [];
  for (
    let i = 0, ep = p;
    i < count && i < MAX_ARRAY_PREVIEW && ep + NUMBER_BYTES <= end;
    i++, ep += NUMBER_BYTES
  ) {
    preview.push(fmtNum(decodeSamNumber(readN(read, ep, NUMBER_BYTES))));
  }
  out.push({
    name: `${label}()`,
    kind: 'number-array',
    value: `${shape} = ${preview.join(', ')}${count > MAX_ARRAY_PREVIEW ? ', …' : ''}`,
    ref: { addr: p, layout: 'number-array' },
  });
}

/** Both areas, numbers first, as the watcher shows them. */
export function readSamcoupeVariables(port: SamVarsPort): MachineVariable[] {
  const out: MachineVariable[] = [];
  // Implausible pointers mean the ROM has not laid the areas down yet.
  if (
    port.nvars > port.numend ||
    port.numend > port.savars ||
    port.savars > port.eline
  )
    return out;
  readNumbers(port, out);
  readStringsAndArrays(port, out);
  return out;
}
