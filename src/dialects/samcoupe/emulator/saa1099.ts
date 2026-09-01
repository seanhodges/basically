/**
 * The Philips SAA1099, the SAM's sound chip.
 *
 * Six tone generators in stereo over eight octaves, two noise generators, two
 * envelope generators and an amplitude controller per channel. The AY in
 * `src/emulator/ay/` is the model for the *shape* of this file - a chip ticked
 * forward one frame at a time, accumulating samples the machine drains - and
 * for nothing else: the register model has no overlap with the AY's.
 *
 * Registers, written as an address latch on port 0x1FF and data on 0xFF:
 *
 *   0x00-0x05  amplitude: low nibble left, high nibble right, 0-15 each
 *   0x08-0x0D  frequency, 8 bits, one per channel
 *   0x10-0x12  octave, one channel per nibble (0-7); 0x10 is channels 0 and 1
 *   0x14       tone enable, bits 0-5
 *   0x15       noise enable, bits 0-5
 *   0x16       noise generator clock: bits 0-1 for generator 0, 4-5 for 1
 *   0x18/0x19  envelope control for generator 0 (channel 2) and 1 (channel 5)
 *   0x1C       bit 0 enables all sound; bit 1 holds the generators in reset
 *
 * A tone's frequency is `15625 * 2^octave / (511 - freq)` off the SAM's 8MHz
 * chip clock, which is the datasheet formula rather than a fit: the octave
 * divider and the 511-step counter are both literal.
 *
 * The output is summed to mono. The IDE's audio path takes one Float32 stream,
 * and a stereo image is worth less here than the six channels being audible at
 * all; a program that pans a voice hard left still sounds, at half amplitude.
 */

/** Output rate: 44100 / 50 is an integer, so a frame is a whole 882 samples. */
export const SAA_SAMPLE_RATE = 44100;
/** Samples emitted per 50Hz frame. */
export const SAA_SAMPLES_PER_FRAME = SAA_SAMPLE_RATE / 50;
/** The chip's clock on the SAM: a flat 8MHz. */
export const SAA_CLOCK = 8_000_000;

/**
 * Every generator runs off the clock divided by 256 - 31.25kHz, the datasheet's
 * fastest noise clock and the rate the tone counters step at. A tone toggles
 * every `(511 - freq) / 2^octave` steps, so a full square cycle is twice that
 * and the pitch comes out at the datasheet's `15625 * 2^octave / (511 - freq)`.
 */
const BASE_DIVIDER = 256;

/** Six channels at full volume must stay inside the mix. */
const CHANNEL_AMPLITUDE = 1 / 12;
/** One-pole DC-blocker coefficient, as the AY and the beeper use. */
const DC_POLE = 0.995;
/** Below this the DC blocker has settled, so an idle frame costs nothing. */
const SILENCE_EPS = 1e-4;

/** Shared empty result so a silent frame allocates nothing. */
const EMPTY_AUDIO = new Float32Array(0);

/** Registers the chip decodes; the gaps in between read and write as nothing. */
const REG_COUNT = 0x20;

/**
 * Envelope shapes, indexed by control bits 1-3. Each is the sequence of
 * amplitudes (0-15) one envelope cycle steps through; the generator walks it
 * and either stops at the end or wraps, per the control's bit 7.
 *
 * The datasheet names eight: zero, maximum, one decay, one repeating decay, one
 * attack, a repeating attack, a triangle down-up, and a repeating triangle.
 * Resolution is either 16 steps or 8 (control bit 4 doubles the step), which is
 * applied when the table is read rather than by keeping two tables.
 */
const ENVELOPE_SHAPES: readonly (readonly number[])[] = [
  [0], // 000: zero amplitude
  [15], // 001: maximum amplitude
  ramp(15, 0), // 010: single decay
  ramp(15, 0), // 011: repetitive decay
  ramp(0, 15), // 100: single attack
  ramp(0, 15), // 101: repetitive attack
  [...ramp(0, 15), ...ramp(15, 0)], // 110: single triangle
  [...ramp(0, 15), ...ramp(15, 0)], // 111: repetitive triangle
];

/** Shapes that repeat rather than stopping at the end of one cycle. */
const ENVELOPE_REPEATS = [false, false, false, true, false, true, false, true];

function ramp(from: number, to: number): number[] {
  const step = from < to ? 1 : -1;
  const out: number[] = [];
  for (let v = from; v !== to + step; v += step) out.push(v);
  return out;
}

export class Saa1099 {
  readonly sampleRate = SAA_SAMPLE_RATE;

  private readonly regs = new Uint8Array(REG_COUNT);
  private selected = 0;

  /** Base steps per output sample, fixed by the clock and the sample rate. */
  private readonly stepsPerSample = SAA_CLOCK / BASE_DIVIDER / SAA_SAMPLE_RATE;
  private stepAccumulator = 0;

  /** Tone counters and square-wave outputs, one per channel. */
  private readonly toneCounter = new Float64Array(6);
  private readonly toneOutput = new Uint8Array(6);
  /** Noise counters, LFSRs and outputs, one per generator. */
  private readonly noiseCounter = new Float64Array(2);
  private readonly noiseLfsr = new Uint32Array(2).fill(1);
  private readonly noiseOutput = new Uint8Array(2);
  /** Envelope generators: position in the shape, and whether each has stopped. */
  private readonly envPosition = new Uint8Array(2);
  private readonly envHolding = new Uint8Array(2);
  /** Envelope clock: each generator steps on its channel's tone edge. */
  private readonly envPrevClock = new Uint8Array(2);

  private dcPrevIn = 0;
  private dcPrevOut = 0;

  /** OUT to 0x1FF: latch the register the next data write lands in. */
  selectRegister(reg: number): void {
    this.selected = reg & 0x1f;
  }

  /** OUT to 0xFF: write the latched register. */
  writeData(value: number): void {
    this.write(this.selected, value);
  }

  write(address: number, value: number): void {
    const reg = address & 0x1f;
    this.regs[reg] = value & 0xff;
    // Writing an envelope control register retriggers that generator, which is
    // how a program restarts an envelope without changing its shape.
    if (reg === 0x18 || reg === 0x19) {
      const gen = reg - 0x18;
      this.envPosition[gen] = 0;
      this.envHolding[gen] = 0;
    }
    // Bit 1 of 0x1C resets every generator, and holds them while it is set.
    if (reg === 0x1c && value & 0x02) this.resetGenerators();
  }

  reset(): void {
    this.regs.fill(0);
    this.selected = 0;
    this.resetGenerators();
    this.dcPrevIn = 0;
    this.dcPrevOut = 0;
  }

  private resetGenerators(): void {
    this.toneCounter.fill(0);
    this.toneOutput.fill(0);
    this.noiseCounter.fill(0);
    this.noiseLfsr.fill(1);
    this.noiseOutput.fill(0);
    this.envPosition.fill(0);
    this.envHolding.fill(0);
    this.envPrevClock.fill(0);
    this.stepAccumulator = 0;
  }

  /**
   * Base steps between edges of channel `c`'s square wave: the datasheet's
   * `511 - freq`, halved per octave below the top one.
   */
  private tonePeriod(c: number): number {
    const freq = this.regs[0x08 + c]!;
    const octaveReg = this.regs[0x10 + (c >> 1)]!;
    const octave = c & 1 ? (octaveReg >> 4) & 7 : octaveReg & 7;
    return (511 - freq) / (1 << octave);
  }

  /**
   * Base steps between noise shifts. Modes 0-2 divide the 8MHz clock by 256,
   * 512 and 1024 - the datasheet's 31.25kHz, 15.6kHz and 7.8kHz - which against
   * a base step of clock/256 is one step, two and four. Mode 3 clocks the
   * generator off the tone generator beside it instead: channel 0 for generator
   * 0, channel 3 for generator 1, so the noise tracks the note.
   */
  private noisePeriod(gen: number): number {
    const mode = (this.regs[0x16]! >> (gen * 4)) & 3;
    if (mode === 3) return this.tonePeriod(gen * 3);
    return 1 << mode;
  }

  /** The amplitude a channel is currently sounding at, 0-15 per side summed. */
  private channelLevel(c: number): number {
    const amp = this.regs[c]!;
    let level = ((amp & 0x0f) + ((amp >> 4) & 0x0f)) / 2;
    // Channels 2 and 5 can take their amplitude from an envelope generator
    // instead, which scales whatever the register holds.
    const gen = c === 2 ? 0 : c === 5 ? 1 : -1;
    if (gen >= 0 && this.regs[0x18 + gen]! & 0x80) {
      level = (level * this.envelopeAmplitude(gen)) / 15;
    }
    return level;
  }

  /** Where envelope generator `gen` currently sits, 0-15. */
  private envelopeAmplitude(gen: number): number {
    const control = this.regs[0x18 + gen]!;
    const shape = ENVELOPE_SHAPES[(control >> 1) & 7]!;
    // Bit 4 halves the resolution: the same shape in eight steps of two.
    const coarse = (control & 0x10) !== 0;
    const index = Math.min(this.envPosition[gen]!, shape.length - 1);
    const value = shape[index]!;
    return coarse ? value & ~1 : value;
  }

  private stepEnvelope(gen: number): void {
    if (this.envHolding[gen]) return;
    const control = this.regs[0x18 + gen]!;
    const shapeIndex = (control >> 1) & 7;
    const shape = ENVELOPE_SHAPES[shapeIndex]!;
    const next = this.envPosition[gen]! + 1;
    if (next < shape.length) {
      this.envPosition[gen] = next;
      return;
    }
    if (ENVELOPE_REPEATS[shapeIndex]) this.envPosition[gen] = 0;
    else this.envHolding[gen] = 1;
  }

  /** Advance every generator one base (clock/256) step. */
  private stepBase(): void {
    // Bit 1 of 0x1C holds every generator still for as long as it is set, which
    // is how a program lines several channels up before letting them run.
    if (this.regs[0x1c]! & 0x02) return;
    for (let c = 0; c < 6; c++) {
      const period = this.tonePeriod(c);
      if (++this.toneCounter[c]! >= period) {
        this.toneCounter[c]! -= period;
        this.toneOutput[c] ^= 1;
      }
    }
    for (let gen = 0; gen < 2; gen++) {
      const period = this.noisePeriod(gen);
      if (++this.noiseCounter[gen]! >= period) {
        this.noiseCounter[gen]! -= period;
        // 17-bit LFSR with taps at 0 and 5, the SAA's noise polynomial.
        const lfsr = this.noiseLfsr[gen]!;
        const feedback = (lfsr ^ (lfsr >> 5)) & 1;
        this.noiseLfsr[gen] = (lfsr >> 1) | (feedback << 16);
        this.noiseOutput[gen] = this.noiseLfsr[gen]! & 1;
      }
      // The envelope steps on the falling edge of channel 1's (or channel 4's)
      // tone, which is what ties an envelope's speed to the note it shapes.
      // Only that internal clock is modelled; the chip can also be clocked
      // externally off writes to the envelope register, which nothing on this
      // machine does.
      const clock = this.toneOutput[gen === 0 ? 1 : 4]!;
      if (this.envPrevClock[gen] && !clock) this.stepEnvelope(gen);
      this.envPrevClock[gen] = clock;
    }
  }

  /** Mixed amplitude (pre-DC-blocker) for the current state. */
  private mix(): number {
    if (!(this.regs[0x1c]! & 0x01)) return 0; // sound disabled
    const toneEnable = this.regs[0x14]!;
    const noiseEnable = this.regs[0x15]!;
    let sum = 0;
    for (let c = 0; c < 6; c++) {
      const tone = toneEnable & (1 << c) ? this.toneOutput[c]! : 0;
      const noise =
        noiseEnable & (1 << c) ? this.noiseOutput[c < 3 ? 0 : 1]! : 0;
      if (!(tone | noise)) continue;
      sum += (this.channelLevel(c) / 15) * CHANNEL_AMPLITUDE;
    }
    return sum;
  }

  /** True when nothing can currently make a sound. */
  private isIdle(): boolean {
    if (!(this.regs[0x1c]! & 0x01)) return true;
    if (!(this.regs[0x14]! | this.regs[0x15]!)) return true;
    for (let c = 0; c < 6; c++) if (this.regs[c]! !== 0) return false;
    return true;
  }

  /**
   * One frame of mono samples, mixed down from the stereo pair. Returns an
   * empty array while the chip is idle and the DC blocker has settled, so a
   * silent program allocates nothing.
   */
  drain(): Float32Array {
    if (this.isIdle() && Math.abs(this.dcPrevOut) < SILENCE_EPS) {
      this.dcPrevIn = 0;
      this.dcPrevOut = 0;
      return EMPTY_AUDIO;
    }
    const out = new Float32Array(SAA_SAMPLES_PER_FRAME);
    let prevIn = this.dcPrevIn;
    let prevOut = this.dcPrevOut;
    for (let i = 0; i < SAA_SAMPLES_PER_FRAME; i++) {
      this.stepAccumulator += this.stepsPerSample;
      while (this.stepAccumulator >= 1) {
        this.stepBase();
        this.stepAccumulator -= 1;
      }
      const x = this.mix();
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
