// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Cassette decoding: recorded audio -> the records it carries, the inverse of
 * `cassetteEncoder.ts`.
 *
 * The tape is a square wave whose information is entirely in how long each
 * phase lasts, so recovery is: gate the waveform into edges, measure the phase
 * between them, and read the durations back.
 *
 * - a **leader** is a long run of phases all the same length;
 * - the **sync bit** is the one short phase that ends a leader, followed by an
 *   ordinary phase which is skipped;
 * - each **bit** is the next two phases, read as a `1` when the pair is long;
 * - a record ends where the next leader begins, or where the recording does,
 *   and its last byte is the checksum.
 *
 * Every threshold is a ratio of the leader phase that was just measured, never
 * an absolute duration, so a recorder running fast or slow - or a file at some
 * other sample rate - decodes the same. The ROM's own `RD2BIT` instead counts a
 * fixed number of loops, which is why a real Apple II is famously fussy about
 * tape speed; there is no reason to reproduce that.
 *
 * Throws when no valid signal is found, per the {@link import('../../types').Dialect}
 * `audio.decodeSamples` contract - a silent empty result would look to the
 * import dialog like a successfully-loaded empty program. A **checksum
 * mismatch is not that case**: the bytes are all there and readable, so they
 * come back with a warning rather than being thrown away, which is the only way
 * the user gets to see what a damaged tape actually held.
 */

import {
  LEADER_PHASE_CYCLES,
  ONE_PHASE_CYCLES,
  SYNC_SHORT_CYCLES,
  ZERO_PHASE_CYCLES,
  tapeChecksum,
} from './cassetteEncoder';
import { IMAGE_HEADER_BYTES } from '../basicImage';

const NO_SIGNAL = 'No cassette signal detected';
const NO_LENGTH_RECORD =
  'This tape has no two-byte length record in front of the program, so it is not one SAVE wrote';

/** A phase shorter than this fraction of the leader's is the sync bit. */
const SYNC_RATIO =
  (SYNC_SHORT_CYCLES + LEADER_PHASE_CYCLES) / 2 / LEADER_PHASE_CYCLES;

/** A cycle longer than this many leader phases is a `1` bit rather than a `0`. */
const BIT_SPLIT_RATIO =
  (sum(ZERO_PHASE_CYCLES) + sum(ONE_PHASE_CYCLES)) / 2 / LEADER_PHASE_CYCLES;

/** A phase at least this fraction of the leader's is leader rather than data. */
const LEADER_RATIO =
  (ONE_PHASE_CYCLES[0] + LEADER_PHASE_CYCLES) / 2 / LEADER_PHASE_CYCLES;

/**
 * Phases of one steady tone that make a leader.
 *
 * Twelve `1` bits in a row would otherwise end a record early. Real data
 * reaches that only as a run of `$FF`s, and the phases would still have to
 * measure longer than {@link LEADER_RATIO} of a leader recorded moments
 * earlier.
 */
const LEADER_PHASES = 24;

/** How far two phases of the same tone may differ before the run has ended. */
const TONE_TOLERANCE = 0.25;

/** One record read off the tape, with its trailing checksum already checked. */
export interface TapeBlock {
  /** The record's data, the checksum byte removed. */
  bytes: Uint8Array;
  /** Whether the checksum byte agreed with the data in front of it. */
  checksumOk: boolean;
}

export interface DecodeCassetteResult {
  /**
   * Always empty: an Apple II tape carries a length and a program, not a name.
   * The field is the seam's, and this is the honest answer to it.
   */
  programName: string;
  /** The length-prefixed image, as `basicImage.ts` builds it. */
  data: Uint8Array;
  /** What was wrong with the recording, where it was readable anyway. */
  warnings: string[];
}

/** Recover the program image on a recording, or throw if there isn't one. */
export function decodeCassette(
  samples: Float32Array,
  sampleRate: number,
): DecodeCassetteResult {
  const blocks = decodeApple2Tape(samples, sampleRate);
  if (blocks.length === 0) throw new Error(NO_SIGNAL);

  // `SAVE` writes the length first and the program second, so the tape is read
  // the same way round. Records after the second are concatenated onto it: a
  // long program recorded through a drop-out reads as two, and the bytes either
  // side of the gap are still the program's.
  const [length, ...rest] = blocks;
  if (length!.bytes.length !== IMAGE_HEADER_BYTES || rest.length === 0) {
    throw new Error(NO_LENGTH_RECORD);
  }

  const warnings: string[] = [];
  if (!length!.checksumOk) {
    warnings.push(
      'The length record’s checksum does not match, so the program length read off this tape may be wrong',
    );
  }
  if (rest.some((block) => !block.checksumOk)) {
    warnings.push(
      'The program record’s checksum does not match, so some of the bytes read off this tape are wrong',
    );
  }

  const program = concat(rest.map((block) => block.bytes));
  const declared = length!.bytes[0]! | (length!.bytes[1]! << 8);
  if (declared !== program.length) {
    warnings.push(
      `The tape declares ${declared} program bytes and carries ${program.length}; the ${program.length} that are there were read`,
    );
  }

  // The header is rebuilt from what was actually recovered rather than copied
  // off the tape, so the image is self-consistent even when the two disagreed -
  // the disagreement is in the warnings above, and reporting it twice would say
  // nothing more.
  const data = new Uint8Array(IMAGE_HEADER_BYTES + program.length);
  data[0] = program.length & 0xff;
  data[1] = (program.length >> 8) & 0xff;
  data.set(program, IMAGE_HEADER_BYTES);
  return { programName: '', data, warnings };
}

/**
 * Demodulate a recording into the records it holds, one entry per leader on the
 * tape and with no assumption about what the bytes mean. Exported so the
 * round-trip test can check the modulation on its own, without the two-record
 * layout on top.
 */
export function decodeApple2Tape(
  samples: Float32Array,
  sampleRate: number,
): TapeBlock[] {
  const phases = phaseLengths(samples, sampleRate);
  const blocks: TapeBlock[] = [];
  let at = 0;
  while (at < phases.length) {
    const sync = findSyncBit(phases, at);
    if (!sync) break;
    const record = readRecord(phases, sync.at, sync.leaderPhase);
    // A record with nothing but a checksum in it carried no data at all.
    if (record.bytes.length > 1) {
      const bytes = record.bytes.subarray(0, record.bytes.length - 1);
      blocks.push({
        bytes,
        checksumOk:
          record.bytes[record.bytes.length - 1] === tapeChecksum(bytes),
      });
    }
    at = Math.max(record.at, sync.at + 1);
  }
  return blocks;
}

interface SyncBit {
  /** Index of the first data phase, past the sync bit's own two phases. */
  at: number;
  /** Length of one leader phase, in samples: the reference every ratio scales. */
  leaderPhase: number;
}

/**
 * Find the next leader and the short phase that ends it.
 *
 * The tape is walked as runs of one steady tone - phases within
 * {@link TONE_TOLERANCE} of the run's first - because that is what a leader is,
 * and because the phase that breaks the run is exactly the sync bit the reader
 * is waiting for.
 */
function findSyncBit(phases: readonly number[], from: number): SyncBit | null {
  let i = from;
  while (i < phases.length) {
    const first = phases[i]!;
    let end = i + 1;
    while (
      end < phases.length &&
      phases[end]! > first * (1 - TONE_TOLERANCE) &&
      phases[end]! < first * (1 + TONE_TOLERANCE)
    ) {
      end++;
    }
    if (end - i >= LEADER_PHASES && end + 2 < phases.length) {
      const leaderPhase = median(phases.slice(i, end));
      if (phases[end]! < leaderPhase * SYNC_RATIO) {
        // Past the short phase and the ordinary one behind it, the data starts.
        return { at: end + 2, leaderPhase };
      }
    }
    i = end;
  }
  return null;
}

/** Read bits until the next leader starts or the recording ends. */
function readRecord(
  phases: readonly number[],
  from: number,
  leaderPhase: number,
): { bytes: Uint8Array; at: number } {
  const split = leaderPhase * BIT_SPLIT_RATIO;
  const leaderish = leaderPhase * LEADER_RATIO;
  const bits: number[] = [];
  let i = from;
  while (i + 1 < phases.length) {
    if (isLeader(phases, i, leaderish)) break;
    bits.push(phases[i]! + phases[i + 1]! > split ? 1 : 0);
    i += 2;
  }
  return { bytes: packBits(bits), at: i };
}

/** Whether a leader's worth of long phases starts here. */
function isLeader(
  phases: readonly number[],
  at: number,
  leaderish: number,
): boolean {
  if (at + LEADER_PHASES > phases.length) return false;
  for (let i = at; i < at + LEADER_PHASES; i++) {
    if (phases[i]! < leaderish) return false;
  }
  return true;
}

/** Most significant bit first, dropping a trailing part-byte. */
function packBits(bits: readonly number[]): Uint8Array {
  const out = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < out.length; i++) {
    let value = 0;
    for (let bit = 0; bit < 8; bit++) value = (value << 1) | bits[i * 8 + bit]!;
    out[i] = value;
  }
  return out;
}

function sum(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

function concat(blocks: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(blocks.reduce((n, b) => n + b.length, 0));
  let at = 0;
  for (const block of blocks) {
    out.set(block, at);
    at += block.length;
  }
  return out;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[sorted.length >> 1]!;
}

/**
 * Recover phase lengths (in samples) from the waveform: high-pass, then measure
 * the gap between successive zero crossings - one per phase of the square wave.
 * A Schmitt gate (+/-0.25 peak) only *confirms* that a crossing belongs to a real
 * phase rather than to noise; the length itself is timed at the crossing, where
 * the slope is steepest and a slowly-varying offset - a room echo on a
 * speaker-to-microphone recording - moves it least.
 */
function phaseLengths(samples: Float32Array, sampleRate: number): number[] {
  const hp = highPass(samples, sampleRate, 5);
  const peak = percentileAbs(hp, 0.99);
  if (peak < 1e-4) return [];
  const gate = peak * 0.25;

  const lengths: number[] = [];
  let state = 0; // -1 low, +1 high, 0 undecided
  let lastUp = -1;
  let lastDown = -1;
  let prev = -1; // last committed edge
  for (let i = 1; i < hp.length; i++) {
    if (hp[i - 1]! <= 0 && hp[i]! > 0) lastUp = i;
    else if (hp[i - 1]! >= 0 && hp[i]! < 0) lastDown = i;

    let edge = -1;
    if (state <= 0 && hp[i]! > gate) {
      edge = lastUp >= 0 ? lastUp : i;
      state = 1;
    } else if (state >= 0 && hp[i]! < -gate) {
      edge = lastDown >= 0 ? lastDown : i;
      state = -1;
    }
    if (edge < 0) continue;
    if (prev >= 0 && edge > prev) lengths.push(edge - prev);
    prev = edge;
  }
  return lengths;
}

/** One-pole high-pass: subtract a slow running mean to kill DC / baseline drift. */
function highPass(
  x: Float32Array,
  sampleRate: number,
  ms: number,
): Float32Array {
  const rc = ms / 1000;
  const dt = 1 / sampleRate;
  const alpha = dt / (rc + dt);
  const out = new Float32Array(x.length);
  const warm = Math.min(x.length, Math.round(2 * rc * sampleRate));
  let lp = 0;
  for (let i = 0; i < warm; i++) lp += x[i]!;
  lp = warm > 0 ? lp / warm : 0;
  for (let i = 0; i < x.length; i++) {
    lp += alpha * (x[i]! - lp);
    out[i] = x[i]! - lp;
  }
  return out;
}

function percentileAbs(x: Float32Array, p: number): number {
  const a = Float32Array.from(x, Math.abs).sort();
  const idx = Math.min(
    a.length - 1,
    Math.max(0, Math.floor(p * (a.length - 1))),
  );
  return a[idx]!;
}
