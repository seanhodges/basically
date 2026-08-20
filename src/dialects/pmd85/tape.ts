// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The PMD 85's tape container: what a `SAVE` writes, byte for byte.
 *
 * Every fact here was read off a running machine rather than inferred. Boot
 * BASIC-G, watch the 8251 at ports 0x1E/0x1F, and type `SAVE 1`: the Monitor
 * programs the USART for 8 data bits, no parity and two stop bits, sets the
 * 8253's counter 1 to divide 2.048 MHz by 0x6AB (1199.8 Hz), and then pushes
 * out one 63-byte header block followed by one body block. The two blocks are
 * the whole format.
 *
 * **The header block.** 48 bytes of leader - 16 each of `FF`, `00`, `55` -
 * then fifteen bytes of description:
 *
 * | Offset | Size | Field                                                |
 * | ------ | ---- | ---------------------------------------------------- |
 * | 48     | 1    | file number, the argument `SAVE n` / `LOAD n` take   |
 * | 49     | 1    | type letter; `>` (0x3E) for a BASIC-G program        |
 * | 50     | 2    | load address, little endian                          |
 * | 52     | 2    | body length **minus one**, little endian             |
 * | 54     | 8    | name, space padded                                   |
 * | 62     | 1    | checksum of the fifteen bytes before it              |
 *
 * **The body block.** The bytes themselves and one checksum byte after them.
 *
 * Both checksums are the same thing: the bytes summed modulo 256. Not a CRC,
 * whatever the community documentation calls the field.
 *
 * **A saved program is one byte longer than the program.** BASIC-G writes
 * TXTTAB through VARTAB *inclusive*, so the body carries the tokenized program
 * plus the one byte sitting at VARTAB, and the header's length field - one less
 * than the body - is exactly the program's own length. That is not padding to
 * be trimmed on a whim: `LOAD` sets VARTAB to `start + length`, so shortening
 * the body by a byte would leave the interpreter's idea of where variables
 * begin one short of the end of the program.
 *
 * Two files hold this on disc, and they differ only in framing:
 *
 * - **`.pmd`** is the blocks written back to back, nothing else.
 * - **`.ptp`** puts a little-endian `u16` length in front of each block, so a
 *   reader can walk a multi-file tape without parsing what is on it. It is the
 *   format the community emulators save, and the one that survives a headerless
 *   block (a data file written by a program) intact.
 */

/** Bytes of leader in front of the fifteen header bytes: 16 each FF, 00, 55. */
export const HEADER_LEADER_BYTES = 48;

/** A whole header block: {@link HEADER_LEADER_BYTES} + 15 described bytes. */
export const HEADER_BLOCK_BYTES = 63;

/** Characters in a header's name field, space padded. */
export const HEADER_NAME_BYTES = 8;

/** The type letter BASIC-G writes for a program: `>`. */
export const BASIC_FILE_TYPE = 0x3e;

/**
 * The file number a program is exported under, and the one to type back:
 * `LOAD 1`. BASIC-G's tape commands take a number rather than a name - `SAVE
 * "A"` answers `Type conv.` - so the eight-character name in the header is a
 * label for a human, and this is the handle the interpreter matches on.
 */
export const DEFAULT_FILE_NUMBER = 1;

/** Highest file number a header can carry. */
export const MAX_FILE_NUMBER = 99;

export interface Pmd85TapeHeader {
  /** File number, 0-{@link MAX_FILE_NUMBER}. */
  number: number;
  /** Type letter as a byte; {@link BASIC_FILE_TYPE} for a BASIC-G program. */
  type: number;
  /** Address the body loads at. */
  start: number;
  /** Name as written in the header, trailing spaces trimmed. */
  name: string;
}

export interface Pmd85TapeFile {
  header: Pmd85TapeHeader;
  /** The body as it lands in memory, without its checksum byte. */
  bytes: Uint8Array;
}

/** The tape's checksum: the bytes summed modulo 256. */
export function tapeChecksum(bytes: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < bytes.length; i++) sum = (sum + bytes[i]!) & 0xff;
  return sum;
}

/**
 * A name as the header stores it: eight characters of upper-case ASCII, space
 * padded. Anything the Monitor's character generator cannot draw becomes `-`
 * rather than travelling as a raw byte, because the name is only ever shown to
 * a human - a tape browser's listing - and never read back as data.
 */
export function tapeHeaderName(name: string): string {
  const clean = [...name.toUpperCase()]
    .map((ch) => (ch >= ' ' && ch <= '_' ? ch : '-'))
    .join('')
    .slice(0, HEADER_NAME_BYTES);
  return clean.padEnd(HEADER_NAME_BYTES, ' ');
}

/** The 63-byte header block for a file. */
export function buildHeaderBlock(file: Pmd85TapeFile): Uint8Array {
  const block = new Uint8Array(HEADER_BLOCK_BYTES);
  block.fill(0xff, 0, 16);
  block.fill(0x00, 16, 32);
  block.fill(0x55, 32, 48);
  const { header } = file;
  // The length field is one less than the body, which is how the interpreter
  // derives VARTAB from it - see the note at the top of this file.
  const length = file.bytes.length - 1;
  block[48] = header.number & 0xff;
  block[49] = header.type & 0xff;
  block[50] = header.start & 0xff;
  block[51] = (header.start >> 8) & 0xff;
  block[52] = length & 0xff;
  block[53] = (length >> 8) & 0xff;
  const name = tapeHeaderName(header.name);
  for (let i = 0; i < HEADER_NAME_BYTES; i++) {
    block[54 + i] = name.charCodeAt(i);
  }
  block[62] = tapeChecksum(block.subarray(48, 62));
  return block;
}

/** The body block for a file: its bytes and their checksum. */
export function buildBodyBlock(file: Pmd85TapeFile): Uint8Array {
  const block = new Uint8Array(file.bytes.length + 1);
  block.set(file.bytes);
  block[file.bytes.length] = tapeChecksum(file.bytes);
  return block;
}

/** Every block of a tape, in the order the recorder writes them. */
export function tapeBlocks(files: readonly Pmd85TapeFile[]): Uint8Array[] {
  return files.flatMap((file) => [
    buildHeaderBlock(file),
    buildBodyBlock(file),
  ]);
}

/** A `.ptp` image: every block behind a little-endian `u16` length. */
export function buildPtpImage(files: readonly Pmd85TapeFile[]): Uint8Array {
  const blocks = tapeBlocks(files);
  const size = blocks.reduce((n, b) => n + b.length + 2, 0);
  const out = new Uint8Array(size);
  let p = 0;
  for (const block of blocks) {
    out[p] = block.length & 0xff;
    out[p + 1] = (block.length >> 8) & 0xff;
    out.set(block, p + 2);
    p += block.length + 2;
  }
  return out;
}

/**
 * A `.pmd` image: the blocks back to back, no length fields.
 *
 * One file only. Without the length prefixes a reader can find the next header
 * only by recognising its leader, and a body free to contain any bytes at all
 * may contain that leader - so a multi-file `.pmd` is ambiguous by
 * construction, and `.ptp` is what a multi-file tape is written as.
 */
export function buildPmdImage(file: Pmd85TapeFile): Uint8Array {
  const header = buildHeaderBlock(file);
  const body = buildBodyBlock(file);
  const out = new Uint8Array(header.length + body.length);
  out.set(header);
  out.set(body, header.length);
  return out;
}

/** The tape file a tokenized BASIC-G program is saved as. */
export function programTapeFile(
  programBytes: Uint8Array,
  opts: { name: string; number?: number; start: number },
): Pmd85TapeFile {
  // The trailing byte is the one at VARTAB; BASIC-G saves it and zero is what
  // it holds after a program is entered.
  const bytes = new Uint8Array(programBytes.length + 1);
  bytes.set(programBytes);
  return {
    header: {
      number: opts.number ?? DEFAULT_FILE_NUMBER,
      type: BASIC_FILE_TYPE,
      start: opts.start,
      name: tapeHeaderName(opts.name).trimEnd(),
    },
    bytes,
  };
}

/** The tokenized program inside a BASIC-G tape file: the body less its tail. */
export function programFromTapeFile(file: Pmd85TapeFile): Uint8Array {
  return file.bytes.subarray(0, Math.max(0, file.bytes.length - 1));
}

/** What {@link parseTapeImage} recovered from a tape. */
export interface Pmd85TapeParse {
  files: Pmd85TapeFile[];
  /**
   * Blocks with no header in front of them, preserved verbatim. A program that
   * writes its own data with `DSAVE` leaves one of these, and the format of
   * what is in it is that program's business rather than the tape's.
   */
  headerless: Uint8Array[];
  /** Import-fidelity notes: bad checksums, truncated blocks, odd framing. */
  warnings: string[];
}

/** True when the 48 bytes at `at` are a header block's FF/00/55 leader. */
function hasLeader(bytes: Uint8Array, at: number): boolean {
  if (at + HEADER_BLOCK_BYTES > bytes.length) return false;
  for (let i = 0; i < 16; i++) {
    if (bytes[at + i] !== 0xff) return false;
    if (bytes[at + 16 + i] !== 0x00) return false;
    if (bytes[at + 32 + i] !== 0x55) return false;
  }
  return true;
}

function readWord(bytes: Uint8Array, at: number): number {
  return bytes[at]! | (bytes[at + 1]! << 8);
}

/** True when `bytes` is a `.pmd` image, or a tape decoded straight to bytes. */
export function isFlatTapeImage(bytes: Uint8Array): boolean {
  return hasLeader(bytes, 0);
}

/**
 * True when `bytes` is a `.ptp` image: a chain of length-prefixed blocks that
 * ends exactly where the file does.
 *
 * The walk is the test rather than the first block being a header, because a
 * tape may open with a headerless block - data a program wrote for itself. A
 * `.pmd` cannot be mistaken for one: its first two bytes are the leader's `FF
 * FF`, a 64K block that no such file is long enough to hold.
 */
export function isPtpImage(bytes: Uint8Array): boolean {
  if (isFlatTapeImage(bytes)) return false;
  let p = 0;
  let blocks = 0;
  while (p + 2 <= bytes.length) {
    const length = readWord(bytes, p);
    if (length === 0 || p + 2 + length > bytes.length) return false;
    p += 2 + length;
    blocks++;
  }
  return p === bytes.length && blocks > 0;
}

/** True when `bytes` are any tape container this dialect reads. */
export function isTapeImage(bytes: Uint8Array): boolean {
  return isPtpImage(bytes) || isFlatTapeImage(bytes);
}

/** Decode the fifteen described bytes of a header block. */
function readHeader(block: Uint8Array): {
  header: Pmd85TapeHeader;
  bodyBytes: number;
  checksumOk: boolean;
} {
  const name = String.fromCharCode(
    ...block.subarray(54, 54 + HEADER_NAME_BYTES),
  );
  return {
    header: {
      number: block[48]!,
      type: block[49]!,
      start: readWord(block, 50),
      name: name.replace(/[\0\s]+$/, ''),
    },
    bodyBytes: readWord(block, 52) + 1,
    checksumOk: tapeChecksum(block.subarray(48, 62)) === block[62],
  };
}

/** The type letter as it reads in a message, e.g. `>`. */
function typeLabel(type: number): string {
  return type >= 0x20 && type < 0x7f
    ? `"${String.fromCharCode(type)}"`
    : `0x${type.toString(16).toUpperCase().padStart(2, '0')}`;
}

/**
 * Read a `.ptp` or `.pmd` image, or a tape decoded from audio, back into files.
 *
 * Neither framing is checked for more than it can promise. A bad checksum is
 * reported and the bytes kept: a tape that read back imperfectly is still worth
 * more to its owner than an error message, and the report says exactly which
 * block was doubted.
 */
export function parseTapeImage(bytes: Uint8Array): Pmd85TapeParse {
  const files: Pmd85TapeFile[] = [];
  const headerless: Uint8Array[] = [];
  const warnings: string[] = [];
  const ptp = isPtpImage(bytes);
  let p = 0;

  const takeBlock = (want: number): Uint8Array | null => {
    if (ptp) {
      if (p + 2 > bytes.length) return null;
      const length = readWord(bytes, p);
      if (length === 0 || p + 2 + length > bytes.length) return null;
      const block = bytes.subarray(p + 2, p + 2 + length);
      p += 2 + length;
      return block;
    }
    // A flat tape has no length fields, so the caller's expectation is all
    // there is to go on; a body shorter than its header claimed is truncated.
    if (p >= bytes.length) return null;
    const block = bytes.subarray(p, Math.min(p + want, bytes.length));
    p += block.length;
    return block;
  };

  while (p < bytes.length) {
    const start = p;
    const block = takeBlock(HEADER_BLOCK_BYTES);
    if (!block || block.length === 0) break;

    if (block.length === HEADER_BLOCK_BYTES && hasLeader(block, 0)) {
      const { header, bodyBytes, checksumOk } = readHeader(block);
      if (!checksumOk) {
        warnings.push(
          `The header of file ${header.number} did not checksum — its ` +
            'description may be wrong.',
        );
      }
      // The body block is the payload and one checksum byte after it.
      const body = takeBlock(bodyBytes + 1);
      if (!body || body.length < 2) {
        warnings.push(
          `File ${header.number} has a header but no body — the tape ends ` +
            'mid-file.',
        );
        break;
      }
      const payload = body.subarray(0, body.length - 1);
      if (payload.length !== bodyBytes) {
        warnings.push(
          `File ${header.number} carries ${payload.length} bytes where its ` +
            `header claims ${bodyBytes}.`,
        );
      }
      if (tapeChecksum(payload) !== body[body.length - 1]) {
        warnings.push(
          `The body of file ${header.number} did not checksum — it may have ` +
            'read back with errors.',
        );
      }
      files.push({ header, bytes: payload });
      continue;
    }

    if (ptp) {
      headerless.push(block);
      warnings.push(
        `A ${block.length}-byte block with no header was preserved as it is.`,
      );
      continue;
    }
    // Flat framing and no leader where one was due: there is no way to find the
    // next block, so stop rather than guess.
    warnings.push(
      `The tape stops making sense ${start} bytes in — no file header there.`,
    );
    break;
  }

  return { files, headerless, warnings };
}

/** The first BASIC-G program on a tape, and a note about anything skipped. */
export function firstProgramFile(parse: Pmd85TapeParse): {
  file: Pmd85TapeFile | null;
  warnings: string[];
} {
  const warnings: string[] = [];
  const index = parse.files.findIndex((f) => f.header.type === BASIC_FILE_TYPE);
  if (index < 0) {
    const types = parse.files.map((f) => typeLabel(f.header.type)).join(', ');
    warnings.push(
      parse.files.length === 0
        ? 'The tape holds no file with a header.'
        : `The tape holds no BASIC-G program — its files are of type ${types}.`,
    );
    return { file: null, warnings };
  }
  const rest = parse.files.length - 1;
  if (rest > 0) {
    warnings.push(
      `${rest} other file${rest === 1 ? '' : 's'} on the tape ` +
        `${rest === 1 ? 'was' : 'were'} not opened; only the program was.`,
    );
  }
  return { file: parse.files[index]!, warnings };
}
