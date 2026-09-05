import { describe, expect, it } from 'vitest';
import { encodeSamTape } from './cassetteEncoder';
import { DATA_BLOCK } from '../samfile';

/** 5µs per sample, so a pulse is pinned to well inside a T-state count. */
const RATE = 200_000;
const MICROS_PER_SAMPLE = 1e6 / RATE;

/** One block whose bits alternate both ways, so every pulse length appears. */
const BLOCK = {
  type: DATA_BLOCK,
  bytes: Uint8Array.of(0xff, 0xaa, 0x55, 0x00),
};

/** T-states of a 6MHz Z80, as microseconds. */
const micros = (tstates: number) => (tstates * 1e6) / 6_000_000;

/**
 * Pulse lengths in microseconds, taken off the encoded signal by measuring each
 * constant-sign run. The leading silence is zeros, so the walk starts at the
 * first non-zero sample.
 */
function pulses(samples: Float32Array): number[] {
  let i = 0;
  while (i < samples.length && samples[i] === 0) i++;
  const out: number[] = [];
  let start = i;
  for (; i < samples.length; i++) {
    if (samples[i] === 0) break;
    if (Math.sign(samples[i]!) !== Math.sign(samples[start]!)) {
      out.push((i - start) * MICROS_PER_SAMPLE);
      start = i;
    }
  }
  out.push((i - start) * MICROS_PER_SAMPLE);
  return out;
}

/** Pulse lengths are rounded to whole samples, so compare within one. */
function near(actual: number | undefined, want: number, label: string): void {
  expect(
    Math.abs((actual ?? NaN) - want),
    `${label}: ${actual}µs`,
  ).toBeLessThanOrEqual(MICROS_PER_SAMPLE);
}

describe('encodeSamTape', () => {
  const signal = pulses(encodeSamTape([BLOCK], { sampleRate: RATE }));

  // Every figure below is `SABLK` at the ROM's own default speed: `13*R + 33`
  // T-states for a data pulse counted with R, `16*R + 51` for a leader or sync
  // pulse, with R = 112 for a `0` bit and 227 for a `1` bit and the leader.
  const PILOT = micros(16 * 227 + 51);
  const SYNC = micros(16 * ((227 >> 2) + 3) + 51);
  const ZERO = micros(13 * 112 + 33);
  const ONE = micros(13 * 227 + 33);
  const PILOT_PULSES = 6000;

  it('writes the pulse lengths the ROM computes', () => {
    expect(PILOT).toBeCloseTo(613.8, 1);
    expect(SYNC).toBeCloseTo(165.8, 1);
    expect(ZERO).toBeCloseTo(248.2, 1);
    expect(ONE).toBeCloseTo(497.3, 1);
  });

  it('lays the block out as leader, two sync pulses, then two pulses a bit', () => {
    expect(signal).toHaveLength(PILOT_PULSES + 2 + BLOCK.bytes.length * 8 * 2);
    for (let i = 0; i < PILOT_PULSES; i++)
      near(signal[i], PILOT, `leader ${i}`);
    near(signal[PILOT_PULSES], SYNC, 'first sync');
    near(signal[PILOT_PULSES + 1], SYNC, 'second sync');
  });

  it('sends each byte MSB first, both pulses of a bit equal', () => {
    let at = PILOT_PULSES + 2;
    for (const byte of BLOCK.bytes) {
      for (let bit = 7; bit >= 0; bit--) {
        const want = byte & (1 << bit) ? ONE : ZERO;
        near(signal[at], want, `byte ${byte} bit ${bit}`);
        near(signal[at + 1], want, `byte ${byte} bit ${bit}, second pulse`);
        at += 2;
      }
    }
  });
});
