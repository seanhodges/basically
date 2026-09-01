/**
 * SAM Coupé cassette decoding - the inverse of {@link encodeSamTape}.
 *
 * Every classification threshold here is a fraction of the leader pulse the
 * recording itself carries rather than an absolute duration, and that is the
 * ROM's own method rather than a convenience: `LDBLK` averages 256 leader
 * pulses, calls 1.25 times that average the longest a `1` bit may be, and puts
 * the short/long decision at half of it. Nothing in the loader knows how fast
 * the tape was written, which is why a SAM reads its own tapes, tapes written
 * at the other speeds `DEVICE T<n>` offers, and standard Spectrum tapes, all
 * through one routine. Measuring the same way makes this decoder immune to the
 * same things - playback speed drift, resampling, a sample rate that does not
 * match the one that wrote the file. The one absolute figure is the debounce
 * floor below, which describes the recording path and not the tape.
 *
 * The two schemes sit close enough together to share one set of fractions. A
 * SAM pulse is 0.40 of its leader for a `0` bit and 0.81 for a `1`; a Spectrum's
 * are 0.39 and 0.79, and both machines' sync pulses fall below 0.35.
 *
 * The recovered blocks are re-framed into a container image and handed back for
 * {@link parseSamFileWithReport} to read.
 */
import { headerName, samImageFromBlocks } from '../samfile';
import { ZERO_BIT_PULSE_MICROS } from './cassetteEncoder';

const NO_SAM_SIGNAL = 'No cassette signal detected';

/**
 * Fraction of a default-speed `0` bit's pulse below which an edge-to-edge
 * interval is ringing rather than signal.
 *
 * Half of 248µs leaves the floor at 124µs: clear of the ring an 11kHz
 * speaker→air→microphone path leaves after each transition, and still well
 * under the 166µs sync pulse, which is the shortest thing a default-speed tape
 * writes. It suits a Spectrum tape as comfortably - every pulse in that scheme
 * is longer, the 191µs sync included.
 */
const MIN_PULSE_FRACTION = 0.5;
/** A pulse at or above this fraction of the leader is leader tone, not data. */
const PILOT_FLOOR = 0.88;
/** The upper bound, so a silent gap's single enormous run is not leader. */
const PILOT_CEILING = 1.5;
/** Above this fraction of the leader a data pulse is a `1` bit. */
const ONE_BIT_FLOOR = 0.6;

export interface DecodeCassetteResult {
  /** Program name from the tape header. */
  name: string;
  /** Reconstructed container image, one framed block per block on the tape. */
  image: Uint8Array;
}

export function decodeSamCassette(
  samples: Float32Array,
  sampleRate: number,
): DecodeCassetteResult {
  const pulses = pulseDurations(samples, sampleRate);
  if (pulses.length < 16) throw new Error(NO_SAM_SIGNAL);

  const pilot = estimatePilot(pulses);
  if (pilot === null) throw new Error(NO_SAM_SIGNAL);

  const blocks = readBlocks(pulses, pilot);
  if (blocks.length === 0) throw new Error(NO_SAM_SIGNAL);

  // The header block is 82 bytes - a 0x01 type byte, the 80-byte header and the
  // parity - and its bytes 1-10 carry the file name. Route it through the
  // charset (headerName does) so a name with £ or graphics in it decodes to the
  // text the editor would show.
  const header = blocks.find((b) => b.length === 82 && b[0] === 0x01);
  const name = header ? headerName(header.subarray(2, 12)) : '';

  return {
    name,
    image: samImageFromBlocks(blocks.map((b) => ({ type: b[0]!, bytes: b }))),
  };
}

/**
 * Square-wave pulse durations, in samples. Each pulse is one constant-sign run
 * of the high-passed, Schmitt-gated signal; the silent pause between blocks
 * shows up as a single very long run, which {@link readBlocks} treats as a
 * boundary.
 */
function pulseDurations(samples: Float32Array, sampleRate: number): number[] {
  const hp = highPass(samples, sampleRate, 5);
  const peak = percentileAbs(hp, 0.99);
  if (peak < 1e-4) return [];
  const gate = peak * 0.25; // hysteresis band keeps noise from adding edges

  const edges: number[] = [];
  let state = 0; // -1 low, +1 high, 0 unknown
  for (let i = 0; i < hp.length; i++) {
    const v = hp[i]!;
    if (state <= 0 && v > gate) {
      if (state === -1) edges.push(i);
      state = 1;
    } else if (state >= 0 && v < -gate) {
      if (state === 1) edges.push(i);
      state = -1;
    }
  }
  if (edges.length < 2) return [];

  // Debounce against ringing, which arrives as a cluster of spurious crossings
  // right after a real edge. Counting them as pulses would desync the rigid
  // two-pulses-per-bit pairing below and corrupt the rest of the block, so each
  // cluster is collapsed back to the single real edge that started it.
  //
  // The floor is absolute rather than a fraction of the leader, unlike every
  // classification threshold below it: it is a property of the recording path,
  // not of the tape, and deriving it from the signal would let a ring cluster
  // dense enough to shorten the apparent leader lower the very floor meant to
  // remove it. A `DEVICE T<n>` tape saved faster than about T80 falls under the
  // floor and is not read here, which costs little: by T40 a pulse is a handful
  // of samples at any rate a browser records at, and the classification below
  // has run out of resolution well before the debounce does.
  const minPulse =
    ZERO_BIT_PULSE_MICROS * 1e-6 * sampleRate * MIN_PULSE_FRACTION;
  const pulses: number[] = [];
  let prevKept = edges[0]!;
  for (let i = 1; i < edges.length; i++) {
    const gap = edges[i]! - prevKept;
    if (gap < minPulse) continue; // ringing glitch - fold it into the pulse
    pulses.push(gap);
    prevKept = edges[i]!;
  }
  return pulses;
}

/**
 * Estimate the leader pulse length as the median of the longest run of pulses
 * that stay within ±20% of the run's first pulse - the leader tone is by far
 * the longest such constant run in any recording.
 */
function estimatePilot(pulses: number[]): number | null {
  let bestStart = 0;
  let bestLen = 0;
  let i = 0;
  while (i < pulses.length) {
    const ref = pulses[i]!;
    let j = i + 1;
    while (j < pulses.length && Math.abs(pulses[j]! - ref) <= ref * 0.2) j++;
    if (j - i > bestLen) {
      bestLen = j - i;
      bestStart = i;
    }
    i = j;
  }
  if (bestLen < 16) return null;
  const run = pulses
    .slice(bestStart, bestStart + bestLen)
    .sort((a, b) => a - b);
  return run[run.length >> 1]!;
}

/**
 * Walk the pulse stream block by block: skip the leader tone, drop the two sync
 * pulses, then read data pulses in pairs (each pair one bit, MSB first) until
 * the carrier stops or the next block's leader begins. Each returned block is
 * the raw type + payload + parity bytes a tape carries.
 */
function readBlocks(pulses: number[], pilot: number): Uint8Array[] {
  const isPilot = (p: number) =>
    p >= pilot * PILOT_FLOOR && p <= pilot * PILOT_CEILING;
  const blocks: Uint8Array[] = [];
  let i = 0;
  while (i < pulses.length) {
    if (!isPilot(pulses[i]!)) {
      i++;
      continue;
    }
    while (i < pulses.length && isPilot(pulses[i]!)) i++; // consume the leader
    i += 2; // the two sync pulses

    const bits: number[] = [];
    // Gate on `i` rather than `i + 1`: the recording's very last pulse has no
    // closing edge - it fades straight into the trailing silence - so the last
    // bit of the last block arrives as a single measured pulse of the right
    // duration. Requiring both would drop that block's final byte.
    while (i < pulses.length && pulses[i]! < pilot * PILOT_FLOOR) {
      bits.push(pulses[i]! > pilot * ONE_BIT_FLOOR ? 1 : 0);
      i += 2; // two equal pulses per data bit
    }
    const bytes = packBitsMsb(bits);
    if (bytes.length > 0) blocks.push(bytes);
  }
  return blocks;
}

function packBitsMsb(bits: number[]): Uint8Array {
  const n = Math.floor(bits.length / 8);
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    let b = 0;
    for (let k = 0; k < 8; k++) b = (b << 1) | bits[i * 8 + k]!;
    out[i] = b;
  }
  return out;
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
