/**
 * Host-side VIC-I (6561) sound renderer — an approximation.
 *
 * The VIC-20 stage of the emulator-audio work, modelled on the C64's
 * {@link import('../c64/sid').SidRenderer}. The VIC-I's sound generator is far
 * simpler than the SID: three square-wave voices an octave apart (bass $900A,
 * alto $900B, soprano $900C) plus a noise voice ($900D), with no envelopes and
 * a single 4-bit master volume in the low nibble of $900E. Each voice register
 * holds an enable flag in bit 7 and a 7-bit value X in bits 0–6; the output
 * frequency is
 *
 *   f = CLOCK / (divisor × (128 − X))
 *
 * with divisor 1024 / 512 / 256 for bass/alto/soprano and 128 for the noise
 * LFSR clock, at the PAL system clock of 1.108404 MHz.
 *
 * The machine calls {@link VicAudioRenderer.render} once per frame with the
 * VIC-I's side-effect-free register reader; the renderer synthesizes one 50Hz
 * frame of mono samples. Like the SID renderer, a one-pole DC blocker keeps a
 * held level from clicking at start/stop, and a fully-idle frame allocates
 * nothing (the shared empty array).
 *
 * Known approximations: the real chip clocks each voice's shift register from
 * a divider chain (so the square edges quantize to the divider) and its noise
 * generator has an exact LFSR layout; here the tone voices are ideal square
 * waves from a phase accumulator and noise is a generic broadband LFSR.
 */

/** Output rate of the stream; 44100 / 50 = 882 samples per frame (integer). */
export const VIC_AUDIO_SAMPLE_RATE = 44100;
/** Samples emitted per 50Hz frame. */
const SAMPLES_PER_FRAME = VIC_AUDIO_SAMPLE_RATE / 50;
/** PAL VIC-20 system clock feeding the sound dividers (Hz). */
const VIC_CLOCK_PAL = 1_108_404;

/** The four voice registers' offsets in the VIC file ($900A–$900D). */
const VOICE_REGS = [0x0a, 0x0b, 0x0c, 0x0d] as const;
/** Per-voice frequency divisor: bass, alto, soprano, noise LFSR clock. */
const VOICE_DIVISOR = [1024, 512, 256, 128] as const;
/** $900E: master volume in the low nibble (the high nibble is aux colour). */
const REG_VOLUME = 0x0e;

/** Voice-register bit 7 enables the voice; bits 0–6 are the X frequency value. */
const VOICE_ENABLE = 0x80;
const VOICE_X_MASK = 0x7f;

/** Per-voice peak amplitude; four voices at unity stay below ~1. */
const VOICE_AMPLITUDE = 0.25;
/** One-pole DC-blocker coefficient; ~0.995 settles a held level in a few ms. */
const DC_POLE = 0.995;
/** Below this magnitude the DC blocker has settled, so an idle frame is free. */
const SILENCE_EPS = 1e-4;

/** Shared empty result so a fully-silent frame allocates nothing. */
const EMPTY_AUDIO = new Float32Array(0);

/** Reads a VIC-I register (0..15) without side effects. */
export type VicRegisterReader = (reg: number) => number;

/**
 * Output frequency in Hz for voice `v` (0=bass, 1=alto, 2=soprano, 3=noise
 * clock) with register value X (bits 0–6). X = 127 would divide by 1 — the
 * hardware's silent degenerate case — and is clamped away by the 128 − X term
 * never reaching 0 for the 0–126 values BASIC programs use.
 */
export function vicVoiceFreqHz(v: number, x: number): number {
  return VIC_CLOCK_PAL / (VOICE_DIVISOR[v]! * (128 - (x & VOICE_X_MASK)));
}

export class VicAudioRenderer {
  readonly sampleRate = VIC_AUDIO_SAMPLE_RATE;

  // --- Synthesis state, carried across frames for continuous waveforms ---
  /** Per-voice oscillator phase in [0, 1) (the noise voice's LFSR-clock phase). */
  private readonly phase = [0, 0, 0, 0];
  /** Noise LFSR and its held output sample. */
  private noiseLfsr = 0x7ffff8;
  private noiseValue = 0;
  /** DC-blocker memory, kept across frames so the filter stays continuous. */
  private dcPrevIn = 0;
  private dcPrevOut = 0;

  reset(): void {
    for (let v = 0; v < 4; v++) this.phase[v] = 0;
    this.noiseLfsr = 0x7ffff8;
    this.noiseValue = 0;
    this.dcPrevIn = 0;
    this.dcPrevOut = 0;
  }

  /** Clock the noise LFSR once and resample its held output value. */
  private clockNoise(): void {
    // 23-bit LFSR, the same generic broadband source as the SID renderer's.
    let lfsr = this.noiseLfsr;
    const feedback = ((lfsr >> 22) ^ (lfsr >> 17)) & 1;
    lfsr = ((lfsr << 1) | feedback) & 0x7fffff;
    this.noiseLfsr = lfsr;
    // The held output is the fresh feedback bit as a bipolar level — a random
    // square wave at the LFSR clock, like the chip's own single-bit noise
    // output (the VIC clocks its shift register only once per noise period, so
    // a multi-bit mapping would drift rather than flip).
    this.noiseValue = feedback ? 1 : -1;
  }

  /**
   * Render one 50Hz frame of mono samples from the current register state.
   * Returns an empty array once the chip is idle (volume 0 or no voice
   * enabled) and the DC blocker has settled, so silent frames allocate
   * nothing.
   */
  render(readRegister: VicRegisterReader): Float32Array {
    const master = (readRegister(REG_VOLUME) & 0x0f) / 15;
    const regs = VOICE_REGS.map((r) => readRegister(r));
    const anyVoice = regs.some((r) => (r & VOICE_ENABLE) !== 0);

    if ((master === 0 || !anyVoice) && Math.abs(this.dcPrevOut) < SILENCE_EPS) {
      this.dcPrevIn = 0;
      this.dcPrevOut = 0;
      return EMPTY_AUDIO;
    }

    // Per-voice phase increment per output sample.
    const inc = regs.map(
      (r, v) => vicVoiceFreqHz(v, r & VOICE_X_MASK) / VIC_AUDIO_SAMPLE_RATE,
    );

    const out = new Float32Array(SAMPLES_PER_FRAME);
    let prevIn = this.dcPrevIn;
    let prevOut = this.dcPrevOut;
    for (let i = 0; i < SAMPLES_PER_FRAME; i++) {
      let sum = 0;
      for (let v = 0; v < 4; v++) {
        // Advance the phase even when the voice is disabled, so re-enabling
        // resumes a continuous waveform.
        const phase = (this.phase[v] = (this.phase[v]! + inc[v]!) % 1);
        if (v === 3) {
          // Noise: each oscillator period clocks the LFSR once; the held value
          // is the output. Detect the wrap via phase < inc.
          if (phase < inc[v]!) this.clockNoise();
          if (regs[v]! & VOICE_ENABLE) {
            sum += this.noiseValue * VOICE_AMPLITUDE;
          }
        } else if (regs[v]! & VOICE_ENABLE) {
          sum += (phase < 0.5 ? 1 : -1) * VOICE_AMPLITUDE;
        }
      }
      const x = sum * master;
      // y[n] = x[n] - x[n-1] + R*y[n-1]: passes AC tones, removes the DC offset.
      const y = x - prevIn + DC_POLE * prevOut;
      prevIn = x;
      prevOut = y;
      out[i] = y;
    }
    this.dcPrevIn = prevIn;
    this.dcPrevOut = prevOut;
    return out;
  }
}
