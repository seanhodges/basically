/**
 * Commodore `.d64` disk-image container - a byte-exact image of a 1541 5.25"
 * floppy, the format most Commodore disk archives and emulators use. Unlike the
 * `.t64` tape archive, a `.d64` mirrors the real disk geometry: 35 tracks of
 * 256-byte sectors (21 on tracks 1-17, 19 on 18-24, 18 on 25-30, 17 on 31-35 =
 * 683 sectors = 174848 bytes), a BAM + directory on track 18, and files stored
 * as chains of sectors linked by their first two bytes.
 *
 * Layout this module reads and writes:
 *
 * ```
 *  track 18, sector 0   BAM: dir link @0-1, DOS 'A' @2, per-track free bitmap
 *                       @4.., disk name @0x90 ($A0-padded), id + "2A" @0xA2
 *  track 18, sector 1+  directory: 8 × 32-byte entries per sector, chained
 *                         +02   file type (0x82 = closed PRG)
 *                         +03   first data track / +04 sector
 *                         +05   16-byte PETSCII filename ($A0-padded)
 *                         +1E   file size in sectors (LE)
 *  data sectors         bytes 0-1 = link (next track, sector); when track = 0
 *                       the file ends and byte 1 is the last used byte index;
 *                       bytes 2.. hold up to 254 data bytes. A PRG file's data
 *                       starts with the 2-byte load address.
 * ```
 */

import { parseC64Char } from './petscii';

/** One usable file recovered from a `.d64` directory. */
export interface D64Entry {
  /** Directory filename, trimmed, PETSCII folded to ASCII. */
  name: string;
  /** Load (start) address of the payload (a PRG's leading load-address word). */
  start: number;
  /** Payload bytes (no load-address word - the entry's `start` carries it). */
  bytes: Uint8Array;
}

/** One file to write into a `.d64` directory (see {@link buildD64}). */
export interface D64ExportEntry {
  /** Directory filename; PETSCII-encoded and $A0-padded to 16 bytes. */
  name: string;
  /** Load (start) address stored ahead of `bytes`, e.g. $0801 for BASIC. */
  start: number;
  /** Payload bytes, without the .prg load-address word (`start` carries it). */
  bytes: Uint8Array;
}

const TRACKS = 35;
/** Standard single-sided 35-track image size. */
const IMAGE_SIZE = 174848;
/** 35-track image with a trailing per-sector error-info block. */
const IMAGE_SIZE_ERRORS = 175531;
const SECTOR_SIZE = 256;
const DIRECTORY_TRACK = 18;
const DATA_BYTES_PER_SECTOR = 254; // 256 minus the 2-byte link
const DIR_ENTRIES_PER_SECTOR = 8;
const DIR_ENTRY_SIZE = 32;
const DOS_VERSION = 0x41; // 'A'
const FILE_TYPE_CLOSED_PRG = 0x82; // closed (bit 7) + PRG (type 2)
const PAD = 0xa0; // shifted-space, the 1541 filename padding byte

/** Sectors on `track` (variable across the 1541's four speed zones). */
function sectorsPerTrack(track: number): number {
  if (track >= 1 && track <= 17) return 21;
  if (track <= 24) return 19;
  if (track <= 30) return 18;
  return 17; // 31..40
}

/** Byte offset in the image of `track`/`sector` (tracks and sectors 0-based). */
function sectorOffset(track: number, sector: number): number {
  let sectors = 0;
  for (let t = 1; t < track; t++) sectors += sectorsPerTrack(t);
  return (sectors + sector) * SECTOR_SIZE;
}

/**
 * PETSCII-encode `name` into a fixed-width, `pad`-padded field. Characters with
 * no PETSCII equivalent are skipped; the result is truncated to `length`.
 */
function petsciiField(name: string, length: number, pad: number): Uint8Array {
  const out = new Uint8Array(length).fill(pad);
  let i = 0;
  let o = 0;
  while (i < name.length && o < length) {
    try {
      const { code, length: consumed } = parseC64Char(name, i);
      out[o++] = code;
      i += consumed;
    } catch {
      i++; // skip a character with no PETSCII equivalent
    }
  }
  return out;
}

/** Directory filename PETSCII -> readable ASCII ($A0 padding and non-print dropped). */
function decodeName(image: Uint8Array, at: number): string {
  let name = '';
  for (let i = 0; i < 16; i++) {
    const c = image[at + i]!;
    if (c === PAD) break; // padding starts; the name is done
    if (c >= 0x20 && c < 0x7f) name += String.fromCharCode(c);
  }
  return name.trim();
}

/**
 * Whether `image` is a `.d64` disk image. D64 has no magic bytes, so detection
 * is by the well-known image sizes (35-track, with or without the trailing
 * error-info block).
 */
export function isD64(image: Uint8Array): boolean {
  return image.length === IMAGE_SIZE || image.length === IMAGE_SIZE_ERRORS;
}

/**
 * Read a file's sector chain starting at `track`/`sector` into its raw bytes
 * (load-address word included, for a PRG). Follows the link in each sector's
 * first two bytes; a link track of 0 ends the file and its second byte is the
 * index of the last used byte. Guards against loops and truncation.
 */
function readFileChain(
  image: Uint8Array,
  track: number,
  sector: number,
  warnings: string[],
  name: string,
): Uint8Array | null {
  const parts: number[] = [];
  const seen = new Set<string>();
  let t = track;
  let s = sector;
  while (t !== 0) {
    const key = `${t}/${s}`;
    if (seen.has(key)) {
      warnings.push(
        `.d64 file "${name}" has a looping sector chain; truncated.`,
      );
      break;
    }
    seen.add(key);
    if (t > TRACKS || s >= sectorsPerTrack(t)) {
      warnings.push(`.d64 file "${name}" points at a bad sector; truncated.`);
      break;
    }
    const off = sectorOffset(t, s);
    const nextTrack = image[off]!;
    const nextSector = image[off + 1]!;
    if (nextTrack === 0) {
      // Last sector: byte 1 is the index of the last used byte (>= 2).
      const lastUsed = nextSector;
      const end = off + 2 + Math.max(0, lastUsed - 1);
      for (let i = off + 2; i < end && i < image.length; i++)
        parts.push(image[i]!);
      t = 0;
    } else {
      for (let i = off + 2; i < off + SECTOR_SIZE; i++) parts.push(image[i]!);
      t = nextTrack;
      s = nextSector;
    }
  }
  return parts.length > 0 ? Uint8Array.from(parts) : null;
}

/**
 * Read every usable file out of a `.d64` image: walk the directory chain on
 * track 18, follow each PRG entry's sector chain, and split off its 2-byte load
 * address. Throws only when `image` is not a `.d64` at all - callers gate on
 * {@link isD64} first.
 */
export function parseD64(image: Uint8Array): {
  entries: D64Entry[];
  warnings: string[];
} {
  if (!isD64(image)) {
    throw new Error('Not a .d64 disk image (unexpected file size).');
  }
  const warnings: string[] = [];
  const entries: D64Entry[] = [];

  // The BAM's first two bytes point at the first directory sector (usually
  // 18/1); fall back to 18/1 if they look wrong.
  const bamOff = sectorOffset(DIRECTORY_TRACK, 0);
  let dirTrack = image[bamOff]!;
  let dirSector = image[bamOff + 1]!;
  if (dirTrack !== DIRECTORY_TRACK) {
    dirTrack = DIRECTORY_TRACK;
    dirSector = 1;
  }

  const seenDir = new Set<string>();
  while (dirTrack === DIRECTORY_TRACK) {
    const key = `${dirTrack}/${dirSector}`;
    if (seenDir.has(key)) break; // looping directory chain
    seenDir.add(key);
    if (dirSector >= sectorsPerTrack(DIRECTORY_TRACK)) break;

    const off = sectorOffset(dirTrack, dirSector);
    const nextTrack = image[off]!;
    const nextSector = image[off + 1]!;
    for (let e = 0; e < DIR_ENTRIES_PER_SECTOR; e++) {
      const base = off + e * DIR_ENTRY_SIZE;
      const fileType = image[base + 2]!;
      const firstTrack = image[base + 3]!;
      const firstSector = image[base + 4]!;
      // Skip DEL/empty entries (type nibble 0) and unallocated slots.
      if ((fileType & 0x0f) === 0 || firstTrack === 0) continue;
      const name = decodeName(image, base + 5);
      const data = readFileChain(
        image,
        firstTrack,
        firstSector,
        warnings,
        name,
      );
      if (data === null || data.length < 2) continue;
      const start = data[0]! | (data[1]! << 8);
      entries.push({ name, start, bytes: data.subarray(2) });
    }
    dirTrack = nextTrack;
    dirSector = nextSector;
  }

  if (entries.length === 0) {
    warnings.push('The .d64 directory holds no usable files.');
  }
  return { entries, warnings };
}

/** An allocated sector position. */
interface Sector {
  track: number;
  sector: number;
}

/**
 * Build a `.d64` disk image around `entries` (the inverse of {@link parseD64}).
 * Writes each file as a chain of data sectors (allocated from track 1 upward,
 * skipping the directory track), a directory of 32-byte PRG entries on track
 * 18, and a BAM reflecting the sectors used. Round-trips through `parseD64` /
 * `detokenizeD64WithReport`.
 */
export function buildD64(
  entries: readonly D64ExportEntry[],
  diskName = 'BASICALLY',
  diskId = '00',
): Uint8Array {
  const image = new Uint8Array(IMAGE_SIZE);
  const used = new Set<string>();
  const markUsed = (t: number, s: number) => used.add(`${t}/${s}`);

  // Free data sectors in allocation order: every sector except the directory
  // track, low tracks first (a valid, simple layout - real DOS interleaves for
  // speed, which only affects load time, not correctness).
  const freeData: Sector[] = [];
  for (let t = 1; t <= TRACKS; t++) {
    if (t === DIRECTORY_TRACK) continue;
    for (let s = 0; s < sectorsPerTrack(t); s++)
      freeData.push({ track: t, sector: s });
  }
  let dataIdx = 0;
  const takeData = (): Sector => {
    const sec = freeData[dataIdx++];
    if (!sec) throw new Error('.d64 export ran out of disk space');
    markUsed(sec.track, sec.sector);
    return sec;
  };

  interface Placed {
    name: string;
    first: Sector;
    blocks: number;
  }
  const placed: Placed[] = [];

  for (const e of entries) {
    const data = Uint8Array.from([
      e.start & 0xff,
      (e.start >> 8) & 0xff,
      ...e.bytes,
    ]);
    const nSectors = Math.max(
      1,
      Math.ceil(data.length / DATA_BYTES_PER_SECTOR),
    );
    const secs: Sector[] = [];
    for (let i = 0; i < nSectors; i++) secs.push(takeData());
    for (let i = 0; i < nSectors; i++) {
      const off = sectorOffset(secs[i]!.track, secs[i]!.sector);
      const chunk = data.subarray(
        i * DATA_BYTES_PER_SECTOR,
        (i + 1) * DATA_BYTES_PER_SECTOR,
      );
      if (i < nSectors - 1) {
        image[off] = secs[i + 1]!.track;
        image[off + 1] = secs[i + 1]!.sector;
      } else {
        image[off] = 0; // last sector: track 0
        image[off + 1] = chunk.length + 1; // index of the last used byte
      }
      image.set(chunk, off + 2);
    }
    placed.push({ name: e.name, first: secs[0]!, blocks: nSectors });
  }

  // Directory sectors on track 18, from sector 1, 8 entries each.
  const dirCount = Math.max(
    1,
    Math.ceil(placed.length / DIR_ENTRIES_PER_SECTOR),
  );
  for (let d = 0; d < dirCount; d++) {
    const sector = 1 + d;
    markUsed(DIRECTORY_TRACK, sector);
    const off = sectorOffset(DIRECTORY_TRACK, sector);
    if (d < dirCount - 1) {
      image[off] = DIRECTORY_TRACK;
      image[off + 1] = 1 + d + 1;
    } else {
      image[off] = 0; // last directory sector
      image[off + 1] = 0xff;
    }
    for (let e = 0; e < DIR_ENTRIES_PER_SECTOR; e++) {
      const idx = d * DIR_ENTRIES_PER_SECTOR + e;
      if (idx >= placed.length) break;
      const p = placed[idx]!;
      const base = off + e * DIR_ENTRY_SIZE;
      image[base + 2] = FILE_TYPE_CLOSED_PRG;
      image[base + 3] = p.first.track;
      image[base + 4] = p.first.sector;
      image.set(petsciiField(p.name, 16, PAD), base + 5);
      image[base + 30] = p.blocks & 0xff;
      image[base + 31] = (p.blocks >> 8) & 0xff;
    }
  }

  markUsed(DIRECTORY_TRACK, 0); // the BAM sector itself
  writeBam(image, diskName, diskId, used);
  return image;
}

/** Write the BAM sector (track 18, sector 0): dir link, DOS header, free map. */
function writeBam(
  image: Uint8Array,
  diskName: string,
  diskId: string,
  used: Set<string>,
): void {
  const off = sectorOffset(DIRECTORY_TRACK, 0);
  image[off] = DIRECTORY_TRACK; // first directory sector track
  image[off + 1] = 1; // first directory sector
  image[off + 2] = DOS_VERSION;
  image[off + 3] = 0x00;

  for (let t = 1; t <= TRACKS; t++) {
    const spt = sectorsPerTrack(t);
    let free = 0;
    const bits = [0, 0, 0];
    for (let s = 0; s < spt; s++) {
      if (!used.has(`${t}/${s}`)) {
        free++;
        bits[s >> 3]! |= 1 << (s & 7); // 1 = free
      }
    }
    const e = off + 4 + (t - 1) * 4;
    image[e] = free;
    image[e + 1] = bits[0]!;
    image[e + 2] = bits[1]!;
    image[e + 3] = bits[2]!;
  }

  image.set(petsciiField(diskName, 16, PAD), off + 0x90);
  image[off + 0xa0] = PAD;
  image[off + 0xa1] = PAD;
  const id = petsciiField(diskId, 2, PAD);
  image[off + 0xa2] = id[0]!;
  image[off + 0xa3] = id[1]!;
  image[off + 0xa4] = PAD;
  image[off + 0xa5] = 0x32; // '2'
  image[off + 0xa6] = 0x41; // 'A'
  image[off + 0xa7] = PAD;
  image[off + 0xa8] = PAD;
  image[off + 0xa9] = PAD;
  image[off + 0xaa] = PAD;
}
