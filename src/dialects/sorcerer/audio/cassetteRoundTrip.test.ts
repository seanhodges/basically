// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { sorcerer } from '../index';
import { sorcererSamples } from '../samples';
import { PROGRAM_BASE } from '../addresses';
import { materializeSampleBlocks } from '../../../app/sampleBlocks';
import { decodeKcsBytes } from '../../audio/kansasCity';
import {
  CASSETTE_SAMPLE_RATE,
  SORCERER_FRAMING_300,
  SORCERER_FRAMING_1200,
  buildCassetteSamples,
  buildTapeRecords,
  encodeSorcererTape,
} from './cassetteEncoder';
import { decodeCassette } from './cassetteDecoder';
import { parseTapeRecords } from '../tapeFile';

/**
 * The smallest sample, because the cost of a cassette test is entirely the
 * waveform: a byte is eleven bits, so a program is ~9 ms of audio per byte at
 * 1200 baud and four times that at 300.
 */
const HELLO = sorcererSamples.find((s) => s.name === 'hello.bas')!;

/**
 * Short leaders for the same reason. The default two seconds of carrier is for
 * a real recorder finding its speed; the decoder only needs enough fast
 * half-cycles to measure one against.
 */
const QUICK = { leaderMs: 200, interRecordMs: 200, trailerMs: 100 } as const;

describe('sorcerer cassette audio', () => {
  it('round-trips a program through encode and decode at 1200 baud', () => {
    const samples = buildCassetteSamples(HELLO.text, 'HELLO', false);
    const decoded = decodeCassette(samples, CASSETTE_SAMPLE_RATE);

    expect(decoded.programName).toBe('HELLO');
    // Byte-exact, not merely runnable: the recovered text re-tokenizes to the
    // image the tape carried.
    expect(decoded.source.trimEnd()).toBe(HELLO.text.trimEnd());
    expect(decoded.warnings ?? []).toEqual([]);
    expect(decoded.blocks).toBeUndefined();
  });

  it('round-trips at 300 baud, which is what robust mode records', () => {
    const samples = buildCassetteSamples(HELLO.text, 'HELLO', true);
    // Four times the cycles per bit, so four times the recording - the one
    // check that robust mode really changed the rate and not just the leader.
    const fast = buildCassetteSamples(HELLO.text, 'HELLO', false);
    expect(samples.length).toBeGreaterThan(fast.length * 3);

    const decoded = decodeCassette(samples, CASSETTE_SAMPLE_RATE);
    expect(decoded.source.trimEnd()).toBe(HELLO.text.trimEnd());
  });

  it('carries the document’s memory blocks on the same tape', () => {
    const sample = sorcererSamples.find((s) => s.name === 'kaleido.bas')!;
    const blocks = materializeSampleBlocks(sorcerer, sample);
    const samples = encodeSorcererTape(
      buildTapeRecords(sample.text, 'KALEI', blocks),
      QUICK,
    );

    const decoded = decodeCassette(samples, CASSETTE_SAMPLE_RATE);
    expect(decoded.source.trimEnd()).toBe(sample.text.trimEnd());
    expect(decoded.blocks).toHaveLength(blocks.length);
    decoded.blocks!.forEach((block, i) => {
      expect(block.address).toBe(blocks[i]!.address);
      expect([...block.bytes]).toEqual([...blocks[i]!.bytes]);
    });
  });

  it('demodulates at whichever rate the recording used', () => {
    // Nothing in the signal declares its speed - the machine is told by its own
    // SE T= setting - so the decoder tries both. Check the demodulator itself
    // at each rate rather than only through the whole import path.
    for (const framing of [SORCERER_FRAMING_1200, SORCERER_FRAMING_300]) {
      const records = buildTapeRecords(HELLO.text, 'HELLO');
      const samples = encodeSorcererTape(records, { ...QUICK, framing });
      const bytes = decodeKcsBytes(samples, CASSETTE_SAMPLE_RATE, framing);
      const [record] = parseTapeRecords(bytes);
      expect(record!.loadAddress, `${1200 / framing.zeroCycles} baud`).toBe(
        PROGRAM_BASE,
      );
    }
  });

  it('reads a recording with no carrier leader at all', () => {
    // What a real Sorcerer writes: motor on, run-up in silence, then straight
    // into the record's hundred-byte lead. The leader this encoder adds is for
    // the recorder's benefit, so the decoder must not depend on it.
    const samples = encodeSorcererTape(buildTapeRecords(HELLO.text, 'HELLO'), {
      leaderMs: 0,
      interRecordMs: 0,
      trailerMs: 0,
    });
    expect(decodeCassette(samples, CASSETTE_SAMPLE_RATE).source.trimEnd()).toBe(
      HELLO.text.trimEnd(),
    );
  });

  it('throws when the samples carry no valid signal', () => {
    expect(() =>
      decodeCassette(new Float32Array(CASSETTE_SAMPLE_RATE), 44100),
    ).toThrow(/no cassette signal/i);
    // Noise is not silence: it demodulates to bytes, and those bytes are still
    // not a tape.
    const noise = Float32Array.from({ length: 44100 }, (_, i) =>
      Math.sin(i * 0.37) > 0 ? 0.8 : -0.8,
    );
    expect(() => decodeCassette(noise, 44100)).toThrow(/no cassette signal/i);
  });

  it('reports a corrupt record rather than half-decoding it', () => {
    const records = buildTapeRecords(HELLO.text, 'HELLO');
    // Flip a byte inside the program's data block, which its checksum covers.
    const record = records[0]!;
    record[record.length - 2] ^= 0xff;
    const samples = encodeSorcererTape(records, QUICK);

    expect(() => decodeCassette(samples, CASSETTE_SAMPLE_RATE)).toThrow(
      /data block checksum/,
    );
  });
});
