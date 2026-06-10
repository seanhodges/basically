import { zx81Charset } from '../charset';

/**
 * ZX81 cassette encoding.
 *
 * Each byte is written MSB first. A '0' bit is 4 pulses, a '1' bit is
 * 9 pulses; one pulse is ~150µs high then ~150µs low. After every bit there
 * is a ~1300µs silence gap. The program name (in ZX81 charset, last char
 * +0x80) precedes the .P data. A few seconds of silence lead in/out.
 */
export interface CassetteOptions {
  sampleRate?: number; // default 44100
  leaderSeconds?: number; // default 2 (real SAVE writes ~5s; 2s is plenty)
  trailerSeconds?: number; // default 1
  /** "Robust" mode stretches the inter-bit gap for temperamental hardware. */
  bitGapMicros?: number; // default 1300
  amplitude?: number; // default 0.85
}

const PULSE_HALF_MICROS = 150;
const PULSES_FOR_0 = 4;
const PULSES_FOR_1 = 9;

/** Encode a ZX81 program name into its tape representation. */
export function encodeName(name: string): Uint8Array {
  const cleaned = name.trim() === '' ? 'PROGRAM' : name.trim();
  const codes = zx81Charset.toMachine(
    cleaned
      .toUpperCase()
      .replace(/[^A-Z0-9 ]/g, '')
      .slice(0, 10) || 'PROGRAM',
  );
  const out = Uint8Array.from(codes);
  out[out.length - 1] = out[out.length - 1]! | 0x80; // end-of-name marker
  return out;
}

export function encodeCassette(
  name: string,
  pData: Uint8Array,
  opts: CassetteOptions = {},
): Float32Array {
  const sampleRate = opts.sampleRate ?? 44100;
  const leaderSeconds = opts.leaderSeconds ?? 2;
  const trailerSeconds = opts.trailerSeconds ?? 1;
  const bitGapMicros = opts.bitGapMicros ?? 1300;
  const amplitude = opts.amplitude ?? 0.85;

  const bytes = new Uint8Array(encodeName(name).length + pData.length);
  bytes.set(encodeName(name), 0);
  bytes.set(pData, encodeName(name).length);

  const samplesPerMicro = sampleRate / 1e6;
  // Sample-accurate accumulation: track positions as exact micros, round at
  // emission time, so no per-pulse drift accumulates.
  const pulseSamples = (count: number) => count * 2 * PULSE_HALF_MICROS;

  // Pre-compute total length in micros
  let totalMicros = (leaderSeconds + trailerSeconds) * 1e6;
  for (const b of bytes) {
    for (let bit = 7; bit >= 0; bit--) {
      const pulses = b & (1 << bit) ? PULSES_FOR_1 : PULSES_FOR_0;
      totalMicros += pulseSamples(pulses) + bitGapMicros;
    }
  }

  const total = Math.ceil(totalMicros * samplesPerMicro) + 1;
  const out = new Float32Array(total);

  let micros = leaderSeconds * 1e6;
  const writePulse = () => {
    const start = micros;
    const mid = start + PULSE_HALF_MICROS;
    const end = mid + PULSE_HALF_MICROS;
    const s0 = Math.round(start * samplesPerMicro);
    const s1 = Math.round(mid * samplesPerMicro);
    const s2 = Math.round(end * samplesPerMicro);
    out.fill(amplitude, s0, s1);
    out.fill(-amplitude, s1, s2);
    micros = end;
  };

  for (const b of bytes) {
    for (let bit = 7; bit >= 0; bit--) {
      const pulses = b & (1 << bit) ? PULSES_FOR_1 : PULSES_FOR_0;
      for (let p = 0; p < pulses; p++) writePulse();
      micros += bitGapMicros; // silence gap ends the bit
    }
  }

  return out;
}
