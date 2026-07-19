// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The generated auto-loader for block-aware `.TAP`/cassette export: a tiny
 * auto-running BASIC program that CLEARs RAMTOP below the lowest block, loads
 * every CODE file in tape order, then chains into the main program with
 * `LOAD ""` - the classic loader-first tape layout, so an exported tape runs
 * by itself on real hardware (`LOAD ""` and wait).
 *
 * The user's own program is untouched: the loader is a separate tape file,
 * and importing the tape back chooses the (larger) main program for editing
 * while the loader rides along as a preserved tape file.
 */

import type { MemoryBlock } from '../types';
import { fatalErrors } from '../types';
import { tokenizeProgram } from './tokenizer';
import { tapBlocks, type TapBlock } from './tapfile';

/**
 * The loader's BASIC source for `blocks` (already in tape order). One
 * statement per line keeps it obvious in a headerless dump; the ROM runs it
 * from line 10 via the auto-start header.
 */
export function loaderSource(blocks: readonly MemoryBlock[]): string {
  const lowest = Math.min(...blocks.map((b) => b.address));
  const lines = [`10 CLEAR ${lowest - 1}`];
  blocks.forEach((_, i) => lines.push(`${20 + 10 * i} LOAD "" CODE`));
  lines.push(`${20 + 10 * blocks.length} LOAD ""`);
  return lines.join('\n');
}

/**
 * The loader as its two tape blocks (header + data), auto-starting at line
 * 10. Named after the program so `LOAD ""` on real hardware announces the
 * program's own name. Throws only on a programming error - the generated
 * source is ours and must tokenize clean.
 */
export function loaderTapBlocks(
  programName: string,
  blocks: readonly MemoryBlock[],
): [TapBlock, TapBlock] {
  const source = loaderSource(blocks);
  const { bytes, errors } = tokenizeProgram(source);
  const fatal = fatalErrors(errors);
  if (fatal.length > 0) {
    throw new Error(
      `Generated loader failed to tokenize: ${fatal[0]!.message}`,
    );
  }
  return tapBlocks(bytes, { name: programName, autoStart: 10 });
}
