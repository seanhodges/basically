// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * PMD 85 cassette encoding: tape blocks -> audio.
 *
 * **This is not Kansas City Standard, and not an FSK modem either.** There are
 * no two tones to tell apart: the tape carries one 1200 Hz square wave whose
 * *phase* is the data, which is what a receiver that has to find its own clock
 * in the signal needs. Every bit is one whole cycle, and a bit is read from
 * which way round that cycle goes - high then low is a `1`, low then high is a
 * `0`. Equivalently, and the way the hardware builds it, the recorded level is
 * the 1200 Hz clock exclusive-ORed with the bit.
 *
 * The numbers come from the Monitor's own tape routine rather than from
 * documentation. Watch the machine's I/O while BASIC-G runs `SAVE`: it sets the
 * 8253's counter 1 to mode 3 dividing the 2.048 MHz clock by 0x6AB, which is
 * 1199.8 Hz, and hands the 8251 the mode byte 0xED - a x1 baud factor, eight
 * data bits, no parity, two stop bits. So a byte on tape is eleven bit periods:
 * a `0` start bit, eight data bits least-significant first, then two `1` stop
 * bits, at 1200 baud.
 *
 * The leaders are carrier rather than silence: a run of `1` bits, which is a
 * plain 1200 Hz square wave, and what gives the receiver its lock. A header
 * block gets 2.8 s of it, a body block 0.5 s, and 0.2 s follows the last byte
 * of a file. Between files the recorder stops, so a gap really is silence.
 */

import { samplesToWav } from '../../../transfer/wav';
import { fatalErrors } from '../../types';
import { tokenizeProgram } from '../tokenizer';
import { PROGRAM_BASE } from '../addresses';
import {
  buildBodyBlock,
  buildHeaderBlock,
  programTapeFile,
  type Pmd85TapeFile,
} from '../tape';

/** Sample rate the encoder emits at. */
export const CASSETTE_SAMPLE_RATE = 44_100;

/** Bits per second on the tape, and the frequency of the carrier that is a `1`. */
export const TAPE_BAUD = 1200;

/** Bit periods per byte: one start bit, eight data bits, two stop bits. */
export const BITS_PER_BYTE = 11;

/** Half-bit slots per bit: the phase change that carries the data is mid-bit. */
const SLOTS_PER_BIT = 2;

/** Half-bit levels, as the encoder builds them: the carrier, or silence. */
const HIGH = 1;
const LOW = -1;
const SILENT = 0;

export interface Pmd85TapeAudioOptions {
  sampleRate?: number; // default CASSETTE_SAMPLE_RATE
  amplitude?: number; // default 0.85
  /** Carrier in front of a header block, in ms. */
  headerLeaderMs?: number; // default 2800
  /** Carrier in front of a body block, in ms. */
  bodyLeaderMs?: number; // default 500
  /** Carrier after the last byte of a file, in ms. */
  tailMs?: number; // default 200
  /** Silence between one file and the next, in ms. */
  gapMs?: number; // default 1500
}

/** Push the half-bit levels of one bit: the level, then its opposite. */
function pushBit(slots: number[], bit: number): void {
  slots.push(bit ? HIGH : LOW, bit ? LOW : HIGH);
}

/** Push `ms` of carrier: `1` bits, which is a plain 1200 Hz square wave. */
function pushCarrier(slots: number[], ms: number): void {
  const bits = Math.round((ms / 1000) * TAPE_BAUD);
  for (let i = 0; i < bits; i++) pushBit(slots, 1);
}

/** Push a block, one asynchronous frame per byte. */
function pushBlock(slots: number[], block: Uint8Array): void {
  for (const byte of block) {
    pushBit(slots, 0); // start
    for (let i = 0; i < 8; i++) pushBit(slots, (byte >> i) & 1);
    pushBit(slots, 1); // two stop bits
    pushBit(slots, 1);
  }
}

/**
 * The whole recording as half-bit levels: {@link HIGH}, {@link LOW}, or
 * {@link SILENT} for the gap where the recorder was stopped.
 *
 * Shared with the emulator's own tape deck (`emulator/tape.ts`), which plays
 * these straight at the 8251 rather than through a sound card - so the machine
 * is fed by the same modulation the `.wav` export writes, and one of them
 * cannot quietly drift from the other.
 */
export function tapeSlots(
  files: readonly Pmd85TapeFile[],
  opts: Pmd85TapeAudioOptions = {},
): Int8Array<ArrayBuffer> {
  const gapSlots = Math.round(
    ((opts.gapMs ?? 1500) / 1000) * TAPE_BAUD * SLOTS_PER_BIT,
  );
  const slots: number[] = [];
  files.forEach((file, index) => {
    if (index > 0) for (let i = 0; i < gapSlots; i++) slots.push(SILENT);
    pushCarrier(slots, opts.headerLeaderMs ?? 2800);
    pushBlock(slots, buildHeaderBlock(file));
    pushCarrier(slots, opts.bodyLeaderMs ?? 500);
    pushBlock(slots, buildBodyBlock(file));
    pushCarrier(slots, opts.tailMs ?? 200);
  });
  return new Int8Array(slots);
}

/** Modulate whole tape files as PMD 85 cassette audio. */
export function encodePmd85Tape(
  files: readonly Pmd85TapeFile[],
  opts: Pmd85TapeAudioOptions = {},
): Float32Array {
  const sampleRate = opts.sampleRate ?? CASSETTE_SAMPLE_RATE;
  const amplitude = opts.amplitude ?? 0.85;
  const slots = tapeSlots(files, opts);

  // Which slot a sample belongs to is computed from its index rather than
  // accumulated, so a long recording cannot drift away from 1200 baud.
  const samplesPerSlot = sampleRate / (TAPE_BAUD * SLOTS_PER_BIT);
  const out = new Float32Array(Math.ceil(slots.length * samplesPerSlot));
  for (let i = 0; i < out.length; i++) {
    out[i] = (slots[Math.floor(i / samplesPerSlot)] ?? SILENT) * amplitude;
  }
  return out;
}

/**
 * Tokenize `source` and wrap it as the tape file `SAVE` would have written.
 *
 * Throws rather than exporting a broken program: a half-built image would read
 * back as a plausible program with a corrupt link chain, and the checksum in
 * the header would agree with it.
 */
export function buildTapeFile(
  source: string,
  programName: string,
): Pmd85TapeFile {
  const { program, errors } = tokenizeProgram(source);
  const fatal = fatalErrors(errors);
  if (fatal.length > 0) {
    throw new Error(
      `Program has ${fatal.length} error(s) - fix them before building`,
    );
  }
  // A bare 0x0000 end-of-program link is what an empty program tokenizes to.
  if (program.length <= 2) throw new Error('Program is empty');
  return programTapeFile(program, {
    name: programName,
    start: PROGRAM_BASE,
  });
}

/** Cassette audio for a program (used by the play button and the `.wav` export). */
export function buildCassetteSamples(
  source: string,
  programName: string,
  robust = false,
): Float32Array {
  return encodePmd85Tape([buildTapeFile(source, programName)], {
    sampleRate: CASSETTE_SAMPLE_RATE,
    headerLeaderMs: robust ? 5000 : 2800,
    bodyLeaderMs: robust ? 1500 : 500,
    tailMs: robust ? 600 : 200,
  });
}

/** Encode a program straight to a `.wav` cassette blob. */
export function buildCassetteWav(source: string, programName: string): Blob {
  return samplesToWav(
    buildCassetteSamples(source, programName),
    CASSETTE_SAMPLE_RATE,
  );
}
