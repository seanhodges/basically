/**
 * ZX Spectrum 48K beeper synthesis.
 *
 * The ULA drives the loudspeaker from bit 4 of every write to port 0xFE: each
 * flip of that bit moves the speaker cone, so a BASIC `BEEP` toggles it to make
 * a square wave. The machine records each write with the cycle-within-frame it
 * happened at (see spectrumMachine.ts); {@link Beeper.render} then replays that
 * timeline into one 50Hz frame of mono samples, point-sampling the held level
 * at {@link BEEPER_SAMPLE_RATE}.
 *
 * A one-pole DC blocker sits on the output. Without it a steady speaker line
 * (the common idle state, and the tail of every beep) would be a constant
 * offset — inaudible as a tone but a source of clicks whenever playback starts,
 * stops or underruns. With it, a held level decays smoothly to zero exactly as
 * the real cone settles, while square-wave tones pass through untouched. This is
 * the only stateful synthesis here, which is why it lives in its own pure module
 * with colocated tests rather than inside the machine.
 */

/** Output rate of the beeper stream; 44100 / 50 = 882 samples per frame (integer). */
export const BEEPER_SAMPLE_RATE = 44100;
/** Cone deflection for a high speaker bit, below the headroom the host gain adds. */
export const BEEPER_AMPLITUDE = 0.6;

/** Samples emitted per 50Hz frame. */
const SAMPLES_PER_FRAME = BEEPER_SAMPLE_RATE / 50;
/** Speaker output is bit 4 of the value written to port 0xFE. */
const SPEAKER_BIT = 0x10;
/** One-pole DC-blocker coefficient; ~0.995 gives a few-millisecond settle at 44.1kHz. */
const DC_POLE = 0.995;
/** Below this magnitude the DC blocker has settled, so a silent frame can allocate nothing. */
const SILENCE_EPS = 1e-4;

/** Shared empty result so a fully-silent frame allocates nothing. */
const EMPTY_AUDIO = new Float32Array(0);

interface Transition {
  /** Offset within the frame, in T-states, at which the level changed. */
  cycle: number;
  /** New speaker level (0 or 1). */
  level: number;
}

export class Beeper {
  readonly sampleRate = BEEPER_SAMPLE_RATE;

  /** Current speaker level (the last bit 4 written). */
  private level = 0;
  /** Speaker level at the start of the frame not yet rendered. */
  private startLevel = 0;
  /** Level changes recorded during the pending frame, in cycle order. */
  private transitions: Transition[] = [];
  /** DC-blocker memory carried across frames so the filter is continuous. */
  private dcPrevIn = 0;
  private dcPrevOut = 0;

  /**
   * Record a write to port 0xFE at the given cycle offset within the current
   * frame. Only level changes are stored — a write that doesn't flip bit 4
   * (e.g. a border-only change) costs nothing.
   */
  write(cycle: number, portValue: number): void {
    const level = (portValue & SPEAKER_BIT) === 0 ? 0 : 1;
    if (level === this.level) return;
    this.level = level;
    this.transitions.push({ cycle, level });
  }

  /**
   * Render one frame, replaying the recorded transitions across `frameCycles`
   * T-states, then arm the next frame (carrying the held level and DC-blocker
   * state forward). Returns an empty array once the machine is fully silent —
   * a steady-low speaker with the DC blocker settled — so idle frames are free.
   */
  render(frameCycles: number): Float32Array {
    if (
      this.transitions.length === 0 &&
      this.level === 0 &&
      this.startLevel === 0 &&
      Math.abs(this.dcPrevOut) < SILENCE_EPS
    ) {
      this.dcPrevIn = 0;
      this.dcPrevOut = 0;
      return EMPTY_AUDIO;
    }

    const n = SAMPLES_PER_FRAME;
    const out = new Float32Array(n);
    let level = this.startLevel;
    let ti = 0;
    let prevIn = this.dcPrevIn;
    let prevOut = this.dcPrevOut;
    for (let i = 0; i < n; i++) {
      const cycle = (i * frameCycles) / n;
      while (
        ti < this.transitions.length &&
        this.transitions[ti]!.cycle <= cycle
      ) {
        level = this.transitions[ti]!.level;
        ti++;
      }
      const x = level ? BEEPER_AMPLITUDE : 0;
      // y[n] = x[n] - x[n-1] + R*y[n-1]: passes the AC square wave, removes DC.
      const y = x - prevIn + DC_POLE * prevOut;
      prevIn = x;
      prevOut = y;
      out[i] = y;
    }
    this.dcPrevIn = prevIn;
    this.dcPrevOut = prevOut;
    this.startLevel = this.level;
    this.transitions = [];
    return out;
  }

  reset(): void {
    this.level = 0;
    this.startLevel = 0;
    this.transitions = [];
    this.dcPrevIn = 0;
    this.dcPrevOut = 0;
  }
}
