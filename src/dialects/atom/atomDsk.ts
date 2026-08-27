// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Acorn Atom `.dsk` disc-image container - the Atom's block-carrying counterpart
 * to the BASIC-only `.atm`. Where an `.atm` holds a single `#2900` program image,
 * a `.dsk` holds several files, each with its own **load and exec address**, so a
 * document with both a BASIC listing and fixed-address memory blocks round-trips
 * as one file (the same way the BBC uses `.ssd` and the Commodore uses `.d64`).
 *
 * The Atom's disc systems belong to the Acorn 8271 family, whose on-disc
 * catalogue is the DFS layout already implemented and tested in
 * `src/emulator/bbc/bbcDisc.ts`. This module is a thin Atom adapter over that
 * codec: it maps the document's BASIC program (load = exec = `#2900`) and each
 * memory block (load = its address, exec = its entry) onto DFS catalogue files,
 * and reads them back. The per-file load address is exactly what lets the
 * importer tell a `#2900` BASIC file from machine code at some other address -
 * the Atom analogue of the way MOS distinguishes `CHAIN` from `*RUN` on the BBC.
 *
 * Fidelity note: this standardises on the single-sided DFS geometry the shared
 * codec writes. That is a genuine Acorn disc format (the one Atom disc emulators
 * read), not an invented one; it is not tied to any one Atom DOS ROM's default
 * track count.
 */

import type { Block } from '../types';
import {
  buildBbcDisc,
  readBbcDisc,
  isBbcDisc,
  type BbcFile,
} from '../../emulator/bbc/bbcDisc';
import { TEXT_START } from './addresses';

/** One file read out of a `.dsk` catalogue. */
export interface AtomDskEntry {
  /** Catalogue filename, trimmed. */
  name: string;
  /** Load address (`#2900` for a BASIC program). */
  load: number;
  /** Exec address (= load for a plain BASIC/data file). */
  exec: number;
  /** File payload. */
  bytes: Uint8Array;
}

/** One file to write into a `.dsk` catalogue. */
export interface AtomDskExportEntry {
  name: string;
  load: number;
  exec: number;
  bytes: Uint8Array;
}

/** Max name length the DFS catalogue stores (7 chars + directory byte). */
const MAX_NAME_LEN = 7;

/** Sanitise a raw name into an Atom/DFS-legal upper-case filename. */
function dskName(raw: string, fallback: string): string {
  const cleaned = raw
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '')
    .slice(0, MAX_NAME_LEN);
  return cleaned || fallback;
}

/** Give every file a unique name, suffixing digits within the length cap. */
function uniqueName(base: string, taken: Set<string>): string {
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

/**
 * Compose a document - a tokenized `#2900` `programImage` (empty for a
 * machine-code-only document) plus its fixed-address {@link Block}s - into
 * the ordered `.dsk` files: the BASIC program (load = exec = `#2900`), then each
 * block in address order (load = its address, exec = its entry, defaulting to
 * the load address). Names are sanitised and de-duplicated so the catalogue and
 * the re-import stay unambiguous.
 */
export function composeAtomDskFiles(
  programImage: Uint8Array,
  blocks: readonly Block[],
  programName: string,
): AtomDskExportEntry[] {
  const taken = new Set<string>();
  const hasBasic = programImage.length > 2;

  const files: AtomDskExportEntry[] = [];
  if (hasBasic) {
    files.push({
      name: uniqueName(dskName(programName, 'PROG'), taken),
      load: TEXT_START,
      exec: TEXT_START,
      bytes: programImage,
    });
  }
  const sorted = [...blocks].sort((a, b) => a.address - b.address);
  for (const block of sorted) {
    files.push({
      name: uniqueName(dskName(block.name, 'BLOCK'), taken),
      load: block.address & 0xffff,
      exec: (block.entry ?? block.address) & 0xffff,
      bytes: block.bytes,
    });
  }
  return files;
}

/** Whether `image` looks like an Atom `.dsk` (an Acorn DFS-family disc image). */
export function isAtomDsk(image: Uint8Array): boolean {
  return isBbcDisc(image);
}

/**
 * Parse a `.dsk` image into its catalogue files. A bad or non-disc image yields
 * an empty entry list; the caller ({@link import('./detokenizer')}) sniffs with
 * {@link isAtomDsk} first, so this is only reached for a real disc.
 */
export function parseAtomDsk(image: Uint8Array): {
  entries: AtomDskEntry[];
  warnings: string[];
} {
  const { files } = readBbcDisc(image);
  const entries: AtomDskEntry[] = files.map((f) => ({
    name: f.name,
    load: f.load & 0xffff,
    exec: f.exec & 0xffff,
    bytes: f.bytes,
  }));
  return { entries, warnings: [] };
}

/** Build a `.dsk` image from `entries`, titled after the program. */
export function buildAtomDsk(
  entries: readonly AtomDskExportEntry[],
  diskTitle = '',
): Uint8Array {
  const files: BbcFile[] = entries.map((e) => ({
    name: e.name,
    load: e.load,
    exec: e.exec,
    bytes: e.bytes,
  }));
  return buildBbcDisc(files, { title: diskTitle.toUpperCase().slice(0, 12) });
}
