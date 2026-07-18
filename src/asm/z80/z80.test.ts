// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { z80Engine } from './index';

const bytes = (...values: number[]) => new Uint8Array(values);

function texts(input: Uint8Array, origin = 0x8000): string[] {
  return z80Engine.disassemble(input, origin).map((l) => l.text);
}

function assembled(source: string, origin = 0x8000): number[] {
  const result = z80Engine.assemble(source, origin);
  if (!result.ok) {
    throw new Error(
      'assemble failed: ' + result.errors.map((e) => e.message).join('; '),
    );
  }
  return [...result.bytes];
}

describe('z80 disassembler', () => {
  it('decodes the border-flip block', () => {
    expect(texts(bytes(0x3e, 0x02, 0xd3, 0xfe, 0xc9))).toEqual([
      'LD A,$02',
      'OUT ($FE),A',
      'RET',
    ]);
  });

  it('decodes ED block operations', () => {
    expect(texts(bytes(0xed, 0xb0))).toEqual(['LDIR']);
    expect(texts(bytes(0xed, 0xa1))).toEqual(['CPI']);
  });

  it('decodes DDCB with the displacement before the final opcode', () => {
    expect(texts(bytes(0xdd, 0xcb, 0x03, 0x46))).toEqual(['BIT 0,(IX+$03)']);
    expect(texts(bytes(0xfd, 0xcb, 0xff, 0x86))).toEqual(['RES 0,(IY-$01)']);
  });

  it('shows relative jumps as absolute targets', () => {
    expect(texts(bytes(0x18, 0xfe))).toEqual(['JR $8000']);
    expect(texts(bytes(0x10, 0xfd))).toEqual(['DJNZ $7FFF']);
    expect(texts(bytes(0x20, 0x05))).toEqual(['JR NZ,$8007']);
  });

  it('decodes indexed operands', () => {
    expect(texts(bytes(0xdd, 0x36, 0x05, 0x99))).toEqual(['LD (IX+$05),$99']);
    expect(texts(bytes(0xdd, 0x86, 0x7f))).toEqual(['ADD A,(IX+$7F)']);
    expect(texts(bytes(0xdd, 0xe9))).toEqual(['JP (IX)']);
    expect(texts(bytes(0xfd, 0x21, 0x34, 0x12))).toEqual(['LD IY,$1234']);
  });

  it('falls back to DB for ED holes and resumes cleanly', () => {
    expect(texts(bytes(0xed, 0x00))).toEqual(['DB $ED', 'NOP']);
    // ED 63 duplicates LD (nn),HL and is deliberately not decoded.
    expect(texts(bytes(0xed, 0x63, 0x34, 0x12))).toEqual([
      'DB $ED',
      'LD H,E',
      'INC (HL)',
      'LD (DE),A',
    ]);
  });

  it('falls back to DB for truncated tails and dangling prefixes', () => {
    expect(texts(bytes(0xdd))).toEqual(['DB $DD']);
    expect(texts(bytes(0x3e))).toEqual(['DB $3E']);
    expect(texts(bytes(0xcd, 0x34))).toEqual(['DB $CD', 'INC (HL)']);
  });

  it('reports addresses with 16-bit wraparound', () => {
    const lines = z80Engine.disassemble(bytes(0x00, 0x00), 0xffff);
    expect(lines.map((l) => l.address)).toEqual([0xffff, 0x0000]);
  });

  it('decodes an empty block to no lines', () => {
    expect(texts(bytes())).toEqual([]);
  });

  it('covers each line with its exact bytes', () => {
    const input = bytes(0x3e, 0x02, 0xed, 0xb0, 0xdd, 0xcb, 0x03, 0x46);
    const lines = z80Engine.disassemble(input, 0x4000);
    expect([...lines.flatMap((l) => [...l.bytes])]).toEqual([...input]);
    expect(lines.map((l) => l.address)).toEqual([0x4000, 0x4002, 0x4004]);
  });
});

describe('z80 assembler', () => {
  it('assembles the border-flip block', () => {
    expect(assembled('LD A,$02\nOUT ($FE),A\nRET')).toEqual([
      0x3e, 0x02, 0xd3, 0xfe, 0xc9,
    ]);
  });

  it('is generous about case, spacing and number formats', () => {
    expect(assembled('ld a, 0feh')).toEqual([0x3e, 0xfe]);
    expect(assembled('  Ld A , 0xFE ; comment')).toEqual([0x3e, 0xfe]);
    expect(assembled('ld a, %11111110')).toEqual([0x3e, 0xfe]);
    expect(assembled('ld a, 254')).toEqual([0x3e, 0xfe]);
    expect(assembled('LD A,-1')).toEqual([0x3e, 0xff]);
  });

  it('re-encodes absolute branch targets as relative bytes', () => {
    expect(assembled('start: LD A,$00\nloop: INC A\nJR loop')).toEqual([
      0x3e, 0x00, 0x3c, 0x18, 0xfd,
    ]);
    expect(assembled('JR fwd\nNOP\nfwd: RET')).toEqual([
      0x18, 0x01, 0x00, 0xc9,
    ]);
    expect(assembled('DJNZ $8000')).toEqual([0x10, 0xfe]);
  });

  it('resolves label expressions', () => {
    expect(assembled('LD HL,data+1\nRET\ndata: DB $10,$20')).toEqual([
      0x21, 0x05, 0x80, 0xc9, 0x10, 0x20,
    ]);
  });

  it('supports DB, DW and DS', () => {
    expect(assembled('DB $01,2,%00000011')).toEqual([0x01, 0x02, 0x03]);
    expect(assembled('DW $1234,data\ndata: NOP')).toEqual([
      0x34, 0x12, 0x04, 0x80, 0x00,
    ]);
    expect(assembled('DS 3,$FF')).toEqual([0xff, 0xff, 0xff]);
    expect(assembled('DS 2')).toEqual([0x00, 0x00]);
  });

  it('accepts a matching ORG and rejects a mismatched one', () => {
    expect(assembled('ORG $8000\nRET')).toEqual([0xc9]);
    const result = z80Engine.assemble('ORG $9000\nRET', 0x8000);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0].line).toBe(1);
      expect(result.errors[0].message).toContain('$8000');
    }
  });

  it('accepts RST spelled hex or decimal', () => {
    expect(assembled('RST $10')).toEqual([0xd7]);
    expect(assembled('RST 16')).toEqual([0xd7]);
  });

  it('assembles register spellings before value spellings', () => {
    // (BC) must not parse as "label BC" for LD A,(nn).
    expect(assembled('LD A,(BC)')).toEqual([0x0a]);
    expect(assembled('LD A,($1234)')).toEqual([0x3a, 0x34, 0x12]);
    expect(assembled('IN A,(C)')).toEqual([0xed, 0x78]);
    expect(assembled('IN A,($FE)')).toEqual([0xdb, 0xfe]);
  });

  it('reports branch targets out of range with the line number', () => {
    const result = z80Engine.assemble('JR $9000', 0x8000);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0].line).toBe(1);
      expect(result.errors[0].message).toContain('range');
    }
  });

  it('reports duplicate, reserved and undefined labels', () => {
    const dup = z80Engine.assemble('foo: NOP\nfoo: NOP', 0x8000);
    expect(dup.ok).toBe(false);
    if (!dup.ok) {
      expect(dup.errors[0].line).toBe(2);
      expect(dup.errors[0].message).toContain("Duplicate label 'FOO'");
    }
    const reserved = z80Engine.assemble('hl: NOP', 0x8000);
    expect(reserved.ok).toBe(false);
    if (!reserved.ok) {
      expect(reserved.errors[0].message).toContain(
        "'HL' collides with a register",
      );
    }
    const undef = z80Engine.assemble('JP missing', 0x8000);
    expect(undef.ok).toBe(false);
    if (!undef.ok) {
      expect(undef.errors[0].message).toContain("Undefined label 'MISSING'");
    }
  });

  it('reports unknown instructions and bad operands', () => {
    const unknown = z80Engine.assemble('FLY A,B', 0x8000);
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) {
      expect(unknown.errors[0].message).toContain("Unknown instruction 'FLY'");
    }
    const bad = z80Engine.assemble('LD A', 0x8000);
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.errors[0].message).toContain('Bad operands for LD');
    }
  });

  it('collects multiple errors in one run', () => {
    const result = z80Engine.assemble('FLY\nJP nowhere', 0x8000);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBe(1); // pass-1 error blocks pass 2
    }
    const twoPassOne = z80Engine.assemble('FLY\nWALK', 0x8000);
    expect(twoPassOne.ok).toBe(false);
    if (!twoPassOne.ok) {
      expect(twoPassOne.errors.map((e) => e.line)).toEqual([1, 2]);
    }
  });

  it('assembles empty source to zero bytes', () => {
    expect(assembled('')).toEqual([]);
    expect(assembled('\n; just a comment\n')).toEqual([]);
  });
});
