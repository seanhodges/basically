// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Table-driven two-pass assembler shared by every CPU engine.
 *
 * Line grammar: `[label:] [mnemonic|directive [operands]] [; comment]`.
 * Directives: `ORG` (optional; must equal the block's address), `DB`, `DW`,
 * `DS count[,fill]`. Expressions are deliberately minimal - numbers and
 * labels combined with `+`/`-` - and labels are case-insensitive (source is
 * matched uppercase throughout).
 *
 * Pass 1 sizes every line and collects label addresses; form selection is
 * purely syntactic (a label or expression always selects the 16-bit form on
 * the 6502 - only a narrow literal selects zero-page), so sizes never depend
 * on label values. Pass 2 encodes, resolves labels and range-checks. All
 * problems are collected as `AsmError`s; nothing throws.
 */

import { looksNumeric, parseLiteral } from './format';
import type { AsmTable, CompiledForm } from './table';
import type { AsmError, AssembleResult } from './types';

const LABEL_RE = /^([A-Za-z_][A-Za-z0-9_]*):/;
const MNEMONIC_RE = /^[A-Za-z_.][A-Za-z0-9_.]*/;
const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const TERM_RE = /^[A-Za-z0-9_$%]+/;

/** Hard ceiling on assembled output - the 16-bit address space. */
const MAX_OUTPUT_BYTES = 0x10000;

interface ScannedLine {
  lineNo: number;
  label: string | null;
  labelCol: number;
  mnemonic: string | null;
  mnemonicCol: number;
  mnemonicEnd: number;
  /** Normalized operand field: uppercased, all whitespace removed. */
  operands: string;
  operandCol: number;
  operandEnd: number;
}

type Sized =
  | { kind: 'none'; size: 0 }
  | { kind: 'inst'; size: number; compiled: CompiledForm; captures: string[] }
  | { kind: 'data'; size: number; width: 1 | 2; exprs: string[] }
  | { kind: 'ds'; size: number; fillExpr: string | null };

function scanLine(raw: string, lineNo: number): ScannedLine {
  const commentAt = raw.indexOf(';');
  const text = commentAt >= 0 ? raw.slice(0, commentAt) : raw;
  let i = text.length - text.trimStart().length;
  const line: ScannedLine = {
    lineNo,
    label: null,
    labelCol: i,
    mnemonic: null,
    mnemonicCol: i,
    mnemonicEnd: i,
    operands: '',
    operandCol: i,
    operandEnd: i,
  };
  const labelMatch = LABEL_RE.exec(text.slice(i));
  if (labelMatch) {
    line.label = labelMatch[1].toUpperCase();
    line.labelCol = i;
    i += labelMatch[0].length;
    while (i < text.length && /\s/.test(text[i])) i++;
  }
  const rest = text.slice(i);
  const mnemonicMatch = MNEMONIC_RE.exec(rest);
  if (mnemonicMatch) {
    line.mnemonic = mnemonicMatch[0].toUpperCase();
    line.mnemonicCol = i;
    line.mnemonicEnd = i + mnemonicMatch[0].length;
    const operandRaw = text.slice(line.mnemonicEnd);
    const trimmed = operandRaw.trim();
    line.operandCol =
      line.mnemonicEnd + (operandRaw.length - operandRaw.trimStart().length);
    line.operandEnd = line.operandCol + trimmed.length;
    line.operands = trimmed.replace(/\s+/g, '').toUpperCase();
  } else if (rest.trim() !== '') {
    // Leftover text that opens with something no mnemonic can (e.g. `1:`).
    line.mnemonic = rest.trim();
    line.mnemonicCol = i;
    line.mnemonicEnd = i + rest.trim().length;
  }
  return line;
}

type EvalResult = { value: number } | { error: string };

/** Evaluate a normalized `term ((+|-) term)*` expression. */
function evalExpr(
  text: string,
  labels: ReadonlyMap<string, number>,
): EvalResult {
  if (text === '') return { error: 'Missing value' };
  let i = 0;
  let total = 0;
  let first = true;
  while (i < text.length) {
    let sign = 1;
    const ch = text[i];
    if (ch === '+' || ch === '-') {
      sign = ch === '-' ? -1 : 1;
      i++;
    } else if (!first) {
      return { error: `Expected + or - before '${text.slice(i)}'` };
    }
    const term = TERM_RE.exec(text.slice(i));
    if (!term) {
      return { error: `Unexpected '${text[i] ?? ''}' in expression` };
    }
    i += term[0].length;
    let value: number;
    if (looksNumeric(term[0])) {
      const literal = parseLiteral(term[0]);
      if (!literal) return { error: `Bad number '${term[0]}'` };
      value = literal.value;
    } else if (IDENT_RE.test(term[0])) {
      const labelValue = labels.get(term[0]);
      if (labelValue === undefined) {
        return { error: `Undefined label '${term[0]}'` };
      }
      value = labelValue;
    } else {
      return { error: `Bad value '${term[0]}'` };
    }
    total += sign * value;
    first = false;
  }
  return { value: total };
}

/** A zp slot only accepts a byte-narrow pure literal (`$NN`, decimal < 256). */
function zpAccepts(capture: string): boolean {
  const literal = parseLiteral(capture);
  return literal !== null && literal.narrow;
}

/**
 * Whether an expression references a reserved register/condition name -
 * which means this slotted form mis-matched a register spelling and a more
 * literal form should take the operand instead.
 */
function usesReservedName(
  capture: string,
  reserved: ReadonlySet<string>,
): boolean {
  for (const term of capture.matchAll(/[A-Za-z0-9_$%]+/g)) {
    if (!looksNumeric(term[0]) && reserved.has(term[0])) return true;
  }
  return false;
}

function selectForm(
  table: AsmTable,
  forms: readonly CompiledForm[],
  operands: string,
): { compiled: CompiledForm; captures: string[] } | null {
  for (const compiled of forms) {
    const match = compiled.regex.exec(operands);
    if (!match) continue;
    const captures = match.slice(1);
    const rejected = compiled.slots.some((slot, i) => {
      if (slot === 'zp' && !zpAccepts(captures[i])) return true;
      return usesReservedName(captures[i], table.reserved);
    });
    if (rejected) continue;
    return { compiled, captures };
  }
  return null;
}

function splitList(operands: string): string[] {
  return operands.split(',');
}

/** Assemble `source` at `origin` with the given instruction table. */
export function assembleWith(
  table: AsmTable,
  source: string,
  origin: number,
): AssembleResult {
  const errors: AsmError[] = [];
  const labels = new Map<string, number>();
  const scanned = source.split(/\r?\n/).map((raw, i) => scanLine(raw, i + 1));
  const sized: Sized[] = [];
  let offset = 0;

  const fail = (
    line: ScannedLine,
    message: string,
    column: number,
    endColumn: number,
  ): Sized => {
    errors.push({ line: line.lineNo, column, endColumn, message });
    return { kind: 'none', size: 0 };
  };
  const failOperands = (line: ScannedLine, message: string): Sized =>
    fail(line, message, line.operandCol, line.operandEnd);

  // Pass 1: define labels, size every line.
  for (const line of scanned) {
    if (line.label) {
      if (table.reserved.has(line.label)) {
        fail(
          line,
          `Label '${line.label}' collides with a register or condition name`,
          line.labelCol,
          line.labelCol + line.label.length,
        );
      } else if (labels.has(line.label)) {
        fail(
          line,
          `Duplicate label '${line.label}'`,
          line.labelCol,
          line.labelCol + line.label.length,
        );
      } else {
        labels.set(line.label, (origin + offset) & 0xffff);
      }
    }
    const mnemonic = line.mnemonic;
    if (mnemonic === null) {
      sized.push({ kind: 'none', size: 0 });
      continue;
    }
    let item: Sized;
    if (mnemonic === 'ORG') {
      const value = evalExpr(line.operands, labels);
      if ('error' in value) {
        item = failOperands(line, value.error);
      } else if (offset > 0) {
        item = failOperands(line, 'ORG must come before any code or data');
      } else if ((value.value & 0xffff) !== (origin & 0xffff)) {
        item = failOperands(
          line,
          `This block assembles at ${'$' + (origin & 0xffff).toString(16).toUpperCase().padStart(4, '0')} - change the block's address instead`,
        );
      } else {
        item = { kind: 'none', size: 0 };
      }
    } else if (mnemonic === 'DB' || mnemonic === 'DW') {
      const width = mnemonic === 'DB' ? 1 : 2;
      const exprs = splitList(line.operands);
      if (line.operands === '' || exprs.some((e) => e === '')) {
        item = failOperands(line, `Missing value in ${mnemonic} list`);
      } else {
        item = { kind: 'data', size: width * exprs.length, width, exprs };
      }
    } else if (mnemonic === 'DS') {
      const parts = splitList(line.operands);
      if (line.operands === '' || parts.length > 2 || parts[0] === '') {
        item = failOperands(line, 'DS expects a count and an optional fill');
      } else {
        // The count fixes this line's size, so it must resolve now - from a
        // literal or an already-defined (backward) label.
        const count = evalExpr(parts[0], labels);
        if ('error' in count) {
          item = failOperands(line, `DS count: ${count.error}`);
        } else if (count.value < 0 || count.value > MAX_OUTPUT_BYTES) {
          item = failOperands(line, 'DS count out of range');
        } else {
          item = { kind: 'ds', size: count.value, fillExpr: parts[1] ?? null };
        }
      }
    } else {
      const forms = table.encodeIndex.get(mnemonic);
      if (!forms) {
        item = fail(
          line,
          `Unknown instruction '${mnemonic}'`,
          line.mnemonicCol,
          line.mnemonicEnd,
        );
      } else {
        const selected = selectForm(table, forms, line.operands);
        item = selected
          ? { kind: 'inst', size: selected.compiled.length, ...selected }
          : failOperands(line, `Bad operands for ${mnemonic}`);
      }
    }
    sized.push(item);
    offset += item.size;
    if (offset > MAX_OUTPUT_BYTES) {
      failOperands(line, 'Assembled output exceeds 64 KB');
      break;
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  // Pass 2: encode with the full label map.
  const bytes = new Uint8Array(offset);
  let at = 0;
  for (let i = 0; i < sized.length; i++) {
    const item = sized[i];
    const line = scanned[i];
    const lineAddress = origin + at;
    if (item.kind === 'inst') {
      const { compiled, captures } = item;
      let cursor = at;
      let slotIndex = 0;
      for (const el of compiled.form.encoding) {
        if (typeof el === 'number') {
          bytes[cursor++] = el;
          continue;
        }
        const kind = el.slot;
        const capture = captures[slotIndex++];
        const result = evalExpr(
          kind === 'disp8' && capture === '' ? '0' : capture,
          labels,
        );
        if ('error' in result) {
          failOperands(line, result.error);
          break;
        }
        const value = result.value;
        if (kind === 'imm16') {
          if (value < -0x8000 || value > 0xffff) {
            failOperands(line, `Value ${value} does not fit in 16 bits`);
            break;
          }
          bytes[cursor++] = value & 0xff;
          bytes[cursor++] = (value >> 8) & 0xff;
        } else if (kind === 'rel8') {
          // The operand is the absolute target; re-encode it relative to the
          // next instruction, wrapping around the 16-bit address space.
          let delta = (value - (lineAddress + compiled.length)) & 0xffff;
          if (delta > 0x7fff) delta -= 0x10000;
          if (delta < -128 || delta > 127) {
            failOperands(line, 'Branch target out of range');
            break;
          }
          bytes[cursor++] = delta & 0xff;
        } else if (kind === 'disp8') {
          if (value < -128 || value > 127) {
            failOperands(line, `Displacement ${value} out of range`);
            break;
          }
          bytes[cursor++] = value & 0xff;
        } else {
          // imm8 and zp: a byte value (imm8 tolerates signed spellings).
          if (value < -128 || value > 255) {
            failOperands(line, `Value ${value} does not fit in a byte`);
            break;
          }
          bytes[cursor++] = value & 0xff;
        }
      }
    } else if (item.kind === 'data') {
      let cursor = at;
      for (const expr of item.exprs) {
        const result = evalExpr(expr, labels);
        if ('error' in result) {
          failOperands(line, result.error);
          break;
        }
        const value = result.value;
        if (item.width === 1) {
          if (value < -128 || value > 255) {
            failOperands(line, `Value ${value} does not fit in a byte`);
            break;
          }
          bytes[cursor++] = value & 0xff;
        } else {
          if (value < -0x8000 || value > 0xffff) {
            failOperands(line, `Value ${value} does not fit in 16 bits`);
            break;
          }
          bytes[cursor++] = value & 0xff;
          bytes[cursor++] = (value >> 8) & 0xff;
        }
      }
    } else if (item.kind === 'ds') {
      let fill = 0;
      if (item.fillExpr !== null) {
        const result = evalExpr(item.fillExpr, labels);
        if ('error' in result) {
          failOperands(line, result.error);
        } else if (result.value < -128 || result.value > 255) {
          failOperands(line, 'DS fill does not fit in a byte');
        } else {
          fill = result.value & 0xff;
        }
      }
      bytes.fill(fill, at, at + item.size);
    }
    at += item.size;
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, bytes };
}
