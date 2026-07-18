// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The 6502 round-trip contract, exhaustively over every form (the zero-page
 * vs absolute width rule included) and over seeded pseudo-random buffers.
 */

import { describe, expect, it } from 'vitest';
import { slotWidth } from '../table';
import { m6502Engine } from './index';
import { m6502Forms } from './table';

const ORIGIN = 0xc000;

function synthesize(
  encoding: (typeof m6502Forms)[number]['encoding'],
  variant: 0 | 1,
): Uint8Array {
  const out: number[] = [];
  for (const el of encoding) {
    if (typeof el === 'number') {
      out.push(el);
    } else if (slotWidth(el.slot) === 2) {
      // One wide value and one whose low byte alone would fit zero page -
      // the 4-digit rendering must still re-select the absolute form.
      out.push(variant === 0 ? 0x34 : 0xff, variant === 0 ? 0x12 : 0x00);
    } else if (el.slot === 'rel8') {
      out.push(variant === 0 ? 0x05 : 0xfb); // +5 / -5
    } else {
      out.push(0x12);
    }
  }
  return new Uint8Array(out);
}

function roundTrip(input: Uint8Array): Uint8Array {
  const source = m6502Engine
    .disassemble(input, ORIGIN)
    .map((l) => l.text)
    .join('\n');
  const result = m6502Engine.assemble(source, ORIGIN);
  if (!result.ok) {
    throw new Error(
      `re-assembly of:\n${source}\nfailed: ` +
        result.errors.map((e) => `${e.line}: ${e.message}`).join('; '),
    );
  }
  return result.bytes;
}

describe('6502 round-trip', () => {
  it('is byte-identical for every instruction form', () => {
    for (const form of m6502Forms) {
      if (form.alias) continue;
      for (const variant of [0, 1] as const) {
        const input = synthesize(form.encoding, variant);
        const lines = m6502Engine.disassemble(input, ORIGIN);
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
    let state = 0x9e3779b9;
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
});
