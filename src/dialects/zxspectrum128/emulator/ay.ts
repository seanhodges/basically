/**
 * AY-3-8912 PSG: register file + synthesis.
 *
 * The chip exposes 16 registers (three square-wave tone channels + noise +
 * envelope + mixer + two I/O ports). On the 128K they are reached through two
 * ports: the register number is latched by an OUT to 0xFFFD, then the selected
 * register is written via 0xBFFD (and read back via 0xFFFD). BASIC's PLAY and
 * the 128 BEEP drive it.
 *
 * Synthesis (Stage 3 of docs/contributing/emulator-audio-plan.md) runs the chip
 * as a real PSG: three 12-bit tone counters, a 17-bit noise LFSR, a 16-bit
 * envelope generator with the ten classic shapes, and a 4-bit logarithmic
 * volume table. The synth carries its counter/LFSR/envelope state across frames
 * so tones and envelopes are continuous; register writes are applied live (the
 * within-frame write timing is inaudible for BASIC sound). {@link render} ticks
 * the synth forward one 50Hz frame and returns mono Float32 samples for the
 * machine to sum with the beeper. A one-pole DC blocker on the mix keeps a
 * steady (DC) channel — common when a program parks a voice at a fixed level —
 * from clicking at playback start/stop, exactly as the beeper does.
 */

/** Output rate of the AY stream; 44100 / 50 = 882 samples per frame (integer). */
export const AY_SAMPLE_RATE = 44100;
/** Samples emitted per 50Hz frame. */
const SAMPLES_PER_FRAME = AY_SAMPLE_RATE / 50;
/** AY clock on the 128K: the 3.5469MHz CPU clock divided by two. */
const AY_CLOCK = 1773400;
/**
 * The generators advance one base step every eight AY clocks. A tone toggles on
 * each step it reaches its period, so a full square cycle is 2×period steps —
 * giving the datasheet tone frequency clock / (16 × period). Noise and the
 * envelope step every 2×period base steps, matching clock / (16 × period) and
 * the envelope's clock / (256 × period) full-cycle (16 ramp steps).
 */
const BASE_STEP_RATE = AY_CLOCK / 8;
/** Base counter steps advanced per output sample (~5.03 at 44.1kHz). */
const STEPS_PER_SAMPLE = BASE_STEP_RATE / AY_SAMPLE_RATE;

/** Per-channel peak amplitude; three channels at full volume stay below ~0.75. */
const AY_CHANNEL_AMPLITUDE = 0.25;
/** One-pole DC-blocker coefficient; ~0.995 settles a held level in a few ms. */
const DC_POLE = 0.995;
/** Below this magnitude the DC blocker has settled, so an idle frame is free. */
const SILENCE_EPS = 1e-4;

/** Shared empty result so a fully-silent frame allocates nothing. */
const EMPTY_AUDIO = new Float32Array(0);

/**
 * Logarithmic 4-bit volume table (level 0..15 → linear amplitude 0..1), the
 * widely-used AY-3-8910 curve: each step is ~3dB, so low levels are quiet and
 * the top step is unity. Scaled by {@link AY_CHANNEL_AMPLITUDE} at mix time.
 */
const VOLUME_TABLE = [
  0.0, 0.0137, 0.0205, 0.0291, 0.0423, 0.0618, 0.0847, 0.1369, 0.1691, 0.2647,
  0.3527, 0.4499, 0.5704, 0.6873, 0.8483, 1.0,
];

/**
 * Write masks per register (some are narrower than 8 bits): tone fine = 8 bits,
 * tone coarse (1/3/5) = 4 bits, noise (6) = 5 bits, mixer (7) = 8 bits, volume
 * (8/9/10) = 5 bits, envelope period (11/12) = 8 bits, envelope shape (13) =
 * 4 bits, I/O ports (14/15) = 8 bits.
 */
const REG_MASKS = [
  0xff, 0x0f, 0xff, 0x0f, 0xff, 0x0f, 0x1f, 0xff, 0x1f, 0x1f, 0x1f, 0xff, 0xff,
  0x0f, 0xff, 0xff,
];

export class Ay38912 {
  readonly sampleRate = AY_SAMPLE_RATE;

  private readonly regs = new Uint8Array(16);
  private selected = 0;

  // --- Synthesis state (carried across frames for continuous tones) ---
  /** Tone period counters and square-wave output bits, one per channel A/B/C. */
  private readonly toneCounter = [0, 0, 0];
  private readonly toneOutput = [0, 0, 0];
  /** Noise period counter, 17-bit LFSR, and its current output bit. */
  private noiseCounter = 0;
  private noiseLfsr = 1;
  private noiseOutput = 0;
  /** Fractional base-step accumulator and the envelope's step counter. */
  private stepAccumulator = 0;
  private envCounter = 0;
  /** Envelope generator: position within the current ramp + decoded shape. */
  private envStep = 0;
  private envVolume = 0;
  private envAttack = false;
  private envAlternate = false;
  private envHold = false;
  private envContinue = false;
  private envHolding = false;
  /** DC-blocker memory, kept across frames so the filter stays continuous. */
  private dcPrevIn = 0;
  private dcPrevOut = 0;

  /** OUT to 0xFFFD: latch the register number to read or write next (0-15). */
  selectRegister(reg: number): void {
    this.selected = reg & 0x0f;
  }

  /** OUT to 0xBFFD: write the latched register. */
  writeData(value: number): void {
    this.writeRegister(this.selected, value);
  }

  /** IN from 0xFFFD: read the latched register. */
  readData(): number {
    return this.readRegister(this.selected);
  }

  writeRegister(reg: number, value: number): void {
    const r = reg & 0x0f;
    this.regs[r] = value & REG_MASKS[r]!;
    // Writing the envelope-shape register (re)triggers the generator, even when
    // the value is unchanged — that is how programs retrigger an envelope.
    if (r === 13) this.startEnvelope();
  }

  readRegister(reg: number): number {
    return this.regs[reg & 0x0f]!;
  }

  reset(): void {
    this.regs.fill(0);
    this.selected = 0;
    this.toneCounter[0] = this.toneCounter[1] = this.toneCounter[2] = 0;
    this.toneOutput[0] = this.toneOutput[1] = this.toneOutput[2] = 0;
    this.noiseCounter = 0;
    this.noiseLfsr = 1;
    this.noiseOutput = 0;
    this.stepAccumulator = 0;
    this.envCounter = 0;
    this.envStep = 0;
    this.envVolume = 0;
    this.envHolding = false;
    this.dcPrevIn = 0;
    this.dcPrevOut = 0;
  }

  /** 12-bit tone period for channel c (0 behaves as 1, the minimum). */
  private tonePeriod(c: number): number {
    const p = ((this.regs[2 * c + 1]! & 0x0f) << 8) | this.regs[2 * c]!;
    return p === 0 ? 1 : p;
  }

  /** Decode a fresh write to the envelope-shape register (reg 13). */
  private startEnvelope(): void {
    const shape = this.regs[13]!;
    this.envContinue = (shape & 0x08) !== 0;
    this.envAttack = (shape & 0x04) !== 0;
    this.envAlternate = (shape & 0x02) !== 0;
    this.envHold = (shape & 0x01) !== 0;
    this.envStep = 0;
    this.envHolding = false;
    this.envCounter = 0;
    this.envVolume = this.envAttack ? 0 : 15;
  }

  /** Advance the envelope one clock/256 tick, honouring its shape. */
  private clockEnvelope(): void {
    if (this.envHolding) return;
    this.envStep++;
    if (this.envStep > 15) {
      this.envStep = 0;
      if (!this.envContinue) {
        // Shapes 0-7: one ramp, then the output sits at zero forever.
        this.envVolume = 0;
        this.envHolding = true;
        return;
      }
      if (this.envHold) {
        // Hold at the level the completed ramp would settle on.
        this.envVolume = this.envAttack !== this.envAlternate ? 15 : 0;
        this.envHolding = true;
        return;
      }
      if (this.envAlternate) this.envAttack = !this.envAttack;
    }
    this.envVolume = this.envAttack ? this.envStep : 15 - this.envStep;
  }

  /** Advance every counter one base (clock/8) step. */
  private stepBase(): void {
    for (let c = 0; c < 3; c++) {
      if (++this.toneCounter[c]! >= this.tonePeriod(c)) {
        this.toneCounter[c] = 0;
        this.toneOutput[c]! ^= 1;
      }
    }
    const noisePeriod = this.regs[6]! & 0x1f || 1;
    if (++this.noiseCounter >= 2 * noisePeriod) {
      this.noiseCounter = 0;
      // 17-bit LFSR, taps at bits 0 and 3 (the AY noise polynomial).
      const feedback = (this.noiseLfsr ^ (this.noiseLfsr >> 3)) & 1;
      this.noiseLfsr = (this.noiseLfsr >> 1) | (feedback << 16);
      this.noiseOutput = this.noiseLfsr & 1;
    }
    const envPeriod = (this.regs[12]! << 8) | this.regs[11]! || 1;
    if (++this.envCounter >= 2 * envPeriod) {
      this.envCounter = 0;
      this.clockEnvelope();
    }
  }

  /** Mixed amplitude (pre-DC-blocker) for the current synth state. */
  private mix(): number {
    const mixer = this.regs[7]!;
    let sum = 0;
    for (let c = 0; c < 3; c++) {
      const toneDisabled = (mixer >> c) & 1; // mixer bit set => tone off
      const noiseDisabled = (mixer >> (c + 3)) & 1;
      const tone = toneDisabled ? 1 : this.toneOutput[c]!;
      const noise = noiseDisabled ? 1 : this.noiseOutput;
      if (!(tone & noise)) continue; // channel gated low this sample
      const volReg = this.regs[8 + c]!;
      const level = volReg & 0x10 ? this.envVolume : volReg & 0x0f;
      sum += VOLUME_TABLE[level]!;
    }
    return sum * AY_CHANNEL_AMPLITUDE;
  }

  /** True when no channel can currently produce a non-zero amplitude. */
  private isIdle(): boolean {
    for (let c = 0; c < 3; c++) {
      const volReg = this.regs[8 + c]!;
      if (volReg & 0x10) return false; // envelope-driven: assume audible
      if ((volReg & 0x0f) !== 0) return false; // fixed non-zero level
    }
    return true;
  }

  /**
   * Render one 50Hz frame of mono samples, advancing the synth across the
   * frame. Returns an empty array once the chip is idle and the DC blocker has
   * settled, so silent frames allocate nothing (mirroring the 48K beeper).
   */
  render(): Float32Array {
    if (this.isIdle() && Math.abs(this.dcPrevOut) < SILENCE_EPS) {
      this.dcPrevIn = 0;
      this.dcPrevOut = 0;
      return EMPTY_AUDIO;
    }

    const out = new Float32Array(SAMPLES_PER_FRAME);
    let prevIn = this.dcPrevIn;
    let prevOut = this.dcPrevOut;
    for (let i = 0; i < SAMPLES_PER_FRAME; i++) {
      this.stepAccumulator += STEPS_PER_SAMPLE;
      while (this.stepAccumulator >= 1) {
        this.stepBase();
        this.stepAccumulator -= 1;
      }
      const x = this.mix();
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
