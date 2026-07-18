// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The round-trip contract: `assemble(disassemble(bytes))` is byte-identical.
 * Swept exhaustively over every instruction form (with representative
 * operand values, positive and negative where signed) and over seeded
 * pseudo-random buffers, which also exercise the DB fallback paths.
 */

import { describe, expect, it } from 'vitest';
import { slotWidth } from '../table';
import { z80Engine } from './index';
import { z80Forms } from './table';

const ORIGIN = 0x8000;

function synthesize(
  encoding: (typeof z80Forms)[number]['encoding'],
  variant: 0 | 1,
): Uint8Array {
  const out: number[] = [];
  for (const el of encoding) {
    if (typeof el === 'number') {
      out.push(el);
    } else if (slotWidth(el.slot) === 2) {
      out.push(0x34, 0x12);
    } else if (el.slot === 'disp8' || el.slot === 'rel8') {
      out.push(variant === 0 ? 0x05 : 0xfb); // +5 / -5
    } else {
      out.push(0x12);
    }
  }
  return new Uint8Array(out);
}

function roundTrip(input: Uint8Array): Uint8Array {
  const source = z80Engine
    .disassemble(input, ORIGIN)
    .map((l) => l.text)
    .join('\n');
  const result = z80Engine.assemble(source, ORIGIN);
  if (!result.ok) {
    throw new Error(
      `re-assembly of:\n${source}\nfailed: ` +
        result.errors.map((e) => `${e.line}: ${e.message}`).join('; '),
    );
  }
  return result.bytes;
}

describe('z80 round-trip', () => {
  it('is byte-identical for every instruction form', () => {
    for (const form of z80Forms) {
      if (form.alias) continue;
      for (const variant of [0, 1] as const) {
        const input = synthesize(form.encoding, variant);
        const lines = z80Engine.disassemble(input, ORIGIN);
        expect(
          lines.length,
          `${form.mnemonic} ${form.pattern} should decode as one line`,
        ).toBe(1);
        expect(
          lines[0].text.startsWith('DB '),
          `${form.mnemonic} ${form.pattern} decoded to ${lines[0].text}`,
        ).toBe(false);
        expect(
          [...roundTrip(input)],
          `${form.mnemonic} ${form.pattern} via "${lines[0].text}"`,
        ).toEqual([...input]);
      }
    }
  });

  it('is byte-identical for seeded pseudo-random buffers', () => {
    // Deterministic xorshift so failures reproduce.
    let state = 0x2545f491;
    const next = () => {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      state >>>= 0;
      return state & 0xff;
    };
    for (let run = 0; run < 8; run++) {
      const input = new Uint8Array(2048);
      for (let i = 0; i < input.length; i++) input[i] = next();
      expect([...roundTrip(input)]).toEqual([...input]);
    }
  });

  it('re-assembles a hand-written listing to what it disassembles from', () => {
    const source = [
      'ORG $8000',
      'start:',
      '  LD A,$02',
      '  OUT ($FE),A',
      '  LD B,$08',
      'loop:',
      '  RLCA',
      '  DJNZ loop',
      '  BIT 7,(IX-$02)',
      '  JR NZ,start',
      '  RET',
    ].join('\n');
    const first = z80Engine.assemble(source, ORIGIN);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect([...roundTrip(first.bytes)]).toEqual([...first.bytes]);
  });
});
