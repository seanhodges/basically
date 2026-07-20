// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/** The 6502 engine: the generated table bound to the shared core. */

import { assembleWith } from '../assemble';
import {
  disassembleReachableWith,
  disassembleWith,
  type FlowClassifier,
} from '../disassemble';
import type { AsmEngine } from '../types';
import { m6502Table } from './table';

const DIRECTIVES = ['ORG', 'DB', 'DW', 'DS'];

/** The relative conditional branches - they take a target and fall through. */
const M6502_BRANCHES = new Set([
  'BPL',
  'BMI',
  'BVC',
  'BVS',
  'BCC',
  'BCS',
  'BNE',
  'BEQ',
]);

/**
 * 6502 control flow for recursive-descent disassembly. `JMP ({addr})` (a
 * parenthesised operand) is an indirect jump whose target can't be followed, so
 * it just ends the run; `JMP addr` is a direct unconditional jump. `JSR` and
 * the conditional branches fall through; `RTS`/`RTI` end the run.
 */
const m6502Flow: FlowClassifier = (form, target) => {
  const { mnemonic, pattern } = form;
  if (mnemonic === 'JMP') {
    if (pattern.includes('(')) return { fallsThrough: false, target: null };
    return { fallsThrough: false, target };
  }
  if (mnemonic === 'JSR') return { fallsThrough: true, target };
  if (M6502_BRANCHES.has(mnemonic)) return { fallsThrough: true, target };
  if (mnemonic === 'RTS' || mnemonic === 'RTI') {
    return { fallsThrough: false, target: null };
  }
  return { fallsThrough: true, target: null };
};

export const m6502Engine: AsmEngine = {
  cpu: '6502',
  disassemble: (bytes, origin) => disassembleWith(m6502Table, bytes, origin),
  disassembleReachable: (bytes, origin) =>
    disassembleReachableWith(m6502Table, bytes, origin, m6502Flow),
  assemble: (source, origin) => assembleWith(m6502Table, source, origin),
  mnemonics: new Set([...m6502Table.mnemonics, ...DIRECTIVES]),
  registers: m6502Table.reserved,
};
