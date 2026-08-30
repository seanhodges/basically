// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import {
  Apple2Paddles,
  PADDLE_CYCLES_PER_UNIT,
  PADDLE_TRIGGER_LEAD,
} from './paddles';

/**
 * Count a paddle the way the monitor's `PREAD` does: trigger, wait out the ten
 * cycles before its first read, then read every eleven until bit 7 falls. The
 * answer this returns is what `PDL(n)` in BASIC answers with.
 */
function pread(paddles: Apple2Paddles, index: number, at: number): number {
  paddles.trigger(at);
  let count = 0;
  let now = at + PADDLE_TRIGGER_LEAD;
  while ((paddles.read(0xc064 + index, now) & 0x80) !== 0 && count < 256) {
    count++;
    now += PADDLE_CYCLES_PER_UNIT;
  }
  return count;
}

describe('Apple2Paddles', () => {
  it('times each one-shot so PREAD reads back the value that was set', () => {
    const p = new Apple2Paddles();
    for (const value of [0, 1, 2, 127, 200, 254, 255]) {
      p.setPaddle(0, value);
      expect(pread(p, 0, 5_000)).toBe(value);
    }
  });

  it('comes up centred, and times all four from one trigger', () => {
    const p = new Apple2Paddles();
    expect(pread(p, 0, 0)).toBe(0x80);
    p.setPaddle(3, 12);
    p.trigger(1_000);
    expect(p.timerHigh(0, 1_000 + PADDLE_TRIGGER_LEAD)).toBe(true);
    expect(p.timerHigh(3, 1_000 + PADDLE_TRIGGER_LEAD)).toBe(true);
    // Paddle 3's one-shot ends long before paddle 0's.
    const after = 1_000 + PADDLE_TRIGGER_LEAD + 12 * PADDLE_CYCLES_PER_UNIT;
    expect(p.timerHigh(3, after)).toBe(false);
    expect(p.timerHigh(0, after)).toBe(true);
  });

  it('reads low until something has triggered the timers', () => {
    const p = new Apple2Paddles();
    expect(p.read(0xc064, 1_000)).toBe(0);
  });

  it('reports the buttons in bit 7 and the cassette input low', () => {
    const p = new Apple2Paddles();
    p.setButton(1, true);
    expect(p.read(0xc061, 0)).toBe(0x00);
    expect(p.read(0xc062, 0)).toBe(0x80);
    expect(p.read(0xc063, 0)).toBe(0x00);
    expect(p.read(0xc060, 0)).toBe(0x00);
  });

  it('repeats the group across $C068-$C06F', () => {
    const p = new Apple2Paddles();
    p.setButton(0, true);
    expect(p.read(0xc069, 0)).toBe(0x80);
  });
});
