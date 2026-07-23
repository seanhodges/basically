import type { MachineVariable } from '../types';
import type { LocoSysVars } from './sysvars';
import { cpcCharset } from './charset';
import { decodeLocoFloat, formatLocoFloat } from './numbers';

/**
 * Side-effect-free view of the machine's RAM for reading variable storage.
 * `read` returns the raw RAM byte (not a ROM overlay), `readWord` the LE word.
 */
export interface LocoMemPort {
  read(addr: number): number;
  readWord(addr: number): number;
}

/** Stop a corrupt/unexpected variable area from looping forever. */
const MAX_ENTRIES = 2000;
/** Array elements shown inline before truncating with an ellipsis. */
const MAX_ARRAY_PREVIEW = 8;

/** Locomotive variable type byte → value layout. */
const TYPE_INTEGER = 0x01;
const TYPE_STRING = 0x02;
const TYPE_REAL = 0x04;

/**
 * Walk Locomotive BASIC's variable storage into the system-agnostic list the
 * variable watcher shows. The layout was reverse-engineered against the real
 * 464 ROM (see {@link ./sysvars}):
 *
 * Every entry — scalar or array — begins with a 2-byte field (a value-pointer
 * cache the interpreter fills in, `0000` until the variable is referenced),
 * then the name (letters/digits, the final character flagged with bit 7), then
 * a type byte:
 *
 *   `01` integer `%`  — 2-byte signed LE value
 *   `02` string  `$`  — 3-byte descriptor: length byte + 2-byte pointer to the
 *                       characters (in the program text or the string heap)
 *   `04` real         — 5-byte Locomotive float (unsuffixed or `!`)
 *
 * Scalars live in `[varStart, arrStart)`; arrays in `[arrStart, arrEnd)`. An
 * array entry inserts, after the type byte, a 2-byte entry length (the bytes
 * that follow it), a dimension count, that many 2-byte dimension sizes (each the
 * element count, i.e. `DIM n` stores `n + 1`), then the elements row-major.
 */
export function readLocoVariables(
  mem: LocoMemPort,
  sysvars: LocoSysVars,
): MachineVariable[] {
  const out: MachineVariable[] = [];
  const varStart = mem.readWord(sysvars.varStart);
  const arrStart = mem.readWord(sysvars.arrStart);
  const arrEnd = mem.readWord(sysvars.arrEnd);

  // Implausible pointers (mid-boot, mid-injection): nothing to show.
  if (varStart > arrStart || arrStart > arrEnd) return out;

  let pos = varStart;
  for (let guard = 0; guard < MAX_ENTRIES && pos < arrStart; guard++) {
    pos += 2; // value-pointer cache
    const name = readName(mem, pos);
    pos = name.next;
    const type = mem.read(pos++);
    if (type === TYPE_INTEGER) {
      out.push({
        name: name.text + '%',
        kind: 'number',
        value: String(toSigned16(mem.readWord(pos))),
      });
      pos += 2;
    } else if (type === TYPE_STRING) {
      const len = mem.read(pos);
      const ptr = mem.readWord(pos + 1);
      out.push({
        name: name.text + '$',
        kind: 'string',
        value: '"' + readString(mem, ptr, len) + '"',
      });
      pos += 3;
    } else if (type === TYPE_REAL) {
      out.push({
        name: name.text,
        kind: 'number',
        value: fmtReal(mem, pos),
      });
      pos += 5;
    } else {
      // Unknown type byte: the area is not what we expect - stop rather than
      // emit garbage.
      return out;
    }
  }

  pos = arrStart;
  for (let guard = 0; guard < MAX_ENTRIES && pos < arrEnd; guard++) {
    pos += 2; // value-pointer cache
    const name = readName(mem, pos);
    pos = name.next;
    const type = mem.read(pos++);
    const entryLen = mem.readWord(pos);
    const payload = pos + 2;
    const next = payload + entryLen;
    const dimCount = mem.read(payload);
    const dims: number[] = [];
    for (let i = 0, dp = payload + 1; i < dimCount; i++, dp += 2) {
      dims.push(mem.readWord(dp));
    }
    const elements = payload + 1 + dimCount * 2;
    const shape = '[' + dims.join(',') + ']';

    if (type === TYPE_STRING) {
      out.push({ name: name.text + '$()', kind: 'string-array', value: shape });
    } else {
      const count = dims.reduce((a, b) => a * b, 1);
      const stride = type === TYPE_INTEGER ? 2 : 5;
      const preview: string[] = [];
      for (let i = 0; i < count && i < MAX_ARRAY_PREVIEW; i++) {
        const at = elements + i * stride;
        preview.push(
          type === TYPE_INTEGER
            ? String(toSigned16(mem.readWord(at)))
            : fmtReal(mem, at),
        );
      }
      const more = count > MAX_ARRAY_PREVIEW ? ', …' : '';
      out.push({
        name: name.text + (type === TYPE_INTEGER ? '%()' : '()'),
        kind: 'number-array',
        value: `${shape} = ${preview.join(', ')}${more}`,
      });
    }
    if (next <= pos) return out; // defensive: never go backwards
    pos = next;
  }

  return out;
}

/** Read a variable name: characters until one has bit 7 set (the last). */
function readName(
  mem: LocoMemPort,
  start: number,
): { text: string; next: number } {
  let text = '';
  let p = start;
  for (let i = 0; i < 40; i++) {
    const b = mem.read(p++);
    text += String.fromCharCode(b & 0x7f);
    if (b & 0x80) break;
  }
  return { text, next: p };
}

/** Read `len` characters from the string heap/program at `ptr`. */
function readString(mem: LocoMemPort, ptr: number, len: number): string {
  const codes: number[] = [];
  for (let i = 0; i < len; i++) codes.push(mem.read(ptr + i));
  return cpcCharset.toUnicode(codes);
}

/** Format the 5-byte real at `at` in Locomotive's display style. */
function fmtReal(mem: LocoMemPort, at: number): string {
  const bytes = [0, 1, 2, 3, 4].map((i) => mem.read(at + i));
  return formatLocoFloat(decodeLocoFloat(bytes, 0));
}

/** Interpret a 16-bit word as a signed integer (Locomotive `%` range). */
function toSigned16(word: number): number {
  return word >= 0x8000 ? word - 0x10000 : word;
}
