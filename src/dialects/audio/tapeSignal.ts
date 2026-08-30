/**
 * The signal abuse every cassette decoder test puts a clean encode through:
 * noise, gain and DC offset, and clock drift. Each machine's decoder is its
 * own, but the channel between a real tape and a real ear is not, so the six
 * `<dialect>/audio/cassetteDecoder.test.ts` suites carried a byte-identical
 * copy of these apiece.
 *
 * Not a test file, so it takes no dependency on vitest.
 */

/**
 * Deterministic pseudo-random noise, so the robustness tests do not flake.
 *
 * Mulberry32: a fixed seed gives the same sequence on every run and every
 * platform, which `Math.random` cannot promise.
 */
export function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Add uniform noise of amplitude `amp` to every sample. */
export function addNoise(
  samples: Float32Array,
  amp: number,
  seed = 1,
): Float32Array {
  const rng = mulberry32(seed);
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    out[i] = samples[i]! + (rng() * 2 - 1) * amp;
  }
  return out;
}

/** Apply a gain and a DC offset, as a mis-set input level would. */
export function scale(
  samples: Float32Array,
  gain: number,
  dc = 0,
): Float32Array {
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) out[i] = samples[i]! * gain + dc;
  return out;
}

/** Linear-resample to simulate tape/clock speed drift. */
export function resample(samples: Float32Array, factor: number): Float32Array {
  const n = Math.round(samples.length * factor);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const pos = i / factor;
    const lo = Math.floor(pos);
    const frac = pos - lo;
    const a = samples[lo] ?? 0;
    const b = samples[lo + 1] ?? a;
    out[i] = a + (b - a) * frac;
  }
  return out;
}
