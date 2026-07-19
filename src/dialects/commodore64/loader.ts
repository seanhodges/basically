// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The generated auto-loader for block-aware `.t64`/cassette export: a tiny
 * auto-running Commodore BASIC program that loads every code block from tape,
 * then chains into the main program - the classic loader-first tape layout, so
 * an exported multi-file tape runs by itself on real hardware (type `LOAD` and
 * `RUN` once).
 *
 * It relies on the C64's documented tape-chaining behaviour: a `LOAD` executed
 * from a running program loads the file and restarts the program from its first
 * line **without clearing variables**, so a progress flag (`A`) survives each
 * load and drives the program to the next `LOAD`. Code blocks load with
 * `,1,1` (secondary 1 = deposit at the address in the file header); the final
 * `LOAD"<main>",1` loads the main BASIC program relocated to $0801, which then
 * auto-runs and replaces the loader.
 *
 * The user's own program is untouched: the loader is a separate tape/directory
 * file, and importing the image back chooses the (larger) main program for
 * editing while the loader rides along as a preserved tape file - exactly the
 * ZX Spectrum loader model (`src/dialects/zxspectrum/loader.ts`).
 */

import type { MemoryBlock } from '../types';
import { fatalErrors } from '../types';
import { tokenizeProgram } from './tokenizer';

/**
 * The loader's BASIC source for `blocks` (already in tape/directory order) and
 * the main program's tape name. One statement per line keeps it obvious in a
 * headerless dump. Block names are upper-cased to match the tape header
 * filenames the export writes (the tokenizer folds source to upper case).
 */
export function loaderSource(
  programName: string,
  blocks: readonly MemoryBlock[],
): string {
  const main = programName.toUpperCase();
  const lines: string[] = [];
  blocks.forEach((b, i) => {
    // Each LOAD restarts the program; the flag A steps past the already-loaded
    // blocks so the next restart falls through to the next LOAD.
    lines.push(
      `${10 + 10 * i} IF A=${i} THEN A=${i + 1}:LOAD"${b.name.toUpperCase()}",1,1`,
    );
  });
  lines.push(`${10 + 10 * blocks.length} LOAD"${main}",1`);
  return lines.join('\n') + '\n';
}

/**
 * The loader tokenized to its bare program bytes (from $0801, no load-address
 * word) - the payload the `.t64`/cassette exporters store as the loader file.
 * Throws only on a programming error: the generated source is ours and must
 * tokenize clean.
 */
export function loaderProgramBytes(
  programName: string,
  blocks: readonly MemoryBlock[],
): Uint8Array {
  const { program, errors } = tokenizeProgram(
    loaderSource(programName, blocks),
  );
  const fatal = fatalErrors(errors);
  if (fatal.length > 0) {
    throw new Error(
      `Generated loader failed to tokenize: ${fatal[0]!.message}`,
    );
  }
  return program;
}
