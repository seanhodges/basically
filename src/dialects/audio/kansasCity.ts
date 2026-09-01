// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Kansas City Standard FSK, the modulation every 1200/2400 Hz cassette in this
 * tree writes: a `0` bit is a whole number of 1200 Hz cycles, a `1` bit is
 * twice as many cycles at 2400 Hz, so both take the same time and the baud rate
 * follows from the count. A byte is framed 8N1 or 8N2 - a `0` start bit, eight
 * data bits LSB-first, one or two `1` stop bits - and a continuous 2400 Hz
 * carrier (an unbroken run of `1`s) leads in and separates blocks.
 *
 * Only the framing and the cycle counts differ between the machines: what a
 * block looks like, what checks it carries and what its bytes mean are each
 * dialect's own. So the modulation lives here and the file formats stay next
 * to the dialect that writes them.
 */

/** How one machine spells a bit and a byte on the tape. */
export interface KcsFraming {
  /** 1200 Hz cycles that carry a `0` bit; the baud rate is 1200 / this. */
  zeroCycles: number;
  /** 2400 Hz cycles that carry a `1` bit - twice `zeroCycles`, same duration. */
  oneCycles: number;
  /** `1` bits after the eight data bits. */
  stopBits: number;
}

const CYCLE_2400_MICROS = 1e6 / 2400;
const HALF_2400_MICROS = CYCLE_2400_MICROS / 2;
const HALF_1200_MICROS = 1e6 / 1200 / 2;

/**
 * A tape being written, as the list of half-cycles it is made of.
 *
 * Durations are accumulated in exact microseconds and rounded only when the
 * waveform is rendered, so a half-cycle that is not a whole number of samples
 * long cannot drift the ones behind it.
 */
export class KcsTape {
  private readonly halves: number[] = [];

  constructor(private readonly framing: KcsFraming) {}

  /** Carrier: `cycles` whole cycles of 2400 Hz, which reads back as `1` bits. */
  tone(cycles: number): void {
    for (let i = 0; i < cycles; i++) {
      this.halves.push(HALF_2400_MICROS, HALF_2400_MICROS);
    }
  }

  /** One bit, at whichever tone and cycle count this machine spells it with. */
  bit(value: number): void {
    if (value) {
      this.tone(this.framing.oneCycles);
      return;
    }
    for (let i = 0; i < this.framing.zeroCycles; i++) {
      this.halves.push(HALF_1200_MICROS, HALF_1200_MICROS);
    }
  }

  /** One framed byte: start bit, eight data bits LSB-first, the stop bits. */
  byte(value: number): void {
    this.bit(0);
    for (let i = 0; i < 8; i++) this.bit((value >> i) & 1);
    for (let i = 0; i < this.framing.stopBits; i++) this.bit(1);
  }

  bytes(data: ArrayLike<number>): void {
    for (let i = 0; i < data.length; i++) this.byte(data[i]!);
  }

  /** Render the square wave, one sample per `sampleRate`th of a second. */
  render(sampleRate: number, amplitude = 0.85): Float32Array {
    const samplesPerMicro = sampleRate / 1e6;
    let total = 0;
    for (const half of this.halves) total += half;

    const out = new Float32Array(Math.ceil(total * samplesPerMicro) + 1);
    let micros = 0;
    let level = amplitude;
    for (const half of this.halves) {
      const end = micros + half;
      out.fill(
        level,
        Math.round(micros * samplesPerMicro),
        Math.round(end * samplesPerMicro),
      );
      micros = end;
      level = -level;
    }
    return out;
  }
}

/**
 * Recover the framed byte stream from a recording.
 *
 * Bytes are found by counting half-cycles rather than by clocking: a `0` bit is
 * `2 × zeroCycles` slow halves and a `1` bit `2 × oneCycles` fast ones, so the
 * reader stays in step with a tape running fast or slow without a PLL. Bytes
 * that do not frame are dropped, and it is the caller's block checks that say
 * which of what survives is a program.
 */
export function decodeKcsBytes(
  samples: Float32Array,
  sampleRate: number,
  framing: KcsFraming,
): Uint8Array {
  const halves = halfCycles(samples, sampleRate); // true = fast (2400 Hz)
  const zeroHalves = framing.zeroCycles * 2;
  const oneHalves = framing.oneCycles * 2;
  const bytes: number[] = [];
  let k = 0;

  const readBit = (): number | null => {
    if (k >= halves.length) return null;
    if (!halves[k]) {
      k += zeroHalves;
      return 0;
    }
    k += oneHalves;
    return 1;
  };

  while (k < halves.length) {
    if (halves[k]) {
      k++; // carrier or a stop bit; a start bit is the next slow half
      continue;
    }
    if (readBit() !== 0) continue;
    let value = 0;
    let ok = true;
    for (let b = 0; b < 8; b++) {
      const bit = readBit();
      if (bit === null) {
        ok = false;
        break;
      }
      value |= bit << b; // LSB first
    }
    if (!ok) break;
    for (let s = 0; s < framing.stopBits; s++) readBit();
    bytes.push(value);
  }
  return Uint8Array.from(bytes);
}

/**
 * Collapse the high-passed, Schmitt-gated signal into half-cycles, each tagged
 * fast (2400 Hz) or slow (1200 Hz). The threshold is derived from the signal:
 * the carrier makes fast halves the most common, so the median is a fast half.
 */
export function halfCycles(
  samples: Float32Array,
  sampleRate: number,
): boolean[] {
  const hp = highPass(samples, sampleRate, 5);
  const peak = percentileAbs(hp, 0.99);
  if (peak < 1e-4) return [];
  const gate = peak * 0.25;

  const lengths: number[] = [];
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
    if (edge) {
      if (last >= 0) lengths.push(i - last);
      last = i;
    }
  }
  if (lengths.length === 0) return [];

  const sorted = [...lengths].sort((a, b) => a - b);
  const fastHalf = sorted[sorted.length >> 1]!; // median ≈ a 2400 Hz half-cycle
  const threshold = fastHalf * 1.5; // 1200 Hz half is ≈2× the 2400 Hz half
  return lengths.map((d) => d < threshold);
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
