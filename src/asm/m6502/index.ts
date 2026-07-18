// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/** The 6502 engine: the generated table bound to the shared core. */

import { assembleWith } from '../assemble';
import { disassembleWith } from '../disassemble';
import type { AsmEngine } from '../types';
import { m6502Table } from './table';

const DIRECTIVES = ['ORG', 'DB', 'DW', 'DS'];

export const m6502Engine: AsmEngine = {
  cpu: '6502',
  disassemble: (bytes, origin) => disassembleWith(m6502Table, bytes, origin),
  assemble: (source, origin) => assembleWith(m6502Table, source, origin),
  mnemonics: new Set([...m6502Table.mnemonics, ...DIRECTIVES]),
  registers: m6502Table.reserved,
};
