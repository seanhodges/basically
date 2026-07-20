// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/** The Z80 engine: the generated table bound to the shared core. */

import { assembleWith } from '../assemble';
import {
  disassembleReachableWith,
  disassembleWith,
  type FlowClassifier,
} from '../disassemble';
import type { AsmEngine } from '../types';
import { z80Table } from './table';

const DIRECTIVES = ['ORG', 'DB', 'DW', 'DS'];

/**
 * Z80 control flow for recursive-descent disassembly. A condition prefix shows
 * up as a comma in the operand pattern (`NZ,{imm16}`, `C,{rel8}`), which is
 * what separates a conditional branch (falls through) from an unconditional one
 * (does not). `JP (HL)`/`(IX)`/`(IY)` (a parenthesised operand) is an indirect
 * jump whose target can't be followed, so it just ends the run.
 */
const z80Flow: FlowClassifier = (form, target) => {
  const { mnemonic, pattern } = form;
  const conditional = pattern.includes(',');
  switch (mnemonic) {
    case 'JR':
      return { fallsThrough: conditional, target };
    case 'JP':
      if (pattern.includes('(')) return { fallsThrough: false, target: null };
      return { fallsThrough: conditional, target };
    case 'DJNZ':
    case 'CALL':
    case 'RST':
      return { fallsThrough: true, target };
    case 'RET':
      // `RET` is unconditional (empty pattern); `RET cc` falls through.
      return pattern === ''
        ? { fallsThrough: false, target: null }
        : { fallsThrough: true, target: null };
    case 'RETI':
    case 'RETN':
      return { fallsThrough: false, target: null };
    default:
      return { fallsThrough: true, target: null };
  }
};

export const z80Engine: AsmEngine = {
  cpu: 'z80',
  disassemble: (bytes, origin) => disassembleWith(z80Table, bytes, origin),
  disassembleReachable: (bytes, origin) =>
    disassembleReachableWith(z80Table, bytes, origin, z80Flow),
  assemble: (source, origin) => assembleWith(z80Table, source, origin),
  mnemonics: new Set([...z80Table.mnemonics, ...DIRECTIVES]),
  registers: z80Table.reserved,
};
