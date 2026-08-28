// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { encodeAtariTape } from './cassetteEncoder';
import { decodeCassette } from './cassetteDecoder';
import { buildCassetteSamples, buildTokenizedImage } from '../targets';

const RATE = 44100;
const SOURCE = '10 PRINT "HELLO"\n20 GOTO 10\n';

const expected = buildTokenizedImage(SOURCE);
const clean = buildCassetteSamples(SOURCE);

/** Deterministic pseudo-random noise so the robustness cases don't flake. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function addNoise(samples: Float32Array, amp: number, seed = 1): Float32Array {
  const rng = mulberry32(seed);
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    out[i] = samples[i]! + (rng() * 2 - 1) * amp;
  }
  return out;
}

function scale(samples: Float32Array, gain: number, dc = 0): Float32Array {
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) out[i] = samples[i]! * gain + dc;
  return out;
}

/** Linear-resample to simulate tape/clock speed drift. */
function resample(samples: Float32Array, factor: number): Float32Array {
  const n = Math.round(samples.length * factor);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const pos = i / factor;
    const lo = Math.floor(pos);
    const frac = pos - lo;
    const a = samples[lo] ?? 0;
    const b = samples[lo + 1] ?? a;
    out[i] = a + (b - a) * frac;
  }
  return out;
}

/** One-pole low-pass: the HF roll-off of a speaker, the air and a microphone. */
function lowPass(
  samples: Float32Array,
  sampleRate: number,
  cutoffHz: number,
): Float32Array {
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const dt = 1 / sampleRate;
  const alpha = dt / (rc + dt);
  const out = new Float32Array(samples.length);
  let y = 0;
  for (let i = 0; i < samples.length; i++) {
    y += alpha * (samples[i]! - y);
    out[i] = y;
  }
  return out;
}

/** A single delayed reflection, as a desk between two devices makes. */
function echo(
  samples: Float32Array,
  sampleRate: number,
  gain: number,
  delayMs: number,
): Float32Array {
  const d = Math.round((delayMs / 1000) * sampleRate);
  const out = Float32Array.from(samples);
  for (let i = d; i < samples.length; i++) out[i]! += gain * samples[i - d]!;
  return out;
}

describe('the Atari cassette', () => {
  it('carries a program from encode to decode', () => {
    const { data, warnings } = decodeCassette(clean, RATE);
    expect(warnings).toEqual([]);
    expect(Array.from(data)).toEqual(Array.from(expected));
  });

  it('spans as many records as the program needs', () => {
    // Four records: three full ones and the partial tail, plus end-of-file.
    const long = buildTokenizedImage(
      Array.from({ length: 40 }, (_, i) => `${i * 10 + 10} PRINT "LINE"`).join(
        '\n',
      ),
    );
    expect(long.length).toBeGreaterThan(384);
    const { data } = decodeCassette(
      encodeAtariTape(long, { sampleRate: RATE, leaderMs: 500, gapMs: 100 }),
      RATE,
    );
    expect(Array.from(data)).toEqual(Array.from(long));
  });

  const robustness: [string, () => Float32Array, number][] = [
    ['additive noise', () => addNoise(clean, 0.1), RATE],
    ['quiet (gain ×0.05)', () => scale(clean, 0.05), RATE],
    ['loud (gain ×20)', () => scale(clean, 20), RATE],
    ['DC offset', () => scale(clean, 1, 0.3), RATE],
    [
      'noise + DC + low gain',
      () => addNoise(scale(clean, 0.3, 0.2), 0.03),
      RATE,
    ],
    ['speed drift 0.93×', () => resample(clean, 0.93), RATE],
    ['speed drift 1.07×', () => resample(clean, 1.07), RATE],
    // Told the wrong sample rate, so both tones and the bit clock are 8.8% out.
    ['a sample-rate mismatch', () => clean, 48000],
    [
      'the robust (play-out) timings',
      () => buildCassetteSamples(SOURCE, true),
      RATE,
    ],
  ];

  for (const [label, make, rate] of robustness) {
    it(`decodes despite ${label}`, () => {
      const { data } = decodeCassette(make(), rate);
      expect(Array.from(data)).toEqual(Array.from(expected));
    });
  }

  it('decodes a simulated speaker→microphone capture', () => {
    // What playing the tape out of one device and recording it on another does
    // to the signal: the mic's own 48kHz rate, the highs rolled off, a near
    // reflection off the desk between them, then mild noise.
    const RECORD_RATE = 48000;
    let s = resample(clean, RECORD_RATE / RATE);
    s = lowPass(s, RECORD_RATE, 8000);
    s = echo(s, RECORD_RATE, 0.35, 1.3);
    s = addNoise(s, 0.03, 5);

    const { data } = decodeCassette(s, RECORD_RATE);
    expect(Array.from(data)).toEqual(Array.from(expected));
  });

  it('rejects pure silence', () => {
    expect(() => decodeCassette(new Float32Array(RATE), RATE)).toThrow(
      /no atari cassette records/i,
    );
  });

  it('rejects white noise', () => {
    const noise = addNoise(new Float32Array(RATE * 2), 0.5, 7);
    expect(() => decodeCassette(noise, RATE)).toThrow(
      /no atari cassette records/i,
    );
  });
});
