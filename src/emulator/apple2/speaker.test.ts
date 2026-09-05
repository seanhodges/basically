// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import {
  Apple2Speaker,
  SPEAKER_AMPLITUDE,
  SPEAKER_SAMPLES_PER_FRAME,
} from './speaker';
import { CYCLES_PER_FIELD } from './timing';

/** Zero crossings in one rendered field - the tone's edges. */
function edges(samples: Float32Array): number {
  let count = 0;
  for (let i = 1; i < samples.length; i++) {
    const previous = samples[i - 1]!;
    const current = samples[i]!;
    if (previous <= 0 && current > 0) count++;
  }
  return count;
}

describe('Apple2Speaker', () => {
  it('emits a whole number of samples a field', () => {
    expect(Number.isInteger(SPEAKER_SAMPLES_PER_FRAME)).toBe(true);
    const speaker = new Apple2Speaker();
    speaker.toggle(0);
    expect(speaker.render(CYCLES_PER_FIELD)).toHaveLength(
      SPEAKER_SAMPLES_PER_FRAME,
    );
  });

  it('costs nothing while nothing has touched $C030', () => {
    const speaker = new Apple2Speaker();
    expect(speaker.render(CYCLES_PER_FIELD)).toHaveLength(0);
  });

  it('turns a run of toggles into a square wave at the loop period', () => {
    const speaker = new Apple2Speaker();
    // A tone the way every Apple II program made one: touch the address, count
    // cycles, touch it again. 400 cycles between toggles is ~1.3kHz.
    const period = 400;
    for (let cycle = 0; cycle < CYCLES_PER_FIELD; cycle += period) {
      speaker.toggle(cycle);
    }
    const samples = speaker.render(CYCLES_PER_FIELD);
    const cycles = Math.floor(CYCLES_PER_FIELD / (period * 2));
    expect(edges(samples)).toBeGreaterThanOrEqual(cycles - 1);
    expect(edges(samples)).toBeLessThanOrEqual(cycles + 1);
    let peak = 0;
    for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
    expect(peak).toBeCloseTo(SPEAKER_AMPLITUDE, 2);
  });

  it('every touch is a transition, since there is no value to compare', () => {
    const speaker = new Apple2Speaker();
    speaker.toggle(0);
    const held = speaker.render(CYCLES_PER_FIELD);
    // The cone is left deflected, so the next field starts there rather than
    // at rest - and the DC blocker walks it back down instead of clicking.
    expect(held[held.length - 1]).toBeGreaterThan(0);
    const decay = speaker.render(CYCLES_PER_FIELD);
    expect(Math.abs(decay[decay.length - 1]!)).toBeLessThan(
      Math.abs(held[held.length - 1]!),
    );
  });

  it('settles back to silence, and to allocating nothing', () => {
    const speaker = new Apple2Speaker();
    speaker.toggle(0);
    speaker.toggle(1);
    let field = 0;
    while (speaker.render(CYCLES_PER_FIELD).length > 0 && field < 200) field++;
    expect(field).toBeLessThan(200);
  });

  it('drops the cone and the filter on a reset', () => {
    const speaker = new Apple2Speaker();
    speaker.toggle(0);
    speaker.render(CYCLES_PER_FIELD);
    speaker.reset();
    expect(speaker.render(CYCLES_PER_FIELD)).toHaveLength(0);
  });
});
