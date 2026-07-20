// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * TRS-80 `.dsk` disc-image container - the Model I block-carrying counterpart to
 * the BASIC-only `.cas` cassette. Where a `.cas` holds a single CSAVE program, a
 * `.dsk` holds several named files, so a document with a BASIC listing plus
 * fixed-address memory blocks round-trips as one file (the way the BBC uses
 * `.ssd` and the Commodore uses `.d64`).
 *
 * On-disk format: a **JV1** image - the simplest, most widely-read TRS-80 disc
 * format: a flat, header-less run of 256-byte sectors, track-major (Model I
 * single density: 35 tracks x 10 sectors = 89600 bytes). On top of the sectors
 * sits a **TRSDOS 2.3-style** filesystem: track 17 holds the directory (a
 * Granule Allocation Table, a Hash Index Table, and 32-byte directory entries);
 * files occupy 5-sector granules linked by directory extents.
 *
 * File mapping (the analogue of the BBC's load/exec catalogue attributes):
 * - the BASIC program is a `NAME/BAS` file: a `0xFF` Disk-BASIC token marker
 *   followed by the tokenized program;
 * - each memory block is a `NAME/CMD` load module (`0x01` load records carrying
 *   the block's load address + data, terminated by an `0x02` transfer record
 *   carrying its entry address) - the disc form of the `.cas` SYSTEM record
 *   grammar in `./casfile`.
 *
 * Fidelity notes: the geometry is standardised on Model I single-density
 * 35-track; the GAT/HIT are written to be structurally valid but the HIT hash
 * and some directory-attribute bits are best-effort, so the image round-trips
 * faithfully through this codec (and so through the IDE) but a byte-exact real
 * TRSDOS may not mount it. The BASIC file keeps the Level-II/cassette link base
 * (`0x42E9`) the IDE's tokenizer uses, not Disk BASIC's own load base.
 */

/** Model I single-density geometry. */
const SECTOR_SIZE = 256;
const SECTORS_PER_TRACK = 10;
const TRACKS = 35;
export const JV1_IMAGE_SIZE = SECTOR_SIZE * SECTORS_PER_TRACK * TRACKS; // 89600

/** The directory lives on track 17; granules are 5 sectors (2 per track). */
const DIRECTORY_TRACK = 17;
const SECTORS_PER_GRANULE = 5;
const GRANULES_PER_TRACK = SECTORS_PER_TRACK / SECTORS_PER_GRANULE; // 2
const TOTAL_GRANULES = TRACKS * GRANULES_PER_TRACK; // 70
const GRANULE_BYTES = SECTOR_SIZE * SECTORS_PER_GRANULE; // 1280

/** Directory-track sector roles. */
const GAT_SECTOR = 0;
const HIT_SECTOR = 1;
const FIRST_DIR_SECTOR = 2;
const DIR_ENTRY_SIZE = 32;
const DIR_ENTRIES_PER_SECTOR = SECTOR_SIZE / DIR_ENTRY_SIZE; // 8
/** Directory entry slots available across sectors 2..9 of the directory track. */
const MAX_FILES =
  (SECTORS_PER_TRACK - FIRST_DIR_SECTOR) * DIR_ENTRIES_PER_SECTOR; // 64

/** Directory-entry field offsets (see the module doc). */
const F_FLAGS = 0;
const F_EOF_BYTE = 2;
const F_NAME = 4;
const F_EXT = 12;
const F_ERN = 15; // ending record (sector) count, LE u16
const F_EXTENTS = 18; // (absGranule, count) pairs, 0xFF-terminated
const NAME_LEN = 8;
const EXT_LEN = 3;
/** Bit marking a directory entry as an active (in-use) file. */
const FLAG_ACTIVE = 0x10;
/** Extent terminator byte. */
const EXTENT_END = 0xff;

/** `.dsk` load-module (`/CMD`) record markers. */
const CMD_LOAD = 0x01;
const CMD_TRANSFER = 0x02;
/** A `/CMD` load record carries at most 254 data bytes (256 − 2 address bytes). */
const CMD_MAX_DATA = 254;

/** One file to write onto a `.dsk`. */
export interface Trs80DiskFile {
  /** File name, up to 8 chars (sanitised/padded into the directory). */
  name: string;
  /** 3-char extension, e.g. `BAS` or `CMD`. */
  ext: string;
  /** File payload. */
  bytes: Uint8Array;
}

/** One file read from a `.dsk` directory. */
export interface Trs80DiskEntry {
  name: string;
  ext: string;
  bytes: Uint8Array;
}

/** Byte offset of a (track, sector) in the flat JV1 image. */
function sectorOffset(track: number, sector: number): number {
  return (track * SECTORS_PER_TRACK + sector) * SECTOR_SIZE;
}

/** First sector (absolute, within its track) of an absolute granule number. */
function granuleLocation(granule: number): { track: number; sector: number } {
  const track = Math.floor(granule / GRANULES_PER_TRACK);
  const sector = (granule % GRANULES_PER_TRACK) * SECTORS_PER_GRANULE;
  return { track, sector };
}

/** Byte offset of the first sector of an absolute granule. */
function granuleOffset(granule: number): number {
  const { track, sector } = granuleLocation(granule);
  return sectorOffset(track, sector);
}

/** The two absolute granules that make up the directory track (reserved). */
function directoryGranules(): Set<number> {
  const base = DIRECTORY_TRACK * GRANULES_PER_TRACK;
  return new Set([base, base + 1]);
}

// ---------------------------------------------------------------------------
// /CMD load modules (memory blocks)
// ---------------------------------------------------------------------------

/**
 * Encode a memory block as a `/CMD` load module: `0x01` load records (each a
 * count byte = data length + 2, a little-endian load address, then up to 254
 * data bytes) for the block's bytes, followed by an `0x02` transfer record
 * carrying the entry address. The inverse of {@link parseCmdModule}; the disc
 * form of the `.cas` SYSTEM record grammar in `./casfile`.
 */
export function buildCmdModule(
  address: number,
  bytes: Uint8Array,
  entry: number,
): Uint8Array {
  const out: number[] = [];
  let off = 0;
  let addr = address & 0xffff;
  while (off < bytes.length) {
    const chunk = bytes.subarray(off, off + CMD_MAX_DATA);
    out.push(
      CMD_LOAD,
      (chunk.length + 2) & 0xff,
      addr & 0xff,
      (addr >> 8) & 0xff,
    );
    for (const b of chunk) out.push(b);
    addr = (addr + chunk.length) & 0xffff;
    off += chunk.length;
  }
  const e = entry & 0xffff;
  out.push(CMD_TRANSFER, 0x02, e & 0xff, (e >> 8) & 0xff);
  return Uint8Array.from(out);
}

/**
 * Decode a `/CMD` load module back into a single contiguous block (load
 * records are emitted contiguously by {@link buildCmdModule}) plus its entry
 * address. Returns null when no load record is found.
 */
export function parseCmdModule(
  data: Uint8Array,
): { address: number; bytes: Uint8Array; entry: number } | null {
  const loads: { addr: number; chunk: Uint8Array }[] = [];
  let entry = 0;
  let i = 0;
  while (i < data.length) {
    const type = data[i++]!;
    if (type === CMD_LOAD) {
      if (i >= data.length) break;
      const count = data[i++]!;
      const total = count === 0 ? 256 : count;
      const dataLen = total - 2;
      if (dataLen < 0 || i + 2 + dataLen > data.length) break;
      const addr = data[i]! | (data[i + 1]! << 8);
      i += 2;
      loads.push({ addr, chunk: data.slice(i, i + dataLen) });
      i += dataLen;
    } else if (type === CMD_TRANSFER) {
      const count = i < data.length ? data[i++]! : 2;
      if (i + 1 < data.length) entry = data[i]! | (data[i + 1]! << 8);
      i += count;
      break;
    } else {
      break; // unknown record: stop cleanly
    }
  }
  if (loads.length === 0) return null;
  loads.sort((a, b) => a.addr - b.addr);
  const address = loads[0]!.addr;
  const merged: number[] = [];
  for (const l of loads) for (const b of l.chunk) merged.push(b);
  return { address, bytes: Uint8Array.from(merged), entry };
}

// ---------------------------------------------------------------------------
// Directory / filesystem
// ---------------------------------------------------------------------------

/** Sanitise a raw name into a TRSDOS-legal 8-char upper-case filename. */
function dosName(raw: string, fallback: string): string {
  const cleaned = raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, NAME_LEN);
  const withLetter = /^[A-Z]/.test(cleaned)
    ? cleaned
    : cleaned && `X${cleaned}`;
  return (withLetter || fallback).slice(0, NAME_LEN);
}

/** Write `text` (upper ASCII) into `buf` at `at`, space-padded to `len`. */
function writePadded(buf: Uint8Array, at: number, text: string, len: number) {
  for (let i = 0; i < len; i++) {
    buf[at + i] = i < text.length ? text.charCodeAt(i) & 0x7f : 0x20;
  }
}

/** A best-effort TRSDOS directory-hash of a `NAME/EXT` (structural, not exact). */
function hitHash(name: string, ext: string): number {
  const field = name.padEnd(NAME_LEN, ' ') + ext.padEnd(EXT_LEN, ' ');
  let h = 0;
  for (let i = 0; i < field.length; i++) {
    h = (h + field.charCodeAt(i)) & 0xff;
    h = ((h << 1) | (h >> 7)) & 0xff;
  }
  return h === 0 ? 1 : h; // 0 marks a free HIT slot, so never hash to 0
}

/**
 * Build a JV1 `.dsk` image from `files`. Files are laid out on contiguous
 * granules from the start of the disc (skipping the directory track); the
 * directory track carries a GAT, a HIT and one 32-byte entry per file. Throws
 * when there are too many files or they overflow the disc.
 */
export function buildTrsDisk(
  files: readonly Trs80DiskFile[],
  opts: { diskName?: string } = {},
): Uint8Array {
  if (files.length > MAX_FILES) {
    throw new Error(`A TRSDOS disc holds at most ${MAX_FILES} files`);
  }
  const image = new Uint8Array(JV1_IMAGE_SIZE);
  const reserved = directoryGranules();

  // Allocate contiguous granules from granule 0 upward, skipping the directory
  // track. Each file records its first absolute granule and granule count.
  let nextGranule = 0;
  const takeGranule = (): number => {
    while (reserved.has(nextGranule)) nextGranule++;
    if (nextGranule >= TOTAL_GRANULES) {
      throw new Error('Files do not fit on a 35-track single-density disc');
    }
    return nextGranule++;
  };

  const gat = new Uint8Array(SECTOR_SIZE);
  const hit = new Uint8Array(SECTOR_SIZE);
  // Mark the directory track's own granules as allocated in the GAT.
  for (const g of reserved) {
    const { track } = granuleLocation(g);
    gat[track] = (gat[track]! | (1 << (g % GRANULES_PER_TRACK))) & 0xff;
  }

  files.forEach((file, slot) => {
    const name = dosName(file.name, `FILE${slot}`);
    const ext = file.ext
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, EXT_LEN);
    const sectorCount = Math.max(1, Math.ceil(file.bytes.length / SECTOR_SIZE));
    const granuleCount = Math.ceil(sectorCount / SECTORS_PER_GRANULE) || 1;

    const startGranule = takeGranule();
    const granules = [startGranule];
    for (let g = 1; g < granuleCount; g++) granules.push(takeGranule());

    // Write payload across the granules' sectors.
    let written = 0;
    for (const g of granules) {
      const base = granuleOffset(g);
      const span = Math.min(GRANULE_BYTES, file.bytes.length - written);
      if (span > 0)
        image.set(file.bytes.subarray(written, written + span), base);
      written += span;
      const { track } = granuleLocation(g);
      gat[track] = (gat[track]! | (1 << (g % GRANULES_PER_TRACK))) & 0xff;
    }

    // Directory entry.
    const dirSector =
      FIRST_DIR_SECTOR + Math.floor(slot / DIR_ENTRIES_PER_SECTOR);
    const entryOff =
      sectorOffset(DIRECTORY_TRACK, dirSector) +
      (slot % DIR_ENTRIES_PER_SECTOR) * DIR_ENTRY_SIZE;
    image[entryOff + F_FLAGS] = FLAG_ACTIVE;
    const eofByte = file.bytes.length % SECTOR_SIZE; // 0 encodes a full sector
    image[entryOff + F_EOF_BYTE] = eofByte;
    writePadded(image, entryOff + F_NAME, name, NAME_LEN);
    writePadded(image, entryOff + F_EXT, ext, EXT_LEN);
    image[entryOff + F_ERN] = sectorCount & 0xff;
    image[entryOff + F_ERN + 1] = (sectorCount >> 8) & 0xff;
    // Extents: our allocation is contiguous, so one (startGranule, count) pair.
    image[entryOff + F_EXTENTS] = startGranule & 0xff;
    image[entryOff + F_EXTENTS + 1] = granuleCount & 0xff;
    image[entryOff + F_EXTENTS + 2] = EXTENT_END;

    // HIT: one hash byte at the file's directory-slot position.
    hit[slot] = hitHash(name, ext);
  });

  // Disc name in the GAT tail (cosmetic; not read back).
  writePadded(
    gat,
    0xd0,
    (opts.diskName ?? 'BASIC').toUpperCase().slice(0, 8),
    8,
  );

  image.set(gat, sectorOffset(DIRECTORY_TRACK, GAT_SECTOR));
  image.set(hit, sectorOffset(DIRECTORY_TRACK, HIT_SECTOR));
  return image;
}

/** Read a space-padded ASCII field. */
function readField(image: Uint8Array, at: number, len: number): string {
  let s = '';
  for (let i = 0; i < len; i++) s += String.fromCharCode(image[at + i]! & 0x7f);
  return s.replace(/\s+$/, '');
}

/** Read one directory entry's payload by walking its extents. */
function readEntryBytes(image: Uint8Array, entryOff: number): Uint8Array {
  const sectorCount =
    image[entryOff + F_ERN]! | (image[entryOff + F_ERN + 1]! << 8);
  const eofByte = image[entryOff + F_EOF_BYTE]!;
  const length =
    sectorCount === 0
      ? 0
      : (sectorCount - 1) * SECTOR_SIZE +
        (eofByte === 0 ? SECTOR_SIZE : eofByte);

  const out = new Uint8Array(length);
  let written = 0;
  let e = entryOff + F_EXTENTS;
  while (e + 1 < entryOff + DIR_ENTRY_SIZE && image[e] !== EXTENT_END) {
    const startGranule = image[e]!;
    const count = image[e + 1]!;
    e += 2;
    for (let g = 0; g < count && written < length; g++) {
      const base = granuleOffset(startGranule + g);
      const span = Math.min(GRANULE_BYTES, length - written);
      out.set(image.subarray(base, base + span), written);
      written += span;
    }
  }
  return out;
}

/** Whether `image` looks like a JV1 TRSDOS `.dsk` (rather than a `.cas`/program). */
export function isJv1Disk(image: Uint8Array): boolean {
  if (image.length !== JV1_IMAGE_SIZE) return false;
  // The directory track must carry at least one active, plausibly-named entry.
  for (let slot = 0; slot < MAX_FILES; slot++) {
    const dirSector =
      FIRST_DIR_SECTOR + Math.floor(slot / DIR_ENTRIES_PER_SECTOR);
    const off =
      sectorOffset(DIRECTORY_TRACK, dirSector) +
      (slot % DIR_ENTRIES_PER_SECTOR) * DIR_ENTRY_SIZE;
    if (image[off + F_FLAGS] !== FLAG_ACTIVE) continue;
    const first = image[off + F_NAME]!;
    if (first >= 0x41 && first <= 0x5a) return true; // A-Z
  }
  return false;
}

/** Parse a JV1 `.dsk` image into its directory files. */
export function parseTrsDisk(image: Uint8Array): {
  entries: Trs80DiskEntry[];
  warnings: string[];
} {
  const entries: Trs80DiskEntry[] = [];
  for (let slot = 0; slot < MAX_FILES; slot++) {
    const dirSector =
      FIRST_DIR_SECTOR + Math.floor(slot / DIR_ENTRIES_PER_SECTOR);
    const off =
      sectorOffset(DIRECTORY_TRACK, dirSector) +
      (slot % DIR_ENTRIES_PER_SECTOR) * DIR_ENTRY_SIZE;
    if (image[off + F_FLAGS] !== FLAG_ACTIVE) continue;
    const name = readField(image, off + F_NAME, NAME_LEN);
    const ext = readField(image, off + F_EXT, EXT_LEN);
    if (name === '') continue;
    entries.push({ name, ext, bytes: readEntryBytes(image, off) });
  }
  return { entries, warnings: [] };
}
