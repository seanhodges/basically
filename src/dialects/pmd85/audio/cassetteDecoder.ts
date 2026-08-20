// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * PMD 85 cassette decoding: recorded audio -> the bytes on the tape.
 *
 * The inverse of `cassetteEncoder.ts`, and it inverts the same three steps.
 * The signal is high-passed and Schmitt-gated into edges; the runs between
 * edges are measured in half-bit slots, of which a run can only ever be one or
 * two long, because the level changes at the middle of every bit; and the slots
 * are paired back into bits, then framed into bytes.
 *
 * Two things are only recoverable by trying:
 *
 * - **Where a bit begins.** Pairing the slots the other way round reads every
 *   bit half a period late, which is a different (and wrong) bit stream, and
 *   nothing in the waveform says which pairing is meant.
 * - **Which way up the tape is.** A recorder, a sound card or a cable may
 *   invert the signal, and inverting a phase-encoded tape inverts every bit
 *   rather than merely flipping a polarity that no one would notice.
 *
 * So all four combinations are decoded and the one that frames into the most
 * bytes wins. Framing is a real test rather than a formality here: a byte is
 * accepted only with its start bit low and both stop bits high, so a stream
 * read at the wrong offset or upside down collapses almost immediately.
 */

import { TAPE_BAUD } from './cassetteEncoder';

/** Longest run of one level that is signal rather than a gap, in half-bits. */
const MAX_RUN_SLOTS = 3;

/** Fewest bytes a decode must yield before it is believed to be a tape at all. */
const MIN_BYTES = 4;

/**
 * Recover the byte stream from recorded cassette audio.
 *
 * The result is the tape's blocks back to back with no framing between them,
 * which is exactly a `.pmd` image - so `parseTapeImage` reads it directly.
 * Throws when the recording holds no signal this decoder can frame.
 */
export function decodePmd85Tape(
  samples: Float32Array,
  sampleRate: number,
): Uint8Array {
  const slots = slotLevels(samples, sampleRate);
  if (slots.length === 0) {
    throw new Error('No cassette signal found in the recording');
  }

  let best = new Uint8Array(0);
  let bestScore = -1;
  for (const offset of [0, 1]) {
    for (const polarity of [1, -1]) {
      const bytes = frameBytes(slots, offset, polarity);
      // A decode that contains a header's FF/00/55 leader beats one that is
      // merely longer: at the wrong offset or upside down the framing still
      // accepts the occasional byte, and length alone would sometimes prefer
      // that noise to the real tape.
      const score = bytes.length + (hasHeaderSignature(bytes) ? 1e6 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = bytes;
      }
    }
  }
  if (best.length < MIN_BYTES) {
    throw new Error('No PMD 85 tape blocks found in the recording');
  }
  return best;
}

/** True when a header block's 16xFF / 16x00 / 16x55 leader appears anywhere. */
function hasHeaderSignature(bytes: Uint8Array): boolean {
  const runs: [number, number][] = [
    [0xff, 16],
    [0x00, 16],
    [0x55, 16],
  ];
  outer: for (let at = 0; at + 48 <= bytes.length; at++) {
    let p = at;
    for (const [value, count] of runs) {
      for (let i = 0; i < count; i++) {
        if (bytes[p++] !== value) continue outer;
      }
    }
    return true;
  }
  return false;
}

/**
 * The recording as a run of half-bit levels: +1, -1, or 0 for a gap.
 *
 * Silence between files reads as one enormous run, which becomes a single gap
 * marker; the framing above resynchronises there rather than carrying a
 * half-decoded byte across it.
 */
function slotLevels(samples: Float32Array, sampleRate: number): number[] {
  const hp = highPass(samples, sampleRate, 5);
  const peak = percentileAbs(hp, 0.99);
  if (peak < 1e-4) return [];
  const gate = peak * 0.25;
  const slotSamples = sampleRate / (TAPE_BAUD * 2);

  const slots: number[] = [];
  let state = 0; // -1 low, +1 high, 0 undecided
  let last = -1;
  const emit = (level: number, from: number, to: number): void => {
    const run = Math.round((to - from) / slotSamples);
    if (run <= 0) return;
    if (run > MAX_RUN_SLOTS) {
      slots.push(0);
      return;
    }
    for (let i = 0; i < run; i++) slots.push(level);
  };

  for (let i = 0; i < hp.length; i++) {
    const v = hp[i]!;
    let edge = false;
    if (state <= 0 && v > gate) {
      edge = state === -1;
      state = 1;
    } else if (state >= 0 && v < -gate) {
      edge = state === 1;
      state = -1;
    }
    if (!edge) continue;
    // The run that just ended carried the level the signal is leaving.
    if (last >= 0) emit(state === 1 ? -1 : 1, last, i);
    last = i;
  }
  return slots;
}

/**
 * Pair the slots into bits from `offset`, read them `polarity` way up, and
 * frame them into bytes.
 *
 * A pair whose halves are the same level is not a bit at all - it is where the
 * decode has lost the thread - so it resynchronises, as it does at a gap.
 */
function frameBytes(
  slots: readonly number[],
  offset: number,
  polarity: number,
): Uint8Array<ArrayBuffer> {
  const bytes: number[] = [];
  let p = offset;

  const nextBit = (): number | null => {
    if (p + 1 >= slots.length) {
      p = slots.length;
      return null;
    }
    const a = slots[p]!;
    const b = slots[p + 1]!;
    // A gap, or two halves at the same level, means the pairing has lost the
    // thread. Step one slot rather than two and let the next call try again:
    // that is what lets a second file, whose silence shifted every slot after
    // it by one, come back into phase on its own.
    if (a === 0 || b === 0 || a === b) {
      p += 1;
      return null;
    }
    p += 2;
    return a * polarity > 0 ? 1 : 0;
  };

  while (p + 1 < slots.length) {
    // The carrier between blocks is a run of 1 bits; a 0 is the start bit that
    // opens the next byte.
    const start = nextBit();
    if (start === null) continue;
    if (start === 1) continue;

    let byte = 0;
    let framed = true;
    for (let i = 0; i < 8 && framed; i++) {
      const bit = nextBit();
      if (bit === null) framed = false;
      else byte |= bit << i;
    }
    for (let i = 0; i < 2 && framed; i++) {
      // Only the first stop bit has to be there: the recording may end on the
      // last byte of a block, and half a stop bit is not a corrupt byte.
      const bit = nextBit();
      if (bit === 0) framed = false;
      else if (bit === null) framed = i > 0;
    }
    if (framed) bytes.push(byte);
  }
  return new Uint8Array(bytes);
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
