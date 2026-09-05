// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { DetokenizeResult } from '../types';
import { readAsciiListing } from './basfile';
import { detokenizeProgram } from './detokenizer';

/**
 * The MSX tape file layer, and the `.cas` container the emulators read.
 *
 * A tape file is two runs of bytes with a header tone in front of each. The
 * first is ten copies of a marker byte saying what kind of file follows and six
 * bytes of filename, space-padded; the second is the file's data. What the
 * markers are, and that the counts are ten and six, is read off this machine's
 * own ROM: the writer at `0x7125` calls TAPOON, writes `B=10` copies of the
 * marker in A and then `B=6` filename bytes, and the reader at `0x70B8` demands
 * exactly that back.
 *
 * ```
 *   CSAVE "NAME"          0xD3 x10  the tokenized program area, verbatim
 *   BSAVE "CAS:NAME"      0xD0 x10  a machine-code file with load/end/exec
 *   SAVE "CAS:NAME",A     0xEA x10  the listing as text, ending 0x1A
 * ```
 *
 * There is no checksum anywhere on an MSX tape - the framing is the only check
 * the format has, which is why a bad recording gives nonsense rather than an
 * error on real hardware.
 *
 * `.cas` replaces each header tone with an eight-byte marker, aligned to an
 * eight-byte boundary in the file, and keeps the bytes themselves as they were.
 * An ASCII save writes 256 bytes at a time and each chunk gets its own marker,
 * so a file has as many blocks as it needs rather than always two.
 */

/** The eight-byte marker a `.cas` writes where the tape has a header tone. */
export const CAS_BLOCK_MARKER = Uint8Array.of(
  0x1f,
  0xa6,
  0xde,
  0xba,
  0xcc,
  0x13,
  0x7d,
  0x74,
);

/** Every block marker sits on an eight-byte boundary; the gap is zero-filled. */
export const CAS_BLOCK_ALIGN = 8;

/** `CSAVE`: the tokenized program area as it sits in memory from TXTTAB. */
export const TOKENIZED_MARKER = 0xd3;
/** `BSAVE`: a machine-code file, which is not a BASIC program. */
export const BINARY_MARKER = 0xd0;
/** `SAVE "CAS:…",A`: the listing as text. */
export const ASCII_MARKER = 0xea;

/** Copies of the marker byte the header block opens with. */
export const MARKER_COUNT = 10;

/** Filename bytes behind the marker run - always six, space-padded. */
export const NAME_BYTES = 6;

/**
 * Bytes the writer emits past the end of the program.
 *
 * `CSAVE` writes the program area and then repeats its last byte seven times
 * (`LD L,7` at `0x7156`). A tokenized program ends in the zero link, so those
 * seven bytes are zeros, and a `.cas` in the wild carries them.
 */
export const TRAILER_BYTES = 7;

/** What a tape file turned out to be, once its header block was read. */
export interface MsxTapeFile {
  kind: 'tokenized' | 'ascii' | 'binary';
  /** The six-byte name with its padding trimmed. */
  name: string;
  /** Everything past the header block. */
  data: Uint8Array;
}

/** The six-byte tape name: upper-case, padded with spaces, cut to fit. */
export function casFileName(name: string): Uint8Array {
  const cleaned =
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, NAME_BYTES) || 'PROG';
  return Uint8Array.from(cleaned.padEnd(NAME_BYTES, ' '), (c) =>
    c.charCodeAt(0),
  );
}

/** The header block: ten marker bytes then the six-byte name. */
export function buildHeaderBlock(marker: number, name: string): Uint8Array {
  const block = new Uint8Array(MARKER_COUNT + NAME_BYTES);
  block.fill(marker, 0, MARKER_COUNT);
  block.set(casFileName(name), MARKER_COUNT);
  return block;
}

/**
 * The two blocks `CSAVE` writes for a tokenized program, header first. The
 * program's own trailing zeros are what the writer's repeat of the last byte
 * produces, so they are part of the data block rather than a separate flourish.
 */
export function buildTokenizedBlocks(
  programBytes: Uint8Array,
  name: string,
): Uint8Array[] {
  const data = new Uint8Array(programBytes.length + TRAILER_BYTES);
  data.set(programBytes);
  data.fill(programBytes.at(-1) ?? 0, programBytes.length);
  return [buildHeaderBlock(TOKENIZED_MARKER, name), data];
}

/** Wrap tape blocks as a `.cas` image: a marker per block, each block aligned. */
export function buildCasImage(blocks: readonly Uint8Array[]): Uint8Array {
  const out: number[] = [];
  for (const block of blocks) {
    while (out.length % CAS_BLOCK_ALIGN !== 0) out.push(0x00);
    out.push(...CAS_BLOCK_MARKER, ...block);
  }
  return Uint8Array.from(out);
}

/** Whether `bytes` opens with a `.cas` block marker. */
export function isCasImage(bytes: Uint8Array): boolean {
  return (
    bytes.length >= CAS_BLOCK_MARKER.length &&
    CAS_BLOCK_MARKER.every((b, i) => bytes[i] === b)
  );
}

/**
 * The byte stream a `.cas` stands for: its blocks with the markers taken out.
 *
 * That is the same stream a recording of the same tape decodes to, so one
 * reader serves both routes. The zeros that align a marker are left in: every
 * block MSX BASIC writes is already a multiple of eight bytes long except the
 * last, which nothing follows, and a stray zero at the end of a block is read
 * past either way - the tokenized walk stops at the program's zero link and a
 * listing stops at its 0x1A.
 */
export function casToTapeStream(bytes: Uint8Array): Uint8Array {
  const out: number[] = [];
  let at = 0;
  while (at < bytes.length) {
    const marker = findMarker(bytes, at);
    if (marker === -1) break;
    const start = marker + CAS_BLOCK_MARKER.length;
    const next = findMarker(bytes, start);
    const end = next === -1 ? bytes.length : next;
    for (let i = start; i < end; i++) out.push(bytes[i]!);
    at = end;
  }
  return Uint8Array.from(out);
}

function findMarker(bytes: Uint8Array, from: number): number {
  for (let i = from; i + CAS_BLOCK_MARKER.length <= bytes.length; i++) {
    if (CAS_BLOCK_MARKER.every((b, k) => bytes[i + k] === b)) return i;
  }
  return -1;
}

/**
 * Read a tape byte stream: find the header block's marker run, and take
 * everything behind its filename as the file.
 *
 * The run is searched for rather than assumed to be first, because a recording
 * starts wherever the user pressed the key and a lead-in of half-framed noise
 * is normal. Ten identical bytes is the whole test - the format has nothing
 * else to check.
 */
export function readTapeStream(bytes: Uint8Array): MsxTapeFile | null {
  for (let i = 0; i + MARKER_COUNT + NAME_BYTES <= bytes.length; i++) {
    const marker = bytes[i]!;
    const kind = MARKER_KINDS.get(marker);
    if (kind === undefined) continue;
    let run = true;
    for (let k = 1; k < MARKER_COUNT && run; k++) run = bytes[i + k] === marker;
    if (!run) continue;
    const nameAt = i + MARKER_COUNT;
    return {
      kind,
      name: String.fromCharCode(
        ...bytes.subarray(nameAt, nameAt + NAME_BYTES),
      ).trim(),
      data: bytes.slice(nameAt + NAME_BYTES),
    };
  }
  return null;
}

const MARKER_KINDS = new Map<number, MsxTapeFile['kind']>([
  [TOKENIZED_MARKER, 'tokenized'],
  [ASCII_MARKER, 'ascii'],
  [BINARY_MARKER, 'binary'],
]);

/** A tape file's data back to editable text, whichever way it was saved. */
export function readTapeFile(file: MsxTapeFile): DetokenizeResult {
  if (file.kind === 'binary') {
    return {
      source: '',
      warnings: [
        'This tape holds a machine-code file (BSAVE), not a BASIC program.',
      ],
    };
  }
  if (file.kind === 'ascii') return readAsciiListing(file.data);
  return detokenizeProgram(file.data);
}
