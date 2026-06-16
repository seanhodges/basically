import type { TapBlock } from '../tapfile';

/**
 * ZX Spectrum cassette encoding (the standard ROM tape format).
 *
 * The signal is a square wave whose level flips on every "pulse". Each pulse
 * holds the EAR line at one level for a number of Z80 T-states (1 T-state =
 * 1/3.5MHz); the next pulse flips it. A block is:
 *
 *   pilot tone  — many 2168 T pulses (8063 for a header, 3223 for data)
 *   sync        — one 667 T pulse then one 735 T pulse
 *   data        — each byte MSB-first; bit 0 = two 855 T pulses, bit 1 = two
 *                 1710 T pulses (the flag byte and a parity byte bookend the
 *                 payload — already baked into {@link TapBlock.bytes})
 *
 * A short silent pause separates blocks and trails the recording. The two
 * blocks (header then data) come from {@link tapBlocks}, so the audio carries
 * exactly the bytes the `.TAP` export does.
 */

const TSTATE_MICROS = 1e6 / 3_500_000;

const PILOT_PULSE_T = 2168;
const PILOT_PULSES_HEADER = 8063;
const PILOT_PULSES_DATA = 3223;
const SYNC1_T = 667;
const SYNC2_T = 735;
const BIT0_PULSE_T = 855;
const BIT1_PULSE_T = 1710;

export interface SpectrumTapeOptions {
  sampleRate?: number; // default 44100
  amplitude?: number; // default 0.85
  /** Leading silence before the first pilot tone, in ms. */
  leadingSilenceMs?: number; // default 500
  /** Silent pause after each block (incl. a trailing pause), in ms. */
  blockPauseMs?: number; // default 1000
  /** Multiplies the pilot-tone length for temperamental hardware. */
  pilotScale?: number; // default 1
}

function pilotPulses(block: TapBlock, scale: number): number {
  // Header blocks (flag < 0x80) get the long leader; data blocks the short one.
  const base = block.flag < 0x80 ? PILOT_PULSES_HEADER : PILOT_PULSES_DATA;
  return Math.round(base * scale);
}

export function encodeSpectrumTape(
  blocks: readonly TapBlock[],
  opts: SpectrumTapeOptions = {},
): Float32Array {
  const sampleRate = opts.sampleRate ?? 44100;
  const amplitude = opts.amplitude ?? 0.85;
  const leadingSilenceMicros = (opts.leadingSilenceMs ?? 500) * 1000;
  const blockPauseMicros = (opts.blockPauseMs ?? 1000) * 1000;
  const pilotScale = opts.pilotScale ?? 1;

  const samplesPerMicro = sampleRate / 1e6;

  // Pre-compute the total length in micros so we can allocate exactly once.
  let totalMicros = leadingSilenceMicros + blocks.length * blockPauseMicros;
  for (const block of blocks) {
    totalMicros +=
      pilotPulses(block, pilotScale) * PILOT_PULSE_T * TSTATE_MICROS;
    totalMicros += (SYNC1_T + SYNC2_T) * TSTATE_MICROS;
    for (const b of block.bytes) {
      for (let bit = 7; bit >= 0; bit--) {
        const pulseT = b & (1 << bit) ? BIT1_PULSE_T : BIT0_PULSE_T;
        totalMicros += 2 * pulseT * TSTATE_MICROS;
      }
    }
  }

  const out = new Float32Array(Math.ceil(totalMicros * samplesPerMicro) + 1);

  // Sample-accurate accumulation: track position in exact micros and round at
  // emission time, so no per-pulse drift builds up over a long recording.
  let micros = 0;
  let level = amplitude;

  const writePulseT = (tstates: number) => {
    const start = micros;
    const end = start + tstates * TSTATE_MICROS;
    out.fill(
      level,
      Math.round(start * samplesPerMicro),
      Math.round(end * samplesPerMicro),
    );
    micros = end;
    level = -level; // every pulse flips the line — that's the square wave
  };

  const writeSilence = (durMicros: number) => {
    micros += durMicros; // out is already zero-filled
  };

  writeSilence(leadingSilenceMicros);

  for (const block of blocks) {
    const pilot = pilotPulses(block, pilotScale);
    for (let i = 0; i < pilot; i++) writePulseT(PILOT_PULSE_T);
    writePulseT(SYNC1_T);
    writePulseT(SYNC2_T);
    for (const b of block.bytes) {
      for (let bit = 7; bit >= 0; bit--) {
        const pulseT = b & (1 << bit) ? BIT1_PULSE_T : BIT0_PULSE_T;
        writePulseT(pulseT);
        writePulseT(pulseT);
      }
    }
    writeSilence(blockPauseMicros);
  }

  return out;
}
