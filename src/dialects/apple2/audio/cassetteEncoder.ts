// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The Apple II's cassette output: a tokenized program -> the audio `SAVE`
 * would have recorded.
 *
 * Every number below was measured off `public/roms/apple2.rom` itself, by
 * running the monitor's `WRITE` routine at `$FECD` on the vendored 6502 core
 * and timing the accesses it makes to the cassette-output flip-flop at `$C020`
 * (`cassetteRom.test.ts` re-derives them from the ROM on every run). They are
 * therefore in **CPU cycles**, the unit the routine actually counts in, and
 * become seconds only through the machine's own 1.0205 MHz average clock - see
 * `emulator/apple2/timing.ts` for why that is not the nominal 1.023 MHz.
 *
 * The modulation is Woz's again, one full cycle per data bit with the bit
 * carried by the cycle's *length* - the same idea as the Apple I's ACI card,
 * whose card-PROM version is in `apple1/audio/aciEncoder.ts`. What differs is
 * everything around it, so nothing here was copied across:
 *
 * - `WRBIT` delays with Y and adds a second loop when the carry - the bit being
 *   written - is set, giving a `0` a ~500-cycle cycle (2 kHz) and a `1` a
 *   ~1000-cycle one (1 kHz).
 * - `HEADR` writes a leader of 652-cycle phases (~780 Hz), then leaves Y short
 *   and falls into `WRBIT`, so the leader ends with one 195-cycle phase. That
 *   short phase is the sync bit, and it is what tells a reader where the data
 *   begins.
 * - **The framing is the Apple II's own:** the data is followed by a checksum
 *   byte, the exclusive-OR of every data byte seeded with `$FF`, which `READ`
 *   compares and answers `ERR` on. The ACI has no checksum at all.
 * - `SAVE` writes **two records**, each behind a leader of its own: a two-byte
 *   one holding the program's length, then the program text. That is exactly
 *   the length-prefixed image `basicImage.ts` builds, split at its header.
 */

import { buildImageOrThrow } from '../../targetHelpers';
import { CPU_HZ } from '../../../emulator/apple2/timing';
import { buildBasicImage, IMAGE_HEADER_BYTES } from '../basicImage';
import { tokenizeProgram } from '../tokenizer';

/** Sample rate the encoder emits at. */
export const CASSETTE_SAMPLE_RATE = 44_100;

/**
 * One phase of the leader tone: `HEADR`'s Y = $4B delay plus the carry's own
 * Y = $32 loop, which the routine keeps set throughout. ~780 Hz.
 */
export const LEADER_PHASE_CYCLES = 652;

/**
 * The short phase that ends the leader, from the Y = $21 `HEADR` leaves behind
 * as it falls into `WRBIT`, and the ordinary phase that follows it. Together
 * they are the sync bit - the only mark on the tape that says the data starts
 * here.
 */
export const SYNC_SHORT_CYCLES = 195;
export const SYNC_LONG_CYCLES = 250;

/**
 * The two phases of each bit.
 *
 * They are not equal, and the few cycles between them are not a rounding: the
 * first phase of a bit is reached through `WRBYTE`'s `ASL`/`JSR` and the second
 * by falling through `WRBIT`'s two `INY`s, so the same delay loop is entered
 * with Y two apart. No reader can tell - the ROM's own `RD2BIT` times the pair
 * with one counter - but a tape written to the round 250/500 figures the
 * manuals quote is a tidied version of this, not the machine's.
 */
export const ZERO_PHASE_CYCLES = [253, 250] as const;
export const ONE_PHASE_CYCLES = [503, 500] as const;

/**
 * Leader phases `HEADR` writes for a given count in A: 256 per pass of its
 * outer loop, which runs `count + 1` times, less the one the sync bit consumes.
 */
export function leaderPhases(count: number): number {
  return (count + 1) * 256 - 1;
}

/**
 * The counts `SAVE` passes: `$40` in front of the length record and `$1A` in
 * front of the program, which is why the second leader is audibly the shorter.
 * `READ` in turn spends {@link READ_HEADER_COUNT} letting the tape settle
 * before it starts hunting for a sync bit, so neither leader may be trimmed
 * below ~3.8 seconds or a real machine never sees the data behind it.
 */
export const FIRST_HEADER_COUNT = 0x40;
export const SECOND_HEADER_COUNT = 0x1a;
export const READ_HEADER_COUNT = 0x16;

/**
 * What the checksum starts at, on both sides.
 *
 * `$FF` is not a constant in the ROM: `HEADR` ends by subtracting its way down
 * to a borrow, which always leaves A = `$FF` whatever count it was given, and
 * both `WRITE` and `READ` take the accumulator they get back as the seed. So
 * the value is the same for every record and neither routine names it.
 */
export const CHECKSUM_SEED = 0xff;

/**
 * Silence-free tail after the last phase, in cycles.
 *
 * The flip-flop toggles at the *end* of every phase, so on the machine the last
 * bit still finishes with an edge and the line then rests at that level. A
 * recording has to carry that final edge too - without it the last phase has no
 * end to be measured against and the last bit is lost.
 */
export const TRAILER_CYCLES = 5_000;

/** One record as the tape carries it: bytes, behind a leader of its own. */
export interface TapeRecord {
  bytes: Uint8Array;
  /** The count `HEADR` is called with, not the phase count it produces. */
  headerCount: number;
}

export interface Apple2TapeOptions {
  sampleRate?: number; // default CASSETTE_SAMPLE_RATE
  amplitude?: number; // default 0.85
  /** Scales every record's leader; 1 is the ROM's own length. */
  leaderScale?: number;
}

/** The exclusive-OR checksum `WRITE` appends and `READ` compares. */
export function tapeChecksum(bytes: Uint8Array): number {
  let sum = CHECKSUM_SEED;
  for (const byte of bytes) sum ^= byte;
  return sum;
}

/**
 * Modulate records as cassette audio, each behind its own leader and followed
 * by its checksum byte.
 *
 * Bytes go out most-significant bit first: `WRBYTE` shifts the byte left with
 * `ASL` and writes whatever lands in the carry, and `RDBYTE` rebuilds it with
 * `ROL`.
 */
export function encodeApple2Tape(
  records: readonly TapeRecord[],
  opts: Apple2TapeOptions = {},
): Float32Array {
  return renderPhases(
    tapePhaseCycles(records, opts.leaderScale ?? 1),
    opts.sampleRate ?? CASSETTE_SAMPLE_RATE,
    opts.amplitude ?? 0.85,
  );
}

/**
 * The tape as the durations between successive flips of the cassette output,
 * in CPU cycles - the form the ROM's own `WRITE` routine produces and the one
 * `cassetteRom.test.ts` compares against it. {@link encodeApple2Tape} is this
 * painted as a square wave.
 */
export function tapePhaseCycles(
  records: readonly TapeRecord[],
  leaderScale = 1,
): number[] {
  const phases: number[] = [];
  for (const record of records) {
    const count = Math.round(leaderPhases(record.headerCount) * leaderScale);
    for (let i = 0; i < count; i++) phases.push(LEADER_PHASE_CYCLES);
    phases.push(SYNC_SHORT_CYCLES, SYNC_LONG_CYCLES);
    for (const byte of record.bytes) pushByte(phases, byte);
    pushByte(phases, tapeChecksum(record.bytes));
  }
  phases.push(TRAILER_CYCLES);
  return phases;
}

function pushByte(phases: number[], byte: number): void {
  for (let bit = 7; bit >= 0; bit--) {
    phases.push(...((byte >> bit) & 1 ? ONE_PHASE_CYCLES : ZERO_PHASE_CYCLES));
  }
}

/**
 * Paint a list of phase durations as a square wave, one polarity per phase.
 *
 * Sample boundaries are computed from the running total rather than accumulated
 * per phase, so a tape tens of seconds long cannot drift away from the timings
 * above.
 */
function renderPhases(
  phaseCycles: readonly number[],
  sampleRate: number,
  amplitude: number,
): Float32Array {
  const perCycle = sampleRate / CPU_HZ;
  let total = 0;
  for (const cycles of phaseCycles) total += cycles;
  const out = new Float32Array(Math.round(total * perCycle));
  let elapsed = 0;
  let at = 0;
  for (let i = 0; i < phaseCycles.length; i++) {
    elapsed += phaseCycles[i]!;
    const end = Math.min(out.length, Math.round(elapsed * perCycle));
    out.fill(i % 2 === 0 ? amplitude : -amplitude, at, end);
    at = end;
  }
  return out;
}

/**
 * Tokenize `source` and build the image `SAVE` writes: the two-byte length
 * followed by the program text.
 *
 * Throws rather than exporting a broken or empty program - a tape whose length
 * record disagrees with the program behind it loads as a workspace full of
 * nothing rather than failing loudly.
 */
export function buildCassetteImage(source: string): Uint8Array {
  const { program, errors, workspace } = tokenizeProgram(source);
  return buildBasicImage(
    buildImageOrThrow({ bytes: program, errors }),
    workspace,
  );
}

/** Split a built image at its header, into the two records `SAVE` writes. */
export function cassetteRecords(image: Uint8Array): TapeRecord[] {
  return [
    {
      bytes: image.subarray(0, IMAGE_HEADER_BYTES),
      headerCount: FIRST_HEADER_COUNT,
    },
    {
      bytes: image.subarray(IMAGE_HEADER_BYTES),
      headerCount: SECOND_HEADER_COUNT,
    },
  ];
}

/**
 * Build the cassette audio for a program (used by play + wav).
 *
 * Robust mode doubles both leaders and nothing else: the bit timings are the
 * ROM's, not a parameter, and a reader that cannot follow them is not going to
 * be helped by stretching them.
 */
export function buildCassetteSamples(
  source: string,
  robust = false,
): Float32Array {
  return encodeApple2Tape(cassetteRecords(buildCassetteImage(source)), {
    leaderScale: robust ? 2 : 1,
  });
}
