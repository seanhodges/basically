// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { AudioDecodeResult, Dialect } from '../../types';
import {
  KcsTape,
  decodeKcsBytes,
  type KcsFraming,
} from '../../audio/kansasCity';
import { buildTokenizedBlocks, readTapeFile, readTapeStream } from '../casfile';
import { buildTokenizedProgram } from '../basfile';

/**
 * The MSX cassette signal: Kansas City Standard FSK at 1200 baud, where a 0
 * bit is one cycle of 1200Hz and a 1 bit two cycles of 2400Hz, behind a 2400Hz
 * leader. The BIOS detects 1200 against 2400 baud as it reads, so a recording
 * does not have to say which it is.
 *
 * Two things about the framing are this machine's own rather than the family's,
 * and both are read off the ROM. A byte carries **two** stop bits, not one:
 * TAPOUT at `0x1A19` writes the start bit, rotates the eight data bits out
 * LSB-first and then calls the `1` writer twice. And a header tone is a whole
 * number of 2400Hz cycles counted from the `HEADER` work-area byte at
 * `0xF40A`, which this ROM boots holding 15: TAPOON at `0x19F1` writes
 * `HEADER × 256` cycles for a short header and four times that for a long one,
 * so the machine's own leaders are 15360 cycles (6.4 s) before a file's header
 * block and 3840 (1.6 s) before its data.
 *
 * What is shipped is shorter. A tape leader is long because a cassette motor
 * takes seconds to reach speed; a sound card playing straight into the machine
 * needs only enough tone for the reader to lock onto, and the shorter leaders
 * are what keep an exported `.wav` a practical size. The 4:1 ratio between the
 * two headers is kept, because it is what tells the reader a file is starting
 * rather than continuing.
 */

export const CASSETTE_SAMPLE_RATE = 44100;

/** 1200 baud, 8N2 - the two stop bits are what set MSX apart from the BBC. */
export const MSX_FRAMING: KcsFraming = {
  zeroCycles: 1,
  oneCycles: 2,
  stopBits: 2,
};

/** Leader cycles at 2400 Hz: two seconds before the file, one before its data. */
const TAPE_HEADERS = { long: 4800, short: 2400 } as const;

/** The same, doubled for a noisy path - a phone speaker held to a microphone. */
const ROBUST_TAPE_HEADERS = { long: 9600, short: 4800 } as const;

/** Cycles of 2400 Hz after the last byte, so the reader is not cut off mid-stop-bit. */
const TRAILER_CYCLES = 1200;

/** Modulate the blocks of one tape file, each behind its own header tone. */
export function encodeMsxTape(
  blocks: readonly Uint8Array[],
  headers: { long: number; short: number },
  sampleRate = CASSETTE_SAMPLE_RATE,
): Float32Array {
  const tape = new KcsTape(MSX_FRAMING);
  blocks.forEach((block, i) => {
    tape.tone(i === 0 ? headers.long : headers.short);
    tape.bytes(block);
  });
  tape.tone(TRAILER_CYCLES);
  return tape.render(sampleRate);
}

/** Build the cassette audio for a program (used by the .wav target and play). */
export function buildCassetteSamples(
  source: string,
  programName: string,
  robust = false,
): Float32Array {
  return encodeMsxTape(
    buildTokenizedBlocks(buildTokenizedProgram(source), programName),
    robust ? ROBUST_TAPE_HEADERS : TAPE_HEADERS,
  );
}

const NO_SIGNAL = 'No MSX cassette file found in the recording';

/** Recorded samples back to an editable program - {@link encodeMsxTape} undone. */
export function decodeCassette(
  samples: Float32Array,
  sampleRate: number,
): AudioDecodeResult {
  const file = readTapeStream(decodeKcsBytes(samples, sampleRate, MSX_FRAMING));
  if (!file) throw new Error(NO_SIGNAL);
  const { source, warnings } = readTapeFile(file);
  return { programName: file.name, source, warnings };
}

/** The cassette route as the Transfer dialog offers it. */
export const hb10pCassetteAudio: NonNullable<Dialect['audio']> = {
  sampleRate: CASSETTE_SAMPLE_RATE,
  buildSamples: (source, programName, robust) =>
    buildCassetteSamples(source, programName, robust),
  loadInstructions:
    'On the HB-10P type CLOAD"NAME" and press RETURN, then start playback; when Ok comes back, type RUN. RUN"CAS:NAME" does both in one go.',
  saveInstructions:
    'On the HB-10P press RECORD and PLAY on the recorder, then type CSAVE"NAME" and press RETURN; the program plays out of the cassette port as a 1200 baud tone you can capture here.',
  decodeSamples: decodeCassette,
};
