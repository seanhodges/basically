/**
 * Software SID (6581) renderer — an approximation.
 *
 * The Commodore 64 stage of the emulator-audio work. The vendored viciious
 * SID core (target/sid.js) emulates only the ADSR envelope generator and
 * delegates the actual waveform synthesis to the host: it pushes every register
 * write through {@link onRegWrite} and the per-voice envelope amplitude through
 * {@link setVoiceVolume}. This renderer is that host. From the register file it
 * recovers each voice's frequency, waveform and pulse width; it multiplies the
 * generated waveform by the envelope amplitude viciious supplies and the master
 * volume, mixes the three voices, and hands the mono Float32 frame to
 * {@link C64Machine.readAudio}.
 *
 * Known limitations (the plan accepts an approximation, to be refined later):
 *  - No filter (the $D418 filter mode / resonance / cutoff are ignored).
 *  - No ring modulation or hard sync (control bits 1/2 are ignored).
 *  - Combined waveforms (more than one waveform bit set) are not AND-ed as on
 *    real hardware; a single waveform is chosen by priority.
 *  - Noise is a generic LFSR, not the SID's exact 23-bit tap layout.
 *
 * Like the AY synth, a one-pole DC blocker on the mix keeps a steady (held)
 * level from clicking at start/stop, and a fully-idle frame allocates nothing.
 */

/** Output rate of the SID stream; 44100 / 50 = 882 samples per frame (integer). */
export const SID_SAMPLE_RATE = 44100;
/** Samples emitted per 50Hz frame. */
const SAMPLES_PER_FRAME = SID_SAMPLE_RATE / 50;
/** PAL system clock feeding the SID oscillators (Hz). */
const SID_CLOCK_PAL = 985248;
/**
 * Oscillator frequency in Hz for a 16-bit register value Fn:
 * f = Fn × clock / 2^24. Pre-divided so a render multiplies once per voice.
 */
const FREQ_SCALE = SID_CLOCK_PAL / 0x1000000;

/** SID register file size ($D400–$D41C, mirrored every 0x20). */
const SID_REGS = 0x20;
/** Per-voice peak amplitude; three voices at unity stay below ~0.75. */
const VOICE_AMPLITUDE = 0.25;
/** One-pole DC-blocker coefficient; ~0.995 settles a held level in a few ms. */
const DC_POLE = 0.995;
/** Below this magnitude the DC blocker has settled, so an idle frame is free. */
const SILENCE_EPS = 1e-4;
/**
 * Noise LFSR clock rate relative to the oscillator fundamental. On real
 * hardware the noise shift register is clocked from accumulator bit 19, which
 * toggles ~32× faster than the oscillator's fundamental frequency — so noise is
 * broadband rather than a buzz at the fundamental.
 */
const NOISE_CLOCK_RATIO = 32;

/** Control-register bits (per voice control register, e.g. $D404). */
const CTRL_TEST = 0x08;
const CTRL_TRIANGLE = 0x10;
const CTRL_SAWTOOTH = 0x20;
const CTRL_PULSE = 0x40;
const CTRL_NOISE = 0x80;

/** Shared empty result so a fully-silent frame allocates nothing. */
const EMPTY_AUDIO = new Float32Array(0);

/** The three voices' base register offsets within the file ($D400/$D407/$D40E). */
const VOICE_BASE = [0x00, 0x07, 0x0e];

export class SidRenderer {
  readonly sampleRate = SID_SAMPLE_RATE;

  /** Mirror of the writable SID register file, fed by {@link onRegWrite}. */
  private readonly regs = new Uint8Array(SID_REGS);
  /** Per-voice envelope amplitude (0..1), fed by {@link setVoiceVolume}. */
  private readonly envAmp = [0, 0, 0];

  // --- Synthesis state, carried across frames for continuous waveforms ---
  /** Per-voice oscillator phase in [0, 1). */
  private readonly phase = [0, 0, 0];
  /** Per-voice noise LFSR, fractional clock accumulator, and held output. */
  private readonly noiseLfsr = [0x7ffff8, 0x7ffff8, 0x7ffff8];
  private readonly noiseAcc = [0, 0, 0];
  private readonly noiseValue = [0, 0, 0];
  /** DC-blocker memory, kept across frames so the filter stays continuous. */
  private dcPrevIn = 0;
  private dcPrevOut = 0;

  /** Host hook for viciious: a SID register was written (reg 0..0x1f). */
  readonly onRegWrite = (reg: number, byte: number): void => {
    this.regs[reg & (SID_REGS - 1)] = byte & 0xff;
  };

  /** Host hook for viciious: a voice's ADSR envelope amplitude changed (0..1). */
  readonly setVoiceVolume = (voice: number, value: number): void => {
    if (voice >= 0 && voice < 3) this.envAmp[voice] = value;
  };

  reset(): void {
    this.regs.fill(0);
    for (let v = 0; v < 3; v++) {
      this.envAmp[v] = 0;
      this.phase[v] = 0;
      this.noiseLfsr[v] = 0x7ffff8;
      this.noiseAcc[v] = 0;
      this.noiseValue[v] = 0;
    }
    this.dcPrevIn = 0;
    this.dcPrevOut = 0;
  }

  /** 16-bit oscillator value for voice v → output frequency in Hz. */
  private voiceFreqHz(v: number): number {
    const base = VOICE_BASE[v]!;
    const fn = this.regs[base]! | (this.regs[base + 1]! << 8);
    return fn * FREQ_SCALE;
  }

  /** 12-bit pulse-width duty for voice v, as a fraction in [0, 1). */
  private voicePulseWidth(v: number): number {
    const base = VOICE_BASE[v]!;
    const pw = this.regs[base + 2]! | ((this.regs[base + 3]! & 0x0f) << 8);
    return pw / 0x1000;
  }

  /** Clock a voice's noise LFSR once and resample its held output value. */
  private clockNoise(v: number): void {
    // 23-bit Galois-style LFSR; a generic broadband source (not the SID's exact
    // tap layout — see the module limitations).
    let lfsr = this.noiseLfsr[v]!;
    const feedback = ((lfsr >> 22) ^ (lfsr >> 17)) & 1;
    lfsr = ((lfsr << 1) | feedback) & 0x7fffff;
    this.noiseLfsr[v] = lfsr;
    // Map the top 8 bits to a bipolar sample.
    this.noiseValue[v] = ((lfsr >> 15) & 0xff) / 127.5 - 1;
  }

  /**
   * Generate one voice's waveform sample for its current phase, advancing the
   * phase (and clocking noise on each wrap). Returns a value in [-1, 1].
   */
  private voiceSample(v: number, inc: number): number {
    const ctrl = this.regs[VOICE_BASE[v]! + 4]!;
    // Test bit holds the oscillator reset; output silence and re-zero phase.
    if (ctrl & CTRL_TEST) {
      this.phase[v] = 0;
      return 0;
    }
    const phase = (this.phase[v] = (this.phase[v]! + inc) % 1);

    // Single waveform by priority (combined waveforms are not AND-ed here).
    if (ctrl & CTRL_NOISE) {
      this.noiseAcc[v]! += inc * NOISE_CLOCK_RATIO;
      while (this.noiseAcc[v]! >= 1) {
        this.clockNoise(v);
        this.noiseAcc[v]! -= 1;
      }
      return this.noiseValue[v]!;
    }
    if (ctrl & CTRL_PULSE) {
      return phase < this.voicePulseWidth(v) ? 1 : -1;
    }
    if (ctrl & CTRL_SAWTOOTH) {
      return 2 * phase - 1;
    }
    if (ctrl & CTRL_TRIANGLE) {
      // -1 at phase 0, +1 at 0.5, back to -1 at 1.
      return phase < 0.5 ? 4 * phase - 1 : 3 - 4 * phase;
    }
    return 0; // no waveform selected
  }

  /** Master volume ($D418 low nibble) as a fraction in [0, 1]. */
  private masterVolume(): number {
    return (this.regs[0x18]! & 0x0f) / 15;
  }

  /** True when nothing can currently produce a non-zero amplitude. */
  private isIdle(): boolean {
    if (this.masterVolume() === 0) return true;
    return this.envAmp[0] === 0 && this.envAmp[1] === 0 && this.envAmp[2] === 0;
  }

  /**
   * Render one 50Hz frame of mono samples, advancing every voice across the
   * frame. Returns an empty array once the chip is idle and the DC blocker has
   * settled, so silent frames allocate nothing (mirroring the AY/beeper).
   */
  render(): Float32Array {
    if (this.isIdle() && Math.abs(this.dcPrevOut) < SILENCE_EPS) {
      this.dcPrevIn = 0;
      this.dcPrevOut = 0;
      return EMPTY_AUDIO;
    }

    // Voice 3 can be muted independently via $D418 bit 7.
    const voice3Off = (this.regs[0x18]! & 0x80) !== 0;
    const master = this.masterVolume();
    const inc = [
      this.voiceFreqHz(0) / SID_SAMPLE_RATE,
      this.voiceFreqHz(1) / SID_SAMPLE_RATE,
      this.voiceFreqHz(2) / SID_SAMPLE_RATE,
    ];

    const out = new Float32Array(SAMPLES_PER_FRAME);
    let prevIn = this.dcPrevIn;
    let prevOut = this.dcPrevOut;
    for (let i = 0; i < SAMPLES_PER_FRAME; i++) {
      let sum = 0;
      for (let v = 0; v < 3; v++) {
        const w = this.voiceSample(v, inc[v]!); // advance phase even when muted
        if (v === 2 && voice3Off) continue;
        sum += w * this.envAmp[v]! * VOICE_AMPLITUDE;
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
