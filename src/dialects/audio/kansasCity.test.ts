// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { KcsTape, decodeKcsBytes } from './kansasCity';

const RATE = 44100;

/** The three machines that write Kansas City tape, and how each frames a byte. */
const FRAMINGS = {
  'BBC (1200 baud, 8N1)': { zeroCycles: 1, oneCycles: 2, stopBits: 1 },
  'Atom (300 baud, 8N1)': { zeroCycles: 4, oneCycles: 8, stopBits: 1 },
  'MSX (1200 baud, 8N2)': { zeroCycles: 1, oneCycles: 2, stopBits: 2 },
} as const;

describe('Kansas City modulation', () => {
  /** The runs of constant level in a rendered square wave - its half-cycles. */
  function halfCycleLengths(samples: Float32Array): number[] {
    const runs: number[] = [];
    let length = 0;
    for (let i = 0; i < samples.length; i++) {
      if (i > 0 && Math.sign(samples[i]!) !== Math.sign(samples[i - 1]!)) {
        runs.push(length);
        length = 0;
      }
      length++;
    }
    return runs;
  }

  it('spells a 0 as 1200 Hz cycles and a 1 as twice as many at 2400 Hz', () => {
    const slowHalf = RATE / 2400; // half a 1200 Hz cycle, in samples
    const fastHalf = RATE / 4800;

    for (const [name, framing] of Object.entries(FRAMINGS)) {
      const tape = new KcsTape(framing);
      tape.bit(0);
      tape.bit(1);
      const halves = halfCycleLengths(tape.render(RATE));

      // Both bits last the same time, which is what makes the baud rate one
      // number: half as many cycles at half the frequency.
      expect(halves).toHaveLength(
        framing.zeroCycles * 2 + framing.oneCycles * 2,
      );
      // A half-cycle is not a whole number of samples, so each run lands on one
      // of the two samples either side of its exact length.
      halves.slice(0, framing.zeroCycles * 2).forEach((n, i) => {
        expect(Math.abs(n - slowHalf), `${name} 0 bit, half ${i}`).toBeLessThan(
          1,
        );
      });
      halves.slice(framing.zeroCycles * 2).forEach((n, i) => {
        expect(Math.abs(n - fastHalf), `${name} 1 bit, half ${i}`).toBeLessThan(
          1,
        );
      });
    }
  });

  it('frames every byte with a start bit, LSB-first data and its stop bits', () => {
    for (const [name, framing] of Object.entries(FRAMINGS)) {
      const tape = new KcsTape(framing);
      tape.tone(200); // carrier, so the reader has something to lock onto
      tape.bytes([0x00, 0x55, 0xaa, 0xff]);
      tape.tone(50);

      expect(
        Array.from(decodeKcsBytes(tape.render(RATE), RATE, framing)),
        name,
      ).toEqual([0x00, 0x55, 0xaa, 0xff]);
    }
  });

  it('reads nothing out of silence', () => {
    const framing = FRAMINGS['MSX (1200 baud, 8N2)'];
    expect(decodeKcsBytes(new Float32Array(RATE), RATE, framing)).toHaveLength(
      0,
    );
  });
});
