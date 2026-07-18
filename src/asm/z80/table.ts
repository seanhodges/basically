// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The Z80 instruction table, generated at module load from the standard
 * x/y/z opcode decomposition (base and CB pages as loops, the ED page as an
 * explicit list) plus a mechanical DD/FD transform that derives the indexed
 * forms from the base and CB pages: `(HL)` becomes `(IX+d)` with the
 * displacement byte inserted at its encoded position (between `CB` and the
 * final opcode on the DDCB page), and standalone `HL` becomes `IX`/`IY`.
 *
 * Documented instructions only: no SLL, no IXH/IXL register halves, no
 * DDCB forms outside the `(HL)` column, and no ED-page duplicates of
 * unprefixed instructions (those decode as `DB` fallbacks - see the note at
 * the `ED 63`/`ED 6B` site below).
 */

import type { EncodingElement, InstructionForm, SlotKind } from '../table';
import { buildTable } from '../table';

const slot = (kind: SlotKind): EncodingElement => ({ slot: kind });
const IMM8 = slot('imm8');
const IMM16 = slot('imm16');
const REL8 = slot('rel8');
const DISP8 = slot('disp8');

const R = ['B', 'C', 'D', 'E', 'H', 'L', '(HL)', 'A'] as const;
const RP = ['BC', 'DE', 'HL', 'SP'] as const;
const RP2 = ['BC', 'DE', 'HL', 'AF'] as const;
const CC = ['NZ', 'Z', 'NC', 'C', 'PO', 'PE', 'P', 'M'] as const;
/** ALU ops by y; `withA` spellings carry the explicit `A,` first operand. */
const ALU: ReadonlyArray<{ mnemonic: string; withA: boolean }> = [
  { mnemonic: 'ADD', withA: true },
  { mnemonic: 'ADC', withA: true },
  { mnemonic: 'SUB', withA: false },
  { mnemonic: 'SBC', withA: true },
  { mnemonic: 'AND', withA: false },
  { mnemonic: 'XOR', withA: false },
  { mnemonic: 'OR', withA: false },
  { mnemonic: 'CP', withA: false },
];
/** CB-page rotate/shift ops by y; index 6 (SLL) is undocumented. */
const ROT = ['RLC', 'RRC', 'RL', 'RR', 'SLA', 'SRA', null, 'SRL'] as const;

function baseForms(): InstructionForm[] {
  const forms: InstructionForm[] = [];
  const add = (
    mnemonic: string,
    pattern: string,
    ...encoding: EncodingElement[]
  ) => forms.push({ mnemonic, pattern, encoding });

  // x=0, z=0: relative jumps and oddballs.
  add('NOP', '', 0x00);
  add('EX', "AF,AF'", 0x08);
  add('DJNZ', '{rel8}', 0x10, REL8);
  add('JR', '{rel8}', 0x18, REL8);
  for (let y = 4; y < 8; y++) {
    add('JR', `${CC[y - 4]},{rel8}`, 0x00 | (y << 3), REL8);
  }
  for (let p = 0; p < 4; p++) {
    // z=1: 16-bit load/add.
    add('LD', `${RP[p]},{imm16}`, 0x01 | (p << 4), IMM16);
    add('ADD', `HL,${RP[p]}`, 0x09 | (p << 4));
    // z=3: 16-bit inc/dec.
    add('INC', RP[p], 0x03 | (p << 4));
    add('DEC', RP[p], 0x0b | (p << 4));
  }
  // z=2: indirect accumulator/HL loads.
  add('LD', '(BC),A', 0x02);
  add('LD', '(DE),A', 0x12);
  add('LD', '({imm16}),HL', 0x22, IMM16);
  add('LD', '({imm16}),A', 0x32, IMM16);
  add('LD', 'A,(BC)', 0x0a);
  add('LD', 'A,(DE)', 0x1a);
  add('LD', 'HL,({imm16})', 0x2a, IMM16);
  add('LD', 'A,({imm16})', 0x3a, IMM16);
  for (let y = 0; y < 8; y++) {
    // z=4..6: 8-bit inc/dec and immediate load.
    add('INC', R[y], 0x04 | (y << 3));
    add('DEC', R[y], 0x05 | (y << 3));
    add('LD', `${R[y]},{imm8}`, 0x06 | (y << 3), IMM8);
  }
  // z=7: accumulator/flag ops.
  const accFlag = ['RLCA', 'RRCA', 'RLA', 'RRA', 'DAA', 'CPL', 'SCF', 'CCF'];
  accFlag.forEach((mnemonic, y) => add(mnemonic, '', 0x07 | (y << 3)));

  // x=1: LD r,r' matrix (0x76 is HALT).
  for (let y = 0; y < 8; y++) {
    for (let z = 0; z < 8; z++) {
      if (y === 6 && z === 6) continue;
      add('LD', `${R[y]},${R[z]}`, 0x40 | (y << 3) | z);
    }
  }
  add('HALT', '', 0x76);

  // x=2: ALU over registers; x=3 z=6: ALU over an immediate.
  ALU.forEach(({ mnemonic, withA }, y) => {
    for (let z = 0; z < 8; z++) {
      const operand = withA ? `A,${R[z]}` : R[z];
      add(mnemonic, operand, 0x80 | (y << 3) | z);
    }
    const immOperand = withA ? 'A,{imm8}' : '{imm8}';
    add(mnemonic, immOperand, 0xc6 | (y << 3), IMM8);
  });

  // x=3: control flow, stack, I/O.
  for (let y = 0; y < 8; y++) {
    add('RET', CC[y], 0xc0 | (y << 3));
    add('JP', `${CC[y]},{imm16}`, 0xc2 | (y << 3), IMM16);
    add('CALL', `${CC[y]},{imm16}`, 0xc4 | (y << 3), IMM16);
    const target = y * 8;
    const hex = '$' + target.toString(16).toUpperCase().padStart(2, '0');
    add('RST', hex, 0xc7 | (y << 3));
    forms.push({
      mnemonic: 'RST',
      pattern: String(target),
      encoding: [0xc7 | (y << 3)],
      alias: true,
    });
  }
  for (let p = 0; p < 4; p++) {
    add('POP', RP2[p], 0xc1 | (p << 4));
    add('PUSH', RP2[p], 0xc5 | (p << 4));
  }
  add('RET', '', 0xc9);
  add('EXX', '', 0xd9);
  add('JP', '(HL)', 0xe9);
  add('LD', 'SP,HL', 0xf9);
  add('JP', '{imm16}', 0xc3, IMM16);
  add('OUT', '({imm8}),A', 0xd3, IMM8);
  add('IN', 'A,({imm8})', 0xdb, IMM8);
  add('EX', '(SP),HL', 0xe3);
  add('EX', 'DE,HL', 0xeb);
  add('DI', '', 0xf3);
  add('EI', '', 0xfb);
  add('CALL', '{imm16}', 0xcd, IMM16);
  return forms;
}

function cbForms(): InstructionForm[] {
  const forms: InstructionForm[] = [];
  for (let z = 0; z < 8; z++) {
    ROT.forEach((mnemonic, y) => {
      if (mnemonic === null) return;
      forms.push({
        mnemonic,
        pattern: R[z],
        encoding: [0xcb, (y << 3) | z],
      });
    });
    for (let y = 0; y < 8; y++) {
      forms.push({
        mnemonic: 'BIT',
        pattern: `${y},${R[z]}`,
        encoding: [0xcb, 0x40 | (y << 3) | z],
      });
      forms.push({
        mnemonic: 'RES',
        pattern: `${y},${R[z]}`,
        encoding: [0xcb, 0x80 | (y << 3) | z],
      });
      forms.push({
        mnemonic: 'SET',
        pattern: `${y},${R[z]}`,
        encoding: [0xcb, 0xc0 | (y << 3) | z],
      });
    }
  }
  return forms;
}

function edForms(): InstructionForm[] {
  const forms: InstructionForm[] = [];
  const add = (
    mnemonic: string,
    pattern: string,
    ...encoding: EncodingElement[]
  ) => forms.push({ mnemonic, pattern, encoding });

  for (let y = 0; y < 8; y++) {
    if (y === 6) continue; // IN (C) / OUT (C),0 are undocumented.
    add('IN', `${R[y]},(C)`, 0xed, 0x40 | (y << 3));
    add('OUT', `(C),${R[y]}`, 0xed, 0x41 | (y << 3));
  }
  for (let p = 0; p < 4; p++) {
    add('SBC', `HL,${RP[p]}`, 0xed, 0x42 | (p << 4));
    add('ADC', `HL,${RP[p]}`, 0xed, 0x4a | (p << 4));
    // ED 63 / ED 6B (p=2) duplicate the unprefixed LD (nn),HL / LD HL,(nn).
    // They are left OUT of the table: decoding them to text that re-assembles
    // to the shorter base encoding would break byte-identical round-trips, so
    // those rare sequences fall back to `DB` lines instead.
    if (p === 2) continue;
    forms.push({
      mnemonic: 'LD',
      pattern: `({imm16}),${RP[p]}`,
      encoding: [0xed, 0x43 | (p << 4), IMM16],
    });
    forms.push({
      mnemonic: 'LD',
      pattern: `${RP[p]},({imm16})`,
      encoding: [0xed, 0x4b | (p << 4), IMM16],
    });
  }
  add('NEG', '', 0xed, 0x44);
  add('RETN', '', 0xed, 0x45);
  add('RETI', '', 0xed, 0x4d);
  add('IM', '0', 0xed, 0x46);
  add('IM', '1', 0xed, 0x56);
  add('IM', '2', 0xed, 0x5e);
  add('LD', 'I,A', 0xed, 0x47);
  add('LD', 'R,A', 0xed, 0x4f);
  add('LD', 'A,I', 0xed, 0x57);
  add('LD', 'A,R', 0xed, 0x5f);
  add('RRD', '', 0xed, 0x67);
  add('RLD', '', 0xed, 0x6f);
  const block: ReadonlyArray<[string, number]> = [
    ['LDI', 0xa0],
    ['CPI', 0xa1],
    ['INI', 0xa2],
    ['OUTI', 0xa3],
    ['LDD', 0xa8],
    ['CPD', 0xa9],
    ['IND', 0xaa],
    ['OUTD', 0xab],
    ['LDIR', 0xb0],
    ['CPIR', 0xb1],
    ['INIR', 0xb2],
    ['OTIR', 0xb3],
    ['LDDR', 0xb8],
    ['CPDR', 0xb9],
    ['INDR', 0xba],
    ['OTDR', 0xbb],
  ];
  for (const [mnemonic, opcode] of block) add(mnemonic, '', 0xed, opcode);
  return forms;
}

/**
 * Derive the documented DD/FD (IX/IY) forms from the base and CB pages.
 * `(HL)` forms gain a displacement (`JP (HL)` excepted - `JP (IX)` takes
 * none); standalone-`HL` forms swap the register name; `EX DE,HL` has no
 * prefixed variant.
 */
function indexedForms(
  base: readonly InstructionForm[],
  cb: readonly InstructionForm[],
  prefix: number,
  ix: 'IX' | 'IY',
): InstructionForm[] {
  const forms: InstructionForm[] = [];
  for (const form of base) {
    if (form.alias) continue;
    if (form.pattern.includes('(HL)') && form.mnemonic !== 'JP') {
      forms.push({
        mnemonic: form.mnemonic,
        pattern: form.pattern.replace('(HL)', `(${ix}{disp8})`),
        encoding: [prefix, form.encoding[0], DISP8, ...form.encoding.slice(1)],
      });
    } else if (
      form.pattern.includes('HL') &&
      !(form.mnemonic === 'EX' && form.pattern === 'DE,HL')
    ) {
      forms.push({
        mnemonic: form.mnemonic,
        pattern: form.pattern.replaceAll('HL', ix),
        encoding: [prefix, ...form.encoding],
      });
    }
  }
  for (const form of cb) {
    if (!form.pattern.includes('(HL)')) continue;
    forms.push({
      mnemonic: form.mnemonic,
      pattern: form.pattern.replace('(HL)', `(${ix}{disp8})`),
      encoding: [prefix, 0xcb, DISP8, form.encoding[1]],
    });
  }
  return forms;
}

function buildForms(): InstructionForm[] {
  const base = baseForms();
  const cb = cbForms();
  return [
    ...base,
    ...cb,
    ...edForms(),
    ...indexedForms(base, cb, 0xdd, 'IX'),
    ...indexedForms(base, cb, 0xfd, 'IY'),
  ];
}

export const z80Forms: readonly InstructionForm[] = buildForms();

export const z80Table = buildTable(z80Forms);
