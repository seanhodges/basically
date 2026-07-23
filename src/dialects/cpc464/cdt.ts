/**
 * `.cdt` tape image - the CPC's TZX-derived container.
 *
 * A `.cdt` is a TZX file (signature `ZXTape!`) carrying the CPC firmware record
 * stream. Each firmware record (a header record or a data record, see
 * `audio/firmware.ts`) is written as one **Turbo Speed Data Block** (TZX block
 * id `&11`), whose parameter header spells out the pilot tone and the pulse
 * lengths of a `0`/`1` bit. Those lengths are the CPC's own cassette timings in
 * the standard 3.5 MHz TZX time base, so a real CPC emulator recognises the tape;
 * import here only needs the block's data bytes, which {@link parseCdt} hands
 * straight back to {@link parseFirmwareStream}.
 */

import { buildFirmwareRecords, parseFirmwareStream } from './audio/firmware';

const SIGNATURE = 'ZXTape!\x1a';
/** TZX version this writer emits (major.minor = 1.20). */
const VERSION = [1, 20];

const ID_STANDARD_DATA = 0x10;
const ID_TURBO_DATA = 0x11;
const ID_PURE_TONE = 0x12;
const ID_PULSE_SEQUENCE = 0x13;
const ID_PURE_DATA = 0x14;
const ID_PAUSE = 0x20;
const ID_GROUP_START = 0x21;
const ID_GROUP_END = 0x22;
const ID_TEXT_DESCRIPTION = 0x30;
const ID_MESSAGE = 0x31;
const ID_ARCHIVE_INFO = 0x32;
const ID_HARDWARE_TYPE = 0x33;
const ID_CUSTOM_INFO = 0x35;
const ID_GLUE = 0x5a;

/**
 * CPC cassette pulse lengths in 3.5 MHz T-states (~0.2857 us each), matching the
 * `audio/cassette.ts` timings: a `0` bit half-cycle is 125 us ~= 437 T-states, a
 * `1` bit is twice that; the pilot is a run of `1`-length pulses.
 */
const T = {
  zeroPulse: 437,
  onePulse: 874,
  pilotPulse: 874,
  pilotCount: 4096,
  syncPulse: 437,
  pauseMs: 100,
};

function u16(v: number): [number, number] {
  return [v & 0xff, (v >> 8) & 0xff];
}
function u24(v: number): [number, number, number] {
  return [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff];
}

/** One TZX Turbo Speed Data Block (`&11`) carrying `data`. */
function turboBlock(data: Uint8Array): number[] {
  return [
    ID_TURBO_DATA,
    ...u16(T.pilotPulse),
    ...u16(T.syncPulse), // sync first pulse
    ...u16(T.syncPulse), // sync second pulse
    ...u16(T.zeroPulse),
    ...u16(T.onePulse),
    ...u16(T.pilotCount),
    8, // used bits in the last byte
    ...u16(T.pauseMs),
    ...u24(data.length),
    ...data,
  ];
}

/** True when `bytes` begins with the TZX/`.cdt` signature. */
export function isCdt(bytes: Uint8Array): boolean {
  if (bytes.length < SIGNATURE.length) return false;
  for (let i = 0; i < SIGNATURE.length; i++) {
    if (bytes[i] !== SIGNATURE.charCodeAt(i)) return false;
  }
  return true;
}

/** Build a `.cdt` image for a tokenized program. */
export function buildCdt(program: Uint8Array, name: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < SIGNATURE.length; i++) out.push(SIGNATURE.charCodeAt(i));
  out.push(VERSION[0]!, VERSION[1]!);
  // Each firmware record becomes its own turbo data block, so a real emulator
  // sees the tape as the CPC firmware wrote it (header record, then data record).
  for (const record of buildFirmwareRecords(program, name)) {
    out.push(...turboBlock(record));
  }
  return Uint8Array.from(out);
}

/** Result of decoding a `.cdt` image. */
export interface CdtImport {
  name: string;
  program: Uint8Array;
  warnings: string[];
}

/** Decode a `.cdt` image back to its tokenized program (inverse of {@link buildCdt}). */
export function parseCdt(bytes: Uint8Array): CdtImport {
  if (!isCdt(bytes)) throw new Error('Not a .cdt (TZX) tape image.');
  const data = extractDataBlocks(bytes);
  if (data.length === 0) throw new Error('The .cdt holds no tape data blocks.');
  return parseFirmwareStream(data);
}

/**
 * Concatenate the data payloads of every data block in the TZX, skipping the
 * metadata blocks (text, archive info, groups…). Only the block ids this writer
 * might meet are handled; an unknown id throws rather than mis-frame the stream.
 */
function extractDataBlocks(bytes: Uint8Array): Uint8Array {
  const chunks: Uint8Array[] = [];
  let p = SIGNATURE.length + 2; // past signature + version
  while (p < bytes.length) {
    const id = bytes[p++]!;
    switch (id) {
      case ID_STANDARD_DATA: {
        // [pause u16][len u16][data]
        const len = bytes[p + 2]! | (bytes[p + 3]! << 8);
        chunks.push(bytes.subarray(p + 4, p + 4 + len));
        p += 4 + len;
        break;
      }
      case ID_TURBO_DATA: {
        // 18-byte parameter header, then a 24-bit data length.
        const len =
          bytes[p + 15]! | (bytes[p + 16]! << 8) | (bytes[p + 17]! << 16);
        chunks.push(bytes.subarray(p + 18, p + 18 + len));
        p += 18 + len;
        break;
      }
      case ID_PURE_DATA: {
        // [zero u16][one u16][used-bits 1][pause u16][len u24][data]
        const len =
          bytes[p + 7]! | (bytes[p + 8]! << 8) | (bytes[p + 9]! << 16);
        chunks.push(bytes.subarray(p + 10, p + 10 + len));
        p += 10 + len;
        break;
      }
      case ID_PURE_TONE:
        p += 4; // [pulse u16][count u16]
        break;
      case ID_PULSE_SEQUENCE:
        p += 1 + bytes[p]! * 2; // [count 1][count x u16]
        break;
      case ID_PAUSE:
        p += 2;
        break;
      case ID_GROUP_START:
        p += 1 + bytes[p]!; // [len 1][chars]
        break;
      case ID_GROUP_END:
        break;
      case ID_TEXT_DESCRIPTION:
      case ID_MESSAGE: {
        // Message has a leading time byte; both end with [len 1][chars].
        const lenOff = id === ID_MESSAGE ? p + 1 : p;
        const skip = id === ID_MESSAGE ? 1 : 0;
        p += skip + 1 + bytes[lenOff]!;
        break;
      }
      case ID_ARCHIVE_INFO:
      case ID_CUSTOM_INFO: {
        const len =
          bytes[p]! |
          (bytes[p + 1]! << 8) |
          (bytes[p + 2]! << 16) |
          (bytes[p + 3]! << 24);
        p += 4 + len;
        break;
      }
      case ID_HARDWARE_TYPE:
        p += 1 + bytes[p]! * 3; // [count 1][count x 3 bytes]
        break;
      case ID_GLUE:
        p += 9;
        break;
      default:
        throw new Error(
          `Unsupported .cdt block id &${id.toString(16).toUpperCase()}.`,
        );
    }
  }
  return concat(chunks);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of parts) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}
