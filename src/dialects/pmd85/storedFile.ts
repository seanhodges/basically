// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Split a file the PMD 85 tape deck stored into the bytes a program saved and
 * the tape framing around them - the dialect's `unwrapStoredFile`.
 *
 * The deck captures a `SAVE`/`DSAVE` as the whole tape file (see
 * `./emulator/tape.ts`), because that is what the Monitor's own receiver has to
 * be played back: a 63-byte header block carrying the file number `DLOAD`
 * matches on, then the body the program wrote. Shown as stored, a program's
 * saved array would open on 48 bytes of `FF/00/55` leader rather than on its
 * numbers.
 */

import type { UnwrappedFile } from '../types';
import { HEADER_BLOCK_BYTES, parseTapeImage } from './tape';

/**
 * The payload and its tape header, or the bytes whole when they are not one
 * complete tape file - a file another machine wrote into the store, or a
 * recording that never finished. Never throws: showing something beats refusing
 * to show a file.
 *
 * The body's trailing checksum goes with the header rather than the payload.
 * It is framing the deck computed, not a byte the program wrote, and leaving it
 * on the end would put a stray byte under every saved array in the editor.
 */
export function unwrapPmd85StoredFile(bytes: Uint8Array): UnwrappedFile {
  const { files, headerless, warnings } = parseTapeImage(bytes);
  const file = files[0];
  if (files.length !== 1 || headerless.length > 0 || warnings.length > 0) {
    return { payload: bytes, container: null };
  }
  return {
    payload: file!.bytes,
    container: bytes.slice(0, HEADER_BLOCK_BYTES),
  };
}
