import { PROG_START } from './tokenizer';

/**
 * The Model I Level II BASIC cassette (CSAVE) block, at the byte level. A real
 * tape carries: a long leader of 0x00 sync bytes, the 0xA5 sync byte that ends
 * the leader, the three-byte 0xD3 0xD3 0xD3 BASIC-file marker, a one-character
 * filename, then the tokenized program exactly as it sits from 0x42E9 - which
 * already ends with its own 0x0000 link, so that doubles as the end marker.
 *
 * This module is the byte ↔ block layer; `audio/cassetteEncoder` renders these
 * bytes to 500-baud tape samples and `audio/cassetteDecoder` recovers them.
 */

/** Leader of 0x00 sync bytes written before the program. */
export const LEADER_LENGTH = 256;
/** Sync byte that marks the end of the leader (Model I 500-baud). */
export const SYNC_BYTE = 0xa5;
/** Repeated this many times after the sync byte to flag a BASIC file. */
export const BASIC_MARKER = 0xd3;
const BASIC_MARKER_COUNT = 3;

/** Model III 1500-baud tapes lead with 0x55 and sync on 0x7F, not 0x00/0xA5. */
const MODEL_III_LEADER = 0x55;
const MODEL_III_SYNC = 0x7f;

/**
 * SYSTEM (machine-language) tape layout, Model I 500-baud. After the same
 * 0x00 leader + 0xA5 sync as a BASIC tape it carries a single 0x55 header byte,
 * a fixed six-character filename, then a run of data records - each a 0x3C
 * marker, a one-byte length (0 means 256), a two-byte little-endian load
 * address, that many data bytes and a one-byte checksum (the low byte of the
 * sum of the two address bytes and the data). A 0x78 entry-point record, with
 * its own two-byte little-endian entry address, terminates the tape.
 */
const SYSTEM_HEADER = 0x55;
const SYSTEM_DATA_MARKER = 0x3c;
const SYSTEM_ENTRY_MARKER = 0x78;
const SYSTEM_NAME_LENGTH = 6;

/** Shown when a Model III high-speed cassette is detected (not yet decodable). */
export const MODEL_III_MESSAGE =
  'This looks like a Model III 1500-baud cassette (0x55 leader, 0x7F sync), ' +
  'which this importer cannot decode yet — only Model I 500-baud CSAVE tapes ' +
  'are supported.';

/** Format a byte address as `0xNNNN` for warning messages. */
function hex(n: number): string {
  return `0x${n.toString(16).toUpperCase().padStart(4, '0')}`;
}

/** True when `bytes` carry the 0xD3×3 BASIC-file marker starting at `at`. */
function hasBasicMarker(bytes: Uint8Array, at: number): boolean {
  for (let m = 0; m < BASIC_MARKER_COUNT; m++) {
    if (bytes[at + m] !== BASIC_MARKER) return false;
  }
  return true;
}

/**
 * Classify a `.cas` image: a Model I 500-baud BASIC (CSAVE) block, a Model I
 * SYSTEM (machine-language) tape, a Model III 1500-baud tape (leader/sync
 * detected but not decodable here), or something else. The import path uses
 * this to warn clearly, or route to the right parser, rather than silently
 * mis-decoding.
 */
export function casFormat(
  image: Uint8Array,
): 'model1' | 'system' | 'model3' | 'unknown' {
  let i = 0;
  while (i < image.length && image[i] === 0x00) i++;
  if (image[i] === SYNC_BYTE) {
    if (hasBasicMarker(image, i + 1)) return 'model1';
    // A 0x55 header immediately after the sync marks a SYSTEM (machine-code)
    // tape rather than a 0xD3×3 BASIC one.
    if (image[i + 1] === SYSTEM_HEADER) return 'system';
  }

  let j = 0;
  while (
    j < image.length &&
    (image[j] === 0x00 || image[j] === MODEL_III_LEADER)
  ) {
    j++;
  }
  if (image[j] === MODEL_III_SYNC) return 'model3';

  return 'unknown';
}

/** True when `image` opens with a Model I SYSTEM (machine-language) tape. */
export function isSystemCas(image: Uint8Array): boolean {
  return casFormat(image) === 'system';
}

/**
 * Parse a Model I SYSTEM (machine-language) cassette image into its filename,
 * loadable data blocks and entry address. Lenient like the BASIC importer:
 * a record with a bad checksum is still kept, with a note pushed onto the
 * optional `warnings` array rather than throwing, and parsing stops cleanly at
 * the first malformed/short record so a noisy tape decode still yields the
 * blocks it managed to read.
 */
export function parseSystemCas(
  image: Uint8Array,
  warnings?: string[],
): {
  name: string;
  blocks: { address: number; bytes: Uint8Array }[];
  entry: number;
} {
  let i = 0;
  while (i < image.length && image[i] === 0x00) i++;
  if (image[i] !== SYNC_BYTE) {
    throw new Error('trs80: not a SYSTEM cassette (missing 0xA5 sync byte)');
  }
  i++;
  if (image[i] !== SYSTEM_HEADER) {
    throw new Error('trs80: not a SYSTEM cassette (missing 0x55 header byte)');
  }
  i++;

  let name = '';
  for (let n = 0; n < SYSTEM_NAME_LENGTH && i < image.length; n++, i++) {
    const code = image[i]!;
    if (code >= 0x20 && code < 0x80) name += String.fromCharCode(code);
  }
  name = name.trim();

  const blocks: { address: number; bytes: Uint8Array }[] = [];
  let entry = 0;
  let blockNo = 0;

  while (i < image.length) {
    const marker = image[i++]!;
    if (marker === SYSTEM_ENTRY_MARKER) {
      // Entry-point record: two-byte little-endian entry address ends the tape.
      if (i + 1 < image.length) entry = image[i]! | (image[i + 1]! << 8);
      break;
    }
    if (marker !== SYSTEM_DATA_MARKER) break; // unknown record: stop cleanly

    blockNo++;
    if (i >= image.length) break;
    const rawLen = image[i++]!;
    const length = rawLen === 0 ? 256 : rawLen; // 0 encodes a full 256-byte block
    if (i + 2 > image.length) break; // no room for the load address
    const address = image[i]! | (image[i + 1]! << 8);
    i += 2;
    if (i + length > image.length) break; // truncated data
    const bytes = image.slice(i, i + length);
    i += length;
    if (i >= image.length) break; // missing checksum byte
    const checksum = image[i++]!;

    let sum = (address & 0xff) + ((address >> 8) & 0xff);
    for (const b of bytes) sum += b;
    if ((sum & 0xff) !== checksum) {
      warnings?.push(
        `SYSTEM block ${blockNo} (load address ${hex(address)}) has a bad ` +
          `checksum; it was imported anyway but may be corrupt.`,
      );
    }
    blocks.push({ address, bytes });
  }

  return { name, blocks, entry };
}

/** Single-character cassette name: first A–Z/0–9 of the title, default 'A'. */
export function casNameByte(name: string): number {
  const cleaned = name.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return (cleaned[0] ?? 'A').charCodeAt(0);
}

/**
 * Length in bytes of the linked-line program at the start of `program`,
 * including its terminating 0x0000 link. Walks the absolute next-line pointers
 * from 0x42E9; falls back to the whole buffer if a link is malformed (so a
 * slightly noisy tape decode still yields something to detokenize).
 */
export function programByteLength(
  program: Uint8Array,
  base = PROG_START,
): number {
  let o = 0;
  while (o + 4 <= program.length) {
    const link = program[o]! | (program[o + 1]! << 8);
    if (link === 0) return o + 2; // null link terminates the program
    const next = link - base;
    if (next <= o || next > program.length) break; // malformed: bail out
    o = next;
  }
  return program.length;
}

/**
 * Build a Model I BASIC cassette image from a tokenized program. `program` is
 * the bytes from 0x42E9 (as {@link tokenizeProgram} produces). `leaderLength`
 * defaults to the standard 256-byte leader; the audio encoder passes its own.
 */
export function buildCasImage(
  program: Uint8Array,
  programName: string,
  leaderLength = LEADER_LENGTH,
): Uint8Array {
  const out = new Uint8Array(
    leaderLength + 1 + BASIC_MARKER_COUNT + 1 + program.length,
  );
  let p = leaderLength; // the leader is already 0x00 from zero-init
  out[p++] = SYNC_BYTE;
  for (let i = 0; i < BASIC_MARKER_COUNT; i++) out[p++] = BASIC_MARKER;
  out[p++] = casNameByte(programName);
  out.set(program, p);
  return out;
}

/** True when `image` opens with a Model I BASIC cassette block (leader optional). */
export function isCasImage(image: Uint8Array): boolean {
  return casFormat(image) === 'model1';
}

/**
 * Parse a Model I BASIC cassette image back into its filename and tokenized
 * program. Tolerates a leader of any length - including none, since the audio
 * decoder hands over a leaderless block once it has locked onto the 0xA5 sync.
 */
export function parseCasImage(image: Uint8Array): {
  programName: string;
  program: Uint8Array;
} {
  let i = 0;
  while (i < image.length && image[i] === 0x00) i++;
  if (image[i] !== SYNC_BYTE) {
    throw new Error('trs80: not a BASIC cassette (missing 0xA5 sync byte)');
  }
  i++;
  for (let m = 0; m < BASIC_MARKER_COUNT; m++) {
    if (image[i++] !== BASIC_MARKER) {
      throw new Error('trs80: not a BASIC cassette (missing 0xD3 marker)');
    }
  }
  const nameCode = image[i++];
  if (nameCode === undefined) {
    throw new Error('trs80: truncated cassette (no filename)');
  }
  const programName = String.fromCharCode(nameCode).trim();
  const rest = image.subarray(i);
  const program = rest.subarray(0, programByteLength(rest));
  return { programName, program };
}
