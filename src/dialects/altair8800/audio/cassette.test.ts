// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import {
  ACR_BAUD,
  ACR_MARK_HZ,
  ACR_SPACE_HZ,
  CASSETTE_SAMPLE_RATE,
  buildCassetteSamples,
  buildCsaveImage,
  encodeAcrTape,
} from './cassetteEncoder';
import { decodeAcrTape, decodeCassette } from './cassetteDecoder';
import { altair8800 } from '../index';
import { detokenizeProgram } from '../detokenizer';
import { fatalErrors } from '../../types';

/** Count zero crossings over a window to measure the tone playing there. */
function toneHz(
  samples: Float32Array,
  fromSec: number,
  toSec: number,
  sampleRate = CASSETTE_SAMPLE_RATE,
): number {
  const from = Math.round(fromSec * sampleRate);
  const to = Math.round(toSec * sampleRate);
  let crossings = 0;
  for (let i = from + 1; i < to; i++) {
    if (Math.sign(samples[i]!) !== Math.sign(samples[i - 1]!)) crossings++;
  }
  return crossings / 2 / (toSec - fromSec);
}

/** Resample by nearest neighbour, to stand in for a recorder running fast. */
function resample(
  samples: Float32Array,
  from: number,
  to: number,
): Float32Array {
  const out = new Float32Array(Math.floor((samples.length * to) / from));
  for (let i = 0; i < out.length; i++) {
    out[i] = samples[Math.floor((i * from) / to)] ?? 0;
  }
  return out;
}

describe('88-ACR modulation', () => {
  it('idles on the mark tone', () => {
    const samples = encodeAcrTape(Uint8Array.of(0x00), { leaderMs: 500 });
    expect(toneHz(samples, 0.05, 0.4)).toBeCloseTo(ACR_MARK_HZ, -1);
  });

  it('carries a 0x00 byte as one long run of the space tone', () => {
    // Leader, then start bit + eight zero data bits = nine bit times of space
    // before the stop bit brings the mark back.
    const samples = encodeAcrTape(Uint8Array.of(0x00), { leaderMs: 100 });
    const dataFrom = 0.1 + 0.5 / ACR_BAUD;
    const dataTo = 0.1 + 8.5 / ACR_BAUD;
    // A 27 ms window holds ~49 whole cycles, so counting crossings quantises to
    // about ±20 Hz - far tighter than the 275 Hz that separates the two tones.
    expect(toneHz(samples, dataFrom, dataTo)).toBeGreaterThan(
      ACR_SPACE_HZ - 20,
    );
    expect(toneHz(samples, dataFrom, dataTo)).toBeLessThan(ACR_SPACE_HZ + 20);
  });

  it('runs at 300 baud', () => {
    // 40 bytes is 400 bit times; with no leader or trailer that is 400/300 s.
    const samples = encodeAcrTape(new Uint8Array(40), {
      leaderMs: 0,
      trailerMs: 0,
    });
    expect(samples.length / CASSETTE_SAMPLE_RATE).toBeCloseTo(
      400 / ACR_BAUD,
      3,
    );
  });

  it('recovers every byte value', () => {
    const bytes = Uint8Array.from({ length: 256 }, (_, i) => i);
    const samples = encodeAcrTape(bytes, { leaderMs: 100, trailerMs: 50 });
    expect(Array.from(decodeAcrTape(samples, CASSETTE_SAMPLE_RATE))).toEqual(
      Array.from(bytes),
    );
  });

  it('survives a recorder running off speed', () => {
    const bytes = Uint8Array.from([0xd3, 0xd3, 0xd3, 0x41, 0x55, 0xaa, 0x00]);
    const samples = encodeAcrTape(bytes, { leaderMs: 200 });
    for (const rate of [40_000, 48_000]) {
      const played = resample(samples, CASSETTE_SAMPLE_RATE, rate);
      expect(Array.from(decodeAcrTape(played, rate))).toEqual(
        Array.from(bytes),
      );
    }
  });

  it('finds nothing in silence rather than inventing a program', () => {
    expect(
      decodeAcrTape(new Float32Array(44_100), CASSETTE_SAMPLE_RATE),
    ).toHaveLength(0);
    expect(() =>
      decodeCassette(new Float32Array(44_100), CASSETTE_SAMPLE_RATE),
    ).toThrow(/No cassette signal/);
  });

  it('rejects audio that is not an Altair tape', () => {
    // A plain 1 kHz tone: real audio, no framing.
    const noise = Float32Array.from({ length: 44_100 }, (_, i) =>
      Math.sign(Math.sin((2 * Math.PI * 1000 * i) / CASSETTE_SAMPLE_RATE)),
    );
    expect(() => decodeCassette(noise, CASSETTE_SAMPLE_RATE)).toThrow(
      /No cassette signal/,
    );
  });
});

describe('cassette round trip', () => {
  const source = altair8800.samples.find((s) => s.name === 'hello.bas')!.text;

  it('recovers the program and its one-character name', () => {
    const samples = buildCassetteSamples(source, 'HELLO', false);
    const { programName, data } = decodeCassette(samples, CASSETTE_SAMPLE_RATE);
    expect(programName).toBe('H');
    expect(detokenizeProgram(data)).toBe(source);
  });

  it('recovers the same program in robust mode', () => {
    const samples = buildCassetteSamples(source, 'HELLO', true);
    const { data } = decodeCassette(samples, CASSETTE_SAMPLE_RATE);
    expect(detokenizeProgram(data)).toBe(source);
  });

  it('decodes to exactly the bytes CSAVE would have written', () => {
    const samples = buildCassetteSamples(source, 'HELLO', false);
    const bytes = decodeAcrTape(samples, CASSETTE_SAMPLE_RATE);
    expect(Array.from(bytes)).toEqual(
      Array.from(buildCsaveImage(source, 'HELLO')),
    );
  });

  it('refuses to build a broken or empty program', () => {
    expect(() => buildCsaveImage('', 'X')).toThrow(/empty/i);
    // A 0x00 byte cannot appear in a line body - it terminates the record.
    const bad = '10 PRINT "{0x00}"\n';
    expect(fatalErrors(altair8800.tokenize(bad).errors).length).toBeGreaterThan(
      0,
    );
    expect(() => buildCsaveImage(bad, 'X')).toThrow(/error/i);
  });
});
