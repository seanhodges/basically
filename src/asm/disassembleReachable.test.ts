// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Recursive-descent disassembly: only bytes control flow can reach from the
 * block entry decode as instructions; everything else comes back as `DB`. The
 * driving case is a ZX81 routine that ends in a byte-sequence data section
 * whose values are valid opcodes - a linear sweep decodes them as code, this
 * keeps them as data - and the round-trip stays byte-identical either way.
 */

import { describe, expect, it } from 'vitest';
import { z80Engine } from './z80';
import { m6502Engine } from './m6502';
import type { AsmEngine } from './types';

const bytes = (...values: number[]) => new Uint8Array(values);

function reachableText(
  engine: AsmEngine,
  input: Uint8Array,
  origin: number,
): string[] {
  return engine.disassembleReachable(input, origin).map((l) => l.text);
}

/** Assemble the recursive-descent listing back and expect the original bytes. */
function expectByteIdentical(
  engine: AsmEngine,
  input: Uint8Array,
  origin: number,
): void {
  const source = reachableText(engine, input, origin).join('\n');
  const result = engine.assemble(source, origin);
  expect(result.ok, source).toBe(true);
  if (result.ok) expect([...result.bytes], source).toEqual([...input]);
}

describe('z80 recursive-descent disassembly', () => {
  // The reported bug, verbatim: a print loop over a pointer at $408D, then the
  // "HELLO WORLD!" ZX81-charset bytes as a DB tail. Assembled at 16514 ($4082).
  const ORIGIN = 0x4082;
  const CODE = [
    0x21,
    0x8d,
    0x40, // LD HL,$408D
    0x7e, //             LD A,(HL)
    0xfe,
    0xff, //       CP $FF
    0xc8, //             RET Z
    0xd7, //             RST $10
    0x23, //             INC HL
    0x18,
    0xf8, //       JR $4085  (unconditional, back to the loop top)
  ];
  // DB $21,$1E,$25,$25,$28,$1A,$00,$30,$28,$2B,$25,$27,$16,$FF
  const DATA = [
    0x21, 0x1e, 0x25, 0x25, 0x28, 0x1a, 0x00, 0x30, 0x28, 0x2b, 0x25, 0x27,
    0x16, 0xff,
  ];

  it('keeps a trailing data section as DB instead of decoding it as code', () => {
    const input = bytes(...CODE, ...DATA);
    const text = reachableText(z80Engine, input, ORIGIN);

    // The code decodes normally, up to and including the unconditional JR.
    expect(text.slice(0, 8)).toEqual([
      'LD HL,$408D',
      'LD A,(HL)',
      'CP $FF',
      'RET Z',
      'RST $10',
      'INC HL',
      'JR $4085',
      'DB $21',
    ]);
    // Every data byte is a `DB`, none reinterpreted as an instruction - a
    // linear sweep would have decoded the first as `LD HL,$251E`.
    const dbTail = text.slice(7);
    expect(dbTail).toHaveLength(DATA.length);
    expect(dbTail.every((line) => line.startsWith('DB '))).toBe(true);
    expect(text).not.toContain('LD HL,$251E');
  });

  it('linear disassembly still mis-decodes the same tail (contrast)', () => {
    const input = bytes(...CODE, ...DATA);
    const linear = z80Engine.disassemble(input, ORIGIN).map((l) => l.text);
    expect(linear).toContain('LD HL,$251E');
  });

  it('re-assembles the recursive-descent listing to the same bytes', () => {
    expectByteIdentical(z80Engine, bytes(...CODE, ...DATA), ORIGIN);
  });

  it('recovers code jumped to over an intervening data table', () => {
    // JR +2 skips two data bytes to a RET; the skipped bytes stay data even
    // though 0xC9 (RET) is a valid opcode.
    const input = bytes(0x18, 0x02, 0xc9, 0xc9, 0xc9);
    //                   JR $8004 -^      ^data^  ^-- target: RET
    expect(reachableText(z80Engine, input, 0x8000)).toEqual([
      'JR $8004',
      'DB $C9',
      'DB $C9',
      'RET',
    ]);
    expectByteIdentical(z80Engine, input, 0x8000);
  });

  it('follows a conditional branch on both paths', () => {
    // JR NZ targets the RET and also falls through to the INC A, so both are
    // reachable code.
    const input = bytes(0x20, 0x01, 0x3c, 0xc9);
    //                   JR NZ,$8003  INC A  RET
    expect(reachableText(z80Engine, input, 0x8000)).toEqual([
      'JR NZ,$8003',
      'INC A',
      'RET',
    ]);
  });

  it('stops at an indirect jump it cannot follow', () => {
    // JP (HL) transfers somewhere unknowable; the trailing byte is left as DB
    // rather than assumed to be code.
    const input = bytes(0xe9, 0x3c); // JP (HL) ; then a stray INC A byte
    expect(reachableText(z80Engine, input, 0x8000)).toEqual([
      'JP (HL)',
      'DB $3C',
    ]);
  });

  it('stops the run after an unconditional RET', () => {
    const input = bytes(0xc9, 0x3c); // RET ; then unreachable INC A
    expect(reachableText(z80Engine, input, 0x8000)).toEqual(['RET', 'DB $3C']);
  });

  it('decodes an empty block to no lines', () => {
    expect(reachableText(z80Engine, bytes(), 0x8000)).toEqual([]);
  });
});

describe('6502 recursive-descent disassembly', () => {
  it('keeps bytes jumped over by a direct JMP as data', () => {
    // JMP $8005 skips two data bytes to an RTS.
    const input = bytes(0x4c, 0x05, 0x80, 0xff, 0xff, 0x60);
    //                   JMP $8005 --^     ^data^      ^ RTS
    expect(reachableText(m6502Engine, input, 0x8000)).toEqual([
      'JMP $8005',
      'DB $FF',
      'DB $FF',
      'RTS',
    ]);
    expectByteIdentical(m6502Engine, input, 0x8000);
  });

  it('follows a JSR fall-through and stops at RTS', () => {
    // JSR $9000 (out of block) falls through to INX, then RTS ends the run;
    // the trailing byte is unreachable data.
    const input = bytes(0x20, 0x00, 0x90, 0xe8, 0x60, 0xe8);
    //                   JSR $9000        INX   RTS   (unreachable INX)
    expect(reachableText(m6502Engine, input, 0x8000)).toEqual([
      'JSR $9000',
      'INX',
      'RTS',
      'DB $E8',
    ]);
    expectByteIdentical(m6502Engine, input, 0x8000);
  });

  it('follows a conditional branch on both paths', () => {
    // BNE targets the RTS and also falls through to the INX, so both are code.
    const input = bytes(0xd0, 0x01, 0xe8, 0x60);
    //                   BNE $8003    INX   RTS
    expect(reachableText(m6502Engine, input, 0x8000)).toEqual([
      'BNE $8003',
      'INX',
      'RTS',
    ]);
  });
});
