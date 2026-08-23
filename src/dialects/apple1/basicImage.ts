// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import {
  DEFAULT_HIMEM,
  DEFAULT_LOMEM,
  HIMEM,
  LOMEM,
  PP,
  PV,
  ZP_BLOCK_BASE,
  ZP_BLOCK_BYTES,
} from './addresses';

/**
 * The machine's program image: the two memory ranges the cassette interface
 * dumps, laid end to end.
 *
 * The Apple I has no `LOAD` or `SAVE` in BASIC. A program is saved by leaving
 * the interpreter for the monitor and writing two ranges through the ACI -
 * `4A.FF W` for the zero-page housekeeping block and `800.FFF W` for the
 * program-and-variable area - so those two ranges *are* the image, and this
 * builds and parses exactly them:
 *
 * ```
 * [ zero page $4A-$FF : 182 bytes ][ workspace LOMEM..HIMEM-1 : 2048 bytes ]
 * ```
 *
 * The housekeeping block is what makes the pair self-describing: LOMEM and
 * HIMEM say where the workspace sat, PP says where the program text starts and
 * PV where the variables end. The program is stored at the **top** of the
 * workspace and grows downwards while the variables grow up from LOMEM, so PP -
 * not LOMEM - is the first byte of program text.
 */

/** Offset of a zero-page address within the housekeeping block. */
function zp(address: number): number {
  return address - ZP_BLOCK_BASE;
}

function writeWord(bytes: Uint8Array, at: number, value: number): void {
  bytes[at] = value & 0xff;
  bytes[at + 1] = (value >> 8) & 0xff;
}

function readWord(bytes: Uint8Array, at: number): number {
  return (bytes[at] ?? 0) | ((bytes[at + 1] ?? 0) << 8);
}

export interface BasicImageOptions {
  /** Bottom of the workspace; defaults to the stock `$0800`. */
  lomem?: number;
  /** Top of the workspace; defaults to the stock `$1000`. */
  himem?: number;
}

/** The two ranges an ACI dump holds, built around a tokenized program. */
export function buildBasicImage(
  program: Uint8Array,
  opts: BasicImageOptions = {},
): Uint8Array {
  const lomem = opts.lomem ?? DEFAULT_LOMEM;
  const himem = opts.himem ?? DEFAULT_HIMEM;
  const workspace = himem - lomem;
  if (program.length > workspace) {
    throw new RangeError(
      `apple1: ${program.length} program bytes do not fit the ${workspace}-byte workspace`,
    );
  }

  const block = new Uint8Array(ZP_BLOCK_BYTES);
  writeWord(block, zp(LOMEM), lomem);
  writeWord(block, zp(HIMEM), himem);
  // No variables yet: PV sits at LOMEM, and PP just below the program text.
  writeWord(block, zp(PV), lomem);
  writeWord(block, zp(PP), himem - program.length);

  const area = new Uint8Array(workspace);
  area.set(program, workspace - program.length);

  const image = new Uint8Array(block.length + area.length);
  image.set(block, 0);
  image.set(area, block.length);
  return image;
}

/** Recover the program text and the workspace bounds from an image. */
export function parseBasicImage(image: Uint8Array): {
  program: Uint8Array;
  lomem: number;
  himem: number;
} {
  const block = image.subarray(0, ZP_BLOCK_BYTES);
  const lomem = readWord(block, zp(LOMEM));
  const himem = readWord(block, zp(HIMEM));
  const pp = readWord(block, zp(PP));

  // A dump whose pointers do not describe a workspace is not one of ours - a
  // truncated tape, or a range captured with BASIC not running. Fall back to
  // the stock layout and read the whole area as program text rather than
  // returning nothing.
  const sane =
    himem > lomem &&
    himem - lomem === image.length - ZP_BLOCK_BYTES &&
    pp >= lomem &&
    pp <= himem;
  const base = sane ? lomem : DEFAULT_LOMEM;
  const top = sane ? himem : base + (image.length - ZP_BLOCK_BYTES);
  const start = sane ? pp : base;

  return {
    program: image.subarray(ZP_BLOCK_BYTES + (start - base)),
    lomem: base,
    himem: top,
  };
}
