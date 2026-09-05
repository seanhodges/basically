// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import {
  BITS_PER_BYTE,
  CASSETTE_SAMPLE_RATE,
  TAPE_BAUD,
  buildCassetteSamples,
  buildTapeFile,
  encodePmd85Tape,
} from './cassetteEncoder';
import { decodePmd85Tape } from './cassetteDecoder';
import { pmd85 } from '../index';
import { detokenizeProgram } from '../detokenizer';
import {
  buildPmdImage,
  parseTapeImage,
  programFromTapeFile,
  tapeBlocks,
  type Pmd85TapeFile,
} from '../tape';
import { PROGRAM_BASE } from '../addresses';

const SOURCE = '10 PRINT "TAPE"\n20 END\n';

/** Deterministic pseudo-random noise, so the robustness tests do not flake. */
function noise(length: number, level: number): Float32Array {
  let seed = 0x2401;
  return Float32Array.from({ length }, () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return ((seed / 0x7fffffff) * 2 - 1) * level;
  });
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

/** Count edges over a window, which on this tape is 2 per bit period. */
function edgesPerSecond(
  samples: Float32Array,
  fromSec: number,
  toSec: number,
): number {
  const from = Math.round(fromSec * CASSETTE_SAMPLE_RATE);
  const to = Math.round(toSec * CASSETTE_SAMPLE_RATE);
  let edges = 0;
  for (let i = from + 1; i < to; i++) {
    if (Math.sign(samples[i]!) !== Math.sign(samples[i - 1]!)) edges++;
  }
  return edges / (toSec - fromSec);
}

describe('PMD 85 cassette modulation', () => {
  const file = (): Pmd85TapeFile => buildTapeFile(SOURCE, 'TAPE');

  it('carries a 1200 Hz square wave through the leader', () => {
    // A leader is a run of 1 bits, and a 1 bit is one whole cycle of the
    // clock - so the carrier is the bit rate, not twice it.
    const samples = encodePmd85Tape([file()], {
      headerLeaderMs: 500,
      bodyLeaderMs: 100,
      tailMs: 100,
    });
    expect(edgesPerSecond(samples, 0.05, 0.45)).toBeCloseTo(2 * TAPE_BAUD, -2);
  });

  it('spends eleven bit periods on every byte', () => {
    const one = encodePmd85Tape([file()], {
      headerLeaderMs: 0,
      bodyLeaderMs: 0,
      tailMs: 0,
    });
    const blocks = tapeBlocks([file()]);
    const bytes = blocks[0]!.length + blocks[1]!.length;
    const seconds = one.length / CASSETTE_SAMPLE_RATE;
    expect(seconds).toBeCloseTo((bytes * BITS_PER_BYTE) / TAPE_BAUD, 3);
  });

  it('decodes back to exactly the bytes SAVE would have written', () => {
    const samples = buildCassetteSamples(SOURCE, 'TAPE', false);
    expect(Array.from(decodePmd85Tape(samples, CASSETTE_SAMPLE_RATE))).toEqual(
      Array.from(buildPmdImage(file())),
    );
  });

  it('reads a tape recorded upside down', () => {
    // Phase encoding has no idle level to give the polarity away: inverting the
    // signal inverts every bit, so the decoder has to work out which way up the
    // recording is rather than shrug at it.
    const samples = buildCassetteSamples(SOURCE, 'TAPE', false);
    const flipped = Float32Array.from(samples, (v) => -v);
    expect(Array.from(decodePmd85Tape(flipped, CASSETTE_SAMPLE_RATE))).toEqual(
      Array.from(buildPmdImage(file())),
    );
  });

  it('survives noise, a quiet recording and a baseline offset', () => {
    const clean = buildCassetteSamples(SOURCE, 'TAPE', false);
    const expected = Array.from(buildPmdImage(file()));
    const hiss = noise(clean.length, 0.08);
    const cases: [string, Float32Array][] = [
      ['hiss', Float32Array.from(clean, (v, i) => v + hiss[i]!)],
      ['quiet', Float32Array.from(clean, (v) => v * 0.05)],
      ['DC offset', Float32Array.from(clean, (v) => v + 0.4)],
    ];
    for (const [label, samples] of cases) {
      expect(
        Array.from(decodePmd85Tape(samples, CASSETTE_SAMPLE_RATE)),
        label,
      ).toEqual(expected);
    }
  });

  it('survives a recorder running off speed', () => {
    const samples = buildCassetteSamples(SOURCE, 'TAPE', false);
    for (const rate of [32_000, 48_000]) {
      const played = resample(samples, CASSETTE_SAMPLE_RATE, rate);
      expect(Array.from(decodePmd85Tape(played, rate))).toEqual(
        Array.from(buildPmdImage(file())),
      );
    }
  });

  it('reads a tape with more than one file on it', () => {
    const data: Pmd85TapeFile = {
      header: { number: 2, type: 0x44, start: 0x7000, name: 'SCORES' },
      bytes: Uint8Array.of(1, 2, 3, 4, 5),
    };
    const samples = encodePmd85Tape([file(), data], {
      headerLeaderMs: 400,
      bodyLeaderMs: 200,
      gapMs: 600,
    });
    const parse = parseTapeImage(
      decodePmd85Tape(samples, CASSETTE_SAMPLE_RATE),
    );
    expect(parse.warnings).toEqual([]);
    expect(parse.files.map((f) => f.header.name)).toEqual(['TAPE', 'SCORES']);
    expect(Array.from(parse.files[1]!.bytes)).toEqual([1, 2, 3, 4, 5]);
  });

  it('records a longer leader in robust mode', () => {
    expect(buildCassetteSamples(SOURCE, 'TAPE', true).length).toBeGreaterThan(
      buildCassetteSamples(SOURCE, 'TAPE', false).length,
    );
  });

  it('finds nothing in silence, and nothing in a plain tone', () => {
    expect(() =>
      decodePmd85Tape(new Float32Array(44_100), CASSETTE_SAMPLE_RATE),
    ).toThrow(/No cassette signal/);
    // A steady 1 kHz tone: real audio, no framing in it.
    const tone = Float32Array.from({ length: 44_100 }, (_, i) =>
      Math.sign(Math.sin((2 * Math.PI * 1000 * i) / CASSETTE_SAMPLE_RATE)),
    );
    expect(() => decodePmd85Tape(tone, CASSETTE_SAMPLE_RATE)).toThrow(
      /No PMD 85 tape blocks/,
    );
  });
});

describe('the dialect cassette seam', () => {
  const source = pmd85.samples.find((s) => s.name === 'hello.bas')!.text;

  it('recovers the program and the name off the header', () => {
    const audio = pmd85.audio!;
    const samples = audio.buildSamples(source, 'HELLO', false);
    const decoded = audio.decodeSamples!(samples, audio.sampleRate);
    expect(decoded.programName).toBe('HELLO');
    expect(decoded.warnings).toEqual([]);
    expect(decoded.source).toBe(source);
  });

  it('loads the exported tape back through the import path', () => {
    // What `.ptp` import does with a recording's worth of bytes: the same
    // parser, so the two ways in cannot disagree.
    const file = buildTapeFile(source, 'HELLO');
    const parse = parseTapeImage(
      decodePmd85Tape(
        buildCassetteSamples(source, 'HELLO', false),
        CASSETTE_SAMPLE_RATE,
      ),
    );
    expect(parse.files[0]!.header.start).toBe(PROGRAM_BASE);
    expect(detokenizeProgram(programFromTapeFile(parse.files[0]!))).toBe(
      source,
    );
    expect(Array.from(parse.files[0]!.bytes)).toEqual(Array.from(file.bytes));
  });
});
