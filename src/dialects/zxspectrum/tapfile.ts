/**
 * ZX Spectrum `.TAP` images.
 *
 * A `.TAP` is a sequence of blocks, each `u16 LE length` followed by `length`
 * bytes: a flag byte (0x00 header / 0xFF data), the payload, and a parity byte
 * (XOR of flag + payload). A saved BASIC program is two blocks - a 17-byte
 * header describing it, then the program area immediately followed by the
 * variables area (a lone 0x80 end-marker when there are no variables).
 *
 * The header's parameters drive a faithful LOAD: param2 is the program length
 * without variables, and param1 is the auto-run line (>= 0x8000 means "don't
 * auto-run"). The IDE uses this same image both as the export file and as the
 * payload the emulator injects through the ROM's tape-loading routine.
 */

import { spectrumCharset } from './charset';

export interface TapOptions {
  /** Program name (≤ 10 chars). Defaults to "program". */
  name?: string;
  /** Auto-run line, or null for "load only". Defaults to the first line. */
  autoStart?: number | null;
}

export interface ParsedTap {
  /** The 17 header bytes (type, name, length, param1, param2). */
  header: Uint8Array;
  /** The data payload: program area followed by the variables area. */
  data: Uint8Array;
  /** Tokenized program area (no variables). */
  program: Uint8Array;
  /** Auto-run line, or null when the header says "load only". */
  autoStart: number | null;
}

const VARS_END = 0x80;
const PROGRAM_TYPE = 0x00;

/** Header type-byte names, for skip/report messages. */
const TYPE_NAMES: Record<number, string> = {
  0: 'BASIC program',
  1: 'number array',
  2: 'character array',
  3: 'CODE',
};

function blockWithParity(flag: number, payload: Uint8Array): Uint8Array {
  const block = new Uint8Array(payload.length + 2);
  block[0] = flag;
  block.set(payload, 1);
  let parity = flag;
  for (const b of payload) parity ^= b;
  block[block.length - 1] = parity;
  return block;
}

/** Prepend the `u16 LE length` prefix that frames a block inside a `.TAP`. */
function withLengthPrefix(block: Uint8Array): Uint8Array {
  const out = new Uint8Array(block.length + 2);
  out[0] = block.length & 0xff;
  out[1] = (block.length >> 8) & 0xff;
  out.set(block, 2);
  return out;
}

function programName(name: string): Uint8Array {
  const bytes = new Uint8Array(10).fill(0x20);
  // Route the name through the charset so £/©/↑ and block graphics store their
  // true Spectrum codes, not their Unicode code points.
  const encoded = spectrumCharset.toMachine(name);
  for (let i = 0; i < Math.min(encoded.length, 10); i++) bytes[i] = encoded[i]!;
  return bytes;
}

/** The 10-byte header name decoded back to editor text, trailing spaces trimmed. */
export function headerName(nameBytes: ArrayLike<number>): string {
  return spectrumCharset.toUnicode(nameBytes).replace(/\s+$/, '');
}

/** One tape block: its flag byte and the full block bytes (flag + payload + parity). */
export interface TapBlock {
  /** 0x00 for a header block, 0xff for a data block. */
  flag: number;
  /** Flag byte, payload and parity byte - the bytes a real tape carries. */
  bytes: Uint8Array;
}

/**
 * The two tape blocks (header then data) for a BASIC program, each as the raw
 * flag+payload+parity bytes a real tape carries - i.e. the `.TAP` body without
 * the per-block length prefixes. Shared by {@link buildTap} (which adds the
 * prefixes) and the cassette-audio encoder.
 */
export function tapBlocks(
  programBytes: Uint8Array,
  opts: TapOptions = {},
): [TapBlock, TapBlock] {
  const firstLine =
    programBytes.length >= 2 ? (programBytes[0]! << 8) | programBytes[1]! : 0;
  const autoStart = opts.autoStart === undefined ? firstLine : opts.autoStart;
  const autoStartParam = autoStart === null ? 0x8000 : autoStart;

  const data = new Uint8Array(programBytes.length + 1);
  data.set(programBytes, 0);
  data[data.length - 1] = VARS_END; // empty variables area

  const header = new Uint8Array(17);
  header[0] = PROGRAM_TYPE;
  header.set(programName(opts.name ?? 'program'), 1);
  header[11] = data.length & 0xff;
  header[12] = (data.length >> 8) & 0xff;
  header[13] = autoStartParam & 0xff;
  header[14] = (autoStartParam >> 8) & 0xff;
  header[15] = programBytes.length & 0xff;
  header[16] = (programBytes.length >> 8) & 0xff;

  return [
    { flag: 0x00, bytes: blockWithParity(0x00, header) },
    { flag: 0xff, bytes: blockWithParity(0xff, data) },
  ];
}

export function buildTap(
  programBytes: Uint8Array,
  opts: TapOptions = {},
): Uint8Array {
  const [header, data] = tapBlocks(programBytes, opts);
  const headerBlock = withLengthPrefix(header.bytes);
  const dataBlock = withLengthPrefix(data.bytes);
  const out = new Uint8Array(headerBlock.length + dataBlock.length);
  out.set(headerBlock, 0);
  out.set(dataBlock, headerBlock.length);
  return out;
}

/**
 * A two-block `.TAP` from raw header and data payloads (as captured off a
 * program's own SAVE, where the payloads can describe CODE or arrays, not
 * just a BASIC program like {@link buildTap}).
 */
export function tapFromPayloads(
  header: Uint8Array,
  data: Uint8Array,
): Uint8Array {
  const headerBlock = withLengthPrefix(blockWithParity(0x00, header));
  const dataBlock = withLengthPrefix(blockWithParity(0xff, data));
  const out = new Uint8Array(headerBlock.length + dataBlock.length);
  out.set(headerBlock, 0);
  out.set(dataBlock, headerBlock.length);
  return out;
}

/** Every block in a `.TAP` image, in tape order, with parity/flag stripped. */
export function tapBlockScan(
  image: Uint8Array,
): { flag: number; payload: Uint8Array }[] {
  return scanBlocks(image).blocks.map((b) => ({
    flag: b.flag,
    payload: b.payload,
  }));
}

/** One scanned block, keeping the parity result the raw tape carries. */
interface ScannedBlock {
  flag: number;
  payload: Uint8Array;
  /** True when the stored parity byte matches flag ^ payload. */
  parityOk: boolean;
}

/**
 * Walk a `.TAP` image block by block, verifying each block's parity byte
 * (XOR of flag + payload). `truncated` is set when the framing runs off the
 * end of the file (a length prefix that promises more bytes than remain, or
 * trailing bytes too short to frame another block).
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
    const flag = image[p]!;
    const payload = image.slice(p + 1, p + len - 1); // drop flag + parity
    let parity = flag;
    for (const b of payload) parity ^= b;
    blocks.push({ flag, payload, parityOk: parity === image[p + len - 1]! });
    p += len;
  }
  if (p < image.length) truncated = true; // trailing partial block
  return { blocks, truncated };
}

/** A header block paired with the data block that immediately follows it. */
interface TapFile {
  header: ScannedBlock;
  data: ScannedBlock | null;
}

/** Pair each 17-byte header block with the data block that follows it. */
function pairFiles(blocks: ScannedBlock[]): TapFile[] {
  const files: TapFile[] = [];
  for (let k = 0; k < blocks.length; k++) {
    const h = blocks[k]!;
    if (h.flag !== 0x00 || h.payload.length !== 17) continue;
    const next = blocks[k + 1];
    if (next && next.flag === 0xff) {
      files.push({ header: h, data: next });
      k++;
    } else {
      files.push({ header: h, data: null });
    }
  }
  return files;
}

/** Assemble the {@link ParsedTap} for the BASIC-program file in a `.TAP`. */
function parseProgramFile(file: TapFile): ParsedTap {
  const header = file.header.payload;
  const data = file.data!.payload;
  const progLen = header[15]! | (header[16]! << 8);
  const param1 = header[13]! | (header[14]! << 8);
  return {
    header,
    data,
    program: data.slice(0, progLen),
    autoStart: param1 >= 0x8000 ? null : param1,
  };
}

/** The first BASIC-program file (header type 0x00 with a data block) in a `.TAP`. */
function findProgramFile(files: TapFile[]): TapFile | undefined {
  return files.find((f) => f.header.payload[0] === PROGRAM_TYPE && f.data);
}

export function parseTap(image: Uint8Array): ParsedTap {
  const files = pairFiles(scanBlocks(image).blocks);
  const program = findProgramFile(files);
  if (!program) throw new Error('Not a valid .TAP program image');
  return parseProgramFile(program);
}

const CODE_TYPE = 3;

/**
 * A tokenized program area's length (bytes) below which a first-of-several
 * program file is treated as a "loader" rather than the payload the user
 * wants imported - see {@link parseTapAllFiles}. Chosen generously above a
 * typical one- or two-line `LOAD "" CODE: RANDOMIZE USR n` loader (a few
 * dozen bytes tokenized) and well below any program with real content.
 */
const LOADER_MAX_PROGRAM_BYTES = 60;

/** One CODE file (header type 3) recovered from a `.TAP` by {@link parseTapAllFiles}. */
export interface CodeFile {
  /** Load address (header param1, bytes 13-14). */
  address: number;
  /** Raw code bytes, sliced to the header's declared length (bytes 11-12). */
  bytes: Uint8Array;
  /** Decoded 10-char header name, trailing spaces trimmed. */
  name: string;
}

function headerDeclaredLength(header: Uint8Array): number {
  return header[11]! | (header[12]! << 8);
}

function codeFileFromTapFile(file: TapFile): CodeFile {
  const header = file.header.payload;
  const length = headerDeclaredLength(header);
  return {
    address: header[13]! | (header[14]! << 8),
    bytes: file.data!.payload.slice(0, length),
    name: headerName(header.slice(1, 11)),
  };
}

/**
 * {@link parseTap} plus every CODE file (header type 3, paired with its data
 * block) the `.TAP` carries, and the same import-fidelity warnings
 * {@link parseTapWithReport} produces - except CODE files are no longer
 * "other files": they come back as {@link CodeFile}s instead of being
 * skipped. Arrays and headerless/unpaired blocks are still skipped, with a
 * warning.
 *
 * A `.TAP` that holds more than one BASIC-program file is a common
 * real-hardware layout for a tiny loader (`LOAD "" CODE: RANDOMIZE USR n`)
 * chaining into the real program: when the first program file's tokenized
 * body is short (see {@link LOADER_MAX_PROGRAM_BYTES}) and another program
 * file follows it, the loader is skipped (with a warning) and the next
 * program file is imported as `program` instead. Any BASIC program file
 * beyond that - a third, fourth, etc. - is reported as an "other file" like
 * any other skipped file.
 */
export function parseTapAllFiles(image: Uint8Array): {
  program: ParsedTap;
  code: CodeFile[];
  warnings: string[];
} {
  const { blocks, truncated } = scanBlocks(image);
  const files = pairFiles(blocks);
  const programFiles = files.filter(
    (f) => f.header.payload[0] === PROGRAM_TYPE && f.data,
  );
  if (programFiles.length === 0)
    throw new Error('Not a valid .TAP program image');

  const warnings: string[] = [];
  let chosen = programFiles[0]!;
  let skippedLoader: TapFile | null = null;
  if (programFiles.length > 1) {
    const header = chosen.header.payload;
    const progLen = header[15]! | (header[16]! << 8);
    if (progLen <= LOADER_MAX_PROGRAM_BYTES) {
      skippedLoader = chosen;
      chosen = programFiles[1]!;
    }
  }

  if (!chosen.header.parityOk) {
    warnings.push(
      'The .TAP program header failed its checksum (parity byte); the ' +
        'import may be corrupt.',
    );
  }
  if (chosen.data && !chosen.data.parityOk) {
    warnings.push(
      'The .TAP program data block failed its checksum (parity byte); the ' +
        'import may be corrupt.',
    );
  }

  if (skippedLoader) {
    const loaderName = headerName(skippedLoader.header.payload.slice(1, 11));
    warnings.push(
      `The .TAP begins with a short loader program${loaderName ? ` ("${loaderName}")` : ''}; ` +
        'it was skipped and the following BASIC program was imported instead.',
    );
  }

  const code: CodeFile[] = [];
  const others: TapFile[] = [];
  for (const f of files) {
    if (f === chosen || f === skippedLoader) continue;
    if (f.header.payload[0] === CODE_TYPE && f.data) {
      code.push(codeFileFromTapFile(f));
    } else {
      others.push(f);
    }
  }

  if (others.length > 0) {
    const kinds = others
      .map((f) => TYPE_NAMES[f.header.payload[0]!] ?? 'unknown')
      .join(', ');
    const plural = others.length === 1 ? 'file' : 'files';
    warnings.push(
      `The .TAP holds ${others.length} other ${plural} (${kinds}); only the ` +
        'BASIC program and CODE files were imported.',
    );
  }

  const header = chosen.header.payload;
  const progLen = header[15]! | (header[16]! << 8);
  if (chosen.data && progLen > chosen.data.payload.length) {
    warnings.push(
      'The .TAP header claims a longer program than the data block holds; ' +
        'the program area is truncated.',
    );
  }
  if (truncated) {
    warnings.push('The .TAP image is truncated: a block runs past the end.');
  }

  return { program: parseProgramFile(chosen), code, warnings };
}

/**
 * {@link parseTap} plus import-fidelity warnings: a `.TAP` that is a
 * multi-file compilation (extra CODE/array/program files are skipped), whose
 * chosen blocks fail their parity checksum, that is truncated, or whose header
 * promises a longer program than the data block holds. The returned `parsed` is
 * the same BASIC-program file {@link parseTap} selects.
 */
export function parseTapWithReport(image: Uint8Array): {
  parsed: ParsedTap;
  warnings: string[];
} {
  const { blocks, truncated } = scanBlocks(image);
  const files = pairFiles(blocks);
  const program = findProgramFile(files);
  if (!program) throw new Error('Not a valid .TAP program image');

  const warnings: string[] = [];
  if (!program.header.parityOk) {
    warnings.push(
      'The .TAP program header failed its checksum (parity byte); the ' +
        'import may be corrupt.',
    );
  }
  if (program.data && !program.data.parityOk) {
    warnings.push(
      'The .TAP program data block failed its checksum (parity byte); the ' +
        'import may be corrupt.',
    );
  }

  const others = files.filter((f) => f !== program);
  if (others.length > 0) {
    const kinds = others
      .map((f) => TYPE_NAMES[f.header.payload[0]!] ?? 'unknown')
      .join(', ');
    const plural = others.length === 1 ? 'file' : 'files';
    warnings.push(
      `The .TAP holds ${others.length} other ${plural} (${kinds}); only the ` +
        'first BASIC program was imported.',
    );
  }

  const header = program.header.payload;
  const progLen = header[15]! | (header[16]! << 8);
  if (program.data && progLen > program.data.payload.length) {
    warnings.push(
      'The .TAP header claims a longer program than the data block holds; ' +
        'the program area is truncated.',
    );
  }
  if (truncated) {
    warnings.push('The .TAP image is truncated: a block runs past the end.');
  }

  return { parsed: parseProgramFile(program), warnings };
}
