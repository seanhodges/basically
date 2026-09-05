// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The Apple Cassette Interface as logic rather than as its PROM: a memory
 * range -> audio, written here so no second copyrighted image is needed to
 * produce a tape a real ACI can read.
 *
 * Every timing below comes from the card's own 256-byte program, which is a
 * square-wave generator and nothing else. `WDELAY` counts Y down in a five-cycle
 * `DEY`/`BNE` loop, runs a second 47-iteration loop when the carry - the bit
 * being written - is set, then toggles the output flip-flop by reading `$C000`.
 * So one phase of the wave lasts `(Y + (bit ? 47 : 0)) x 5` microseconds at the
 * machine's ~1 MHz clock, and every bit is two phases:
 *
 * - `WRITEBIT` runs the first phase with Y as loaded and reloads Y = 44 for the
 *   second, so a `0` is two 220 us phases (~2.3 kHz) and a `1` two 455 us phases
 *   (~1.1 kHz) - the "2 kHz for a zero, 1 kHz for a one" the ACI manual
 *   describes, and the reason a bit's *duration* carries its value here.
 * - The leader loop writes Y = 66 with the carry set throughout - 565 us phases,
 *   `64 * 256` of them, which is the ten seconds of header the manual quotes.
 * - The loop then leaves Y = 30 and falls into `WRITEBIT`, so the header ends
 *   with one short 385 us phase and one ordinary 455 us one. That short phase is
 *   the start bit, and hunting for it is the only way the reader knows where the
 *   data begins: there is no name, no length and no checksum on an ACI tape.
 *
 * Each range is written with a header of its own, because each `W` command is a
 * separate run of the write routine. `4A.FF W 800.FFF W` therefore records
 * header, housekeeping block, header, workspace - which is what
 * {@link buildCassetteSamples} emits, in that order.
 */

import { buildImageOrThrow } from '../../targetHelpers';
import { ZP_BLOCK_BYTES } from '../addresses';
import { buildBasicImage } from '../basicImage';
import { tokenizeProgram } from '../tokenizer';

/** Sample rate the encoder emits at. */
export const CASSETTE_SAMPLE_RATE = 44_100;

/** One phase of a `0` bit: `WRITEBIT`'s bare 44-iteration delay loop. */
export const ACI_ZERO_PHASE_US = 220;

/** One phase of a `1` bit: the same loop plus the carry's extra 47 iterations. */
export const ACI_ONE_PHASE_US = 455;

/** One phase of the leader tone, from the header loop's Y = 66. */
export const ACI_HEADER_PHASE_US = 565;

/** The short phase that ends the leader, from the header loop's parting Y = 30. */
export const ACI_START_PHASE_US = 385;

/**
 * Leader phases the PROM writes before a range: 64 passes of a loop that runs
 * 256 times, which at 565 us a phase is the ~9.3 seconds the manual rounds to
 * ten. The read routine spends the first ~3.2 seconds of it letting the tape
 * speed settle before it starts hunting for the start bit, so this is not a
 * length to trim: shorten it much and a real machine never sees the data.
 */
export const ACI_HEADER_PHASES = 64 * 256;

/**
 * Silence-free tail after the last phase, in microseconds.
 *
 * The flip-flop toggles at the *end* of every phase, so on the machine the last
 * bit still finishes with an edge and the line then rests at that level. A
 * recording has to carry that final edge too - without it the last phase has no
 * end to be measured against and the last bit is lost.
 */
export const ACI_TRAILER_US = 5_000;

export interface AciTapeOptions {
  sampleRate?: number; // default CASSETTE_SAMPLE_RATE
  amplitude?: number; // default 0.85
  /** Leader phases before each range; defaults to the PROM's own count. */
  headerPhases?: number;
}

/**
 * Modulate one or more memory ranges as ACI audio, each behind its own leader.
 *
 * Bytes go out most-significant bit first: the write routine shifts the byte
 * left with `ASL` and writes whatever lands in the carry, and the reader rebuilds
 * it with `ROL`.
 */
export function encodeAciTape(
  ranges: readonly Uint8Array[],
  opts: AciTapeOptions = {},
): Float32Array {
  const headerPhases = opts.headerPhases ?? ACI_HEADER_PHASES;
  const phases: number[] = [];
  for (const bytes of ranges) {
    for (let i = 0; i < headerPhases; i++) phases.push(ACI_HEADER_PHASE_US);
    // The start bit: one short phase, then an ordinary long one (the carry is
    // still set from the header loop, so the second phase is a `1`'s).
    phases.push(ACI_START_PHASE_US, ACI_ONE_PHASE_US);
    for (const byte of bytes) {
      for (let bit = 7; bit >= 0; bit--) {
        const phase = (byte >> bit) & 1 ? ACI_ONE_PHASE_US : ACI_ZERO_PHASE_US;
        phases.push(phase, phase);
      }
    }
  }
  phases.push(ACI_TRAILER_US);
  return renderPhases(
    phases,
    opts.sampleRate ?? CASSETTE_SAMPLE_RATE,
    opts.amplitude ?? 0.85,
  );
}

/**
 * Paint a list of phase durations as a square wave, one polarity per phase.
 *
 * Sample boundaries are computed from the running total rather than accumulated
 * per phase, so a tape tens of seconds long cannot drift away from the timings
 * above.
 */
function renderPhases(
  phasesUs: readonly number[],
  sampleRate: number,
  amplitude: number,
): Float32Array {
  let total = 0;
  for (const us of phasesUs) total += us;
  const out = new Float32Array(Math.round((total / 1e6) * sampleRate));
  let elapsed = 0;
  let at = 0;
  for (let i = 0; i < phasesUs.length; i++) {
    elapsed += phasesUs[i]!;
    const end = Math.min(out.length, Math.round((elapsed / 1e6) * sampleRate));
    out.fill(i % 2 === 0 ? amplitude : -amplitude, at, end);
    at = end;
  }
  return out;
}

/**
 * Tokenize `source` and lay it out as the two ranges the monitor would have
 * written: the zero-page housekeeping block `$4A-$FF`, then the workspace.
 *
 * Throws rather than exporting a broken or empty program: an ACI tape has no
 * checksum and no length field, so a half-built image reads back as a plausible
 * workspace with pointers into nothing instead of failing loudly.
 */
export function buildCassetteImage(source: string): Uint8Array {
  const { program, errors, workspace } = tokenizeProgram(source);
  return buildBasicImage(
    buildImageOrThrow({ bytes: program, errors }),
    workspace,
  );
}

/**
 * Build the cassette audio for a program (used by play + wav).
 *
 * Robust mode doubles the leader and nothing else: the bit timings are the
 * card's, not a parameter, and a reader that cannot follow them is not going to
 * be helped by stretching them.
 */
export function buildCassetteSamples(
  source: string,
  robust = false,
): Float32Array {
  const image = buildCassetteImage(source);
  return encodeAciTape(
    [image.subarray(0, ZP_BLOCK_BYTES), image.subarray(ZP_BLOCK_BYTES)],
    { headerPhases: robust ? ACI_HEADER_PHASES * 2 : ACI_HEADER_PHASES },
  );
}
