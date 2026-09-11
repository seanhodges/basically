// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The Sorcerer's cassette signal: tape records -> audio.
 *
 * The modulation is the Computer Users Tape Standard, which at its slow rate is
 * Kansas City Standard exactly - a `0` bit is a whole number of 1200 Hz cycles
 * and a `1` bit is twice as many cycles at 2400 Hz, so both bits last the same
 * time and the baud rate is only the cycle count. The Sorcerer offers two of
 * them, {@link SORCERER_FRAMING_1200} and {@link SORCERER_FRAMING_300}, and
 * `src/dialects/audio/kansasCity.ts` carries the modulation itself; what is
 * here is the two framings, the leader and how a document becomes records.
 *
 * The frame around a byte comes off the Monitor's cold start, which writes 0xFF
 * to the UART's control register at port 0xFD: every field that register has,
 * set to its widest - eight data bits, no parity, two stop bits. So a byte on
 * tape is a start bit, eight data bits least-significant first, and two stop
 * bits, and the UART sees an unbroken 2400 Hz carrier as an idle line with no
 * start bit in it.
 *
 * The record itself - the leads, the header and the checksummed blocks - is
 * `tapeFile.ts`; this file only turns those bytes into samples.
 */

import { KcsTape, type KcsFraming } from '../../audio/kansasCity';
import { samplesToWav } from '../../../transfer/wav';
import { buildImageOrThrow } from '../../targetHelpers';
import type { Block } from '../../types';
import { PROGRAM_BASE } from '../addresses';
import { buildBasicImage } from '../basicImage';
import { tokenizeProgram } from '../tokenizer';
import { buildTapeFile } from '../tapeFile';

/** Sample rate the encoder emits at. */
export const CASSETTE_SAMPLE_RATE = 44100;

/**
 * How far down the measured half-cycles a 2400 Hz one is, for the decoder's
 * threshold - see {@link KcsFraming.fastQuantile}, which defaults to the median
 * and would be wrong here.
 *
 * Every Exidy record opens each of its two leads with a hundred 0x00 bytes, and
 * a byte of eight zero bits is nine slow bit cells against two fast stop bits -
 * so whatever the payload holds, and at either rate, fast half-cycles are never
 * less than about 30% of a recording. A quantile well inside that is a fast
 * half however the rest of the tape falls.
 */
const FAST_HALF_QUANTILE = 0.15;

/**
 * The rate the machine signs on at: one 1200 Hz cycle per `0`, two 2400 Hz
 * cycles per `1`. The Monitor's cold start leaves the control-port shadow's
 * 0x40 bit set, which is this state.
 */
export const SORCERER_FRAMING_1200: KcsFraming = {
  zeroCycles: 1,
  oneCycles: 2,
  stopBits: 2,
  fastQuantile: FAST_HALF_QUANTILE,
};

/**
 * The slow rate, four times as many cycles for each bit. The Software Manual
 * offers it as the reliable one, and the Monitor's `SE T=1` selects it.
 */
export const SORCERER_FRAMING_300: KcsFraming = {
  zeroCycles: 4,
  oneCycles: 8,
  stopBits: 2,
  fastQuantile: FAST_HALF_QUANTILE,
};

/**
 * Both rates, fastest first - which is the order a recording of unknown origin
 * is tried in, since the default rate is the likelier one.
 */
export const SORCERER_FRAMINGS: readonly KcsFraming[] = [
  SORCERER_FRAMING_1200,
  SORCERER_FRAMING_300,
];

/**
 * The extra byte `CSAVE` writes past the end of the program, and the reason
 * this is a correctness fix rather than a curiosity.
 *
 * `CSAVE` hands the Monitor's save routine TXTTAB as the start and VARTAB as
 * the *inclusive* end, so the length in the header is one more than the program
 * occupies - it covers the byte VARTAB itself points at. `CLOAD` then sets
 * VARTAB back to the start plus that span, so a record one byte shorter would
 * leave VARTAB pointing inside the program's own end-of-program link and the
 * first variable assigned would overwrite it. Confirmed by capturing what the
 * booted ROM writes to the UART for a two-line program: eighteen bytes for a
 * seventeen-byte program.
 */
const CSAVE_TAIL_BYTES = 1;

const CYCLE_2400_MICROS = 1e6 / 2400;

export interface SorcererTapeOptions {
  sampleRate?: number; // default CASSETTE_SAMPLE_RATE
  amplitude?: number; // default 0.85
  /** Which of the machine's two rates to record at. Default: 1200 baud. */
  framing?: KcsFraming;
  /** Carrier tone before the first record, in ms. */
  leaderMs?: number; // default 2000
  /** Carrier tone between records, in ms. */
  interRecordMs?: number; // default 1500
  /** Trailing carrier tone, in ms. */
  trailerMs?: number; // default 500
}

/**
 * The records a document becomes on tape: the BASIC program first, then one
 * memory-range file per memory block.
 *
 * That is the layout of a real Sorcerer tape rather than a container invented
 * for the IDE - the machine has no multi-file format, only a stream of records
 * its loaders read past until the name matches. Which is also why there is no
 * auto-loader here and `loader` is ignored: pulling a memory-range file off
 * tape is a Monitor command (`LO`), not something a BASIC program can do to
 * itself, so there is nothing an extra generated program could usefully say.
 *
 * Throws rather than exporting a program the machine could not load back.
 */
export function buildTapeRecords(
  source: string,
  programName: string,
  blocks: readonly Block[] = [],
): Uint8Array[] {
  const { program, errors } = tokenizeProgram(source);
  // An empty program is the bare 0x0000 end-of-program link and nothing else.
  const image = buildBasicImage(
    buildImageOrThrow({ bytes: program, errors }, 2),
  );

  const payload = new Uint8Array(image.length + CSAVE_TAIL_BYTES);
  payload.set(image);
  const records = [
    buildTapeFile(payload, {
      programName,
      loadAddress: PROGRAM_BASE,
      execAddress: 0x0000,
      basic: true,
    }),
  ];
  for (const block of blocks) {
    records.push(
      buildTapeFile(block.bytes, {
        programName: block.name,
        loadAddress: block.address,
        // Zero stands for "no entry address recorded", which is what the
        // import path reads it back as. The Monitor's `SA` leaves whatever its
        // workarea held when its optional third address is left off, so the
        // field has no meaning of its own to preserve here.
        execAddress: block.entry ?? 0x0000,
      }),
    );
  }
  return records;
}

/**
 * The same records as one byte stream: the `.tape` file, and what a decoder
 * hands back after demodulating a recording. A tape has no container around its
 * records, so this is only a concatenation.
 */
export function buildTapeImage(
  source: string,
  programName: string,
  blocks: readonly Block[] = [],
): Uint8Array {
  const records = buildTapeRecords(source, programName, blocks);
  const out = new Uint8Array(records.reduce((n, r) => n + r.length, 0));
  let at = 0;
  for (const record of records) {
    out.set(record, at);
    at += record.length;
  }
  return out;
}

/**
 * Modulate a tape's records.
 *
 * The carrier tone before the first record is this encoder's own, not the
 * machine's: a real save starts the motor, waits out the run-up in silence and
 * then writes the record's hundred-byte lead. A leading tone is inaudible to
 * the machine - an idle line is exactly what it means - and it is what gives a
 * decoder a run of known-fast half-cycles to measure the tape speed against,
 * which a lead of zero bytes, being almost all slow half-cycles, does not.
 */
export function encodeSorcererTape(
  records: readonly Uint8Array[],
  opts: SorcererTapeOptions = {},
): Float32Array {
  const cycles = (ms: number) => Math.round((ms * 1000) / CYCLE_2400_MICROS);
  const tape = new KcsTape(opts.framing ?? SORCERER_FRAMING_1200);
  tape.tone(cycles(opts.leaderMs ?? 2000));
  records.forEach((record, i) => {
    if (i > 0) tape.tone(cycles(opts.interRecordMs ?? 1500));
    tape.bytes(record);
  });
  tape.tone(cycles(opts.trailerMs ?? 500));
  return tape.render(
    opts.sampleRate ?? CASSETTE_SAMPLE_RATE,
    opts.amplitude ?? 0.85,
  );
}

/**
 * Build the cassette audio samples for a document (used by play + wav).
 *
 * Robust mode is the machine's own answer to a temperamental recorder rather
 * than a longer leader alone: it records at 300 baud, the rate the Software
 * Manual calls the reliable one. The listening machine has to be told, which is
 * what the dialect's `loadInstructions` says.
 */
export function buildCassetteSamples(
  source: string,
  programName: string,
  robust = false,
  opts: { blocks?: readonly Block[] } = {},
): Float32Array {
  return encodeSorcererTape(
    buildTapeRecords(source, programName, opts.blocks ?? []),
    {
      sampleRate: CASSETTE_SAMPLE_RATE,
      framing: robust ? SORCERER_FRAMING_300 : SORCERER_FRAMING_1200,
      leaderMs: robust ? 4000 : 2000,
      interRecordMs: robust ? 3000 : 1500,
    },
  );
}

/** Encode a document straight to a `.wav` cassette blob. */
export function buildCassetteWav(
  source: string,
  programName: string,
  blocks: readonly Block[] = [],
): Blob {
  return samplesToWav(
    buildCassetteSamples(source, programName, false, { blocks }),
    CASSETTE_SAMPLE_RATE,
  );
}
