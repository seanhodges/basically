// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Table-driven disassembler with two strategies over the same decode trie:
 *
 * - {@link disassembleWith} - a linear sweep: decode every byte in order, and
 *   any byte that doesn't open a known instruction (an ED hole, a 6502 illegal,
 *   a truncated tail, a dangling prefix) becomes a one-byte `DB $NN` line the
 *   assembler accepts straight back. Best for "decode this pile of bytes".
 *
 * - {@link disassembleReachableWith} - a recursive-descent walk from the block
 *   entry: follow control flow (fallthrough plus static branch/call/jump
 *   targets), stopping each run at an unconditional transfer, and emit only the
 *   bytes control can actually reach as instructions. Everything else - a `DB`
 *   data section appended after the code, a table jumped over - comes back as
 *   `DB`, instead of a linear sweep decoding a data byte like 0x21 as
 *   `LD HL,...`. Approximate by nature (indirect jumps and data jumped into
 *   can't be followed), so it degrades to `DB` rather than guessing.
 *
 * Both tile the input exactly - every byte lands on one line, and each line
 * carries the exact bytes it covers - so `assemble(disassemble(bytes))` is
 * byte-identical either way.
 */

import { formatByte, formatDisp, formatWord } from './format';
import type { AsmTable, CompiledForm, InstructionForm } from './table';
import { slotWidth } from './table';
import type { DisassembledLine } from './types';

const SLOT_RE = /\{(imm8|imm16|rel8|disp8|zp)\}/g;

function renderLine(
  compiled: CompiledForm,
  bytes: Uint8Array,
  start: number,
  address: number,
): string {
  const { form, slots, length } = compiled;
  // Slot values in encoding (= pattern) order.
  const values: number[] = [];
  let offset = start;
  for (const el of form.encoding) {
    if (typeof el === 'number') {
      offset++;
    } else if (slotWidth(el.slot) === 2) {
      values.push(bytes[offset] | (bytes[offset + 1] << 8));
      offset += 2;
    } else {
      values.push(bytes[offset]);
      offset++;
    }
  }
  let slotIndex = 0;
  const operands = form.pattern.replace(SLOT_RE, () => {
    const value = values[slotIndex];
    const kind = slots[slotIndex];
    slotIndex++;
    switch (kind) {
      case 'imm8':
      case 'zp':
        return formatByte(value);
      case 'imm16':
        return formatWord(value);
      case 'disp8':
        return formatDisp((value << 24) >> 24);
      case 'rel8':
        return formatWord(address + length + ((value << 24) >> 24));
    }
  });
  return operands === '' ? form.mnemonic : `${form.mnemonic} ${operands}`;
}

/** Walk the decode trie at `pos`; the matched form and its byte length, or null. */
function decodeAt(
  table: AsmTable,
  bytes: Uint8Array,
  pos: number,
): { compiled: CompiledForm; consumed: number } | null {
  let node = table.root;
  let consumed = 0;
  while (pos + consumed < bytes.length) {
    const byte = bytes[pos + consumed];
    const next = node.byteEdges ? node.byteEdges.get(byte) : node.slotEdge;
    if (!next) return null;
    node = next;
    consumed++;
    if (node.leaf) return { compiled: node.leaf, consumed };
  }
  return null;
}

/** The decoded line for a matched form at `pos`. */
function lineFor(
  compiled: CompiledForm,
  bytes: Uint8Array,
  pos: number,
  consumed: number,
  address: number,
): DisassembledLine {
  return {
    address,
    bytes: bytes.slice(pos, pos + consumed),
    text: renderLine(compiled, bytes, pos, address),
  };
}

/** A one-byte `DB $NN` fallback line at `pos`. */
function dbLine(
  bytes: Uint8Array,
  pos: number,
  address: number,
): DisassembledLine {
  return {
    address,
    bytes: bytes.slice(pos, pos + 1),
    text: `DB ${formatByte(bytes[pos])}`,
  };
}

/** Decode `bytes` as if loaded at `origin`; every input byte lands on a line. */
export function disassembleWith(
  table: AsmTable,
  bytes: Uint8Array,
  origin: number,
): DisassembledLine[] {
  const lines: DisassembledLine[] = [];
  let pos = 0;
  while (pos < bytes.length) {
    const address = (origin + pos) & 0xffff;
    const decoded = decodeAt(table, bytes, pos);
    if (decoded) {
      lines.push(
        lineFor(decoded.compiled, bytes, pos, decoded.consumed, address),
      );
      pos += decoded.consumed;
    } else {
      lines.push(dbLine(bytes, pos, address));
      pos += 1;
    }
  }
  return lines;
}

/** How control leaves one instruction, for the recursive-descent walk. */
export interface InstrFlow {
  /** Whether execution can continue to the next instruction in memory. */
  fallsThrough: boolean;
  /**
   * A static in-code target this instruction can transfer to (absolute,
   * 16-bit), or null when it has none or the target is computed/indirect and
   * so can't be followed.
   */
  target: number | null;
}

/**
 * A CPU's control-flow classifier: given a decoded instruction form and the
 * absolute address its address operand resolves to (its `rel8`/`imm16`
 * operand, or null), describe how control leaves it. Lives with each engine so
 * the walk stays CPU-agnostic.
 */
export type FlowClassifier = (
  form: InstructionForm,
  target: number | null,
) => InstrFlow;

/**
 * The absolute code target an instruction's address operand resolves to - its
 * `rel8` (shown relative, resolved to absolute here) or `imm16` operand - or
 * null when it has neither. The classifier decides whether a given mnemonic
 * actually treats it as a control-flow target (an `LD HL,$4000` has an `imm16`
 * but transfers nowhere).
 */
function operandTarget(
  compiled: CompiledForm,
  bytes: Uint8Array,
  start: number,
  address: number,
): number | null {
  let offset = start;
  for (const el of compiled.form.encoding) {
    if (typeof el === 'number') {
      offset++;
      continue;
    }
    if (el.slot === 'imm16') {
      return (bytes[offset] | (bytes[offset + 1] << 8)) & 0xffff;
    }
    if (el.slot === 'rel8') {
      const rel = (bytes[offset] << 24) >> 24;
      return (address + compiled.length + rel) & 0xffff;
    }
    offset += slotWidth(el.slot);
  }
  return null;
}

/**
 * Recursive-descent disassembly: decode only the bytes control flow can reach
 * from `origin` (the block's entry) and emit every other byte as `DB`. See the
 * file header for the trade-offs versus {@link disassembleWith}.
 */
export function disassembleReachableWith(
  table: AsmTable,
  bytes: Uint8Array,
  origin: number,
  flow: FlowClassifier,
): DisassembledLine[] {
  const len = bytes.length;
  // Byte offset -> the instruction line that starts there (reachable code).
  const starts = new Map<number, DisassembledLine>();
  // Offsets we've already begun a run from - guards loops and re-tracing.
  const seen = new Set<number>();
  const work: number[] = [0]; // the entry: control starts at the block base
  while (work.length > 0) {
    let pos = work.pop()!;
    while (pos >= 0 && pos < len) {
      if (seen.has(pos)) break;
      seen.add(pos);
      const decoded = decodeAt(table, bytes, pos);
      // Control reached a byte that opens no instruction (data, or a truncated
      // tail): stop this run and let the byte fall through to `DB`.
      if (!decoded) break;
      const { compiled, consumed } = decoded;
      const address = (origin + pos) & 0xffff;
      starts.set(pos, lineFor(compiled, bytes, pos, consumed, address));
      const info = flow(
        compiled.form,
        operandTarget(compiled, bytes, pos, address),
      );
      if (info.target !== null) {
        const off = (info.target - origin) & 0xffff;
        if (off < len) work.push(off); // an in-block branch/call/jump target
      }
      if (!info.fallsThrough) break;
      pos += consumed;
    }
  }
  // Tile the block: a reachable instruction where we found one, else a `DB`
  // byte. Each line carries its exact bytes, so re-assembly is byte-identical.
  const lines: DisassembledLine[] = [];
  let pos = 0;
  while (pos < len) {
    const start = starts.get(pos);
    if (start) {
      lines.push(start);
      pos += start.bytes.length;
    } else {
      lines.push(dbLine(bytes, pos, (origin + pos) & 0xffff));
      pos += 1;
    }
  }
  return lines;
}
