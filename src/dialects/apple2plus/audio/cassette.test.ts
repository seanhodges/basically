// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The tape framing this dialect owns, over a modulation it does not.
 *
 * The square wave itself - leader phases, sync bit, bit pairs, checksum, and
 * how forgivingly they are read back off a noisy or off-speed recording - is
 * the monitor's `WRITE`/`READ` and is tested against the ROM under
 * `apple2/audio/`. Nothing of that is repeated here: what these checks are
 * about is the two records `SAVE` wraps a program in and what comes back out of
 * them, including when the tape is damaged.
 */

import { describe, expect, it } from 'vitest';
import {
  CASSETTE_SAMPLE_RATE,
  HEADER_FLAG_BYTE,
  HEADER_RECORD_BYTES,
  SAVE_LEADER_COUNT,
  buildCassetteImage,
  buildCassetteSamples,
  cassetteRecords,
  decodeCassette,
} from './cassette';
import {
  ONE_PHASE_CYCLES,
  READ_HEADER_COUNT,
  ZERO_PHASE_CYCLES,
  encodeApple2Tape,
  leaderPhases,
  tapePhaseCycles,
} from '../../apple2/audio/cassetteEncoder';
import { CPU_HZ } from '../../../emulator/apple2/timing';
import { detokenizeProgram } from '../detokenizer';
import { tokenizeProgram } from '../tokenizer';

const SOURCE = '10 A = 1\n20 PRINT A\n30 GOTO 10\n';

/** A leader long enough to be found, without ten seconds of it per record. */
const SHORT = 64 / leaderPhases(SAVE_LEADER_COUNT);

describe('apple2plus cassette leaders', () => {
  it('outlast the settling delay READ spends before hunting for the sync bit', () => {
    // `READ` calls `HEADR` with $16 purely as a delay, so a leader shorter than
    // that is over before the machine starts listening. Applesoft writes both
    // of its records behind the same full-length one, so the margin is the same
    // either side of the header.
    const seconds = (count: number) => (leaderPhases(count) * 652) / CPU_HZ;
    expect(seconds(READ_HEADER_COUNT)).toBeGreaterThan(3.5);
    expect(seconds(SAVE_LEADER_COUNT)).toBeGreaterThan(10);
  });
});

describe('apple2plus cassette records', () => {
  it('are the header and the program SAVE writes, behind leaders of their own', () => {
    const { program } = tokenizeProgram(SOURCE);
    const [header, text] = cassetteRecords(buildCassetteImage(SOURCE));

    expect([...header!.bytes]).toEqual([
      program.length & 0xff,
      program.length >> 8,
      HEADER_FLAG_BYTE,
    ]);
    expect(header!.bytes).toHaveLength(HEADER_RECORD_BYTES);
    // Top bit clear, or `LOAD` skips the relink and leaves PRGEND stale.
    expect(HEADER_FLAG_BYTE & 0x80).toBe(0);

    // One byte longer than the program: `SAVE` writes TXTTAB through VARTAB
    // inclusive, and `READ` reads the same range back.
    expect([...text!.bytes]).toEqual([...program, 0]);
    expect(header!.headerCount).toBe(text!.headerCount);
  });

  it('refuses a program the machine could not load back', () => {
    // An empty program is the bare zero link and nothing else.
    expect(() => buildCassetteImage('')).toThrow(/empty/i);
    // A line the interpreter would not have accepted at its prompt.
    expect(() => buildCassetteImage('PRINT 1\n')).toThrow(/error/i);
  });

  it('round-trips a program through the modulation', () => {
    const { programName, data, warnings } = decodeCassette(
      buildCassetteSamples(SOURCE),
      CASSETTE_SAMPLE_RATE,
    );

    // An Apple II tape carries a length and a program, not a name.
    expect(programName).toBe('');
    expect(warnings).toEqual([]);
    expect([...data]).toEqual([...buildCassetteImage(SOURCE)]);
    expect(detokenizeProgram(data)).toBe(SOURCE);
  });

  it('round-trips in robust mode, which only lengthens the leaders', () => {
    const plain = buildCassetteSamples(SOURCE, false);
    const robust = buildCassetteSamples(SOURCE, true);
    expect(robust.length).toBeGreaterThan(plain.length);
    expect(
      detokenizeProgram(decodeCassette(robust, CASSETTE_SAMPLE_RATE).data),
    ).toBe(SOURCE);
  });

  it('reports silence rather than an empty program', () => {
    expect(() =>
      decodeCassette(new Float32Array(44_100), CASSETTE_SAMPLE_RATE),
    ).toThrow(/No cassette signal/);
  });

  it('refuses a tape with no header record in front of the program', () => {
    // The program on its own, as a tape recorded from part-way through would
    // hold: there is nothing to say how long it is meant to be.
    const [, text] = cassetteRecords(buildCassetteImage(SOURCE));
    expect(() =>
      decodeCassette(
        encodeApple2Tape([text!], { leaderScale: SHORT }),
        CASSETTE_SAMPLE_RATE,
      ),
    ).toThrow(/header record/);
  });
});

describe('apple2plus cassette damage', () => {
  /**
   * A tape carrying the right bytes behind a checksum that does not match them,
   * which is what a drop-out over one bit leaves. Built by hand because the
   * encoder computes the checksum for itself, as the machine does.
   */
  function tapeWithBadChecksum(): Float32Array {
    const phases = tapePhaseCycles(
      cassetteRecords(buildCassetteImage(SOURCE)),
      SHORT,
    );
    // The program record's last data byte is the one past the program's end,
    // which goes out zeroed; its phases are the sixteen before the checksum's,
    // and the trailer's one after that. Forcing a bit of it to a `1` leaves the
    // checksum on the tape describing what used to be there.
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
    // The damage landed on the byte past the program, so the program itself is
    // whole - which is the point of handing a bad tape over rather than
    // throwing it away.
    expect([...data]).toEqual([...buildCassetteImage(SOURCE)]);
  });

  it('says so when the header record and the program disagree', () => {
    const image = buildCassetteImage(SOURCE);
    const [, text] = cassetteRecords(image);
    const wrong = Uint8Array.of((image.length + 3) & 0xff, 0, HEADER_FLAG_BYTE);
    const { data, warnings } = decodeCassette(
      encodeApple2Tape(
        [{ bytes: wrong, headerCount: SAVE_LEADER_COUNT }, text!],
        { leaderScale: SHORT },
      ),
      CASSETTE_SAMPLE_RATE,
    );
    expect(warnings).toEqual([
      `The tape declares ${image.length + 3} program bytes and carries ${image.length}; the ${image.length} that are there were read`,
    ]);
    // What was recorded is what comes back: the tape's own arithmetic is
    // reported rather than believed.
    expect(detokenizeProgram(data)).toBe(SOURCE);
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
