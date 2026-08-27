// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The generated auto-loader for the VIC-20's block-aware `.d64`/cassette export.
 * The loader BASIC (`IF A=n THEN A=n+1:LOAD"BLOCK",dev,1` chain + a final
 * `LOAD"MAIN",dev`) is the same across the Commodore lineage, so the source is
 * reused from the C64 (`../commodore64/loader`); the VIC-20 tokenizes it through
 * the plain BASIC V2 table (byte-identical to the C64's) at its own $1001 base.
 *
 * See `../commodore64/loader.ts` for the load-chaining trick this relies on
 * (`LOAD` from a running program restarts it without clearing variables).
 */

import type { Block } from '../types';
import { fatalErrors } from '../types';
import { loaderSource, type LoaderDevice } from '../commodore64/loader';
import { tokenizeProgram } from './tokenizer';

export { loaderSource, type LoaderDevice };

/**
 * The loader tokenized to its bare program bytes (from $1001, no load-address
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
