/**
 * TRS-80 cassette decoding — the inverse of {@link bytesToCassetteSamples}.
 *
 * The recording is a train of brief positive pulses; the information is the
 * spacing between them. We high-pass the signal to kill DC / baseline drift,
 * then time the gap between successive pulse onsets, found with a Schmitt gate
 * (rises through the high threshold, re-arms below the low one) so noise and the
 * pulse's own decay can't fake an extra edge. Each gap is classified short or
 * long *relative to the others* — the leader and the 0-bits make long gaps the
 * dominant cluster, so the upper cluster sets the reference and the threshold
 * scales with it, which makes the decode immune to playback-speed drift and
 * sample-rate mismatch.
 *
 * Gaps become bits with the Model I rule: a long gap is a 0; a pair of short
 * gaps (clock→data, data→clock) is a 1. The bit stream is byte-aligned by
 * scanning for the 0xA5 sync pattern, and the bytes are handed to
 * {@link parseCasImage}, which strips the marker/filename and trims the program.
 */
import { parseCasImage, SYNC_BYTE } from '../casfile';

const NO_SIGNAL = 'No cassette signal detected';

export function decodeCassette(
  samples: Float32Array,
  sampleRate: number,
): { programName: string; data: Uint8Array } {
  const gaps = pulseGaps(samples, sampleRate);
  const bits = gapsToBits(gaps);
  const bytes = bitsToBytes(bits);
  const { programName, program } = parseCasImage(bytes);
  return { programName, data: program };
}

/**
 * Classify the inter-pulse gaps and decode the Model I bit scheme. Long gaps are
 * the dominant cluster (the leader and every 0 bit), so the 90th-percentile gap
 * is reliably a long one; the short|long boundary sits at 70% of it.
 */
function gapsToBits(gaps: number[]): number[] {
  if (gaps.length === 0) throw new Error(NO_SIGNAL);
  const sorted = [...gaps].sort((a, b) => a - b);
  const longRef = sorted[Math.floor(0.9 * (sorted.length - 1))]!;
  const threshold = longRef * 0.7;

  const bits: number[] = [];
  let i = 0;
  while (i < gaps.length) {
    if (gaps[i]! >= threshold) {
      bits.push(0);
      i++;
    } else if (i + 1 < gaps.length && gaps[i + 1]! < threshold) {
      bits.push(1); // a 1 is exactly two short gaps
      i += 2;
    } else {
      i++; // a dangling short gap (trailing pulse): ignore
    }
  }
  return bits;
}

/** Read 8 bits MSB-first at `i`, or null past the end. */
function readByteAt(bits: number[], i: number): number | null {
  if (i + 8 > bits.length) return null;
  let v = 0;
  for (let b = 0; b < 8; b++) v = (v << 1) | bits[i + b]!;
  return v;
}

/**
 * Byte-align on the 0xA5 sync, then read whole bytes from there to the end. The
 * leader is all-zero, so the sync byte is the first non-zero pattern and gives
 * an unambiguous frame; trailing junk is trimmed later by `programByteLength`.
 */
function bitsToBytes(bits: number[]): Uint8Array {
  let sync = -1;
  for (let i = 0; i + 8 <= bits.length; i++) {
    if (readByteAt(bits, i) === SYNC_BYTE) {
      sync = i;
      break;
    }
  }
  if (sync < 0) throw new Error(NO_SIGNAL);

  const out: number[] = [];
  for (let i = sync; i + 8 <= bits.length; i += 8)
    out.push(readByteAt(bits, i)!);
  return Uint8Array.from(out);
}

/**
 * Recover inter-pulse gaps (in samples) from the waveform: high-pass, then take
 * the distance between consecutive pulse onsets. A Schmitt gate disarms on a
 * rise through the high threshold (0.4 peak) and only re-arms once the signal
 * falls back below the low threshold (0.15 peak), so a single pulse — and its
 * high-passed undershoot — yields exactly one onset.
 */
function pulseGaps(samples: Float32Array, sampleRate: number): number[] {
  const hp = highPass(samples, sampleRate, 5);
  const peak = percentileAbs(hp, 0.99);
  if (peak < 1e-4) return [];
  const hi = peak * 0.4;
  const lo = peak * 0.15;

  const gaps: number[] = [];
  let armed = true;
  let prevOnset = -1;
  for (let i = 0; i < hp.length; i++) {
    if (armed && hp[i]! > hi) {
      if (prevOnset >= 0) gaps.push(i - prevOnset);
      prevOnset = i;
      armed = false;
    } else if (!armed && hp[i]! < lo) {
      armed = true;
    }
  }
  return gaps;
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
