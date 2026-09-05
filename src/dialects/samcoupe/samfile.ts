/**
 * The SAM tape container: a header block and the data block that follows it.
 *
 * Each block is framed by a u16 little-endian length, then the block bytes a
 * real tape carries - a type byte, the payload, and a parity byte that is the
 * XOR of everything before it (`SABLK` in the ROM's tapex.asm seeds the parity
 * with the type byte and folds each saved byte into it). The type byte is where
 * the SAM parts company with the Spectrum whose pulse scheme it borrows:
 * `0x01` opens a SAM header, `0xFF` a data block, and `0x00` a Spectrum header
 * the SAM ROM will also read.
 *
 * A SAM header is 80 bytes (`LD DE,80 ;CDE=80 (HEADER LEN)`), laid out as
 * tapemn.asm documents it:
 *
 * ```
 *  0      type: 16 program, 17 numeric array, 18 string array, 19 CODE, 20 SCREEN$
 *  1-10   file name, space padded
 *  11-14  four more name characters, for devices whose names run longer
 *  15     flags: bit 0 invisible name, bit 1 protected code
 *  16-18  program length excluding variables          (page form)
 *  19-21  program length plus numeric variables       (page form)
 *  22-24  program length plus all but string/array variables (page form)
 *  25-30  directory entry and spares
 *  31-33  start address - ignored when LOADing a program, which goes to PROG
 *  34-36  data length                                 (page form)
 *  37-39  auto-run: 0xFF in the first byte for none, else 0 and the line number
 *  40-79  comment, which the ROM leaves uninitialised
 * ```
 *
 * "Page form" is the ROM's 19-bit address: `PAGEFORM` in tadjm.asm splits the
 * value into a 16K page number and an offset it presents in the 0x8000-0xBFFF
 * window, and the three bytes are stored page, offset low, offset high.
 *
 * The image this module builds saves the program area alone, so all three
 * length fields and the data length are the program length: a header whose
 * boundaries coincide is one with no variables, which is what a freshly typed
 * program has.
 */

import { samcoupeCharset } from './charset';

/** Block type bytes, as `SABLK` sends them. */
export const HEADER_BLOCK = 0x01;
export const DATA_BLOCK = 0xff;
/** A Spectrum header block, which the SAM ROM also reads. */
export const SPECTRUM_HEADER_BLOCK = 0x00;

/**
 * The byte that ends a stored program, standing where a line number's high
 * byte would be. It is part of the program area rather than a delimiter around
 * it: a freshly reset machine has `NVARS = PROG + 1` with that one 0xFF between
 * them, and the ROM's own line walk stops on it (`LD A,(HL) / ADD A,1 / RET C`
 * in tadjm.asm). So it is saved with the program and counted in every length
 * the header carries - a tape written without it loads a program the
 * interpreter then scans straight off the end of.
 */
export const PROGRAM_END = 0xff;

/** Header length, and the type byte for a BASIC program. */
export const HEADER_BYTES = 80;
export const PROGRAM_TYPE = 16;
/** Longest file name the tape header holds. */
export const NAME_BYTES = 10;

/** Displacement to the header's number fields (`HDN` in the ROM). */
const HDN = 31;

/** Header type-byte names, for skip/report messages. */
const TYPE_NAMES: Record<number, string> = {
  16: 'BASIC program',
  17: 'number array',
  18: 'character array',
  19: 'CODE',
  20: 'SCREEN$',
};

export interface SamFileOptions {
  /** Program name (<= 10 characters). Defaults to "program". */
  name?: string;
  /** Auto-run line, or null for "load only". Defaults to the first line. */
  autoStart?: number | null;
  /**
   * The two variable areas SAM BASIC keeps between the program and its string
   * and array variables, saved after the program the way the ROM's own SAVE
   * writes them.
   *
   * A tape written without them is not merely smaller: the loader deletes
   * everything from PROG up to the edit line and rebuilds it to the three
   * lengths the header carries, so a header claiming no variable areas leaves
   * a machine with none - and the first `RUN` or `CLEAR` after such a load
   * walks off into memory that is no longer there. A freshly reset Coupé keeps
   * 92 bytes in the first area and 512 in the second, which is why a program
   * that never declares a variable still has areas to save.
   */
  variableAreas?: { numeric: Uint8Array; other: Uint8Array };
}

export interface ParsedSamFile {
  /** The 80 header bytes. */
  header: Uint8Array;
  /** The data payload: the program area, and any variables saved with it. */
  data: Uint8Array;
  /** Tokenized program area (no variables). */
  program: Uint8Array;
  /** Auto-run line, or null when the header says "load only". */
  autoStart: number | null;
  /** Header name with its padding trimmed. */
  name: string;
}

/** The ROM's 19-bit page form: page number, then the offset in 0x8000-0xBFFF. */
function pageForm(value: number): [number, number, number] {
  return [(value >> 14) & 0x1f, value & 0xff, 0x80 | ((value >> 8) & 0x3f)];
}

/** The inverse of {@link pageForm}. */
function fromPageForm(bytes: ArrayLike<number>, at: number): number {
  const page = bytes[at]!;
  const offset = ((bytes[at + 2]! & 0x3f) << 8) | bytes[at + 1]!;
  return page * 0x4000 + offset;
}

function blockWithParity(type: number, payload: Uint8Array): Uint8Array {
  const block = new Uint8Array(payload.length + 2);
  block[0] = type;
  block.set(payload, 1);
  let parity = type;
  for (const b of payload) parity ^= b;
  block[block.length - 1] = parity;
  return block;
}

function withLengthPrefix(block: Uint8Array): Uint8Array {
  const out = new Uint8Array(block.length + 2);
  out[0] = block.length & 0xff;
  out[1] = (block.length >> 8) & 0xff;
  out.set(block, 2);
  return out;
}

function nameBytes(name: string): Uint8Array {
  const bytes = new Uint8Array(NAME_BYTES).fill(0x20);
  // Route the name through the charset so £ and the graphics store their true
  // SAM codes rather than their Unicode code points.
  const encoded = samcoupeCharset.toMachine(name);
  for (let i = 0; i < Math.min(encoded.length, NAME_BYTES); i++)
    bytes[i] = encoded[i]!;
  return bytes;
}

/** The 10-byte header name decoded back to editor text, padding trimmed. */
export function headerName(bytes: ArrayLike<number>): string {
  return samcoupeCharset.toUnicode(bytes).replace(/\s+$/, '');
}

/** One tape block: its type byte and the bytes a real tape carries. */
export interface SamBlock {
  /** 0x01 header, 0xFF data. */
  type: number;
  /** Type byte, payload and parity byte. */
  bytes: Uint8Array;
}

/**
 * The 80 header bytes describing a stored program.
 *
 * `lengths` are the three boundaries the ROM restores on load, each measured
 * from PROG: the end of the program itself, the end of the numeric variable
 * area after it, and the end of the area after that.
 */
export function programHeader(
  lengths: [number, number, number],
  opts: SamFileOptions & { autoStart: number | null },
): Uint8Array {
  const header = new Uint8Array(HEADER_BYTES);
  // The ROM clears bytes 1-25 with spaces and 26-39 with 0xFF before filling
  // the fields in, and leaves the comment area untouched.
  header.fill(0x20, 1, 26);
  header.fill(0xff, 26, 40);
  header[0] = PROGRAM_TYPE;
  header.set(nameBytes(opts.name ?? 'program'), 1);
  header.set(pageForm(lengths[0]), 16);
  header.set(pageForm(lengths[1]), 19);
  header.set(pageForm(lengths[2]), 22);
  header.set(pageForm(lengths[2]), HDN + 3); // the data block's own length
  if (opts.autoStart !== null) {
    header[HDN + 6] = 0;
    header[HDN + 7] = opts.autoStart & 0xff;
    header[HDN + 8] = (opts.autoStart >> 8) & 0xff;
  }
  return header;
}

/**
 * The two tape blocks (header then data) for a BASIC program, each as the raw
 * type+payload+parity bytes a real tape carries - the container body without
 * the per-block length prefixes.
 */
export function samBlocks(
  programBytes: Uint8Array,
  opts: SamFileOptions = {},
): [SamBlock, SamBlock] {
  const firstLine =
    programBytes.length >= 2 ? (programBytes[0]! << 8) | programBytes[1]! : 0;
  const autoStart = opts.autoStart === undefined ? firstLine : opts.autoStart;
  const areas = opts.variableAreas;
  const progLen = programBytes.length + 1;
  const numeric = areas?.numeric ?? new Uint8Array(0);
  const other = areas?.other ?? new Uint8Array(0);
  const data = new Uint8Array(progLen + numeric.length + other.length);
  data.set(programBytes);
  data[programBytes.length] = PROGRAM_END;
  data.set(numeric, progLen);
  data.set(other, progLen + numeric.length);
  const header = programHeader(
    [progLen, progLen + numeric.length, data.length],
    { ...opts, autoStart },
  );
  return [
    { type: HEADER_BLOCK, bytes: blockWithParity(HEADER_BLOCK, header) },
    { type: DATA_BLOCK, bytes: blockWithParity(DATA_BLOCK, data) },
  ];
}

/** Frame a sequence of tape blocks as a container image. */
export function samImageFromBlocks(blocks: readonly SamBlock[]): Uint8Array {
  const framed = blocks.map((b) => withLengthPrefix(b.bytes));
  const out = new Uint8Array(framed.reduce((n, b) => n + b.length, 0));
  let p = 0;
  for (const b of framed) {
    out.set(b, p);
    p += b.length;
  }
  return out;
}

/** Tokenized program bytes -> the loadable image. */
export function buildSamFile(
  programBytes: Uint8Array,
  name: string,
  opts: SamFileOptions = {},
): Uint8Array {
  return samImageFromBlocks(samBlocks(programBytes, { name, ...opts }));
}

/** One scanned block, keeping the parity result the raw tape carries. */
interface ScannedBlock {
  type: number;
  payload: Uint8Array;
  /** True when the stored parity byte matches type ^ payload. */
  parityOk: boolean;
}

/**
 * Walk a container image block by block, checking each parity byte.
 * `truncated` is set when the framing runs off the end of the image.
 */
function scanBlocks(image: Uint8Array): {
  blocks: ScannedBlock[];
  truncated: boolean;
} {
  const blocks: ScannedBlock[] = [];
  let p = 0;
  let truncated = false;
  while (p + 2 <= image.length) {
    const len = image[p]! | (image[p + 1]! << 8);
    p += 2;
    if (len < 2 || p + len > image.length) {
      truncated = true;
      break;
    }
    const type = image[p]!;
    const payload = image.slice(p + 1, p + len - 1); // drop type + parity
    let parity = type;
    for (const b of payload) parity ^= b;
    blocks.push({ type, payload, parityOk: parity === image[p + len - 1]! });
    p += len;
  }
  if (p < image.length) truncated = true;
  return { blocks, truncated };
}

/** Every block in a container image, in tape order, with parity/type stripped. */
export function samBlockScan(
  image: Uint8Array,
): { type: number; payload: Uint8Array }[] {
  return scanBlocks(image).blocks.map((b) => ({
    type: b.type,
    payload: b.payload,
  }));
}

/** Whatever the image could not represent, as human-readable notes. */
export function parseSamFileWithReport(image: Uint8Array): {
  file: ParsedSamFile | null;
  warnings: string[];
} {
  const warnings: string[] = [];
  const { blocks, truncated } = scanBlocks(image);
  if (truncated)
    warnings.push('The image ends mid-block; its last file may be incomplete.');

  for (let k = 0; k < blocks.length; k++) {
    const h = blocks[k]!;
    if (h.type !== HEADER_BLOCK || h.payload.length !== HEADER_BYTES) continue;
    const type = h.payload[0]!;
    const data = blocks[k + 1];
    if (type !== PROGRAM_TYPE) {
      warnings.push(
        `Skipped "${headerName(h.payload.subarray(1, 1 + NAME_BYTES))}", a ${
          TYPE_NAMES[type] ?? `type ${type}`
        } file.`,
      );
      continue;
    }
    if (!data || data.type !== DATA_BLOCK) {
      warnings.push('A program header has no data block after it.');
      continue;
    }
    if (!h.parityOk)
      warnings.push('The program header failed its parity check.');
    if (!data.parityOk)
      warnings.push('The program data failed its parity check.');
    let progLen = Math.min(fromPageForm(h.payload, 16), data.payload.length);
    // Drop the end-of-program byte the length counts, so `program` is the
    // stored lines and nothing else.
    if (progLen > 0 && data.payload[progLen - 1] === PROGRAM_END) progLen--;
    const autoStart =
      h.payload[HDN + 6] === 0
        ? h.payload[HDN + 7]! | (h.payload[HDN + 8]! << 8)
        : null;
    return {
      file: {
        header: h.payload,
        data: data.payload,
        program: data.payload.slice(0, progLen),
        autoStart,
        name: headerName(h.payload.subarray(1, 1 + NAME_BYTES)),
      },
      warnings,
    };
  }
  return { file: null, warnings };
}

/** The inverse of {@link buildSamFile}: recover the program bytes. */
export function parseSamFile(image: Uint8Array): { program: Uint8Array } {
  const { file } = parseSamFileWithReport(image);
  return { program: file ? file.program : new Uint8Array(0) };
}
