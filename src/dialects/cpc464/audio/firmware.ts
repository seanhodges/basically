import { PROGRAM_BASE } from '../sysvars';
/**
 * Amstrad CPC firmware cassette record scheme (the byte layer shared by the
 * `.wav` cassette encoder and the `.cdt` tape image).
 *
 * The firmware writes a file as a sequence of **blocks** of up to 2048 file
 * bytes. Each block is stored on tape as two records: a **header record**
 * (synchronisation character `&2C`) carrying a 64-byte header, and a **data
 * record** (`&16`) carrying the block's bytes. Both records split their payload
 * into 256-byte **segments**, each followed by a 2-byte CRC-16/CCITT so the
 * firmware can detect a bad read. The header's 64 bytes sit in one padded
 * segment; a data record holds `ceil(dataLen / 256)` segments (the final one
 * zero-padded to 256). The header names the file and records the block number,
 * the first/last flags and this block's data length, which is what lets
 * {@link parseFirmwareStream} walk the records back without any external framing.
 *
 * The 64-byte header mirrors the AMSDOS header (see `basfile.ts`): file type 0
 * for unprotected tokenized BASIC, load address `&170` (the BASIC program area).
 * Numeric details are from SOFT968 (the Amstrad firmware guide); the CRC is the
 * CCITT polynomial `&1021`, stored complemented as the firmware does.
 */

/** Synchronisation character that opens a header record. */
const HEADER_TYPE = 0x2c;
/** Synchronisation character that opens a data record. */
const DATA_TYPE = 0x16;
/** Bytes per CRC-protected segment. */
const SEGMENT_SIZE = 256;
/** Maximum file bytes carried by one 2K block. */
const MAX_BLOCK_DATA = 2048;
/** Bytes in the record header (padded into the first segment). */
const HEADER_LEN = 64;
/** BASIC program area start; where a tokenized `.bas` loads (matches basfile.ts). */

/** Header field offsets, per SOFT968's cassette header. */
const OFF_NAME = 0; // 16 bytes, space padded
const OFF_BLOCK_NUMBER = 16;
const OFF_LAST_BLOCK = 17; // 0xFF on the final block
const OFF_FILE_TYPE = 18; // 0 = unprotected tokenized BASIC
const OFF_DATA_LENGTH = 19; // u16 LE: bytes in this block
const OFF_LOAD_ADDRESS = 21; // u16 LE
const OFF_FIRST_BLOCK = 23; // 0xFF on the first block
const OFF_LOGICAL_LENGTH = 24; // u16 LE: total file length
const OFF_ENTRY_ADDRESS = 26; // u16 LE

/** CRC-16/CCITT (poly 0x1021, init 0xFFFF), MSB-first - the CPC tape CRC. */
export function crc16(data: ArrayLike<number>): number {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= (data[i]! & 0xff) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  // The firmware stores the CRC complemented; a good read recomputes to 0xFFFF.
  return ~crc & 0xffff;
}

/** 16-char, upper-case, space-padded tape name (letters/digits only). */
function nameBytes(name: string): Uint8Array {
  const cleaned =
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 16) || 'PROGRAM';
  const out = new Uint8Array(16).fill(0x20);
  for (let i = 0; i < cleaned.length; i++) out[i] = cleaned.charCodeAt(i);
  return out;
}

/** Read the tape name back, trailing spaces/nulls trimmed. */
function readName(header: Uint8Array): string {
  let s = '';
  for (let i = 0; i < 16; i++) {
    const c = header[OFF_NAME + i]!;
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s.replace(/\s+$/, '');
}

/** One CRC-protected segment: `SEGMENT_SIZE` data bytes + 2 CRC bytes (MSB first). */
function buildSegment(data: Uint8Array): Uint8Array {
  const seg = new Uint8Array(SEGMENT_SIZE + 2);
  seg.set(data.subarray(0, SEGMENT_SIZE));
  const crc = crc16(seg.subarray(0, SEGMENT_SIZE));
  seg[SEGMENT_SIZE] = (crc >> 8) & 0xff;
  seg[SEGMENT_SIZE + 1] = crc & 0xff;
  return seg;
}

/** The 64-byte header for one block. */
function buildHeader(
  name: Uint8Array,
  blockNumber: number,
  dataLength: number,
  isFirst: boolean,
  isLast: boolean,
  logicalLength: number,
): Uint8Array {
  const h = new Uint8Array(HEADER_LEN);
  h.set(name.subarray(0, 16), OFF_NAME);
  h[OFF_BLOCK_NUMBER] = blockNumber & 0xff;
  h[OFF_LAST_BLOCK] = isLast ? 0xff : 0x00;
  h[OFF_FILE_TYPE] = 0x00; // unprotected tokenized BASIC
  h[OFF_DATA_LENGTH] = dataLength & 0xff;
  h[OFF_DATA_LENGTH + 1] = (dataLength >> 8) & 0xff;
  h[OFF_LOAD_ADDRESS] = PROGRAM_BASE & 0xff;
  h[OFF_LOAD_ADDRESS + 1] = (PROGRAM_BASE >> 8) & 0xff;
  h[OFF_FIRST_BLOCK] = isFirst ? 0xff : 0x00;
  h[OFF_LOGICAL_LENGTH] = logicalLength & 0xff;
  h[OFF_LOGICAL_LENGTH + 1] = (logicalLength >> 8) & 0xff;
  h[OFF_ENTRY_ADDRESS] = 0;
  h[OFF_ENTRY_ADDRESS + 1] = 0;
  return h;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

/**
 * Build the firmware records for a tokenized program: for every 2K block, a
 * header record then a data record, each of 256-byte CRC'd segments (each record
 * opening with its `&2C`/`&16` synchronisation byte). The `.cdt` writer carries
 * each record in its own TZX block; {@link buildFirmwareStream} concatenates them
 * for the `.wav` encoder's single pilot-toned stream.
 */
export function buildFirmwareRecords(
  program: Uint8Array,
  name: string,
): Uint8Array[] {
  const nb = nameBytes(name);
  const blockCount = Math.max(1, Math.ceil(program.length / MAX_BLOCK_DATA));
  const records: Uint8Array[] = [];
  for (let i = 0; i < blockCount; i++) {
    const blockData = program.subarray(
      i * MAX_BLOCK_DATA,
      (i + 1) * MAX_BLOCK_DATA,
    );
    const isFirst = i === 0;
    const isLast = i === blockCount - 1;

    const header = buildHeader(
      nb,
      i + 1,
      blockData.length,
      isFirst,
      isLast,
      program.length,
    );
    const headerSeg = new Uint8Array(SEGMENT_SIZE);
    headerSeg.set(header);
    records.push(concat([Uint8Array.of(HEADER_TYPE), buildSegment(headerSeg)]));

    const dataSegs: Uint8Array[] = [Uint8Array.of(DATA_TYPE)];
    for (let off = 0; off < blockData.length; off += SEGMENT_SIZE) {
      const chunk = new Uint8Array(SEGMENT_SIZE);
      chunk.set(blockData.subarray(off, off + SEGMENT_SIZE));
      dataSegs.push(buildSegment(chunk));
    }
    records.push(concat(dataSegs));
  }
  return records;
}

/**
 * The full on-tape byte sequence (minus the physical leader/sync): every
 * firmware record concatenated. The `.wav` encoder wraps this in a pilot tone.
 */
export function buildFirmwareStream(
  program: Uint8Array,
  name: string,
): Uint8Array {
  return concat(buildFirmwareRecords(program, name));
}

/** Result of decoding a firmware record stream. */
export interface FirmwareStream {
  name: string;
  program: Uint8Array;
  warnings: string[];
}

/** A truncated stream: the record ran past the end of the captured bytes. */
const TRUNCATED =
  'The cassette recording ended before the program was complete.';

/**
 * Walk a firmware record stream back to the tokenized program (the inverse of
 * {@link buildFirmwareStream}). Bad CRCs and truncation are reported as
 * warnings rather than thrown, so a slightly noisy capture still yields the
 * best-effort program; a stream with no recognisable header record throws.
 */
export function parseFirmwareStream(stream: Uint8Array): FirmwareStream {
  const warnings: string[] = [];
  const collected: Uint8Array[] = [];
  let name = '';
  let sawHeader = false;
  let badCrc = false;

  let p = 0;
  while (p < stream.length) {
    if (stream[p] !== HEADER_TYPE) {
      // Skip stray bytes between records (a trailer or inter-record gap).
      p++;
      continue;
    }
    p++; // consume the header sync character

    if (p + SEGMENT_SIZE + 2 > stream.length) {
      warnings.push(TRUNCATED);
      break;
    }
    const headerSeg = stream.subarray(p, p + SEGMENT_SIZE);
    if (!segmentCrcOk(stream, p)) badCrc = true;
    p += SEGMENT_SIZE + 2;

    const header = headerSeg.subarray(0, HEADER_LEN);
    if (!sawHeader) name = readName(header);
    sawHeader = true;
    const dataLength =
      header[OFF_DATA_LENGTH]! | (header[OFF_DATA_LENGTH + 1]! << 8);
    const isLast = header[OFF_LAST_BLOCK] !== 0x00;

    if (stream[p] !== DATA_TYPE) {
      warnings.push('A data record was missing after a header record.');
      break;
    }
    p++; // consume the data sync character

    const segCount = Math.ceil(dataLength / SEGMENT_SIZE);
    const chunks: Uint8Array[] = [];
    let truncated = false;
    for (let s = 0; s < segCount; s++) {
      if (p + SEGMENT_SIZE + 2 > stream.length) {
        warnings.push(TRUNCATED);
        truncated = true;
        break;
      }
      if (!segmentCrcOk(stream, p)) badCrc = true;
      chunks.push(stream.subarray(p, p + SEGMENT_SIZE));
      p += SEGMENT_SIZE + 2;
    }
    collected.push(concat(chunks).subarray(0, dataLength));
    if (truncated || isLast) break;
  }

  if (!sawHeader) throw new Error('No CPC cassette file found.');
  if (badCrc) {
    warnings.push(
      'One or more tape blocks failed their checksum; the program may be corrupt.',
    );
  }
  return { name, program: concat(collected), warnings };
}

/** True when the 256-byte segment at `p` matches its stored CRC. */
function segmentCrcOk(stream: Uint8Array, p: number): boolean {
  const stored =
    (stream[p + SEGMENT_SIZE]! << 8) | stream[p + SEGMENT_SIZE + 1]!;
  return crc16(stream.subarray(p, p + SEGMENT_SIZE)) === stored;
}
