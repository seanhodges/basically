// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Acorn DFS `.ssd` single-sided disc image - the standard BBC multi-file
 * container. Unlike the headerless `.bbc` (which carries the BASIC program
 * only), a `.ssd` holds several files, each with its own **load and exec
 * address** in the two-sector catalogue. Those attributes are what let MOS and
 * real hardware tell a BASIC program (`CHAIN`, load = exec = PAGE) from machine
 * code (`*RUN`, load/exec = the code's address) - so a document with both a
 * BASIC listing and fixed-address memory blocks round-trips as one file.
 *
 * This is the BBC counterpart to `src/dialects/commodore64/d64.ts`. It lives
 * under `src/emulator/bbc/` because both the dialect (export/import) and the
 * emulator run path (mount + boot) build and read these images, and the
 * dependency direction `dialect -> emulator/bbc` already exists.
 *
 * DFS layout this module reads and writes (single-sided, 80 tracks x 10 x 256):
 *
 * ```
 *  sector 0   &00-&07  first 8 chars of the 12-char disc title
 *             &08..    up to 31 file entries x 8 bytes:
 *                        +0..6  filename (space-padded)
 *                        +7     directory char (bit7 = locked)
 *  sector 1   &00-&03  last 4 chars of the title
 *             &04      cycle (write) count, BCD
 *             &05      (number of files) x 8
 *             &06      b0-1 = sector-count bits 8-9, b4-5 = *OPT 4 boot option
 *             &07      sector-count bits 0-7
 *             &08..    per-file attributes x 8 bytes (same order as sector 0):
 *                        +0..1  load addr (low 16, LE)
 *                        +2..3  exec addr (low 16, LE)
 *                        +4..5  length   (low 16, LE)
 *                        +6     b0-1 load 16-17, b2-3 length 16-17,
 *                               b4-5 exec 16-17, b6-7 start-sector 8-9
 *                        +7     start sector (low 8)
 *  sector 2+  file data, each file on a whole number of sectors
 * ```
 */

import type { Block } from '../../dialects/types';
import { PAGE_DFS } from '../../dialects/bbcmicro/addresses';

const SECTOR_SIZE = 256;
const SECTORS_PER_TRACK = 10;
const TRACKS = 80;
/** Total sectors on a standard single-sided DFS disc (80 x 10 = 800). */
const TOTAL_SECTORS = SECTORS_PER_TRACK * TRACKS;
/** The two catalogue sectors sit on track 0; file data starts at sector 2. */
const CATALOGUE_SECTORS = 2;
const MAX_FILES = 31;
/** DFS filename field width (7 chars + 1 directory byte = 8-byte entry). */
const MAX_NAME_LEN = 7;
const DIR_DEFAULT = '$';
const IMAGE_SIZE = SECTOR_SIZE * TOTAL_SECTORS; // 204800

/** One file to write into a `.ssd` catalogue (see {@link buildBbcDisc}). */
export interface BbcFile {
  /** Filename, up to 7 chars; truncated/padded into the entry. */
  name: string;
  /** DFS directory character (default `$`). */
  dir?: string;
  /** Load address (where `*LOAD`/`*RUN` deposits the file). */
  load: number;
  /** Exec address (where `*RUN` jumps; = load for a plain data/BASIC file). */
  exec: number;
  /** File payload. */
  bytes: Uint8Array;
}

/** The `*OPT 4,n` start-up option stored in the catalogue. */
export type BootOption = 0 | 1 | 2 | 3;

function sectorsFor(byteLength: number): number {
  return Math.ceil(byteLength / SECTOR_SIZE) || 1;
}

/** Write up to `len` chars of `text` (ASCII) into `buf` at `at`, space-padded. */
function writePadded(buf: Uint8Array, at: number, text: string, len: number) {
  for (let i = 0; i < len; i++) {
    const ch = i < text.length ? text.charCodeAt(i) & 0x7f : 0x20;
    buf[at + i] = ch;
  }
}

/**
 * Build a single-sided Acorn DFS `.ssd` image from `files`. Files are laid out
 * on ascending sectors from sector 2; the catalogue lists them in descending
 * start-sector order (the on-disc DFS convention). Throws when there are too
 * many files or they don't fit on an 80-track disc.
 */
export function buildBbcDisc(
  files: readonly BbcFile[],
  opts: { title?: string; bootOption?: BootOption } = {},
): Uint8Array {
  if (files.length > MAX_FILES) {
    throw new Error(`A DFS disc holds at most ${MAX_FILES} files`);
  }
  const image = new Uint8Array(IMAGE_SIZE);

  // Place file data on ascending sectors from the first data sector.
  let sector = CATALOGUE_SECTORS;
  const placed = files.map((file) => {
    const startSector = sector;
    const nSectors = sectorsFor(file.bytes.length);
    sector += nSectors;
    return { file, startSector };
  });
  if (sector > TOTAL_SECTORS) {
    throw new Error('Files do not fit on a single-sided DFS disc (200K)');
  }

  for (const { file, startSector } of placed) {
    image.set(file.bytes, startSector * SECTOR_SIZE);
  }

  // Catalogue: descending start-sector order (highest sector first).
  const catalogue = [...placed].sort((a, b) => b.startSector - a.startSector);

  const title = opts.title ?? '';
  writePadded(image, 0x000, title.slice(0, 8), 8);
  writePadded(image, 0x100, title.slice(8, 12), 4);

  catalogue.forEach(({ file, startSector }, i) => {
    const off = 0x008 + i * 8; // sector 0 entry
    const attr = 0x108 + i * 8; // sector 1 entry
    writePadded(image, off, (file.name || 'FILE').slice(0, MAX_NAME_LEN), 7);
    image[off + 7] = (file.dir ?? DIR_DEFAULT).charCodeAt(0) & 0x7f;

    const load = file.load & 0x3ffff;
    const exec = file.exec & 0x3ffff;
    const length = file.bytes.length & 0x3ffff;
    image[attr + 0] = load & 0xff;
    image[attr + 1] = (load >> 8) & 0xff;
    image[attr + 2] = exec & 0xff;
    image[attr + 3] = (exec >> 8) & 0xff;
    image[attr + 4] = length & 0xff;
    image[attr + 5] = (length >> 8) & 0xff;
    image[attr + 6] =
      ((load >> 16) & 0x03) |
      (((length >> 16) & 0x03) << 2) |
      (((exec >> 16) & 0x03) << 4) |
      (((startSector >> 8) & 0x03) << 6);
    image[attr + 7] = startSector & 0xff;
  });

  // Sector-1 disc metadata.
  image[0x104] = 0x00; // cycle count (fresh disc)
  image[0x105] = files.length * 8;
  const totalSectors = TOTAL_SECTORS;
  const boot = opts.bootOption ?? 0;
  image[0x106] = ((totalSectors >> 8) & 0x03) | ((boot & 0x03) << 4);
  image[0x107] = totalSectors & 0xff;

  return image;
}

/**
 * Whether `image` looks like a DFS `.ssd` (rather than a raw `.bbc` program).
 * Heuristic: sector-aligned, at least the two catalogue sectors, a file count
 * that is a byte multiple of 8 within range, a plausible total-sector field,
 * and a printable title - a raw `.bbc` begins with `0x0D`, which fails the
 * title check.
 */
export function isBbcDisc(image: Uint8Array): boolean {
  if (image.length < CATALOGUE_SECTORS * SECTOR_SIZE) return false;
  if (image.length % SECTOR_SIZE !== 0) return false;
  const countByte = image[0x105]!;
  if (countByte % 8 !== 0) return false;
  const files = countByte / 8;
  if (files > MAX_FILES) return false;
  const total = ((image[0x106]! & 0x03) << 8) | image[0x107]!;
  if (total < CATALOGUE_SECTORS || total > TOTAL_SECTORS) return false;
  // Title bytes must be printable ASCII or padding (0x00/space).
  for (let i = 0; i < 8; i++) {
    const b = image[i]!;
    if (b !== 0x00 && (b < 0x20 || b > 0x7e)) return false;
  }
  return true;
}

// The disc builder and reader are the Model B path (the Master shares only the
// format sniff), so the DFS PAGE comes from that dialect.
const PAGE = PAGE_DFS;

/** Sanitise a name into a DFS-legal 7-char upper-case filename. */
function dfsName(raw: string, fallback: string): string {
  const cleaned = raw
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '')
    .slice(0, MAX_NAME_LEN);
  return cleaned || fallback;
}

/** Give every file a unique DFS name, suffixing digits within the 7-char cap. */
function uniqueDfsName(base: string, taken: Set<string>): string {
  if (!taken.has(base)) {
    taken.add(base);
    return base;
  }
  for (let n = 2; ; n++) {
    const suffix = String(n);
    const candidate = base.slice(0, MAX_NAME_LEN - suffix.length) + suffix;
    if (!taken.has(candidate)) {
      taken.add(candidate);
      return candidate;
    }
  }
}

/** Render a `!BOOT` *EXEC file (one command per line, CR-terminated). */
function bootFile(commands: readonly string[]): BbcFile {
  const text = commands.map((c) => c + '\r').join('');
  const bytes = Uint8Array.from(text, (c) => c.charCodeAt(0) & 0xff);
  return { name: '!BOOT', load: 0, exec: 0, bytes };
}

/**
 * Compose a document - a tokenized BASIC `programImage` (empty for a
 * machine-code-only document) plus its fixed-address {@link Block}s - into
 * the ordered `.ssd` files, and, when `withBoot`, a generated `!BOOT` that
 * reproduces the IDE's Run: `*LOAD` every block at its address, then `CHAIN` the
 * BASIC program (or `*RUN` the entry block when there is no BASIC). The boot
 * option is `3` (`*OPT 4,3` = exec `!BOOT`) when a boot file is written.
 *
 * MOS distinguishes the files by their catalogue attributes: the BASIC file
 * loads/execs at PAGE and is reached via `CHAIN`; each block loads/execs at its
 * own address and machine code is reached via `*RUN`.
 */
export function composeDiscFiles(
  programImage: Uint8Array,
  blocks: readonly Block[],
  programName: string,
  withBoot: boolean,
): { files: BbcFile[]; bootOption: BootOption; bootCommands: string[] } {
  const taken = new Set<string>();
  const hasBasic = programImage.length > 2;
  const mainName = hasBasic
    ? uniqueDfsName(dfsName(programName, 'PROG'), taken)
    : '';

  const blockFiles = blocks.map((block) => {
    const name = uniqueDfsName(dfsName(block.name, 'BLOCK'), taken);
    return {
      block,
      file: {
        name,
        load: block.address & 0x3ffff,
        exec: (block.entry ?? block.address) & 0x3ffff,
        bytes: block.bytes,
      } satisfies BbcFile,
    };
  });

  const files: BbcFile[] = [];
  if (hasBasic) {
    files.push({ name: mainName, load: PAGE, exec: PAGE, bytes: programImage });
  }
  for (const { file } of blockFiles) files.push(file);

  const commands: string[] = [];
  if (hasBasic) {
    for (const { file } of blockFiles) commands.push(`*LOAD ${file.name}`);
    commands.push(`CHAIN "${mainName}"`);
  } else {
    // Machine code only: run the block carrying an entry address (the first, if
    // several); load any others first so their data is in place.
    const entryIdx = blockFiles.findIndex(
      ({ block }) => block.entry !== undefined,
    );
    const runIdx = entryIdx >= 0 ? entryIdx : 0;
    blockFiles.forEach(({ file }, i) => {
      if (i !== runIdx) commands.push(`*LOAD ${file.name}`);
    });
    const runFile = blockFiles[runIdx]?.file;
    if (runFile) commands.push(`*RUN ${runFile.name}`);
  }

  if (!withBoot) return { files, bootOption: 0, bootCommands: commands };

  files.push(bootFile(commands));
  return { files, bootOption: 3, bootCommands: commands };
}

/** Result of {@link readBbcDisc}. */
export interface ReadBbcDisc {
  files: BbcFile[];
  bootOption: BootOption;
  title: string;
}

function readName(image: Uint8Array, off: number): string {
  let name = '';
  for (let i = 0; i < 7; i++) {
    const b = image[off + i]! & 0x7f;
    name += String.fromCharCode(b);
  }
  return name.replace(/\s+$/, '');
}

/** Parse a DFS `.ssd` image into its files (with load/exec) and boot option. */
export function readBbcDisc(image: Uint8Array): ReadBbcDisc {
  const files: BbcFile[] = [];
  const count = Math.min((image[0x105]! / 8) | 0, MAX_FILES);
  let title = '';
  for (let i = 0; i < 8; i++) title += String.fromCharCode(image[i]! & 0x7f);
  for (let i = 0; i < 4; i++)
    title += String.fromCharCode(image[0x100 + i]! & 0x7f);
  title = title.replace(/[\s\0]+$/, '');

  for (let i = 0; i < count; i++) {
    const off = 0x008 + i * 8;
    const attr = 0x108 + i * 8;
    const dir = String.fromCharCode(image[off + 7]! & 0x7f);
    const name = readName(image, off);
    const packed = image[attr + 6]!;
    const load =
      (image[attr + 0]! | (image[attr + 1]! << 8) | ((packed & 0x03) << 16)) >>>
      0;
    const exec =
      (image[attr + 2]! |
        (image[attr + 3]! << 8) |
        (((packed >> 4) & 0x03) << 16)) >>>
      0;
    const length =
      image[attr + 4]! |
      (image[attr + 5]! << 8) |
      (((packed >> 2) & 0x03) << 16);
    const startSector = image[attr + 7]! | (((packed >> 6) & 0x03) << 8);
    const start = startSector * SECTOR_SIZE;
    const bytes = image.slice(start, start + length);
    files.push({ name, dir, load, exec, bytes });
  }

  const bootOption = ((image[0x106]! >> 4) & 0x03) as BootOption;
  return { files, bootOption, title };
}
