import { PROGRAM_BASE } from './sysvars';
/**
 * AMSDOS `.bas` container: a 128-byte header ahead of the tokenized program,
 * carrying the file type, load/length/entry fields and a 16-bit checksum of
 * header bytes 0-66 at offset 67 (little-endian) - the checksum is how AMSDOS
 * itself detects a header, and how {@link parseBasFile} does too, so raw
 * (headerless) tokenized images also import cleanly. Layout per the CPCWiki
 * AMSDOS header reference (cpctech `allhead.html`).
 */

const HEADER_SIZE = 128;
/** Header offsets (see the module comment for the reference). */
const OFF_NAME = 1; // 8 bytes name + 3 bytes extension, space padded
const OFF_TYPE = 18; // 0 = unprotected tokenized BASIC
const OFF_LOAD = 21;
const OFF_LENGTH = 24;
const OFF_ENTRY = 26;
const OFF_LENGTH24 = 64; // 24-bit file length
const OFF_CHECKSUM = 67; // 16-bit LE sum of bytes 0-66

/** BASIC program area start; where a tokenized `.bas` loads. */

/** Sum of header bytes 0-66, as AMSDOS computes it. */
function headerChecksum(header: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < OFF_CHECKSUM; i++) sum += header[i]!;
  return sum & 0xffff;
}

/** 8.3-sanitize a program name for the header's filename field. */
function headerName(programName: string): string {
  const cleaned = programName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
  return (cleaned === '' ? 'PROGRAM' : cleaned).padEnd(8, ' ') + 'BAS';
}

/** Wrap a tokenized program in an AMSDOS header. */
export function buildBasFile(
  program: Uint8Array,
  programName = 'PROGRAM',
): Uint8Array {
  const out = new Uint8Array(HEADER_SIZE + program.length);
  const header = out.subarray(0, HEADER_SIZE);

  const name = headerName(programName);
  for (let i = 0; i < name.length; i++) {
    header[OFF_NAME + i] = name.charCodeAt(i);
  }
  header[OFF_TYPE] = 0x00; // unprotected BASIC
  header[OFF_LOAD] = PROGRAM_BASE & 0xff;
  header[OFF_LOAD + 1] = PROGRAM_BASE >> 8;
  header[OFF_LENGTH] = program.length & 0xff;
  header[OFF_LENGTH + 1] = (program.length >> 8) & 0xff;
  header[OFF_ENTRY] = 0;
  header[OFF_ENTRY + 1] = 0;
  header[OFF_LENGTH24] = program.length & 0xff;
  header[OFF_LENGTH24 + 1] = (program.length >> 8) & 0xff;
  header[OFF_LENGTH24 + 2] = (program.length >> 16) & 0xff;
  const sum = headerChecksum(header);
  header[OFF_CHECKSUM] = sum & 0xff;
  header[OFF_CHECKSUM + 1] = sum >> 8;

  out.set(program, HEADER_SIZE);
  return out;
}

/**
 * Unwrap an AMSDOS-headered tokenized program image; a headerless (raw
 * tokenized) image passes through untouched with no warnings. Header
 * detection is AMSDOS's own rule: 128+ bytes whose stored checksum matches
 * the sum of bytes 0-66 (a corrupt header therefore reads as raw data,
 * exactly as on the machine).
 */
export function parseBasFile(image: Uint8Array): {
  program: Uint8Array;
  warnings: string[];
} {
  if (image.length < HEADER_SIZE) return { program: image, warnings: [] };
  const stored = image[OFF_CHECKSUM]! | (image[OFF_CHECKSUM + 1]! << 8);
  if (stored !== headerChecksum(image.subarray(0, HEADER_SIZE))) {
    return { program: image, warnings: [] };
  }

  const warnings: string[] = [];
  const type = image[OFF_TYPE]!;
  if (type !== 0x00) {
    warnings.push(
      `AMSDOS file type &${type.toString(16).padStart(2, '0').toUpperCase()} ` +
        'is not unprotected BASIC; the payload was imported as a tokenized program.',
    );
  }

  const length24 =
    image[OFF_LENGTH24]! |
    (image[OFF_LENGTH24 + 1]! << 8) |
    (image[OFF_LENGTH24 + 2]! << 16);
  const length16 = image[OFF_LENGTH]! | (image[OFF_LENGTH + 1]! << 8);
  const declared = length24 !== 0 ? length24 : length16;
  const available = image.length - HEADER_SIZE;
  let length = declared === 0 ? available : declared;
  if (length > available) {
    warnings.push(
      `The AMSDOS header declares ${declared} program bytes but only ` +
        `${available} follow it; the file may be truncated.`,
    );
    length = available;
  }

  return {
    program: image.subarray(HEADER_SIZE, HEADER_SIZE + length),
    warnings,
  };
}
