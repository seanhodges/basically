// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The Apple II Plus's cassette: a tokenized program <-> the audio Applesoft's
 * `SAVE` would have recorded, and back.
 *
 * **The modulation is not this dialect's.** Applesoft's `SAVE` sets a range up
 * and calls the monitor's `WRITE` at `$FECD`, exactly as the Apple II's Integer
 * BASIC does, so the 652-cycle leader phases, the short sync bit, the two
 * phases of each bit and the `$FF`-seeded XOR checksum all come from a routine
 * this repository already drives against a ROM. They are imported from
 * `apple2/audio/` rather than re-derived: two copies of one routine's timings
 * could only ever drift apart.
 *
 * What *is* this dialect's is the framing above that - which records `SAVE`
 * writes, how long each leader is, and what the header record holds - and every
 * figure below was read off `public/roms/apple2plus.rom` by running `SAVE` at
 * `$D8B0` on the vendored 6502 core over a program the machine had actually
 * been typed (`cassetteRom.test.ts` re-derives them on every run):
 *
 * - **Two records, both behind a full-length leader.** `SAVE` enters `WRITE` at
 *   `$FECD` - past nothing - both times, so both leaders are written with the
 *   routine's own `LDA #$40`. That is the one place the sibling differs: its
 *   `SAVE` enters at `$FECF` for the program record with `$1A` in A, giving a
 *   second leader a quarter the length. Here the tape spends twenty-one seconds
 *   on leader tone before it has said anything.
 * - **The header record is three bytes**, `$0050`-`$0052`: the program's length
 *   as `PRGEND - TXTTAB`, then the byte at `$52`. `LOAD` reads the length into
 *   `VARTAB` and stores that third byte in `$D6` - so with its top bit set the
 *   interpreter skips the relink it otherwise does on a loaded program.
 * - **The program record is one byte longer than the program.** `SAVE` writes
 *   `TXTTAB` through `VARTAB` *inclusive*, and `VARTAB` is already the byte
 *   after the zero link. `READ` reads the same range back, so a record trimmed
 *   to the program alone leaves a real machine hunting for a byte that is not
 *   there and answering `ERR`.
 */

import {
  CASSETTE_SAMPLE_RATE,
  encodeApple2Tape,
  type Apple2TapeOptions,
  type TapeRecord,
} from '../../apple2/audio/cassetteEncoder';
import { decodeApple2Tape } from '../../apple2/audio/cassetteDecoder';
import { buildImageOrThrow } from '../../targetHelpers';
import { buildBasicImage } from '../basicImage';
import { tokenizeProgram } from '../tokenizer';

export { CASSETTE_SAMPLE_RATE };
export type { Apple2TapeOptions, TapeRecord };

/**
 * The leader count both of `SAVE`'s records are written behind.
 *
 * `HEADR` turns it into `(count + 1) * 256 - 1` phases of 652 cycles, so this
 * is about ten and a half seconds of tone per record. It cannot be trimmed
 * below the `$16` `READ` spends settling before it starts hunting for a sync
 * bit - roughly 3.8 seconds - or a real machine never sees the data behind it.
 */
export const SAVE_LEADER_COUNT = 0x40;

/** Bytes in the header record: the two-byte length and the flag behind it. */
export const HEADER_RECORD_BYTES = 3;

/**
 * The third header byte, which `LOAD` stores in `$D6`.
 *
 * On the machine it is whatever `$52` - the pointer to the next free string
 * temporary - holds when `SAVE` runs, which at the `]` prompt is the base of
 * the temporary descriptors. Its value hardly matters but its top bit does: set
 * it and `LOAD` skips the relink and leaves `PRGEND` describing the *previous*
 * program, so the next `SAVE` writes the wrong length. The machine's own resting
 * value has it clear, and that is what is written here.
 */
export const HEADER_FLAG_BYTE = 0x55;

const NO_SIGNAL = 'No cassette signal detected';
const NO_HEADER_RECORD =
  'This tape has no three-byte header record in front of the program, so it is not one SAVE wrote';

/**
 * Tokenize `source` into the bytes the program occupies in memory, which is
 * both this machine's file format and its load format - Applesoft's program is
 * a self-describing linked list from a fixed `$0801`, so there is no container
 * to wrap it in.
 *
 * Throws rather than exporting a program the machine could not load back.
 */
export function buildCassetteImage(source: string): Uint8Array {
  const { program, errors } = tokenizeProgram(source);
  // Two bytes is the bare zero link an empty program already carries.
  return buildBasicImage(buildImageOrThrow({ bytes: program, errors }, 2));
}

/** The two records `SAVE` writes, in the order it writes them. */
export function cassetteRecords(program: Uint8Array): TapeRecord[] {
  const header = Uint8Array.of(
    program.length & 0xff,
    (program.length >> 8) & 0xff,
    HEADER_FLAG_BYTE,
  );
  // The byte past the end goes out zeroed. On the machine it is whatever
  // `VARTAB` points at - uninitialised RAM on a fresh boot, the first variable
  // after a run - and `LOAD` overwrites it before anything reads it.
  const text = new Uint8Array(program.length + 1);
  text.set(program);
  return [
    { bytes: header, headerCount: SAVE_LEADER_COUNT },
    { bytes: text, headerCount: SAVE_LEADER_COUNT },
  ];
}

/**
 * The cassette audio for a program, for both the `.wav` export and the
 * Transfer dialog's play path.
 *
 * Robust mode doubles both leaders and nothing else: the bit timings are the
 * ROM's rather than a parameter, and a reader that cannot follow them is not
 * going to be helped by stretching them.
 */
export function buildCassetteSamples(
  source: string,
  robust = false,
): Float32Array {
  return encodeApple2Tape(cassetteRecords(buildCassetteImage(source)), {
    leaderScale: robust ? 2 : 1,
  });
}

export interface DecodeCassetteResult {
  /**
   * Always empty: an Apple II tape carries a length and a program, not a name.
   * The field is the seam's, and this is the honest answer to it.
   */
  programName: string;
  /** The program image, as `basicImage.ts` describes it. */
  data: Uint8Array;
  /** What was wrong with the recording, where it was readable anyway. */
  warnings: string[];
}

/** Recover the program on a recording, or throw if there isn't one. */
export function decodeCassette(
  samples: Float32Array,
  sampleRate: number,
): DecodeCassetteResult {
  const blocks = decodeApple2Tape(samples, sampleRate);
  if (blocks.length === 0) throw new Error(NO_SIGNAL);

  // The header first and the program second, as `SAVE` wrote them. Records
  // after the second are concatenated onto the program: a long program recorded
  // through a drop-out reads as two, and the bytes either side of the gap are
  // still the program's.
  const [header, ...rest] = blocks;
  if (header!.bytes.length !== HEADER_RECORD_BYTES || rest.length === 0) {
    throw new Error(NO_HEADER_RECORD);
  }

  const warnings: string[] = [];
  if (!header!.checksumOk) {
    warnings.push(
      'The header record’s checksum does not match, so the program length read off this tape may be wrong',
    );
  }
  if (rest.some((block) => !block.checksumOk)) {
    warnings.push(
      'The program record’s checksum does not match, so some of the bytes read off this tape are wrong',
    );
  }

  const body = concat(rest.map((block) => block.bytes));
  // The record's last byte is the one past the program's end, which `SAVE`
  // always writes and nothing in the program owns.
  const carried = Math.max(0, body.length - 1);
  const declared = header!.bytes[0]! | (header!.bytes[1]! << 8);
  if (declared !== carried) {
    warnings.push(
      `The tape declares ${declared} program bytes and carries ${carried}; the ${carried} that are there were read`,
    );
  }
  return { programName: '', data: body.slice(0, carried), warnings };
}

function concat(blocks: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(blocks.reduce((n, b) => n + b.length, 0));
  let at = 0;
  for (const block of blocks) {
    out.set(block, at);
    at += block.length;
  }
  return out;
}
