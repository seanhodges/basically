// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { m6502Engine } from './index';
import { m6502Forms } from './table';

const bytes = (...values: number[]) => new Uint8Array(values);

function texts(input: Uint8Array, origin = 0xc000): string[] {
  return m6502Engine.disassemble(input, origin).map((l) => l.text);
}

function assembled(source: string, origin = 0xc000): number[] {
  const result = m6502Engine.assemble(source, origin);
  if (!result.ok) {
    throw new Error(
      'assemble failed: ' + result.errors.map((e) => e.message).join('; '),
    );
  }
  return [...result.bytes];
}

describe('6502 table', () => {
  it('covers exactly the 151 legal opcodes', () => {
    const opcodes = new Set<number>();
    for (const form of m6502Forms) {
      if (form.alias) continue;
      opcodes.add(form.encoding[0] as number);
    }
    expect(opcodes.size).toBe(151);
  });
});

describe('6502 disassembler', () => {
  it('decodes the border-flip block', () => {
    expect(texts(bytes(0xa9, 0x02, 0x8d, 0x20, 0xd0, 0x60))).toEqual([
      'LDA #$02',
      'STA $D020',
      'RTS',
    ]);
  });

  it('distinguishes zero-page and absolute by operand width', () => {
    expect(texts(bytes(0xa5, 0xff))).toEqual(['LDA $FF']);
    expect(texts(bytes(0xad, 0xff, 0x00))).toEqual(['LDA $00FF']);
  });

  it('decodes the indexed and indirect modes', () => {
    expect(texts(bytes(0xb1, 0xfb))).toEqual(['LDA ($FB),Y']);
    expect(texts(bytes(0xa1, 0x20))).toEqual(['LDA ($20,X)']);
    expect(texts(bytes(0xb6, 0x10))).toEqual(['LDX $10,Y']);
    expect(texts(bytes(0xbd, 0x00, 0x04))).toEqual(['LDA $0400,X']);
    expect(texts(bytes(0x6c, 0x34, 0x12))).toEqual(['JMP ($1234)']);
    expect(texts(bytes(0x0a))).toEqual(['ASL A']);
  });

  it('shows branch targets as absolute addresses, wrapping pages', () => {
    expect(texts(bytes(0xf0, 0xfe))).toEqual(['BEQ $C000']);
    expect(texts(bytes(0x10, 0x05))).toEqual(['BPL $C007']);
    // Backward across a page boundary.
    expect(texts(bytes(0xd0, 0xf9), 0xc100)).toEqual(['BNE $C0FB']);
  });

  it('falls back to DB for illegal opcodes', () => {
    expect(texts(bytes(0x02))).toEqual(['DB $02']);
    expect(texts(bytes(0xa9))).toEqual(['DB $A9']); // truncated immediate
  });
});

describe('6502 assembler', () => {
  it('selects zero page for narrow literals and absolute otherwise', () => {
    expect(assembled('LDA $FF')).toEqual([0xa5, 0xff]);
    expect(assembled('LDA $00FF')).toEqual([0xad, 0xff, 0x00]);
    expect(assembled('LDA 255')).toEqual([0xa5, 0xff]);
    expect(assembled('LDA 256')).toEqual([0xad, 0x00, 0x01]);
    // Labels and expressions always select the absolute form.
    expect(assembled('STA data\ndata: DB 0', 0x0010)).toEqual([
      0x8d, 0x13, 0x00, 0x00,
    ]);
  });

  it('assembles immediates, indexed and indirect modes', () => {
    expect(assembled('LDA #$02')).toEqual([0xa9, 0x02]);
    expect(assembled('LDA ($FB),Y')).toEqual([0xb1, 0xfb]);
    expect(assembled('LDA ($20,X)')).toEqual([0xa1, 0x20]);
    expect(assembled('STA $0400,X')).toEqual([0x9d, 0x00, 0x04]);
    expect(assembled('JMP ($1234)')).toEqual([0x6c, 0x34, 0x12]);
    expect(assembled('ASL')).toEqual([0x0a]);
    expect(assembled('ASL A')).toEqual([0x0a]);
  });

  it('encodes branches to labels', () => {
    expect(assembled('loop: DEX\nBNE loop\nRTS')).toEqual([
      0xca, 0xd0, 0xfd, 0x60,
    ]);
    const far = m6502Engine.assemble('BNE $C400', 0xc000);
    expect(far.ok).toBe(false);
    if (!far.ok) {
      expect(far.errors[0].message).toContain('range');
    }
  });

  it('rejects operands that only an illegal addressing mode could take', () => {
    const result = m6502Engine.assemble('STX $10,X', 0xc000);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0].message).toContain('Bad operands for STX');
    }
  });
});
