/**
 * ZX Spectrum cassette decoding — the inverse of {@link encodeSpectrumTape}.
 *
 * The signal is a square wave whose level flips on every "pulse"; each pulse
 * holds the EAR line for a number of Z80 T-states. A block is a pilot tone
 * (≈2168 T pulses), a 667 T + 735 T sync pair, then data bytes MSB-first where
 * bit `0` is two 855 T pulses and bit `1` is two 1710 T pulses. Silent pauses
 * separate the blocks.
 *
 * We recover the bytes by measuring the duration of each pulse **relative to
 * the pilot pulse** rather than in absolute T-states: the pilot is the longest
 * near-constant run of pulses in each block, so estimating it from the signal
 * itself makes the classification immune to playback/clock speed drift,
 * resampling and sample-rate mismatch. The reconstructed flag+payload+parity
 * blocks are wrapped back into a `.TAP` image and handed to {@link parseTap}.
 */
const NO_SPECTRUM_SIGNAL = 'No cassette signal detected';

const TSTATE_MICROS = 1e6 / 3_500_000;
// The shortest legitimate pulse in the format is the 667 T-state sync pulse;
// every data/pilot pulse is longer. Any edge-to-edge interval well under it is
// ringing/echo from a real speaker→air→mic path, not a real pulse.
const SYNC1_T = 667;
const MIN_PULSE_FRACTION = 0.5;

export interface DecodeCassetteResult {
  /** Program name from the tape header. */
  name: string;
  /** Reconstructed `.TAP` image (header block followed by the data block). */
  image: Uint8Array;
}

export function decodeCassette(
  samples: Float32Array,
  sampleRate: number,
): DecodeCassetteResult {
  const pulses = pulseDurations(samples, sampleRate);
  if (pulses.length < 16) throw new Error(NO_SPECTRUM_SIGNAL);

  const pilot = estimatePilot(pulses);
  if (pilot === null) throw new Error(NO_SPECTRUM_SIGNAL);

  const blocks = readBlocks(pulses, pilot);
  if (blocks.length === 0) throw new Error(NO_SPECTRUM_SIGNAL);

  // The header block is the 19-byte (flag + 17 + parity) block flagged 0x00;
  // its payload bytes 1..10 carry the program name.
  const header = blocks.find((b) => b.length === 19 && b[0] === 0x00);
  const name = header
    ? String.fromCharCode(...header.slice(2, 12)).replace(/\s+$/, '')
    : '';

  return { name, image: buildTapImage(blocks) };
}

/** Re-frame decoded flag+payload+parity blocks into a `.TAP` image. */
function buildTapImage(blocks: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const b of blocks) total += b.length + 2; // u16 LE length prefix
  const out = new Uint8Array(total);
  let p = 0;
  for (const b of blocks) {
    out[p] = b.length & 0xff;
    out[p + 1] = (b.length >> 8) & 0xff;
    out.set(b, p + 2);
    p += b.length + 2;
  }
  return out;
}

/**
 * Square-wave pulse durations (in samples). Each pulse is one constant-sign run
 * of the high-passed, Schmitt-gated signal; silent pauses between blocks show
 * up as a single very long run, which {@link readBlocks} treats as a boundary.
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

  // Debounce: a speaker→air→mic channel rings after each transition, adding
  // clusters of spurious zero-crossings right after a real edge. Counting them
  // as pulses would desync the rigid two-pulses-per-bit pairing in readBlocks
  // and corrupt the whole block. Keep an edge only once the level has held for
  // at least half the shortest legitimate pulse, collapsing each ring cluster
  // back to the single real edge that started it.
  const minPulseSamples =
    SYNC1_T * TSTATE_MICROS * 1e-6 * sampleRate * MIN_PULSE_FRACTION;
  const pulses: number[] = [];
  let prevKept = edges.length > 0 ? edges[0]! : 0;
  for (let i = 1; i < edges.length; i++) {
    const gap = edges[i]! - prevKept;
    if (gap < minPulseSamples) continue; // ringing glitch — fold into the pulse
    pulses.push(gap);
    prevKept = edges[i]!;
  }
  return pulses;
}

/**
 * Estimate the pilot pulse length as the median of the longest run of pulses
 * that stay within ±20% of the run's first pulse — the pilot tone is by far the
 * longest such constant run in any recording.
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
 * Walk the pulse stream block by block: skip the pilot tone, drop the two sync
 * pulses, then read data pulses in pairs (each pair one bit, MSB-first) until
 * the carrier stops or the next block's pilot begins. Returns each block's raw
 * flag+payload+parity bytes.
 */
function readBlocks(pulses: number[], pilot: number): Uint8Array[] {
  const isPilot = (p: number) => p >= pilot * 0.85 && p <= pilot * 1.5;
  const blocks: Uint8Array[] = [];
  let i = 0;
  while (i < pulses.length) {
    if (!isPilot(pulses[i]!)) {
      i++;
      continue;
    }
    while (i < pulses.length && isPilot(pulses[i]!)) i++; // consume pilot tone
    i += 2; // sync pair (667 T, 735 T)

    const bits: number[] = [];
    while (i + 1 < pulses.length && pulses[i]! < pilot * 0.85) {
      bits.push(pulses[i]! > pilot * 0.59 ? 1 : 0); // 855 T → 0, 1710 T → 1
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
