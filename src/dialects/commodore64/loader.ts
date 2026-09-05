// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The generated auto-loader for block-aware `.d64`/cassette export: a tiny
 * auto-running Commodore BASIC program that loads every code block, then chains
 * into the main program - the classic loader-first layout, so an exported disk
 * or tape runs by itself on real hardware (type `LOAD` and `RUN` once).
 *
 * It relies on the C64's documented load-chaining behaviour: a `LOAD` executed
 * from a running program loads the file and restarts the program from its first
 * line **without clearing variables**, so a progress flag (`A`) survives each
 * load and drives the program to the next `LOAD`. Code blocks load with
 * secondary 1 (`LOAD"<name>",<dev>,1` = deposit at the address in the file);
 * the final `LOAD"<main>",<dev>` loads the main BASIC program relocated to
 * $0801, which then auto-runs and replaces the loader.
 *
 * The load device varies by container: tape (`.wav` cassette) uses device 1,
 * disk (`.d64`) uses device 8. The user's own program is untouched: the loader
 * is a separate file, and importing the image back chooses the (larger) main
 * program for editing while the loader rides along as a preserved file -
 * exactly the ZX Spectrum loader model (`src/dialects/zxspectrum/loader.ts`).
 */

import type { Block } from '../types';
import { fatalErrors } from '../types';
import { tokenizeProgram } from './tokenizer';

/** Load device for the generated loader: 1 = tape (cassette), 8 = disk (.d64). */
export type LoaderDevice = 1 | 8;

/**
 * The loader's BASIC source for `blocks` (already in load order), the main
 * program's file name, and the load `device`. One statement per line keeps it
 * obvious in a headerless dump. Block names are upper-cased to match the
 * filenames the export writes (the tokenizer folds source to upper case).
 */
export function loaderSource(
  programName: string,
  blocks: readonly Block[],
  device: LoaderDevice = 1,
): string {
  const main = programName.toUpperCase();
  const lines: string[] = [];
  blocks.forEach((b, i) => {
    // Each LOAD restarts the program; the flag A steps past the already-loaded
    // blocks so the next restart falls through to the next LOAD.
    lines.push(
      `${10 + 10 * i} IF A=${i} THEN A=${i + 1}:LOAD"${b.name.toUpperCase()}",${device},1`,
    );
  });
  lines.push(`${10 + 10 * blocks.length} LOAD"${main}",${device}`);
  return lines.join('\n') + '\n';
}

/**
 * The loader tokenized to its bare program bytes (from $0801, no load-address
 * word) - the payload the `.d64`/cassette exporters store as the loader file.
 * Throws only on a programming error: the generated source is ours and must
 * tokenize clean.
 */
export function loaderProgramBytes(
  programName: string,
  blocks: readonly Block[],
  device: LoaderDevice = 1,
): Uint8Array {
  const { program, errors } = tokenizeProgram(
    loaderSource(programName, blocks, device),
  );
  const fatal = fatalErrors(errors);
  if (fatal.length > 0) {
    throw new Error(
      `Generated loader failed to tokenize: ${fatal[0]!.message}`,
    );
  }
  return program;
}
