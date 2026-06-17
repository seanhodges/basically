/**
 * Shared cassette-audio decoder for the Sinclair ZX80 / ZX81 pulse format.
 *
 * Both machines write each byte MSB-first as a sequence of bit-bursts: a '0'
 * bit is a burst of 4 carrier pulses and a '1' bit is 9; one pulse is ~150µs
 * high then ~150µs low (300µs period). Every bit is followed by a silence gap,
 * and a few seconds of silence lead in/out. The ZX81 prefixes a program-name
 * header to the .P data; the ZX80 has no named files and writes the raw .O
 * image — that difference is handled by the callers, so the signal→bytes
 * recovery (the inverse of `encodeCassette`) lives here once.
 *
 * We recover the bits by gating the signal into tone bursts and **counting the
 * carrier half-cycles in each burst**, not by measuring absolute durations:
 * only the 4-vs-9 ratio distinguishes a bit, and that ratio survives
 * playback/clock speed drift, resampling and sample-rate mismatch — the
 * dominant real-world failure modes. The 4-vs-9 gap (≈7 vs ≈17 Schmitt
 * transitions) leaves a wide classification margin, so a miscount of a cycle or
 * two never flips a bit.
 */

const PULSE_PERIOD_MICROS = 300; // 150µs high + 150µs low, per cassetteEncoder
// A '0' is 4 pulses, a '1' is 9 → ≈7 vs ≈17 Schmitt transitions per burst.
const TRANSITIONS_FOR_0 = 7;
const TRANSITIONS_FOR_1 = 17;
const BIT_THRESHOLD = (TRANSITIONS_FOR_0 + TRANSITIONS_FOR_1) / 2; // 12
// Above this a single burst can't be one bit — it's noise crammed with crossings.
const MAX_PLAUSIBLE_TRANSITIONS = 30;

export const NO_SINCLAIR_SIGNAL = 'No cassette signal detected';

/**
 * Decode recorded Sinclair cassette samples into the raw byte stream the
 * machine would have loaded. Throws {@link NO_SINCLAIR_SIGNAL} when no valid
 * tone bursts are found.
 */
export function decodeSinclairPulses(
  samples: Float32Array,
  sampleRate: number,
): Uint8Array {
  const periodSamples = PULSE_PERIOD_MICROS * 1e-6 * sampleRate;

  // 1. Remove DC offset / slow baseline wander (one-pole high-pass, ~5ms).
  const hp = highPass(samples, sampleRate, 5);

  // 2. Rectified envelope, smoothed over ~one carrier period.
  const env = envelope(hp, Math.max(2, Math.round(periodSamples)));

  // 3. Adaptive thresholds from the envelope's noise floor and peak. Using a
  //    high percentile for the peak keeps the estimate on the tone bursts even
  //    when seconds of leader/trailer silence dominate the recording.
  const floor = percentile(env, 0.1);
  const peak = percentile(env, 0.99);
  const range = peak - floor;
  if (peak < 1e-4 || range < peak * 0.5) throw new Error(NO_SINCLAIR_SIGNAL);
  const hi = floor + range * 0.5;
  const lo = floor + range * 0.25; // hysteresis: don't fragment a burst

  // 4. Gate the envelope into tone bursts — one burst per bit. Merge bursts
  //    split by a brief noise dip: real inter-bit gaps are ≥1300µs (>4 carrier
  //    periods), so anything closer than ~2 periods is one burst, not two.
  const bursts = mergeBursts(
    gateBursts(env, hi, lo, Math.round(periodSamples * 0.5)),
    Math.round(periodSamples * 2),
  );
  if (bursts.length < 8) throw new Error(NO_SINCLAIR_SIGNAL);

  // 5. Classify each burst by counting carrier half-cycles.
  const bits: number[] = [];
  let noisy = 0;
  for (const [start, end] of bursts) {
    const t = countTransitions(hp, start, end);
    if (t > MAX_PLAUSIBLE_TRANSITIONS) noisy++;
    bits.push(t >= BIT_THRESHOLD ? 1 : 0);
  }
  // Random noise produces bursts packed with zero-crossings; real bits never do.
  if (noisy > bursts.length * 0.2) throw new Error(NO_SINCLAIR_SIGNAL);

  // 6. Pack bits MSB-first into bytes (drop any trailing partial byte).
  const bytes = packBits(bits);
  if (bytes.length === 0) throw new Error(NO_SINCLAIR_SIGNAL);
  return bytes;
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
  // Prime the running mean with the leading DC estimate, otherwise the filter's
  // step response to a DC offset looks like a tone burst and adds a phantom bit.
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

/** Trailing moving average of |x| over `w` samples. */
function envelope(x: Float32Array, w: number): Float32Array {
  const out = new Float32Array(x.length);
  let sum = 0;
  for (let i = 0; i < x.length; i++) {
    sum += Math.abs(x[i]!);
    if (i >= w) sum -= Math.abs(x[i - w]!);
    out[i] = sum / Math.min(i + 1, w);
  }
  return out;
}

function percentile(x: Float32Array, p: number): number {
  const a = Float32Array.from(x).sort();
  const idx = Math.min(
    a.length - 1,
    Math.max(0, Math.floor(p * (a.length - 1))),
  );
  return a[idx]!;
}

/** Schmitt-gate the envelope into [start, end) burst intervals. */
function gateBursts(
  env: Float32Array,
  hi: number,
  lo: number,
  minLen: number,
): [number, number][] {
  const bursts: [number, number][] = [];
  let inBurst = false;
  let start = 0;
  for (let i = 0; i < env.length; i++) {
    if (!inBurst && env[i]! > hi) {
      inBurst = true;
      start = i;
    } else if (inBurst && env[i]! < lo) {
      inBurst = false;
      if (i - start >= minLen) bursts.push([start, i]);
    }
  }
  if (inBurst && env.length - start >= minLen) bursts.push([start, env.length]);
  return bursts;
}

/** Join bursts separated by less than `maxGap` samples (noise-induced splits). */
function mergeBursts(
  bursts: [number, number][],
  maxGap: number,
): [number, number][] {
  if (bursts.length === 0) return bursts;
  const out: [number, number][] = [bursts[0]!];
  for (let i = 1; i < bursts.length; i++) {
    const prev = out[out.length - 1]!;
    const cur = bursts[i]!;
    if (cur[0] - prev[1] < maxGap) prev[1] = cur[1];
    else out.push(cur);
  }
  return out;
}

/**
 * Count carrier half-cycles in a burst with an amplitude-gated Schmitt trigger,
 * so noise ripple near zero isn't mistaken for extra cycles. A run of N pulses
 * yields ≈2N−1 transitions (≈7 for a '0', ≈17 for a '1').
 */
function countTransitions(
  hp: Float32Array,
  start: number,
  end: number,
): number {
  let localPeak = 0;
  for (let i = start; i < end; i++)
    localPeak = Math.max(localPeak, Math.abs(hp[i]!));
  if (localPeak < 1e-6) return 0;
  const gate = localPeak * 0.3;
  let state = 0; // -1 low, +1 high, 0 unknown
  let transitions = 0;
  for (let i = start; i < end; i++) {
    const v = hp[i]!;
    if (state <= 0 && v > gate) {
      if (state === -1) transitions++;
      state = 1;
    } else if (state >= 0 && v < -gate) {
      if (state === 1) transitions++;
      state = -1;
    }
  }
  return transitions;
}

function packBits(bits: number[]): Uint8Array {
  const n = Math.floor(bits.length / 8);
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    let b = 0;
    for (let k = 0; k < 8; k++) b = (b << 1) | bits[i * 8 + k]!;
    out[i] = b;
  }
  return out;
}
