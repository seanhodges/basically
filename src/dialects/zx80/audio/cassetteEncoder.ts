/**
 * ZX80 cassette encoding.
 *
 * The ZX80 uses the same pulse scheme the ZX81 later inherited: each byte is
 * written MSB first, a '0' bit is 4 pulses and a '1' bit is 9 pulses, one pulse
 * being ~150µs high then ~150µs low, with a ~1300µs silence gap after each bit.
 * The crucial difference from the ZX81 is that the ZX80 has NO named files —
 * the tape is just the raw `.O` memory image (the RAM dump from 0x4000), with
 * no program-name header.
 */
export interface CassetteOptions {
  sampleRate?: number; // default 44100
  leaderSeconds?: number; // default 2
  trailerSeconds?: number; // default 1
  /** "Robust" mode stretches the inter-bit gap for temperamental hardware. */
  bitGapMicros?: number; // default 1300
  amplitude?: number; // default 0.85
}

const PULSE_HALF_MICROS = 150;
const PULSES_FOR_0 = 4;
const PULSES_FOR_1 = 9;

export function encodeCassette(
  oData: Uint8Array,
  opts: CassetteOptions = {},
): Float32Array {
  const sampleRate = opts.sampleRate ?? 44100;
  const leaderSeconds = opts.leaderSeconds ?? 2;
  const trailerSeconds = opts.trailerSeconds ?? 1;
  const bitGapMicros = opts.bitGapMicros ?? 1300;
  const amplitude = opts.amplitude ?? 0.85;

  const samplesPerMicro = sampleRate / 1e6;
  const pulseMicros = (count: number) => count * 2 * PULSE_HALF_MICROS;

  let totalMicros = (leaderSeconds + trailerSeconds) * 1e6;
  for (const b of oData) {
    for (let bit = 7; bit >= 0; bit--) {
      const pulses = b & (1 << bit) ? PULSES_FOR_1 : PULSES_FOR_0;
      totalMicros += pulseMicros(pulses) + bitGapMicros;
    }
  }

  const total = Math.ceil(totalMicros * samplesPerMicro) + 1;
  const out = new Float32Array(total);

  let micros = leaderSeconds * 1e6;
  const writePulse = () => {
    const start = micros;
    const mid = start + PULSE_HALF_MICROS;
    const end = mid + PULSE_HALF_MICROS;
    out.fill(
      amplitude,
      Math.round(start * samplesPerMicro),
      Math.round(mid * samplesPerMicro),
    );
    out.fill(
      -amplitude,
      Math.round(mid * samplesPerMicro),
      Math.round(end * samplesPerMicro),
    );
    micros = end;
  };

  for (const b of oData) {
    for (let bit = 7; bit >= 0; bit--) {
      const pulses = b & (1 << bit) ? PULSES_FOR_1 : PULSES_FOR_0;
      for (let p = 0; p < pulses; p++) writePulse();
      micros += bitGapMicros; // silence gap ends the bit
    }
  }

  return out;
}
