// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The generated auto-loader for the PET's block-aware `.d64`/cassette export.
 * The loader BASIC (`IF A=n THEN A=n+1:LOAD"BLOCK",dev,1` chain + a final
 * `LOAD"MAIN",dev`) is the same across the Commodore lineage, so the source is
 * reused from the C64 (`../commodore64/loader`); only the tokenization differs -
 * the PET's BASIC 4.0 keyword table - so this module re-tokenizes it here.
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
 * The loader tokenized to its bare program bytes (from $0401, no load-address
 * word) - the payload the `.d64`/cassette exporters store as the loader file.
 * Throws only on a programming error: the generated source is ours and must
 * tokenize clean against the PET's BASIC 4.0 table.
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
