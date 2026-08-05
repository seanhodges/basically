// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * 88-ACR cassette encoding: a `CSAVE` byte stream -> audio.
 *
 * **The plan for this dialect said Kansas City Standard; it is not.** KCS is
 * 2400 Hz against 1200 Hz with a whole number of cycles per bit, which is what
 * the Acorn encoders here implement (`src/dialects/atom/audio/`). The MITS
 * 88-ACR is a different modem: **2400 Hz mark, 1850 Hz space, 300 baud**, and
 * it is a plain continuous-phase FSK line driver rather than a cycle counter -
 * every bit lasts 1/300 s whatever tone it carries, which is eight cycles of
 * 2400 Hz but only 6 1/6 cycles of 1850 Hz. So a bit boundary does not land on
 * a zero crossing and the Acorn "four cycles is a 0, eight cycles is a 1" shape
 * cannot be reused; {@link import('./cassetteDecoder').decodeAcrTape} recovers
 * bits by timing instead.
 *
 * The frequencies are the board's post-March-1976 pair. The first 88-ACRs used
 * the Bell 103A tones (2225/2025 Hz) and MITS widened the split because tapes
 * would not interchange between machines; 2400/1850 is what the board shipped
 * as for the rest of its life and what the surviving documentation and
 * reproductions describe, so it is what this encoder emits.
 * {@link ACR_MARK_HZ}/{@link ACR_SPACE_HZ} are the only two numbers to change
 * if the earlier pair is ever wanted.
 *
 * Framing is ordinary asynchronous serial, because that is literally what it
 * is: the 88-ACR is an 88-SIO board (I/O ports 6 and 7) with a modulator bolted
 * on, jumpered for 300 baud, 8 data bits, no parity, one stop bit. A byte is a
 * start bit (space), eight data bits least-significant first, then a stop bit
 * (mark). Between bytes - and before and after the whole recording - the line
 * idles at the mark tone, which is what gives the receiver its leader.
 */

import { samplesToWav } from '../../../transfer/wav';
import { fatalErrors } from '../../types';
import { buildCsaveStream } from '../csaveFile';
import { tokenizeProgram } from '../tokenizer';

/** Sample rate the encoder emits at. */
export const CASSETTE_SAMPLE_RATE = 44_100;

/** Mark tone: a `1` bit, the stop bit, and the idle/leader carrier. */
export const ACR_MARK_HZ = 2400;

/** Space tone: a `0` bit, and the start bit that opens every byte. */
export const ACR_SPACE_HZ = 1850;

/** Bits per second on the tape. */
export const ACR_BAUD = 300;

export interface AcrTapeOptions {
  sampleRate?: number; // default CASSETTE_SAMPLE_RATE
  amplitude?: number; // default 0.85
  /** Mark tone before the first byte, in ms. */
  leaderMs?: number; // default 2000
  /** Mark tone after the last byte, in ms. */
  trailerMs?: number; // default 500
}

/**
 * Modulate a byte stream as 88-ACR audio.
 *
 * The waveform is a square wave from a continuously-advancing phase
 * accumulator: the ACR's modulator is a tone generator switched between two
 * frequencies, not a pulse shaper, so phase carries across bit boundaries and
 * there is no click or truncated cycle where the tone changes. Which bit a
 * sample belongs to is computed from the sample index rather than accumulated
 * bit by bit, so a long recording cannot drift away from 300 baud.
 */
export function encodeAcrTape(
  bytes: Uint8Array,
  opts: AcrTapeOptions = {},
): Float32Array {
  const sampleRate = opts.sampleRate ?? CASSETTE_SAMPLE_RATE;
  const amplitude = opts.amplitude ?? 0.85;
  const samplesPerBit = sampleRate / ACR_BAUD;
  const leaderBits = Math.round(((opts.leaderMs ?? 2000) / 1000) * ACR_BAUD);
  const trailerBits = Math.round(((opts.trailerMs ?? 500) / 1000) * ACR_BAUD);

  // Idle mark, then start bit + eight data bits + stop bit per byte, then idle
  // mark again.
  const bits: number[] = [];
  for (let i = 0; i < leaderBits; i++) bits.push(1);
  for (const b of bytes) {
    bits.push(0);
    for (let i = 0; i < 8; i++) bits.push((b >> i) & 1);
    bits.push(1);
  }
  for (let i = 0; i < trailerBits; i++) bits.push(1);

  const out = new Float32Array(Math.ceil(bits.length * samplesPerBit));
  let phase = 0; // in cycles; the fractional part is the position in one cycle
  for (let i = 0; i < out.length; i++) {
    const bit = bits[Math.floor(i / samplesPerBit)] ?? 1;
    phase += (bit ? ACR_MARK_HZ : ACR_SPACE_HZ) / sampleRate;
    out[i] = phase % 1 < 0.5 ? amplitude : -amplitude;
  }
  return out;
}

/**
 * Tokenize `source` and wrap it as `CSAVE` would have written it.
 *
 * Throws rather than exporting a broken or empty program: the tape has no
 * length field and no checksum, so a half-built image would read back as a
 * plausible program with a corrupt link chain instead of failing loudly.
 */
export function buildCsaveImage(
  source: string,
  programName: string,
): Uint8Array {
  const { program, errors } = tokenizeProgram(source);
  const fatal = fatalErrors(errors);
  if (fatal.length > 0) {
    throw new Error(
      `Program has ${fatal.length} error(s) - fix them before building`,
    );
  }
  // A bare 0x0000 end-of-program link is what an empty program tokenizes to.
  if (program.length <= 2) throw new Error('Program is empty');
  return buildCsaveStream(program, programName);
}

/** Build the cassette audio samples for a program (used by play + wav). */
export function buildCassetteSamples(
  source: string,
  programName: string,
  robust = false,
): Float32Array {
  return encodeAcrTape(buildCsaveImage(source, programName), {
    sampleRate: CASSETTE_SAMPLE_RATE,
    leaderMs: robust ? 5000 : 2000,
    trailerMs: robust ? 1500 : 500,
  });
}

/** Encode a program straight to a `.wav` cassette blob. */
export function buildCassetteWav(source: string, programName: string): Blob {
  return samplesToWav(
    buildCassetteSamples(source, programName),
    CASSETTE_SAMPLE_RATE,
  );
}
