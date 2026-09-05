// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import {
  CASSETTE_BAUD,
  RECORD_BYTES,
  RECORD_SYNC,
  collectRecordData,
  isValidRecord,
  type RecordScan,
} from '../casfile';
import { MARK_HZ, SPACE_HZ } from './cassetteEncoder';

/**
 * Atari cassette decoding - {@link encodeAtariTape} backwards.
 *
 * The two tones are close together (5327 Hz against 3995 Hz), so at ordinary
 * sample rates a single half-cycle is only four or five samples long and
 * measuring one is not enough to tell them apart. What this does instead is
 * what a modem does: correlate the signal against both tones over a sliding
 * window one bit wide and take whichever answers louder. The window is centred
 * on the sample it decides, so it sees exactly one bit's worth of signal and
 * nothing of its neighbours, and comparing two magnitudes makes the result
 * independent of recording level, of phase, and of the several per cent of
 * speed error a real tape arrives with.
 *
 * Bytes come out of the level track by ordinary 8N1 framing, re-timed from
 * every start bit rather than from a free-running clock, and the byte stream is
 * then scanned for records whose checksum verifies - which is what tells a
 * program from tape hiss.
 */

const NO_SIGNAL = 'No Atari cassette records found in the recording';

/** Where a bit is sampled, in bits from the leading edge of the start bit. */
const START_CENTRE = 0.5;
const FIRST_DATA_CENTRE = 1.5;
const STOP_CENTRE = 9.5;

export type DecodeCassetteResult = RecordScan;

/** Decode recorded samples into the byte stream `CSAVE` wrote. */
export function decodeCassette(
  samples: Float32Array,
  sampleRate: number,
): DecodeCassetteResult {
  const level = demodulate(samples, sampleRate);
  const records = scanRecords(decodeBytes(level, sampleRate));
  if (records.length === 0) throw new Error(NO_SIGNAL);
  return collectRecordData(records);
}

/**
 * One bit-level decision per sample: true where the mark tone is the louder of
 * the two. Silence reads as mark, the level the line idles at, so a recording
 * that starts before the tape does contributes no spurious start bits.
 */
function demodulate(samples: Float32Array, sampleRate: number): Uint8Array {
  const n = samples.length;
  const level = new Uint8Array(n).fill(1);
  const window = Math.max(2, Math.round(sampleRate / CASSETTE_BAUD));
  if (n <= window) return level;

  const markStep = (2 * Math.PI * MARK_HZ) / sampleRate;
  const spaceStep = (2 * Math.PI * SPACE_HZ) / sampleRate;

  // Running sums of the signal against each tone's sine and cosine, over the
  // last `window` samples; the circular buffer holds what leaves the window.
  const history = new Float64Array(window * 4);
  let markI = 0;
  let markQ = 0;
  let spaceI = 0;
  let spaceQ = 0;

  const strength = new Float32Array(n);
  const offset = window >> 1; // the window's centre, which is what it decides
  for (let i = 0; i < n; i++) {
    const x = samples[i]!;
    const slot = (i % window) * 4;
    const mi = x * Math.cos(markStep * i);
    const mq = x * Math.sin(markStep * i);
    const si = x * Math.cos(spaceStep * i);
    const sq = x * Math.sin(spaceStep * i);
    markI += mi - history[slot]!;
    markQ += mq - history[slot + 1]!;
    spaceI += si - history[slot + 2]!;
    spaceQ += sq - history[slot + 3]!;
    history[slot] = mi;
    history[slot + 1] = mq;
    history[slot + 2] = si;
    history[slot + 3] = sq;

    if (i < window - 1) continue;
    const mark = Math.hypot(markI, markQ);
    const space = Math.hypot(spaceI, spaceQ);
    const at = i - offset;
    level[at] = mark >= space ? 1 : 0;
    strength[at] = mark + space;
  }

  // Squelch: below a quarter of the loudest the recording gets, there is no
  // tone to choose between, so the line is idle rather than carrying a space.
  const gate = percentile(strength, 0.99) * 0.25;
  for (let i = 0; i < n; i++) if (strength[i]! < gate) level[i] = 1;

  deglitch(level, Math.round(window * 0.4));
  return level;
}

/**
 * Erase runs too short to be a bit.
 *
 * Where the tone changes, the correlator's window straddles two bits for a
 * moment and can flip for a sample or two before it settles. Those slivers are
 * not levels the tape ever carried, and left in place each one reads as another
 * start bit.
 */
function deglitch(level: Uint8Array, minRun: number): void {
  let runStart = 0;
  let runValue = level[0] ?? 1;
  let keptValue = runValue;
  for (let i = 1; i <= level.length; i++) {
    const value = i < level.length ? level[i]! : -1;
    if (value === runValue) continue;
    // The run [runStart, i) has just ended. The recording's opening run is the
    // leader, however short the capture caught of it, so it is never a glitch.
    if (runStart > 0 && i - runStart < minRun)
      level.fill(keptValue, runStart, i);
    else keptValue = runValue;
    runStart = i;
    runValue = value;
  }
}

/**
 * How long a bit actually lasts in this recording.
 *
 * Every record opens with two `$55` sync bytes, and that is not decoration: an
 * `$55` framed 8N1 alternates level on every bit boundary, so the head of a
 * record is twenty bits of pure square wave at half the bit rate. The machine
 * times its own reader off it, and so does this - the span of a whole run of
 * alternations divided by the bits in it, which averages out the sample or two
 * of jitter each transition carries on its own. A tape running fast or slow, or
 * a recording whose sample rate is not the one it was made at, is absorbed
 * here rather than at every bit downstream.
 */
function estimateBitSamples(level: Uint8Array, nominal: number): number {
  const edges: number[] = [];
  for (let i = 1; i < level.length; i++) {
    if (level[i] !== level[i - 1]) edges.push(i);
  }

  // Sixteen of the twenty, so a preamble missing an edge at either end still
  // measures; fewer than that and ordinary data starts qualifying.
  const SPAN = 16;
  const estimates: number[] = [];
  for (let i = 0; i + SPAN < edges.length; i++) {
    let alternating = true;
    for (let k = 0; k < SPAN && alternating; k++) {
      const gap = edges[i + k + 1]! - edges[i + k]!;
      alternating = gap > nominal * 0.5 && gap < nominal * 1.5;
    }
    if (!alternating) continue;
    estimates.push((edges[i + SPAN]! - edges[i]!) / SPAN);
    i += SPAN; // one estimate per preamble, not one per edge inside it
  }
  if (estimates.length === 0) return nominal;
  estimates.sort((a, b) => a - b);
  return estimates[estimates.length >> 1]!;
}

/** Frame the level track into bytes, re-timing on every start bit. */
function decodeBytes(level: Uint8Array, sampleRate: number): Uint8Array {
  const bitSamples = estimateBitSamples(level, sampleRate / CASSETTE_BAUD);
  const bytes: number[] = [];
  const at = (start: number, bit: number) =>
    Math.round(start + bit * bitSamples);

  let i = 1;
  while (i < level.length) {
    // A start bit begins where the line falls from mark to space.
    if (level[i] !== 0 || level[i - 1] !== 1) {
      i++;
      continue;
    }
    const start = i;
    const stop = at(start, STOP_CENTRE);
    if (stop >= level.length) break;
    if (level[at(start, START_CENTRE)] !== 0 || level[stop] !== 1) {
      i++;
      continue;
    }
    let value = 0;
    for (let bit = 0; bit < 8; bit++) {
      value |= level[at(start, FIRST_DATA_CENTRE + bit)]! << bit;
    }
    bytes.push(value);
    // Resume inside the stop bit: the next byte's start bit is the next fall.
    i = stop;
  }
  return Uint8Array.from(bytes);
}

/** Every well-formed record in the byte stream, in the order they were read. */
function scanRecords(bytes: Uint8Array): Uint8Array[] {
  const records: Uint8Array[] = [];
  let at = 0;
  while (at + RECORD_BYTES <= bytes.length) {
    if (bytes[at] !== RECORD_SYNC || bytes[at + 1] !== RECORD_SYNC) {
      at++;
      continue;
    }
    const record = bytes.subarray(at, at + RECORD_BYTES);
    if (!isValidRecord(record)) {
      at++;
      continue;
    }
    records.push(Uint8Array.from(record));
    at += RECORD_BYTES;
  }
  return records;
}

function percentile(x: Float32Array, p: number): number {
  const sorted = Float32Array.from(x).sort();
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor(p * (sorted.length - 1))),
  );
  return sorted[index] ?? 0;
}
