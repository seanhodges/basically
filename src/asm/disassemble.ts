// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Table-driven disassembler: a linear walk of the decode trie. Total over
 * arbitrary input - any byte that doesn't open a known instruction (an ED
 * hole, a 6502 illegal, a truncated tail, a dangling prefix) becomes a
 * one-byte `DB $NN` line the assembler accepts straight back.
 */

import { formatByte, formatDisp, formatWord } from './format';
import type { AsmTable, CompiledForm } from './table';
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
    let node = table.root;
    let consumed = 0;
    let match: CompiledForm | null = null;
    while (pos + consumed < bytes.length) {
      const byte = bytes[pos + consumed];
      const next = node.byteEdges ? node.byteEdges.get(byte) : node.slotEdge;
      if (!next) break;
      node = next;
      consumed++;
      if (node.leaf) {
        match = node.leaf;
        break;
      }
    }
    if (match) {
      lines.push({
        address,
        bytes: bytes.slice(pos, pos + consumed),
        text: renderLine(match, bytes, pos, address),
      });
      pos += consumed;
    } else {
      lines.push({
        address,
        bytes: bytes.slice(pos, pos + 1),
        text: `DB ${formatByte(bytes[pos])}`,
      });
      pos += 1;
    }
  }
  return lines;
}
