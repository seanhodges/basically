// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import {
  CASSETTE_SAMPLE_RATE,
  FIRST_HEADER_COUNT,
  READ_HEADER_COUNT,
  SECOND_HEADER_COUNT,
  buildCassetteImage,
  buildCassetteSamples,
  cassetteRecords,
  ONE_PHASE_CYCLES,
  ZERO_PHASE_CYCLES,
  encodeApple2Tape,
  leaderPhases,
  tapeChecksum,
  tapePhaseCycles,
} from './cassetteEncoder';
import { decodeApple2Tape, decodeCassette } from './cassetteDecoder';
import { CPU_HZ } from '../../../emulator/apple2/timing';
import { addNoise, resample, scale } from '../../audio/tapeSignal';
import { parseBasicImage } from '../basicImage';
import { detokenizeProgram } from '../detokenizer';
import { tokenizeProgram } from '../tokenizer';

const SOURCE = '10 A=1\n20 PRINT A\n30 GOTO 10';

/** A leader long enough to be found, without ten seconds of it per record. */
const SHORT = 64 / leaderPhases(FIRST_HEADER_COUNT);

const record = (bytes: number[], headerCount = FIRST_HEADER_COUNT) => ({
  bytes: Uint8Array.from(bytes),
  headerCount,
});

describe('apple2 cassette leaders', () => {
  it('outlast the settling delay READ spends before hunting for the sync bit', () => {
    // `READ` calls `HEADR` with $16 purely as a delay, so a leader shorter than
    // that is over before the machine starts listening. Both of `SAVE`'s are
    // longer, and the second - the short one - is what sets the margin.
    const seconds = (count: number) => (leaderPhases(count) * 652) / CPU_HZ;
    expect(seconds(READ_HEADER_COUNT)).toBeGreaterThan(3.5);
    expect(seconds(SECOND_HEADER_COUNT)).toBeGreaterThan(
      seconds(READ_HEADER_COUNT),
    );
    expect(seconds(FIRST_HEADER_COUNT)).toBeGreaterThan(10);
  });
});

describe('apple2 cassette modulation', () => {
  it('round-trips arbitrary bytes, checksum and all', () => {
    const bytes = [0x00, 0xff, 0x80, 0x01, 0x4a, 0xa5];
    const blocks = decodeApple2Tape(
      encodeApple2Tape([record(bytes)], { leaderScale: SHORT }),
      CASSETTE_SAMPLE_RATE,
    );
    expect(blocks).toHaveLength(1);
    expect([...blocks[0]!.bytes]).toEqual(bytes);
    expect(blocks[0]!.checksumOk).toBe(true);
  });

  it('keeps two records apart, because each is written behind its own leader', () => {
    const first = [1, 2, 3];
    const second = [4, 5, 6, 7];
    const blocks = decodeApple2Tape(
      encodeApple2Tape([record(first), record(second, SECOND_HEADER_COUNT)], {
        leaderScale: SHORT,
      }),
      CASSETTE_SAMPLE_RATE,
    );
    expect(blocks.map((b) => [...b.bytes])).toEqual([first, second]);
  });

  it('follows a recorder running fast or slow, having no absolute timings', () => {
    const bytes = [0x0f, 0xf0, 0x55];
    const samples = encodeApple2Tape([record(bytes)], { leaderScale: SHORT });
    // Same waveform, told it was sampled 8% faster / slower: every threshold
    // scales off the leader that was just measured, so both still decode.
    for (const rate of [
      CASSETTE_SAMPLE_RATE * 0.92,
      CASSETTE_SAMPLE_RATE * 1.08,
    ]) {
      expect(decodeApple2Tape(samples, rate).map((b) => [...b.bytes])).toEqual([
        bytes,
      ]);
    }
  });

  it('survives a badly recorded tape: noise, a mis-set level and speed drift', () => {
    const bytes = [0x4a, 0x00, 0xff, 0xa5, 0x2d];
    const clean = encodeApple2Tape([record(bytes)], { leaderScale: SHORT });
    const dirty = addNoise(scale(resample(clean, 1.03), 0.35, 0.12), 0.05);
    const blocks = decodeApple2Tape(dirty, CASSETTE_SAMPLE_RATE);
    expect(blocks.map((b) => [...b.bytes])).toEqual([bytes]);
    expect(blocks[0]!.checksumOk).toBe(true);
  });

  it('reads a tape written to the round figures rather than the ROM’s', () => {
    // What another Apple II tool puts on tape: the 250us/500us half-cycles and
    // the 650us leader the manuals quote, at a flat 1 MHz rather than this
    // machine's 1.0205. No fixture of a real recording ships (there is none in
    // the project's licence-clean sources), so the foreign case is pinned by
    // building one from the published figures.
    //
    // The bits below are laid out most significant bit first, so this is also
    // what pins the bit order: the round trip above would pass either way.
    const bytes = [0x4a, 0x00, 0xff, 0x2d];
    const us: number[] = [];
    for (let i = 0; i < 64; i++) us.push(650);
    us.push(200, 250);
    for (const byte of [...bytes, tapeChecksum(Uint8Array.from(bytes))]) {
      for (let bit = 7; bit >= 0; bit--) {
        const phase = (byte >> bit) & 1 ? 500 : 250;
        us.push(phase, phase);
      }
    }
    us.push(5000);

    const blocks = decodeApple2Tape(
      renderPhases(us, CASSETTE_SAMPLE_RATE / 1e6),
      CASSETTE_SAMPLE_RATE,
    );
    expect(blocks.map((b) => [...b.bytes])).toEqual([bytes]);
    expect(blocks[0]!.checksumOk).toBe(true);
  });

  it('finds the data after silence and noise in front of the leader', () => {
    const bytes = [0x12, 0x34];
    const tape = encodeApple2Tape([record(bytes)], { leaderScale: SHORT });
    const lead = new Float32Array(4410);
    for (let i = 0; i < lead.length; i++) {
      // A few cycles of hum, well below the signal, then quiet.
      lead[i] = i < 2205 ? 0.02 * Math.sin((i / 40) * Math.PI) : 0;
    }
    const noisy = new Float32Array(lead.length + tape.length);
    noisy.set(lead, 0);
    noisy.set(tape, lead.length);
    expect(
      decodeApple2Tape(noisy, CASSETTE_SAMPLE_RATE).map((b) => [...b.bytes]),
    ).toEqual([bytes]);
  });
});

describe('apple2 cassette records', () => {
  it('are the length and the program SAVE writes, behind leaders of their own', () => {
    const image = buildCassetteImage(SOURCE);
    const { program } = tokenizeProgram(SOURCE);
    const [length, text] = cassetteRecords(image);

    expect([...length!.bytes]).toEqual([
      program.length & 0xff,
      program.length >> 8,
    ]);
    expect([...text!.bytes]).toEqual([...program]);
    // The program's leader is the shorter of the two, as `SAVE` writes them.
    expect(text!.headerCount).toBeLessThan(length!.headerCount);
  });

  it('refuses a program the machine could not load back', () => {
    expect(() => buildCassetteImage('')).toThrow(/empty/i);
    expect(() => buildCassetteImage('10 PRINT "')).toThrow(/error/i);
  });

  it('round-trips a program through the modulation', () => {
    const samples = buildCassetteSamples(SOURCE);
    const { programName, data, warnings } = decodeCassette(
      samples,
      CASSETTE_SAMPLE_RATE,
    );

    // An Apple II tape carries a length and a program, not a name.
    expect(programName).toBe('');
    expect(warnings).toEqual([]);
    expect([...data]).toEqual([...buildCassetteImage(SOURCE)]);
    expect(detokenizeProgram(parseBasicImage(data).program)).toBe(SOURCE);
  });

  it('round-trips in robust mode, which only lengthens the leaders', () => {
    const plain = buildCassetteSamples(SOURCE, false);
    const robust = buildCassetteSamples(SOURCE, true);
    expect(robust.length).toBeGreaterThan(plain.length);
    const { data } = decodeCassette(robust, CASSETTE_SAMPLE_RATE);
    expect(detokenizeProgram(parseBasicImage(data).program)).toBe(SOURCE);
  });

  it('reports silence rather than an empty program', () => {
    expect(() =>
      decodeCassette(new Float32Array(44_100), CASSETTE_SAMPLE_RATE),
    ).toThrow(/No cassette signal/);
  });

  it('refuses a tape with no length record in front of the program', () => {
    // The program on its own, as a tape recorded from part-way through would
    // hold: there is nothing to say how long it is meant to be.
    const [, text] = cassetteRecords(buildCassetteImage(SOURCE));
    expect(() =>
      decodeCassette(
        encodeApple2Tape([text!], { leaderScale: SHORT }),
        CASSETTE_SAMPLE_RATE,
      ),
    ).toThrow(/length record/);
  });
});

describe('apple2 cassette damage', () => {
  /**
   * A tape carrying the right bytes behind a checksum that does not match them,
   * which is what a drop-out over one bit leaves. Built by hand because the
   * encoder computes the checksum for itself, as the machine does.
   */
  function tapeWithBadChecksum(): Float32Array {
    const image = buildCassetteImage(SOURCE);
    const phases = tapePhaseCycles(cassetteRecords(image), SHORT);
    // The last data byte's phases are the sixteen before the checksum's, and
    // the trailer's one after it. Its top bit is a `0` in every program this
    // machine stores - the high half of a line's length - so forcing it to a
    // `1` leaves the checksum on the tape describing what used to be there.
    const flip = phases.length - 1 - 16 - 16;
    expect(phases.slice(flip, flip + 2)).toEqual([...ZERO_PHASE_CYCLES]);
    phases.splice(flip, 2, ...ONE_PHASE_CYCLES);
    return renderPhases(phases, CASSETTE_SAMPLE_RATE / CPU_HZ);
  }

  it('reports a checksum mismatch as a warning, and still hands the bytes over', () => {
    const { data, warnings } = decodeCassette(
      tapeWithBadChecksum(),
      CASSETTE_SAMPLE_RATE,
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/checksum/i);
    // The whole program is there, one byte the worse - a damaged tape the user
    // can see is worth more than a thrown error.
    const clean = buildCassetteImage(SOURCE);
    expect(data).toHaveLength(clean.length);
    expect([...data].filter((byte, i) => byte !== clean[i])).toHaveLength(1);
  });

  it('says so when the length record and the program disagree', () => {
    const { program } = tokenizeProgram(SOURCE);
    const wrong = Uint8Array.of((program.length + 3) & 0xff, 0);
    const { data, warnings } = decodeCassette(
      encodeApple2Tape(
        [record([...wrong]), record([...program], SECOND_HEADER_COUNT)],
        { leaderScale: SHORT },
      ),
      CASSETTE_SAMPLE_RATE,
    );
    expect(warnings).toEqual([
      `The tape declares ${program.length + 3} program bytes and carries ${program.length}; the ${program.length} that are there were read`,
    ]);
    // The header is rebuilt from what was recovered, so what comes back still
    // parses as an image rather than compounding the tape's own mistake.
    expect(detokenizeProgram(parseBasicImage(data).program)).toBe(SOURCE);
  });
});

/** Paint phase durations as a square wave; `perUnit` scales them to samples. */
function renderPhases(
  phases: readonly number[],
  perUnit: number,
): Float32Array {
  const total = phases.reduce((a, b) => a + b, 0);
  const out = new Float32Array(Math.round(total * perUnit));
  let elapsed = 0;
  let at = 0;
  phases.forEach((length, i) => {
    elapsed += length;
    const end = Math.min(out.length, Math.round(elapsed * perUnit));
    out.fill(i % 2 === 0 ? 0.7 : -0.7, at, end);
    at = end;
  });
  return out;
}
