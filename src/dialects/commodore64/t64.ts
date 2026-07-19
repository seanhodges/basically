/**
 * Commodore `.t64` tape-image container - the directory format the C64S
 * emulator introduced and most Commodore archives use for multi-file tapes.
 * Not to be confused with `.tap` (raw pulse timings, signature "C64-TAPE-RAW"),
 * which this module deliberately rejects.
 *
 * Layout:
 *
 * ```
 *  0..31   ASCII signature, e.g. "C64S tape image file" (NUL/space padded)
 * 32..33   version (little-endian)
 * 34..35   maximum directory entries (little-endian)
 * 36..37   used directory entries (little-endian; famously 0 in broken files)
 * 40..63   container name (space-padded ASCII)
 * 64..     32-byte directory entries:
 *            0      entry type (0 = free slot, 1 = normal tape file)
 *            2..3   start (load) address, little-endian
 *            4..5   end address (exclusive), little-endian - often wrong in
 *                   files written by broken tools, so lengths are clamped
 *            8..11  absolute offset of the data in the container (LE u32)
 *           16..31  filename, PETSCII, space-padded
 * ```
 */

import { parseC64Char } from './petscii';

/** One usable file recovered from a `.t64` directory. */
export interface T64Entry {
  /** Directory filename, trimmed, PETSCII folded to ASCII. */
  name: string;
  /** Load (start) address of the payload. */
  start: number;
  /** Payload bytes (no load-address word - the directory carries it). */
  bytes: Uint8Array;
}

/** One file to write into a `.t64` directory (see {@link buildT64}). */
export interface T64ExportEntry {
  /** Directory filename; PETSCII-encoded and space-padded to 16 bytes. */
  name: string;
  /** Load (start) address stored in the entry, e.g. $0801 for a BASIC program. */
  start: number;
  /** Payload bytes, without the .prg load-address word (the entry carries it). */
  bytes: Uint8Array;
}

const HEADER_SIZE = 64;
const ENTRY_SIZE = 32;
const RAW_TAP_SIGNATURE = 'C64-TAPE-RAW';
/** The signature this exporter writes; recognised by {@link isT64}. */
const EXPORT_SIGNATURE = 'C64S tape image file';
/** Directory-entry container-name field (bytes 40..63) length. */
const CONTAINER_NAME_LENGTH = 24;
/** Directory-entry filename field (bytes 16..31) length. */
const FILENAME_LENGTH = 16;

/** Signature bytes 0..31 as trimmed ASCII (NULs and padding dropped). */
function signatureOf(image: Uint8Array): string {
  let sig = '';
  for (let i = 0; i < 32 && i < image.length; i++) {
    const c = image[i]!;
    if (c === 0x00) break;
    sig += String.fromCharCode(c);
  }
  return sig.trim();
}

/**
 * Whether `image` is a `.t64` container. Accepts any of the signature
 * variants in the wild ("C64 tape image file", "C64S tape image file",
 * "C64S tape file"…), all of which start with "C64" - but not the raw `.tap`
 * signature "C64-TAPE-RAW", which is a different format entirely.
 */
export function isT64(image: Uint8Array): boolean {
  if (image.length < HEADER_SIZE) return false;
  const sig = signatureOf(image);
  return sig.startsWith('C64') && !sig.startsWith(RAW_TAP_SIGNATURE);
}

/** Directory filename PETSCII -> readable ASCII (unmappable bytes dropped). */
function decodeName(image: Uint8Array, at: number): string {
  let name = '';
  for (let i = 0; i < 16; i++) {
    const c = image[at + i]!;
    if (c >= 0x20 && c < 0x7f) name += String.fromCharCode(c);
  }
  return name.trim();
}

/**
 * Read every usable file out of a `.t64` container. Lenient with the format's
 * well-known defects: a zero used-entries count falls back to scanning every
 * slot, and an end address pointing past the container (the classic broken
 * CONVT64 output) is clamped to the bytes actually present, with a warning.
 * Throws only when `image` is not a `.t64` at all - callers gate on
 * {@link isT64} first.
 */
export function parseT64(image: Uint8Array): {
  entries: T64Entry[];
  warnings: string[];
} {
  if (!isT64(image)) {
    throw new Error(
      signatureOf(image).startsWith(RAW_TAP_SIGNATURE)
        ? 'This is a raw .tap tape (pulse timings), not a .t64 tape image — ' +
            'raw .tap files cannot be imported yet.'
        : 'Not a .t64 tape image (missing the C64 signature).',
    );
  }
  const warnings: string[] = [];
  const u16 = (at: number) => image[at]! | (image[at + 1]! << 8);
  const maxEntries = u16(34);
  let used = u16(36);
  if (used === 0 || used > maxEntries) {
    // The used-entries word is unreliable in the wild; scan every slot the
    // header has room for and let the per-entry type byte decide.
    used = maxEntries;
  }
  const slots = Math.min(
    used,
    Math.max(0, Math.floor((image.length - HEADER_SIZE) / ENTRY_SIZE)),
  );

  interface Slot {
    name: string;
    start: number;
    end: number;
    offset: number;
  }
  const usable: Slot[] = [];
  for (let e = 0; e < slots; e++) {
    const at = HEADER_SIZE + e * ENTRY_SIZE;
    if (image[at] === 0x00) continue; // free slot
    const offset =
      image[at + 8]! |
      (image[at + 9]! << 8) |
      (image[at + 10]! << 16) |
      (image[at + 11]! << 24);
    const name = decodeName(image, at + 16);
    if (offset < HEADER_SIZE || offset >= image.length) {
      warnings.push(
        `.t64 entry "${name}" points outside the container and was skipped.`,
      );
      continue;
    }
    usable.push({ name, start: u16(at + 2), end: u16(at + 4), offset });
  }

  const entries: T64Entry[] = [];
  for (const slot of usable) {
    // A bad declared length must not swallow a neighbour: the most it can be
    // is up to the next entry's data (or the container's end).
    let available = image.length - slot.offset;
    for (const other of usable) {
      if (other.offset > slot.offset) {
        available = Math.min(available, other.offset - slot.offset);
      }
    }
    let length = slot.end > slot.start ? slot.end - slot.start : 0;
    if (length === 0 || length > available) {
      warnings.push(
        `.t64 entry "${slot.name}" declares a bad end address (a known ` +
          `defect of some .t64 writers); its length was taken from the ` +
          `container instead.`,
      );
      length = available;
    }
    entries.push({
      name: slot.name,
      start: slot.start,
      bytes: image.slice(slot.offset, slot.offset + length),
    });
  }

  if (entries.length === 0) {
    warnings.push('The .t64 directory holds no usable files.');
  }
  return { entries, warnings };
}

/**
 * PETSCII-encode `name` into a fixed-width, space-padded field (the directory's
 * filename and container-name fields hold PETSCII, space-padded). Characters
 * with no PETSCII equivalent are skipped; the result is truncated to `length`.
 */
function petsciiField(name: string, length: number): Uint8Array {
  const out = new Uint8Array(length).fill(0x20); // space padding
  let i = 0;
  let out_i = 0;
  while (i < name.length && out_i < length) {
    try {
      const { code, length: consumed } = parseC64Char(name, i);
      out[out_i++] = code;
      i += consumed;
    } catch {
      i++; // skip a character with no PETSCII equivalent
    }
  }
  return out;
}

/**
 * Build a `.t64` container around `entries` (the inverse of {@link parseT64}).
 * Writes the 64-byte header (signature, version, entry counts, container name),
 * one 32-byte directory entry per file (type 1 / PRG, start + exclusive-end
 * address, absolute data offset, PETSCII filename) and the payloads packed
 * back-to-back after the directory. Round-trips through `parseT64` /
 * `detokenizeT64WithReport`.
 */
export function buildT64(
  entries: readonly T64ExportEntry[],
  containerName = 'BASICALLY',
): Uint8Array {
  const dirBytes = entries.length * ENTRY_SIZE;
  const dataBytes = entries.reduce((n, e) => n + e.bytes.length, 0);
  const out = new Uint8Array(HEADER_SIZE + dirBytes + dataBytes);
  const u16 = (at: number, v: number) => {
    out[at] = v & 0xff;
    out[at + 1] = (v >> 8) & 0xff;
  };

  // Header: signature (ASCII, NUL-padded), version, max/used entry counts, name.
  for (let i = 0; i < EXPORT_SIGNATURE.length; i++) {
    out[i] = EXPORT_SIGNATURE.charCodeAt(i);
  }
  u16(32, 0x0100); // version
  u16(34, entries.length); // maximum directory entries
  u16(36, entries.length); // used directory entries
  out.set(petsciiField(containerName, CONTAINER_NAME_LENGTH), 40);

  // Directory entries, then payloads packed after the whole directory.
  let offset = HEADER_SIZE + dirBytes;
  entries.forEach((e, i) => {
    const at = HEADER_SIZE + i * ENTRY_SIZE;
    out[at] = 0x01; // entry type: normal tape file
    out[at + 1] = 0x82; // C64 file type: PRG
    u16(at + 2, e.start); // load (start) address
    u16(at + 4, e.start + e.bytes.length); // end address (exclusive)
    // Absolute offset of the payload in the container (LE u32).
    out[at + 8] = offset & 0xff;
    out[at + 9] = (offset >> 8) & 0xff;
    out[at + 10] = (offset >> 16) & 0xff;
    out[at + 11] = (offset >> 24) & 0xff;
    out.set(petsciiField(e.name, FILENAME_LENGTH), at + 16);
    out.set(e.bytes, offset);
    offset += e.bytes.length;
  });
  return out;
}
