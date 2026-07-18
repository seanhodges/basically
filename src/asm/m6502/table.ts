// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The 6502 instruction table: the 151 legal NMOS opcodes as a compact
 * mnemonic -> addressing-mode -> opcode map, expanded at module load into
 * `InstructionForm`s for the shared core. Illegal/undocumented opcodes are
 * absent and decode as `DB` fallbacks.
 *
 * Zero-page modes are registered before their absolute counterparts: with
 * the assembler's stable form ordering and the narrow-literal rule (`$NN`
 * selects zero page, `$00FF`, labels and expressions select absolute) this
 * makes disassemble -> assemble byte-identical.
 */

import type { EncodingElement, InstructionForm } from '../table';
import { buildTable } from '../table';

type Mode =
  | 'imm'
  | 'zp'
  | 'zpx'
  | 'zpy'
  | 'indx'
  | 'indy'
  | 'rel'
  | 'acc'
  | 'impl'
  | 'abs'
  | 'absx'
  | 'absy'
  | 'ind';

/** Registration order: zero-page family strictly before the absolute family. */
const MODE_ORDER: readonly Mode[] = [
  'imm',
  'zp',
  'zpx',
  'zpy',
  'indx',
  'indy',
  'rel',
  'acc',
  'impl',
  'abs',
  'absx',
  'absy',
  'ind',
];

const MODE_PATTERN: Record<Mode, string> = {
  imm: '#{imm8}',
  zp: '{zp}',
  zpx: '{zp},X',
  zpy: '{zp},Y',
  indx: '({zp},X)',
  indy: '({zp}),Y',
  rel: '{rel8}',
  acc: 'A',
  impl: '',
  abs: '{imm16}',
  absx: '{imm16},X',
  absy: '{imm16},Y',
  ind: '({imm16})',
};

const MODE_SLOT: Record<Mode, EncodingElement | null> = {
  imm: { slot: 'imm8' },
  zp: { slot: 'zp' },
  zpx: { slot: 'zp' },
  zpy: { slot: 'zp' },
  indx: { slot: 'zp' },
  indy: { slot: 'zp' },
  rel: { slot: 'rel8' },
  acc: null,
  impl: null,
  abs: { slot: 'imm16' },
  absx: { slot: 'imm16' },
  absy: { slot: 'imm16' },
  ind: { slot: 'imm16' },
};

const OPS: Record<string, Partial<Record<Mode, number>>> = {
  LDA: {
    imm: 0xa9,
    zp: 0xa5,
    zpx: 0xb5,
    abs: 0xad,
    absx: 0xbd,
    absy: 0xb9,
    indx: 0xa1,
    indy: 0xb1,
  },
  LDX: { imm: 0xa2, zp: 0xa6, zpy: 0xb6, abs: 0xae, absy: 0xbe },
  LDY: { imm: 0xa0, zp: 0xa4, zpx: 0xb4, abs: 0xac, absx: 0xbc },
  STA: {
    zp: 0x85,
    zpx: 0x95,
    abs: 0x8d,
    absx: 0x9d,
    absy: 0x99,
    indx: 0x81,
    indy: 0x91,
  },
  STX: { zp: 0x86, zpy: 0x96, abs: 0x8e },
  STY: { zp: 0x84, zpx: 0x94, abs: 0x8c },
  ADC: {
    imm: 0x69,
    zp: 0x65,
    zpx: 0x75,
    abs: 0x6d,
    absx: 0x7d,
    absy: 0x79,
    indx: 0x61,
    indy: 0x71,
  },
  SBC: {
    imm: 0xe9,
    zp: 0xe5,
    zpx: 0xf5,
    abs: 0xed,
    absx: 0xfd,
    absy: 0xf9,
    indx: 0xe1,
    indy: 0xf1,
  },
  AND: {
    imm: 0x29,
    zp: 0x25,
    zpx: 0x35,
    abs: 0x2d,
    absx: 0x3d,
    absy: 0x39,
    indx: 0x21,
    indy: 0x31,
  },
  ORA: {
    imm: 0x09,
    zp: 0x05,
    zpx: 0x15,
    abs: 0x0d,
    absx: 0x1d,
    absy: 0x19,
    indx: 0x01,
    indy: 0x11,
  },
  EOR: {
    imm: 0x49,
    zp: 0x45,
    zpx: 0x55,
    abs: 0x4d,
    absx: 0x5d,
    absy: 0x59,
    indx: 0x41,
    indy: 0x51,
  },
  CMP: {
    imm: 0xc9,
    zp: 0xc5,
    zpx: 0xd5,
    abs: 0xcd,
    absx: 0xdd,
    absy: 0xd9,
    indx: 0xc1,
    indy: 0xd1,
  },
  CPX: { imm: 0xe0, zp: 0xe4, abs: 0xec },
  CPY: { imm: 0xc0, zp: 0xc4, abs: 0xcc },
  INC: { zp: 0xe6, zpx: 0xf6, abs: 0xee, absx: 0xfe },
  DEC: { zp: 0xc6, zpx: 0xd6, abs: 0xce, absx: 0xde },
  ASL: { acc: 0x0a, zp: 0x06, zpx: 0x16, abs: 0x0e, absx: 0x1e },
  LSR: { acc: 0x4a, zp: 0x46, zpx: 0x56, abs: 0x4e, absx: 0x5e },
  ROL: { acc: 0x2a, zp: 0x26, zpx: 0x36, abs: 0x2e, absx: 0x3e },
  ROR: { acc: 0x6a, zp: 0x66, zpx: 0x76, abs: 0x6e, absx: 0x7e },
  BIT: { zp: 0x24, abs: 0x2c },
  JMP: { abs: 0x4c, ind: 0x6c },
  JSR: { abs: 0x20 },
  BPL: { rel: 0x10 },
  BMI: { rel: 0x30 },
  BVC: { rel: 0x50 },
  BVS: { rel: 0x70 },
  BCC: { rel: 0x90 },
  BCS: { rel: 0xb0 },
  BNE: { rel: 0xd0 },
  BEQ: { rel: 0xf0 },
  BRK: { impl: 0x00 },
  RTI: { impl: 0x40 },
  RTS: { impl: 0x60 },
  PHP: { impl: 0x08 },
  PLP: { impl: 0x28 },
  PHA: { impl: 0x48 },
  PLA: { impl: 0x68 },
  DEY: { impl: 0x88 },
  TAY: { impl: 0xa8 },
  INY: { impl: 0xc8 },
  INX: { impl: 0xe8 },
  DEX: { impl: 0xca },
  NOP: { impl: 0xea },
  TXA: { impl: 0x8a },
  TXS: { impl: 0x9a },
  TAX: { impl: 0xaa },
  TSX: { impl: 0xba },
  TYA: { impl: 0x98 },
  CLC: { impl: 0x18 },
  SEC: { impl: 0x38 },
  CLI: { impl: 0x58 },
  SEI: { impl: 0x78 },
  CLV: { impl: 0xb8 },
  CLD: { impl: 0xd8 },
  SED: { impl: 0xf8 },
};

function buildForms(): InstructionForm[] {
  const forms: InstructionForm[] = [];
  for (const [mnemonic, modes] of Object.entries(OPS)) {
    for (const mode of MODE_ORDER) {
      const opcode = modes[mode];
      if (opcode === undefined) continue;
      const slot = MODE_SLOT[mode];
      forms.push({
        mnemonic,
        pattern: MODE_PATTERN[mode],
        encoding: slot === null ? [opcode] : [opcode, slot],
      });
      if (mode === 'acc') {
        // Bare `ASL` is an accepted spelling of `ASL A`.
        forms.push({ mnemonic, pattern: '', encoding: [opcode], alias: true });
      }
    }
  }
  return forms;
}

export const m6502Forms: readonly InstructionForm[] = buildForms();

export const m6502Table = buildTable(m6502Forms);
