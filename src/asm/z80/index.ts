// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/** The Z80 engine: the generated table bound to the shared core. */

import { assembleWith } from '../assemble';
import { disassembleWith } from '../disassemble';
import type { AsmEngine } from '../types';
import { z80Table } from './table';

const DIRECTIVES = ['ORG', 'DB', 'DW', 'DS'];

export const z80Engine: AsmEngine = {
  cpu: 'z80',
  disassemble: (bytes, origin) => disassembleWith(z80Table, bytes, origin),
  assemble: (source, origin) => assembleWith(z80Table, source, origin),
  mnemonics: new Set([...z80Table.mnemonics, ...DIRECTIVES]),
};
