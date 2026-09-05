// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { FIELD_HZ } from './timing';

/**
 * The Apple II's speaker: one bit, and not even a bit you can write.
 *
 * There is no sound chip. `$C030` is wired to a flip-flop driving the cone, and
 * *touching* the address flips it - the value written is thrown away, and a read
 * does it just as well, which is why a tone in Integer BASIC is a `PEEK(-16336)`
 * in a loop. Every note the machine ever made was a program counting cycles
 * between toggles, so the pitch is the loop's period and nothing else. The Apple
 * I had no speaker at all; the nearest thing in this repository is the
 * Spectrum's beeper, and this is the same square-wave-by-timeline synthesis.
 *
 * The machine records each toggle with the cycle-within-frame it happened at;
 * {@link Apple2Speaker.render} replays that timeline into one field of mono
 * samples, point-sampling the held level.
 *
 * A one-pole DC blocker sits on the output. Without it the cone's resting
 * position - the state it is left in after every beep - would be a constant
 * offset: inaudible as a tone, but a click whenever playback starts, stops or
 * underruns. With it a held level decays smoothly to zero exactly as the real
 * cone settles, while square waves pass through untouched.
 */

/** Output rate the synthesis is designed around. */
const DESIGN_SAMPLE_RATE = 44100;

/**
 * Samples emitted per field. A whole number, so no field ever emits a fraction
 * of a sample; the true output rate is this times {@link FIELD_HZ}, which is
 * what the machine advertises as its `audioSampleRate`.
 */
export const SPEAKER_SAMPLES_PER_FRAME = Math.round(
  DESIGN_SAMPLE_RATE / FIELD_HZ,
);

/** Cone deflection for a high speaker bit, below the headroom the host gain adds. */
export const SPEAKER_AMPLITUDE = 0.6;

/** One-pole DC-blocker coefficient; ~0.995 settles a held level in a few ms. */
const DC_POLE = 0.995;
/** Below this magnitude the DC blocker has settled, so a silent field is free. */
const SILENCE_EPS = 1e-4;

/** Shared empty result so a fully-silent field allocates nothing. */
const EMPTY_AUDIO = new Float32Array(0);

export class Apple2Speaker {
  /** Current cone position (0 or 1) - the flip-flop's state. */
  private level = 0;
  /** Cone position at the start of the field not yet rendered. */
  private startLevel = 0;
  /** Cycle offsets within the pending field at which the cone moved. */
  private toggles: number[] = [];
  /** DC-blocker memory carried across fields so the filter stays continuous. */
  private dcPrevIn = 0;
  private dcPrevOut = 0;

  /**
   * One touch of `$C030`, at the given cycle offset within the current field.
   * Every touch is a transition - there is no value to compare against - so
   * unlike a port-driven beeper nothing here can be a no-op.
   */
  toggle(cycle: number): void {
    this.level ^= 1;
    this.toggles.push(cycle);
  }

  /**
   * Render one field, replaying the recorded toggles across `frameCycles`, then
   * arm the next field carrying the held level and the filter state forward.
   * Returns an empty array once the machine is fully silent, so an idle field
   * costs nothing.
   */
  render(frameCycles: number): Float32Array {
    if (
      this.toggles.length === 0 &&
      this.level === 0 &&
      this.startLevel === 0 &&
      Math.abs(this.dcPrevOut) < SILENCE_EPS
    ) {
      this.dcPrevIn = 0;
      this.dcPrevOut = 0;
      return EMPTY_AUDIO;
    }

    const n = SPEAKER_SAMPLES_PER_FRAME;
    const out = new Float32Array(n);
    let level = this.startLevel;
    let ti = 0;
    let prevIn = this.dcPrevIn;
    let prevOut = this.dcPrevOut;
    for (let i = 0; i < n; i++) {
      const cycle = (i * frameCycles) / n;
      while (ti < this.toggles.length && this.toggles[ti]! <= cycle) {
        level ^= 1;
        ti++;
      }
      const x = level ? SPEAKER_AMPLITUDE : 0;
      // y[n] = x[n] - x[n-1] + R*y[n-1]: passes the AC square wave, removes DC.
      const y = x - prevIn + DC_POLE * prevOut;
      prevIn = x;
      prevOut = y;
      out[i] = y;
    }
    this.dcPrevIn = prevIn;
    this.dcPrevOut = prevOut;
    this.startLevel = this.level;
    this.toggles = [];
    return out;
  }

  reset(): void {
    this.level = 0;
    this.startLevel = 0;
    this.toggles = [];
    this.dcPrevIn = 0;
    this.dcPrevOut = 0;
  }
}
