// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * 88-ACR cassette decoding: recorded audio -> `CSAVE` bytes, the inverse of
 * `cassetteEncoder.ts`.
 *
 * The modulation is continuous-phase FSK at 300 baud - 2400 Hz mark, 1850 Hz
 * space - so unlike the Acorn tapes there is no whole number of cycles per bit
 * to count, and a bit boundary can fall anywhere inside a cycle. Recovery is
 * therefore what a UART does with a modem: turn the waveform into an
 * instantaneous mark/space level, find the falling edge that opens a start bit,
 * and sample the following ten bit cells at their centres, re-syncing on every
 * byte so tape speed error accumulates over one byte rather than the whole
 * recording.
 *
 * Classifying a half-cycle uses the same threshold the hardware does: the
 * 88-ACR reproduction splits mark from space at a 471 µs period (~2123 Hz),
 * midway between the two tones, and that is wide enough either side to survive
 * a recorder running fast or slow. Nothing here assumes the encoder's own
 * sample rate.
 *
 * Throws when no valid signal is found, per the {@link import('../../types').Dialect}
 * `audio.decodeSamples` contract - a silent empty result would look to the
 * import dialog like a successfully-loaded empty program.
 */

import { findCsaveFile } from '../csaveFile';
import { ACR_BAUD, ACR_MARK_HZ, ACR_SPACE_HZ } from './cassetteEncoder';

const NO_ACR_SIGNAL = 'No cassette signal detected';

/**
 * Period that separates mark from space, in seconds: halfway between the two
 * tones. The hardware demodulator uses 471 µs for exactly this, which is what
 * 2/(2400+1850) comes to.
 */
const SPLIT_PERIOD_S = 2 / (ACR_MARK_HZ + ACR_SPACE_HZ);

export interface DecodeCassetteResult {
  /** The one-character program name from the tape header. */
  programName: string;
  /** Tokenized program bytes recovered from the tape. */
  data: Uint8Array;
}

/** Recover the program on a recording, or throw if there isn't one. */
export function decodeCassette(
  samples: Float32Array,
  sampleRate: number,
): DecodeCassetteResult {
  const bytes = decodeAcrTape(samples, sampleRate);
  const file = findCsaveFile(bytes);
  if (!file) throw new Error(NO_ACR_SIGNAL);
  return { programName: file.name, data: file.program };
}

/**
 * Demodulate a recording into the framed byte stream, with no assumption about
 * what the bytes mean. Exported so the round-trip test can check the modem
 * layer on its own, without the `CSAVE` framing on top.
 */
export function decodeAcrTape(
  samples: Float32Array,
  sampleRate: number,
): Uint8Array {
  const level = markLevels(samples, sampleRate);
  if (level.length === 0) return new Uint8Array(0);

  const samplesPerBit = sampleRate / ACR_BAUD;
  const bytes: number[] = [];
  let i = 1;
  while (i < level.length) {
    // A start bit is the first space after a mark. Anything else is leader,
    // inter-byte idle, or the tail of a byte we have already read.
    if (!(level[i - 1] === 1 && level[i] === 0)) {
      i++;
      continue;
    }
    const edge = i;
    const at = (bit: number) =>
      level[Math.round(edge + (bit + 0.5) * samplesPerBit)] ?? 1;
    // Re-check the start bit at its centre: a single spurious crossing at the
    // end of a mark run would otherwise open a byte out of nothing.
    if (at(0) !== 0) {
      i++;
      continue;
    }
    let value = 0;
    for (let b = 0; b < 8; b++) value |= at(1 + b) << b; // LSB first
    if (at(9) !== 1) {
      // Framing error: the stop bit should be mark. Skip this edge and look
      // again rather than trusting a byte the frame did not agree with.
      i++;
      continue;
    }
    bytes.push(value);
    // Resume just inside the stop bit, so the next start bit's falling edge is
    // still ahead of us however far the tape has drifted.
    i = Math.max(edge + 1, Math.round(edge + 9.1 * samplesPerBit));
  }
  return Uint8Array.from(bytes);
}

/**
 * Map every sample to the tone that was playing: 1 for mark, 0 for space.
 *
 * The signal is high-passed to kill tape/soundcard baseline drift, then gated
 * with a hysteresis threshold so noise around the zero crossing does not
 * manufacture edges. Each resulting half-cycle is classified by its length and
 * that verdict is written back across the samples it spans, which gives a level
 * that can be sampled at any instant - what the bit-cell timing above needs.
 * Returns an empty array for silence.
 */
function markLevels(samples: Float32Array, sampleRate: number): Uint8Array {
  const hp = highPass(samples, sampleRate, 5);
  const peak = percentileAbs(hp, 0.99);
  if (peak < 1e-4) return new Uint8Array(0);
  const gate = peak * 0.25;
  const splitSamples = SPLIT_PERIOD_S * sampleRate * 0.5; // half-cycle length

  const level = new Uint8Array(hp.length);
  level.fill(1); // undecided regions read as idle mark
  let state = 0; // -1 low, +1 high, 0 unknown
  let last = -1;
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
    if (last >= 0) {
      // A short half-cycle is the 2400 Hz mark tone, a long one the 1850 Hz
      // space. The verdict applies to the span it was measured over.
      level.fill(i - last < splitSamples ? 1 : 0, last, i);
    }
    last = i;
  }
  return level;
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
