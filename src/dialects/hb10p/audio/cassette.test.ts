// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import {
  CASSETTE_SAMPLE_RATE,
  MSX_FRAMING,
  buildCassetteSamples,
  decodeCassette,
} from './cassette';
import { decodeKcsBytes } from '../../audio/kansasCity';
import {
  MARKER_COUNT,
  NAME_BYTES,
  TOKENIZED_MARKER,
  buildTokenizedBlocks,
} from '../casfile';
import { tokenizeProgram } from '../tokenizer';
import { addNoise, resample, scale } from '../../audio/tapeSignal';

const RATE = CASSETTE_SAMPLE_RATE;
const SOURCE = '10 SCREEN 2\n20 CIRCLE (128,96),60,15\n30 GOTO 30';

describe('hb10p cassette', () => {
  it('frames the tape as the BIOS does, two stop bits and all', () => {
    // 8N2 is what TAPOUT writes; decoding the same waveform as 8N1 would slip a
    // bit every byte, so this is the framing test as well as the block one.
    expect(MSX_FRAMING.stopBits).toBe(2);

    const samples = buildCassetteSamples(SOURCE, 'GAME');
    const bytes = decodeKcsBytes(samples, RATE, MSX_FRAMING);
    const [header, data] = buildTokenizedBlocks(
      tokenizeProgram(SOURCE).bytes,
      'GAME',
    );

    expect(Array.from(bytes.slice(0, MARKER_COUNT))).toEqual(
      new Array(MARKER_COUNT).fill(TOKENIZED_MARKER),
    );
    expect(Array.from(bytes)).toEqual([
      ...Array.from(header!),
      ...Array.from(data!),
    ]);
    expect(header).toHaveLength(MARKER_COUNT + NAME_BYTES);
  });

  it('round-trips a program through encode and decode', () => {
    const { programName, source } = decodeCassette(
      buildCassetteSamples(SOURCE, 'GAME'),
      RATE,
    );
    expect(programName).toBe('GAME');
    expect(source).toBe(SOURCE);
  });

  it('reads a recording back through noise, a bad level and speed drift', () => {
    const clean = buildCassetteSamples(SOURCE, 'GAME', true);
    const cases: [string, Float32Array, number][] = [
      ['noise', addNoise(clean, 0.2), RATE],
      ['half gain with a DC offset', scale(clean, 0.4, 0.15), RATE],
      // 3% fast, which is more than a tape motor drifts by.
      ['a fast tape', resample(clean, 1 / 1.03), RATE],
    ];
    for (const [name, samples, rate] of cases) {
      expect(decodeCassette(samples, rate).source, name).toBe(SOURCE);
    }
  });

  it('says so when the recording holds no tape file', () => {
    expect(() => decodeCassette(new Float32Array(RATE), RATE)).toThrow(
      'No MSX cassette file',
    );
  });
});
