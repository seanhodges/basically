// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { buildCassetteRecords, CASSETTE_BAUD } from '../casfile';

/**
 * Atari cassette encoding: the 132-byte records of `casfile.ts` modulated the
 * way the 410 recorder wrote them.
 *
 * The signal is plain FSK at 600 baud, one tone per bit level rather than the
 * cycle counting the Kansas City machines do. POKEY generates both tones by
 * dividing its 64 kHz clock: channel 3 at `AUDF=5` is the mark, channel 4 at
 * `AUDF=7` is the space. Bytes are framed 8N1 - a space start bit, eight data
 * bits LSB first, a mark stop bit - and a continuous mark tone leads in and
 * separates the records.
 *
 * A bit is not a whole number of cycles of either tone (a mark bit is 8.88 of
 * them), so the waveform is generated from a running phase rather than
 * half-cycle by half-cycle: the tone changes at the bit boundary and carries on
 * from the phase it had reached, exactly as a divider being reprogrammed does.
 */

export const CASSETTE_SAMPLE_RATE = 44100;

/** POKEY's 64 kHz clock, which both cassette tones are divided down from. */
const POKEY_64K_HZ = 63921;

/** Mark: a `1` bit, and the tone the leader and the gaps are made of. */
export const MARK_HZ = POKEY_64K_HZ / 12;

/** Space: a `0` bit, and what a start bit sounds like. */
export const SPACE_HZ = POKEY_64K_HZ / 16;

const BIT_SECONDS = 1 / CASSETTE_BAUD;

export interface AtariTapeOptions {
  sampleRate?: number; // default 44100
  amplitude?: number; // default 0.85
  /** Mark tone before the first record, in ms. */
  leaderMs?: number; // default 5000
  /** Mark tone between records - the inter-record gap - in ms. */
  gapMs?: number; // default 250
  /** Trailing mark tone, in ms. */
  trailerMs?: number; // default 500
}

/** One stretch of one tone. */
interface Tone {
  hz: number;
  seconds: number;
}

/**
 * The gaps a tape is written with. A real `CSAVE` leads in with 19.2 seconds of
 * tone, because a cassette motor takes that long to settle; a sound card
 * playing straight into the machine needs only enough tone for the reader to
 * lock onto, and the shorter leader is what makes the export a practical file
 * size. The 0.25 s inter-record gap is `CSAVE`'s own short-gap timing.
 */
export const TAPE_GAPS = { leaderMs: 5000, gapMs: 250 } as const;

/** The same, stretched for a noisy path - a phone speaker held to a mic. */
export const ROBUST_TAPE_GAPS = { leaderMs: 10000, gapMs: 500 } as const;

/** Modulate the tone list, carrying the phase across every tone change. */
function renderFsk(
  tones: readonly Tone[],
  sampleRate: number,
  amplitude: number,
): Float32Array {
  let totalSeconds = 0;
  for (const tone of tones) totalSeconds += tone.seconds;

  const out = new Float32Array(Math.round(totalSeconds * sampleRate));
  let phase = 0; // in cycles, kept in [0, 1)
  let elapsed = 0;
  let at = 0;
  for (const tone of tones) {
    elapsed += tone.seconds;
    // Round the boundary rather than counting samples per tone, so a bit whose
    // length is not a whole number of samples cannot accumulate drift.
    const end = Math.min(out.length, Math.round(elapsed * sampleRate));
    const step = tone.hz / sampleRate;
    for (; at < end; at++) {
      out[at] = phase < 0.5 ? amplitude : -amplitude;
      phase += step;
      if (phase >= 1) phase -= 1;
    }
  }
  return out;
}

/** The tones for one 8N1 byte, appended to `tones`. */
function pushByte(tones: Tone[], byte: number): void {
  tones.push({ hz: SPACE_HZ, seconds: BIT_SECONDS });
  for (let bit = 0; bit < 8; bit++) {
    tones.push({
      hz: (byte >> bit) & 1 ? MARK_HZ : SPACE_HZ,
      seconds: BIT_SECONDS,
    });
  }
  tones.push({ hz: MARK_HZ, seconds: BIT_SECONDS });
}

/** Modulate a payload as the cassette tape holding it. */
export function encodeAtariTape(
  payload: Uint8Array,
  opts: AtariTapeOptions = {},
): Float32Array {
  const sampleRate = opts.sampleRate ?? CASSETTE_SAMPLE_RATE;
  const amplitude = opts.amplitude ?? 0.85;
  const leaderMs = opts.leaderMs ?? TAPE_GAPS.leaderMs;
  const gapMs = opts.gapMs ?? TAPE_GAPS.gapMs;
  const trailerMs = opts.trailerMs ?? 500;

  const tones: Tone[] = [];
  buildCassetteRecords(payload).forEach((record, i) => {
    tones.push({
      hz: MARK_HZ,
      seconds: (i === 0 ? leaderMs : gapMs) / 1000,
    });
    for (const byte of record) pushByte(tones, byte);
  });
  tones.push({ hz: MARK_HZ, seconds: trailerMs / 1000 });

  return renderFsk(tones, sampleRate, amplitude);
}
