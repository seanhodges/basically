import type { Via6522 } from '../commodore/via6522';

/**
 * Host-side synthesis of the PET's CB2 "piezo" sound — the machine's only
 * audio. The classic BASIC recipe puts the VIA shift register into free-run
 * output mode (`POKE 59467,16` → ACR shift mode `100`), loads an 8-bit pattern
 * (`POKE 59466,15` → SR = $0F, a square wave) and sets the rate via Timer 2's
 * low-order latch (`POKE 59464,N`); the pattern then cycles out on the CB2 pin
 * forever, one bit per 2×(N+2) CPU cycles, so the canonical $0F pattern sounds
 * at f = 1MHz / (16 × (N+2)) — matching the published PET frequency tables.
 *
 * Modeled on the C64's {@link import('../c64/sid').SidRenderer}: rather than
 * clocking the shift register cycle-by-cycle, the pattern is treated as a
 * cyclic bitstream sampled with a phase accumulator at the shift rate, the
 * bit level (±amplitude) is passed through a one-pole DC blocker so start/stop
 * don't click, and a fully-silent frame returns a shared empty array so an
 * idle machine allocates nothing.
 */

/** Output rate of the CB2 stream; 44100 / 50 = 882 samples per frame (integer). */
export const CB2_SAMPLE_RATE = 44100;
/** Samples emitted per 50Hz frame. */
export const CB2_SAMPLES_PER_FRAME = CB2_SAMPLE_RATE / 50;
/** PET CPU clock feeding the VIA's Timer 2 (Hz). */
const CPU_CLOCK = 1_000_000;
/** Peak amplitude of the single square-ish voice. */
const AMPLITUDE = 0.25;
/** One-pole DC-blocker coefficient; ~0.995 settles a held level in a few ms. */
const DC_POLE = 0.995;
/** Below this magnitude the DC blocker has settled, so an idle frame is free. */
const SILENCE_EPS = 1e-4;

/** Shared empty result so a fully-silent frame allocates nothing. */
const EMPTY_AUDIO = new Float32Array(0);

export class Cb2Audio {
  readonly sampleRate = CB2_SAMPLE_RATE;

  /** Fractional position within the 8-bit pattern, in [0, 8). */
  private bitPhase = 0;
  /** DC-blocker memory, kept across frames so the filter stays continuous. */
  private dcPrevIn = 0;
  private dcPrevOut = 0;

  constructor(private readonly via: Via6522) {}

  reset(): void {
    this.bitPhase = 0;
    this.dcPrevIn = 0;
    this.dcPrevOut = 0;
  }

  /**
   * Render one 50Hz frame of mono samples from the VIA's current shift-register
   * state. Silent when the shift register is not free-running out on CB2, or
   * when the pattern is $00/$FF (a constant line makes no sound); once the DC
   * blocker has settled a silent frame returns the shared empty array.
   */
  render(): Float32Array {
    const pattern = this.via.shiftRegister();
    const active =
      this.via.shiftFreeRunningOut() && pattern !== 0x00 && pattern !== 0xff;
    if (!active && Math.abs(this.dcPrevOut) < SILENCE_EPS) {
      this.bitPhase = 0;
      this.dcPrevIn = 0;
      this.dcPrevOut = 0;
      return EMPTY_AUDIO;
    }

    // Free-run shift rate: one bit per 2×(N+2) CPU cycles (6522 datasheet),
    // N = the T2 low-order latch. Expressed as pattern bits per output sample.
    const bitsPerSecond = CPU_CLOCK / (2 * (this.via.t2LowLatch() + 2));
    const inc = bitsPerSecond / CB2_SAMPLE_RATE;

    const out = new Float32Array(CB2_SAMPLES_PER_FRAME);
    let phase = this.bitPhase;
    let prevIn = this.dcPrevIn;
    let prevOut = this.dcPrevOut;
    for (let i = 0; i < CB2_SAMPLES_PER_FRAME; i++) {
      // MSB shifts out first, so bit 7 - floor(phase) is the pin level.
      const bit = (pattern >> (7 - Math.floor(phase))) & 1;
      const x = active ? (bit ? AMPLITUDE : -AMPLITUDE) : 0;
      phase = (phase + inc) % 8;
      // y[n] = x[n] - x[n-1] + R*y[n-1]: passes AC tones, removes the DC offset.
      const y = x - prevIn + DC_POLE * prevOut;
      prevIn = x;
      prevOut = y;
      out[i] = y;
    }
    this.bitPhase = phase;
    this.dcPrevIn = prevIn;
    this.dcPrevOut = prevOut;
    return out;
  }
}
