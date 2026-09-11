// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The Exidy cassette record - the byte stream the Monitor's `SA`ve writes and
 * its `LO`ad reads back, and the container every Sorcerer program travels in.
 *
 * A record is two leads and two kinds of payload:
 *
 * ```text
 *   <lead> <16 header bytes> <checksum>
 *   <lead> <256-byte block> <checksum>  ... <short final block> <checksum>
 * ```
 *
 * where a `<lead>` is {@link TAPE_LEAD_BYTES} bytes of 0x00 followed by one
 * {@link TAPE_LEAD_MARK}, and the header is
 *
 * | offset | bytes | field                                     |
 * | ------ | ----- | ----------------------------------------- |
 * | 0      | 5     | name, space-padded                        |
 * | 5      | 1     | file type ({@link TAPE_FILE_TYPE})         |
 * | 6      | 1     | {@link TAPE_BASIC_MARK} for a CSAVEd program, else zero |
 * | 7      | 2     | file length, little-endian                |
 * | 9      | 2     | load address, little-endian               |
 * | 11     | 2     | execution address, little-endian          |
 * | 13     | 3     | zero padding                              |
 *
 * The checksum is the Monitor's own, and it is neither a sum nor a CRC despite
 * the machine calling a bad one a "TAPE CRC ERROR": it starts at zero and, for
 * each byte written, subtracts the running value from that byte and inverts
 * every bit of the result. Writing the lead resets it, so the header's checksum
 * covers exactly the sixteen header bytes; it is reset again at the top of each
 * block, so a block's checksum covers exactly that block.
 *
 * Everything above is read off the Monitor ROM's own SAVE path rather than
 * described from memory - the routine that writes a byte and folds it into the
 * checksum, the one that writes a lead and then zeroes the checksum, and the
 * one that hands out 256-byte blocks until the length is spent.
 */

/** Bytes of 0x00 that open a lead. */
export const TAPE_LEAD_BYTES = 100;

/** The byte that closes a lead and marks what follows as data. */
export const TAPE_LEAD_MARK = 0x01;

/** Length of the header, checksum excluded. */
export const TAPE_HEADER_BYTES = 16;

/** Characters in a file name. Longer names cannot be asked for by name. */
export const TAPE_NAME_BYTES = 5;

/** The file-type mark the Monitor writes for a saved memory range. */
export const TAPE_FILE_TYPE = 0x55;

/**
 * The byte Exidy Standard BASIC's `CSAVE` stamps at header offset 6, where the
 * Monitor's own `SA`ve leaves whatever its workarea held - in practice zero.
 *
 * Nothing in either ROM ever reads it back, so it is a label rather than a
 * check: the Monitor's loader matches on the name alone. It is written anyway
 * because it is what the machine writes, and because it is the one field that
 * tells a BASIC program on a tape apart from a memory dump beside it, which is
 * how the import path picks the record to open in the editor.
 */
export const TAPE_BASIC_MARK = 0xc2;

/** Bytes in a full data block. The last block of a file may be shorter. */
export const TAPE_BLOCK_BYTES = 256;

/** Name used when a document's title has no character the header can carry. */
const DEFAULT_NAME = 'A';

/** Lowest byte the Monitor's name parser will store; below it the name ends. */
const NAME_FLOOR = 0x30; // '0'

/** Highest byte the Monitor's name parser will store. */
const NAME_CEILING = 0x5a; // 'Z'

/** Fold one byte into a running checksum. */
function fold(checksum: number, byte: number): number {
  return ~(byte - checksum) & 0xff;
}

/**
 * The five header bytes that name a file.
 *
 * The Monitor's name parser wants a leading letter and stores what follows
 * until a character below `'0'` ends the name, space-padding the rest - so this
 * folds to upper case, keeps only what that parser would store, starts at the
 * first letter, and falls back to {@link DEFAULT_NAME} for a title with no
 * letter in it at all rather than writing a name the machine could never ask
 * for.
 */
export function tapeName(programName: string): string {
  const kept = [...programName.toUpperCase()].filter((ch) => {
    const code = ch.codePointAt(0)!;
    return code >= NAME_FLOOR && code <= NAME_CEILING;
  });
  const start = kept.findIndex((ch) => ch >= 'A' && ch <= 'Z');
  const name = start === -1 ? DEFAULT_NAME : kept.slice(start).join('');
  return name.slice(0, TAPE_NAME_BYTES).padEnd(TAPE_NAME_BYTES, ' ');
}

/** The 16 header bytes for a file, checksum excluded. */
function buildHeader(payloadLength: number, opts: TapeFileOptions): Uint8Array {
  const header = new Uint8Array(TAPE_HEADER_BYTES);
  const name = tapeName(opts.programName);
  for (let i = 0; i < TAPE_NAME_BYTES; i++) header[i] = name.charCodeAt(i);
  header[5] = TAPE_FILE_TYPE;
  header[6] = opts.basic ? TAPE_BASIC_MARK : 0x00;
  header[7] = payloadLength & 0xff;
  header[8] = (payloadLength >> 8) & 0xff;
  header[9] = opts.loadAddress & 0xff;
  header[10] = (opts.loadAddress >> 8) & 0xff;
  header[11] = opts.execAddress & 0xff;
  header[12] = (opts.execAddress >> 8) & 0xff;
  return header;
}

/** Append a lead: the run of zeros and the mark that ends it. */
function pushLead(out: number[]): void {
  for (let i = 0; i < TAPE_LEAD_BYTES; i++) out.push(0x00);
  out.push(TAPE_LEAD_MARK);
}

/** Append a run of bytes followed by the checksum that covers just them. */
function pushChecked(out: number[], bytes: ArrayLike<number>): void {
  let checksum = 0;
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i]! & 0xff;
    out.push(byte);
    checksum = fold(checksum, byte);
  }
  out.push(checksum);
}

/** What a record says about the file it carries. */
export interface TapeFileOptions {
  programName: string;
  loadAddress: number;
  execAddress: number;
  /** Stamp the header as a `CSAVE`d BASIC program (see {@link TAPE_BASIC_MARK}). */
  basic?: boolean;
}

/** Build the cassette record for a payload. */
export function buildTapeFile(
  payload: Uint8Array,
  opts: TapeFileOptions,
): Uint8Array {
  const out: number[] = [];
  pushLead(out);
  pushChecked(out, buildHeader(payload.length, opts));
  pushLead(out);
  // A zero-length file writes the second lead and no blocks at all: the
  // Monitor's block loop asks for a block size first and is finished before it
  // writes anything.
  for (let at = 0; at < payload.length; at += TAPE_BLOCK_BYTES) {
    pushChecked(out, payload.subarray(at, at + TAPE_BLOCK_BYTES));
  }
  return Uint8Array.from(out);
}

/** A cassette record read back off a tape. */
export interface SorcererTapeRecord {
  /** The five header characters, trailing spaces kept. */
  name: string;
  /** Where the Monitor would place the payload. */
  loadAddress: number;
  /** Where its `GO` would start it. */
  execAddress: number;
  /** Header offset 6 carried {@link TAPE_BASIC_MARK}, so `CSAVE` wrote this. */
  basic: boolean;
  payload: Uint8Array;
}

/** Thrown for a record this parser will not half-decode. */
export class TapeRecordError extends Error {}

/**
 * Whether a lead opens the stream at all - the cheap question "are these bytes
 * a tape at all", asked before the expensive one of whether the record inside
 * is intact. The audio decoder asks it to tell a demodulation that found the
 * signal and then failed a checksum from one that found no signal at all.
 */
export function hasTapeLead(bytes: Uint8Array): boolean {
  return skipLead(bytes, 0) !== -1;
}

/** Index just past the lead starting at `at`, or -1 if there isn't one. */
function skipLead(bytes: Uint8Array, at: number): number {
  let i = at;
  while (i < bytes.length && bytes[i] === 0x00) i++;
  if (i === at || i >= bytes.length || bytes[i] !== TAPE_LEAD_MARK) return -1;
  return i + 1;
}

/**
 * Read a run of `length` bytes and the checksum after it, throwing when the two
 * disagree. `what` names the run for the message, which is the whole reason a
 * caller can tell a corrupt header from a corrupt block.
 */
function readChecked(
  bytes: Uint8Array,
  at: number,
  length: number,
  what: string,
): Uint8Array {
  if (at + length + 1 > bytes.length) {
    throw new TapeRecordError(`The tape record ends inside its ${what}.`);
  }
  const run = bytes.subarray(at, at + length);
  let checksum = 0;
  for (const byte of run) checksum = fold(checksum, byte);
  const stored = bytes[at + length]!;
  if (stored !== checksum) {
    throw new TapeRecordError(
      `The ${what} checksum is 0x${stored.toString(16).padStart(2, '0')}, ` +
        `but the data sums to 0x${checksum.toString(16).padStart(2, '0')}.`,
    );
  }
  return run;
}

/**
 * Parse the record starting at `at`, returning it and where it ends.
 *
 * Throws {@link TapeRecordError} rather than returning a half-decoded file: a
 * checksum that does not agree is exactly the case the Monitor refuses too, and
 * a payload assembled from blocks the machine would have rejected is worse than
 * no payload at all.
 */
function parseTapeRecordAt(
  bytes: Uint8Array,
  at: number,
): { record: SorcererTapeRecord; end: number } {
  const headerAt = skipLead(bytes, at);
  if (headerAt === -1) {
    throw new TapeRecordError('The tape record does not open with a lead.');
  }
  const header = readChecked(bytes, headerAt, TAPE_HEADER_BYTES, 'header');
  if (header[5] !== TAPE_FILE_TYPE) {
    throw new TapeRecordError(
      `Unknown file type 0x${header[5]!.toString(16).padStart(2, '0')} in the tape header.`,
    );
  }
  const length = header[7]! | (header[8]! << 8);

  const dataAt = skipLead(bytes, headerAt + TAPE_HEADER_BYTES + 1);
  if (dataAt === -1) {
    throw new TapeRecordError('The tape record has no lead before its data.');
  }

  const payload = new Uint8Array(length);
  let block = dataAt;
  let written = 0;
  while (written < length) {
    const size = Math.min(TAPE_BLOCK_BYTES, length - written);
    payload.set(readChecked(bytes, block, size, 'data block'), written);
    block += size + 1;
    written += size;
  }

  let name = '';
  for (let i = 0; i < TAPE_NAME_BYTES; i++)
    name += String.fromCharCode(header[i]!);
  return {
    record: {
      name,
      loadAddress: header[9]! | (header[10]! << 8),
      execAddress: header[11]! | (header[12]! << 8),
      basic: header[6] === TAPE_BASIC_MARK,
      payload,
    },
    end: block,
  };
}

/** Parse the first cassette record on a tape. Throws on a bad checksum. */
export function parseTapeRecord(bytes: Uint8Array): SorcererTapeRecord {
  return parseTapeRecordAt(bytes, 0).record;
}

/**
 * Every record on a tape, in the order they were recorded.
 *
 * A Sorcerer tape is a stream of records rather than a container with a
 * directory, so this is simply "parse one, then look for the next lead" - which
 * is also how the machine's own loader reads past the files it was not asked
 * for. The scan ends where no further lead is found, so the trailing tone or
 * silence after the last record is not an error; a record that *does* open with
 * a lead and then fails its checksum still throws, because that is a corrupt
 * file rather than the end of the tape.
 */
export function parseTapeRecords(bytes: Uint8Array): SorcererTapeRecord[] {
  const records: SorcererTapeRecord[] = [];
  let at = 0;
  while (at < bytes.length && skipLead(bytes, at) !== -1) {
    const { record, end } = parseTapeRecordAt(bytes, at);
    records.push(record);
    at = end;
  }
  if (records.length === 0) {
    throw new TapeRecordError('The tape record does not open with a lead.');
  }
  return records;
}

/** Parse a tape record back into its payload. Throws on a bad checksum. */
export function parseTapeFile(bytes: Uint8Array): Uint8Array {
  return parseTapeRecord(bytes).payload;
}
