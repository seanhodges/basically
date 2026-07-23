/**
 * Amstrad CPC cassette audio.
 *
 * The firmware records each bit as one square-wave cycle whose length carries
 * the value: a `0` bit is a short cycle, a `1` bit a cycle twice as long. Bytes
 * are written MSB-first. A block opens with a long **pilot** tone (a run of `1`
 * cycles the reader locks onto) and a single `0` **sync** bit, after which the
 * firmware record stream ({@link buildFirmwareStream}) follows verbatim - the
 * header record, then the CRC'd data segments.
 *
 * The default write speed is 2000 baud (`SPEED WRITE 1`): a `0` bit is a 500 us
 * cycle, a `1` bit a 1000 us cycle. The "robust" mode drops to 1000 baud (twice
 * as long, easier for a speaker->mic recording to survive). The decoder times
 * the cycles relative to each other, so it reads either speed back without being
 * told which - the same self-scaling trick the TRS-80 and BBC decoders use.
 */

import { tokenizeProgram } from '../tokenizer';
import { fatalErrors } from '../../types';
import { buildFirmwareStream, parseFirmwareStream } from './firmware';

export const CASSETTE_SAMPLE_RATE = 44100;

/** Half-cycle of a `0` bit at 2000 baud, in microseconds (a `1` bit is 2x). */
const ZERO_HALF_MICROS = 125;
/** Pilot `1` bits before the record stream (double in robust mode). */
const PILOT_BITS = 2048;
/** Trailing `1` bits so the final data bit has a clean closing edge. */
const TRAILER_BITS = 8;

interface TapeTiming {
  sampleRate: number;
  amplitude: number;
  /** Half-cycle of a `0` bit, in microseconds. */
  zeroHalfMicros: number;
}

/**
 * Encode CPC BASIC source to cassette samples (the dialect's `buildSamples`).
 * Throws on tokenizer errors so a broken program is reported, not silently
 * exported. `robust` halves the baud rate for a more survivable recording.
 */
export function buildCassetteSamples(
  source: string,
  programName: string,
  robust = false,
): Float32Array {
  const { bytes, errors } = tokenizeProgram(source);
  const fatal = fatalErrors(errors);
  if (fatal.length > 0) {
    throw new Error(
      `Program has ${fatal.length} error(s) - fix them before building`,
    );
  }
  // A bare 0x0000 end marker means the program is empty.
  if (bytes.length <= 2) throw new Error('Program is empty');
  const stream = buildFirmwareStream(bytes, programName);
  return streamToSamples(stream, {
    sampleRate: CASSETTE_SAMPLE_RATE,
    amplitude: 0.85,
    zeroHalfMicros: robust ? ZERO_HALF_MICROS * 2 : ZERO_HALF_MICROS,
  });
}

/**
 * Render the firmware byte stream to a square wave: pilot tone, sync bit, then
 * every byte MSB-first. Half-cycle boundaries are accumulated in exact
 * microseconds and rounded only at emission, so no per-cycle drift builds up.
 */
function streamToSamples(stream: Uint8Array, t: TapeTiming): Float32Array {
  const zeroHalf = t.zeroHalfMicros;
  const oneHalf = zeroHalf * 2;

  // The half-cycle durations, in order. A bit is two equal half-cycles.
  const halves: number[] = [];
  const pushBit = (bit: number) => {
    const h = bit ? oneHalf : zeroHalf;
    halves.push(h, h);
  };
  for (let i = 0; i < PILOT_BITS; i++) pushBit(1);
  pushBit(0); // sync
  for (const byte of stream) {
    for (let b = 7; b >= 0; b--) pushBit((byte >> b) & 1);
  }
  for (let i = 0; i < TRAILER_BITS; i++) pushBit(1);

  const samplesPerMicro = t.sampleRate / 1e6;
  const totalMicros = halves.reduce((n, h) => n + h, 0);
  const out = new Float32Array(Math.ceil(totalMicros * samplesPerMicro) + 1);
  let micros = 0;
  let level = t.amplitude;
  for (const dur of halves) {
    const start = micros;
    const end = start + dur;
    out.fill(
      level,
      Math.round(start * samplesPerMicro),
      Math.round(end * samplesPerMicro),
    );
    micros = end;
    level = -level;
  }
  return out;
}

const NO_SIGNAL = 'No CPC cassette signal detected';

/**
 * Decode recorded CPC cassette samples back to the tokenized program (the
 * inverse of {@link buildCassetteSamples}). Throws when no valid signal is found.
 */
export function decodeCassette(
  samples: Float32Array,
  _sampleRate: number,
): { name: string; program: Uint8Array; warnings: string[] } {
  const halves = halfCycleLengths(samples);
  const bits = halvesToBits(halves);
  const bytes = bitsToBytes(bits);
  const { name, program, warnings } = parseFirmwareStream(bytes);
  return { name, program, warnings };
}

/**
 * The half-cycle lengths (in samples) of the square wave: a Schmitt gate on the
 * signal's sign, with a deadzone around zero, so noise near a crossing can't
 * fake an extra edge. Each constant-level run between crossings is one half-cycle.
 */
function halfCycleLengths(samples: Float32Array): number[] {
  const peak = percentileAbs(samples, 0.99);
  if (peak < 1e-4) return [];
  const hi = peak * 0.25;
  const lo = -peak * 0.25;

  const lengths: number[] = [];
  let state = 0; // -1, 0 (unknown) or +1
  let lastEdge = -1;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i]!;
    const next = s > hi ? 1 : s < lo ? -1 : state;
    if (next !== 0 && next !== state) {
      if (state !== 0 && lastEdge >= 0) lengths.push(i - lastEdge);
      lastEdge = i;
      state = next;
    }
  }
  return lengths;
}

/**
 * Pair the half-cycles into bits. A bit is two equal-length half-cycles; a `0`
 * is short, a `1` is twice as long, so a threshold at 1.5x the short cluster
 * cleanly separates them regardless of the recording speed.
 */
function halvesToBits(halves: number[]): number[] {
  if (halves.length === 0) throw new Error(NO_SIGNAL);
  const sorted = [...halves].sort((a, b) => a - b);
  // The pilot is all 1-bits, so short half-cycles are the minority; the 5th
  // percentile is reliably a short (0-bit) half-cycle.
  const shortRef = sorted[Math.floor(0.05 * (sorted.length - 1))]!;
  const threshold = shortRef * 1.5;

  const bits: number[] = [];
  let i = 0;
  while (i + 1 < halves.length) {
    const a = halves[i]! < threshold ? 0 : 1;
    const b = halves[i + 1]! < threshold ? 0 : 1;
    if (a === b) {
      bits.push(a);
      i += 2;
    } else {
      i += 1; // phase slip: drop one half-cycle to resync
    }
  }
  return bits;
}

/**
 * Byte-align on the sync bit - the first `0` after the pilot's run of `1`s -
 * then read whole bytes MSB-first from the bit that follows it.
 */
function bitsToBytes(bits: number[]): Uint8Array {
  let ones = 0;
  let sync = -1;
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] === 1) {
      ones++;
    } else {
      if (ones >= 16) {
        sync = i;
        break;
      }
      ones = 0;
    }
  }
  if (sync < 0) throw new Error(NO_SIGNAL);

  const out: number[] = [];
  for (let i = sync + 1; i + 8 <= bits.length; i += 8) {
    let v = 0;
    for (let b = 0; b < 8; b++) v = (v << 1) | bits[i + b]!;
    out.push(v);
  }
  return Uint8Array.from(out);
}

function percentileAbs(x: Float32Array, p: number): number {
  const a = Float32Array.from(x, Math.abs).sort();
  const idx = Math.min(
    a.length - 1,
    Math.max(0, Math.floor(p * (a.length - 1))),
  );
  return a[idx]!;
}
