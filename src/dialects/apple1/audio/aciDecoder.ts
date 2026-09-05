// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * ACI cassette decoding: recorded audio -> the memory ranges it carries, the
 * inverse of `aciEncoder.ts`.
 *
 * The card's tape is a square wave whose information is entirely in how long
 * each phase lasts, so recovery is: gate the waveform into edges, measure the
 * phase between them, and read the durations back. Nothing about the byte
 * stream is self-describing - an ACI tape has no name, no length, no checksum
 * and no directory - so the structure has to come from the timings:
 *
 * - a **leader** is a long run of phases all the same length;
 * - the **start bit** is the one short phase that ends a leader, followed by an
 *   ordinary long phase which is skipped;
 * - each **bit** is the next two phases, read as a `1` when the pair is long;
 * - the block ends where the next leader begins, or where the recording does.
 *
 * Every threshold is a ratio of the leader phase that was just measured, never
 * an absolute duration, so a recorder running fast or slow - or a file at some
 * other sample rate - decodes the same. The ratios are the midpoints between
 * the timings `aciEncoder.ts` derives from the PROM, which puts them wider apart
 * than the PROM's own tests: the card compares against fixed loop counts and is
 * famously fussy about tape speed, and there is no reason to reproduce that.
 *
 * Throws when no valid signal is found, per the {@link import('../../types').Dialect}
 * `audio.decodeSamples` contract - a silent empty result would look to the
 * import dialog like a successfully-loaded empty program.
 */

import {
  ACI_HEADER_PHASE_US,
  ACI_ONE_PHASE_US,
  ACI_START_PHASE_US,
  ACI_ZERO_PHASE_US,
} from './aciEncoder';
import {
  HIMEM,
  LOMEM,
  PP,
  RAM_TOP,
  ZP_BLOCK_BASE,
  ZP_BLOCK_BYTES,
} from '../addresses';

const NO_ACI_SIGNAL = 'No cassette signal detected';
const NO_HOUSEKEEPING =
  'This tape has no housekeeping block, so there is no way to find the program in it - record 4A.FF W as well as 800.FFF W';
const TRUNCATED = 'The recording ends part way through the program area';

/** A phase shorter than this fraction of the leader's is the start bit. */
const START_RATIO =
  (ACI_START_PHASE_US + ACI_HEADER_PHASE_US) / 2 / ACI_HEADER_PHASE_US;

/** A cycle longer than this many leader phases is a `1` bit rather than a `0`. */
const BIT_SPLIT_RATIO =
  (2 * ACI_ZERO_PHASE_US + 2 * ACI_ONE_PHASE_US) / 2 / ACI_HEADER_PHASE_US;

/** A phase at least this fraction of the leader's is leader rather than data. */
const LEADER_RATIO =
  (ACI_ONE_PHASE_US + ACI_HEADER_PHASE_US) / 2 / ACI_HEADER_PHASE_US;

/**
 * Phases of one steady tone that make a leader.
 *
 * Twelve `1` bits in a row would otherwise end a block early. Real data reaches
 * that only as a run of `$FF`s, and the phases would still have to measure
 * longer than {@link LEADER_RATIO} of a leader recorded moments earlier.
 */
const LEADER_PHASES = 24;

/** How far two phases of the same tone may differ before the run has ended. */
const TONE_TOLERANCE = 0.25;

export interface DecodeCassetteResult {
  /**
   * Always empty: an ACI tape carries a memory range, not a named file. The
   * field is the seam's, and this is the honest answer to it.
   */
  programName: string;
  /** The two ranges, laid end to end as `basicImage.ts` builds them. */
  data: Uint8Array;
}

/** Recover the program image on a recording, or throw if there isn't one. */
export function decodeCassette(
  samples: Float32Array,
  sampleRate: number,
): DecodeCassetteResult {
  const blocks = decodeAciTape(samples, sampleRate);
  if (blocks.length === 0) throw new Error(NO_ACI_SIGNAL);

  // The tape is a stream of ranges with nothing saying which is which, so the
  // housekeeping block is found by reading one: its LOMEM/HIMEM/PP have to
  // describe a workspace the rest of the tape can hold. Ranges after it are
  // concatenated first, so a block the decoder split in two - or a machine that
  // wrote the workspace as several `W` commands - still reads as one workspace.
  let truncated = false;
  for (let i = 0; i < blocks.length; i++) {
    const bytes = concat(blocks.slice(i));
    const span = workspaceSpan(bytes);
    if (span === null) continue;
    if (bytes.length < ZP_BLOCK_BYTES + span) {
      truncated = true;
      continue;
    }
    return { programName: '', data: bytes.slice(0, ZP_BLOCK_BYTES + span) };
  }
  throw new Error(truncated ? TRUNCATED : NO_HOUSEKEEPING);
}

/**
 * Demodulate a recording into the memory ranges it holds, one entry per leader
 * on the tape and with no assumption about what the bytes mean. Exported so the
 * round-trip test can check the modulation on its own, without the
 * housekeeping-block layout on top.
 */
export function decodeAciTape(
  samples: Float32Array,
  sampleRate: number,
): Uint8Array[] {
  const phases = phaseLengths(samples, sampleRate);
  const blocks: Uint8Array[] = [];
  let at = 0;
  while (at < phases.length) {
    const start = findStartBit(phases, at);
    if (!start) break;
    const block = readBlock(phases, start.at, start.leaderPhase);
    if (block.bytes.length > 0) blocks.push(block.bytes);
    at = Math.max(block.at, start.at + 1);
  }
  return blocks;
}

interface StartBit {
  /** Index of the first data phase, past the start bit's own two phases. */
  at: number;
  /** Length of one leader phase, in samples: the reference every ratio scales. */
  leaderPhase: number;
}

/**
 * Find the next leader and the short phase that ends it.
 *
 * The tape is walked as runs of one steady tone - phases within
 * {@link TONE_TOLERANCE} of the run's first - because that is what a leader is,
 * and because the phase that breaks the run is exactly the start bit the reader
 * is waiting for.
 */
function findStartBit(
  phases: readonly number[],
  from: number,
): StartBit | null {
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
      if (phases[end]! < leaderPhase * START_RATIO) {
        // Past the short phase and the ordinary one behind it, the data starts.
        return { at: end + 2, leaderPhase };
      }
    }
    i = end;
  }
  return null;
}

/** Read bits until the next leader starts or the recording ends. */
function readBlock(
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

/**
 * The workspace `bytes` describes, or null when its first {@link ZP_BLOCK_BYTES}
 * are not a housekeeping block.
 *
 * The test is that the pointers describe a workspace this machine could have
 * had: HIMEM above LOMEM, both inside the fitted RAM, and the program text
 * starting somewhere between them.
 */
function workspaceSpan(bytes: Uint8Array): number | null {
  if (bytes.length < ZP_BLOCK_BYTES) return null;
  const word = (address: number) =>
    bytes[address - ZP_BLOCK_BASE]! |
    (bytes[address - ZP_BLOCK_BASE + 1]! << 8);
  const lomem = word(LOMEM);
  const himem = word(HIMEM);
  const pp = word(PP);
  const sane =
    himem > lomem && himem <= RAM_TOP + 1 && pp >= lomem && pp <= himem;
  return sane ? himem - lomem : null;
}

function concat(blocks: readonly Uint8Array[]): Uint8Array {
  const total = blocks.reduce((n, b) => n + b.length, 0);
  const out = new Uint8Array(total);
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
