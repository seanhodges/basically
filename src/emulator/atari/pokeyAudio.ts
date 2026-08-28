// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Host-side POKEY sound renderer - an approximation, in the shape the VIC-20's
 * and C64's renderers already use.
 *
 * POKEY has four identical voices. Each divides a clock by its AUDF register
 * and toggles a flip-flop, so the tone is
 *
 *   f = clock / (2 * (AUDF + 1))
 *
 * at the 64 kHz clock, or at 15 kHz with AUDCTL bit 0, or at the system clock
 * for channels 1 and 3 when AUDCTL bits 6 and 5 say so. What comes out of the
 * flip-flop then passes through up to two polynomial counters, selected by
 * AUDC's top three bits: that is where the chip's "distortion" comes from, and
 * why `SOUND 0,121,10,8` is a clean note while `SOUND 0,121,8,8` is a rasp.
 * AUDC bit 4 bypasses the divider entirely and puts the volume straight on the
 * output, which is how programs play sampled sound.
 *
 * Known approximations: the polynomial counters are stepped at the output
 * sample rate rather than at the chip's clock, so the noise timbres are the
 * right character rather than the right spectrum; the high-pass filters
 * (AUDCTL bits 1 and 2) are not modelled, and neither is the two-tone mode.
 */

/** Output rate of the stream; 44100 / 50 = 882 samples per frame (integer). */
export const POKEY_AUDIO_SAMPLE_RATE = 44100;
/** Samples emitted per frame at the machine's nominal 50 Hz. */
export const POKEY_SAMPLES_PER_FRAME = POKEY_AUDIO_SAMPLE_RATE / 50;

/** PAL system clock feeding POKEY's dividers (Hz). */
const SYSTEM_CLOCK = 1_773_447;
/** The chip's two slow clocks, as the system clock divided down. */
const CLOCK_64K = SYSTEM_CLOCK / 28;
const CLOCK_15K = SYSTEM_CLOCK / 114;

/** AUDC: volume in the low nibble, "volume only" in bit 4, distortion above. */
const VOLUME_MASK = 0x0f;
const VOLUME_ONLY = 0x10;
const DISTORTION_MASK = 0xe0;

/** Per-voice peak amplitude; four voices at full volume stay below unity. */
const VOICE_AMPLITUDE = 0.25;
/** One-pole DC-blocker coefficient; ~0.995 settles a held level in a few ms. */
const DC_POLE = 0.995;
/** Below this magnitude the DC blocker has settled, so an idle frame is free. */
const SILENCE_EPS = 1e-4;

/** Shared empty result so a fully-silent frame allocates nothing. */
const EMPTY_AUDIO = new Float32Array(0);

/** Reads a POKEY register (0..15) without side effects. */
export type PokeyRegisterReader = (reg: number) => number;

/** The frequency voice `v` sounds at, given the registers it is set from. */
export function pokeyVoiceFreqHz(
  voice: number,
  audf: number,
  audctl: number,
): number {
  const fast = (voice === 0 && audctl & 0x40) || (voice === 2 && audctl & 0x20);
  if (fast) return SYSTEM_CLOCK / (2 * (audf + 4));
  const clock = audctl & 0x01 ? CLOCK_15K : CLOCK_64K;
  return clock / (2 * (audf + 1));
}

export class PokeyAudioRenderer {
  readonly sampleRate = POKEY_AUDIO_SAMPLE_RATE;

  /** Per-voice oscillator phase in [0, 1), carried across frames. */
  private readonly phase = [0, 0, 0, 0];
  /** Per-voice flip-flop output, toggled on each phase wrap. */
  private readonly level = [1, 1, 1, 1];
  /** The three polynomial counters the distortions are taken from. */
  private poly4 = 1;
  private poly5 = 1;
  private poly17 = 1;
  private dcPrevIn = 0;
  private dcPrevOut = 0;

  reset(): void {
    for (let v = 0; v < 4; v++) {
      this.phase[v] = 0;
      this.level[v] = 1;
    }
    this.poly4 = 1;
    this.poly5 = 1;
    this.poly17 = 1;
    this.dcPrevIn = 0;
    this.dcPrevOut = 0;
  }

  /** Step all three polynomial counters one place. */
  private clockPolys(): void {
    this.poly4 =
      ((this.poly4 << 1) | (((this.poly4 >> 3) ^ (this.poly4 >> 2)) & 1)) &
      0x0f;
    this.poly5 =
      ((this.poly5 << 1) | (((this.poly5 >> 4) ^ (this.poly5 >> 2)) & 1)) &
      0x1f;
    this.poly17 =
      ((this.poly17 << 1) | (((this.poly17 >> 16) ^ (this.poly17 >> 11)) & 1)) &
      0x1ffff;
  }

  /**
   * Whether a voice's output is high this sample, given its flip-flop and the
   * distortion its AUDC selects. The chip gates the flip-flop through the
   * polynomial counters named in the data sheet's distortion table; the two
   * settings with no polynomial in them ($A0 and $E0) are the pure tones.
   */
  private gate(voice: number, audc: number): boolean {
    const high = this.level[voice] === 1;
    switch (audc & DISTORTION_MASK) {
      case 0x00:
        return high && (this.poly5 & 1) !== 0 && (this.poly17 & 1) !== 0;
      case 0x20:
      case 0x60:
        return high && (this.poly5 & 1) !== 0;
      case 0x40:
        return high && (this.poly5 & 1) !== 0 && (this.poly4 & 1) !== 0;
      case 0x80:
        return high && (this.poly17 & 1) !== 0;
      case 0xc0:
        return high && (this.poly4 & 1) !== 0;
      default:
        return high;
    }
  }

  /**
   * Render one frame of mono samples from the current register state. Returns
   * an empty array once every voice is silent and the DC blocker has settled,
   * so a quiet frame allocates nothing.
   */
  render(readRegister: PokeyRegisterReader): Float32Array {
    const audctl = readRegister(0x08);
    const audf = [0, 1, 2, 3].map((v) => readRegister(v * 2));
    const audc = [0, 1, 2, 3].map((v) => readRegister(v * 2 + 1));
    const sounding = audc.some((c) => (c & VOLUME_MASK) !== 0);

    if (!sounding && Math.abs(this.dcPrevOut) < SILENCE_EPS) {
      this.dcPrevIn = 0;
      this.dcPrevOut = 0;
      return EMPTY_AUDIO;
    }

    const inc = audf.map(
      (f, v) => pokeyVoiceFreqHz(v, f, audctl) / POKEY_AUDIO_SAMPLE_RATE,
    );

    const out = new Float32Array(POKEY_SAMPLES_PER_FRAME);
    let prevIn = this.dcPrevIn;
    let prevOut = this.dcPrevOut;
    for (let i = 0; i < POKEY_SAMPLES_PER_FRAME; i++) {
      this.clockPolys();
      let sum = 0;
      for (let v = 0; v < 4; v++) {
        // Advance even a silent voice, so unmuting resumes a continuous wave.
        const next = this.phase[v]! + inc[v]!;
        if (next >= 1) this.level[v] = -this.level[v]!;
        this.phase[v] = next % 1;
        const volume = (audc[v]! & VOLUME_MASK) / 15;
        if (volume === 0) continue;
        // Volume-only mode drives the level straight out with no divider.
        if (audc[v]! & VOLUME_ONLY) {
          sum += volume * VOICE_AMPLITUDE;
          continue;
        }
        if (this.gate(v, audc[v]!)) sum += volume * VOICE_AMPLITUDE;
      }
      // y[n] = x[n] - x[n-1] + R*y[n-1]: passes the tones, removes the offset.
      const y = sum - prevIn + DC_POLE * prevOut;
      prevIn = sum;
      prevOut = y;
      out[i] = y;
    }
    this.dcPrevIn = prevIn;
    this.dcPrevOut = prevOut;
    return out;
  }
}
