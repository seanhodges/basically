// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Build a BBC DFS `.ssd` disc image for a whole document - the BASIC program
 * plus its fixed-address memory blocks - the block-carrying counterpart to the
 * BASIC-only `.bbc` export. The pure disc codec and file composition live in
 * `src/emulator/bbc/bbcDisc.ts` (shared with the emulator's mount-and-boot Run
 * path); this thin wrapper just tokenizes the BASIC source into the main file
 * and hands off. Mirrors `src/dialects/commodore64/targets.ts`'s
 * `exportD64Entries` + `buildD64` split.
 */

import type { MemoryBlock } from '../types';
import { fatalErrors } from '../types';
import { buildBbcDisc, composeDiscFiles } from '../../emulator/bbc/bbcDisc';
import { tokenizeProgram } from './tokenizer';
import type { BbcVariant } from './keywords';

/**
 * Tokenize `source` into the main BASIC file image, or an empty array for a
 * document with no BASIC lines (a machine-code-only disc). Throws on tokenizer
 * errors so a broken program is reported rather than silently exported, exactly
 * like `buildBbcImage`.
 */
function programImage(source: string, variant?: BbcVariant): Uint8Array {
  if (source.trim() === '') return new Uint8Array(0);
  const { bytes, errors } = tokenizeProgram(source, variant);
  const fatal = fatalErrors(errors);
  if (fatal.length > 0) {
    throw new Error(
      `Program has ${fatal.length} error(s) - fix them before building`,
    );
  }
  return bytes.length > 2 ? bytes : new Uint8Array(0);
}

/**
 * Build the `.ssd` image for a document. `loader` writes a generated auto-boot
 * `!BOOT` (the default when exporting with blocks) so the disc runs by itself
 * on real hardware; without it the disc holds the files but no start-up option.
 */
export function buildBbcDiscImage(
  source: string,
  programName: string,
  blocks: readonly MemoryBlock[] = [],
  loader = false,
  variant?: BbcVariant,
): Uint8Array {
  const image = programImage(source, variant);
  const { files, bootOption } = composeDiscFiles(
    image,
    blocks,
    programName,
    loader,
  );
  return buildBbcDisc(files, {
    title: programName.slice(0, 12),
    bootOption,
  });
}
