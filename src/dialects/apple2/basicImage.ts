// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { DEFAULT_HIMEM, DEFAULT_LOMEM } from './addresses';
import type { Workspace } from './directLine';

/**
 * The machine's program image: what `SAVE` writes and `LOAD` reads back.
 *
 * Integer BASIC has both commands in the language, and the pair between them
 * define the format. Disassembled out of the interpreter, `SAVE` computes
 * `HIMEM - PP` into `$CE/$CF`, writes those two bytes as a record of their own,
 * and then writes `PP`..`HIMEM-1`; `LOAD` reads the two bytes back, sets
 * `PP = HIMEM - length` and reads that many bytes into the top of the
 * workspace. So the image is
 *
 * ```
 * [ length lo ][ length hi ][ program text : length bytes ]
 * ```
 *
 * and the two records' leader tones and checksums are the transfer layer's
 * business rather than this file's.
 *
 * The consequence worth stating: **the workspace bounds are not in the image.**
 * A program does not remember the `LOMEM:`/`HIMEM:` it was written under - it
 * lands at the top of whatever workspace the loading machine has, which is what
 * makes `HIMEM:` something you type *before* `LOAD` on a real Apple II. Where
 * the IDE needs to carry those bounds it carries them in the source text, as the
 * unnumbered preamble the listing itself writes.
 */

/** How many bytes the record's header costs. */
export const IMAGE_HEADER_BYTES = 2;

/** The stock workspace, for a caller with no listing to read one from. */
const STOCK: Workspace = {
  lomem: DEFAULT_LOMEM,
  himem: DEFAULT_HIMEM,
  declared: false,
};

/** The length-prefixed record `SAVE` writes, built around a tokenized program. */
export function buildBasicImage(
  program: Uint8Array,
  workspace: Workspace = STOCK,
): Uint8Array {
  const capacity = workspace.himem - workspace.lomem;
  if (program.length > capacity) {
    throw new RangeError(
      `apple2: ${program.length} program bytes do not fit the ${capacity}-byte workspace`,
    );
  }
  const image = new Uint8Array(IMAGE_HEADER_BYTES + program.length);
  image[0] = program.length & 0xff;
  image[1] = (program.length >> 8) & 0xff;
  image.set(program, IMAGE_HEADER_BYTES);
  return image;
}

/**
 * Recover the program text from an image.
 *
 * A header that does not describe the rest of the file is not one of ours - a
 * truncated tape, or a range captured with BASIC not running - so the whole
 * file is read as program text instead, which leaves the detokenizer to say
 * what it found rather than returning nothing.
 */
export function parseBasicImage(image: Uint8Array): {
  program: Uint8Array;
  /** True when the two-byte header agreed with the file's length. */
  headed: boolean;
} {
  const declared = (image[0] ?? 0) | ((image[1] ?? 0) << 8);
  const headed =
    image.length >= IMAGE_HEADER_BYTES &&
    declared === image.length - IMAGE_HEADER_BYTES;
  return {
    program: headed ? image.subarray(IMAGE_HEADER_BYTES) : image,
    headed,
  };
}
