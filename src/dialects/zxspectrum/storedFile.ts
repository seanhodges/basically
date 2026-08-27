// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Split a file the Spectrum tape deck stored into the bytes a program saved
 * and the tape framing around them - the dialect's `unwrapStoredFile`.
 *
 * The deck captures a `SAVE … DATA` / `SAVE … CODE` as a ready two-block `.TAP`
 * image (see `./emulator/tapeDeck.ts`), because that is what the ROM's own
 * LD-BYTES search has to be served back: a 17-byte header block naming the
 * file and its type, then the data block the program wrote. Shown as stored,
 * a user's high-score table would open on that header rather than on their
 * numbers.
 */

import type { UnwrappedFile } from '../types';
import { tapBlockScan } from './tapfile';

/** Length of a Spectrum tape header payload (type, 10-byte name, 3 params). */
const HEADER_LENGTH = 17;
const HEADER_FLAG = 0x00;
const DATA_FLAG = 0xff;

/**
 * The payload and its tape header, or the bytes whole when they are not a
 * header-then-data pair - a file another machine wrote into the store, or an
 * image the deck never finished. Never throws: showing something beats
 * refusing to show a file.
 */
export function unwrapSpectrumStoredFile(bytes: Uint8Array): UnwrappedFile {
  const blocks = tapBlockScan(bytes);
  const [header, data] = blocks;
  if (
    blocks.length !== 2 ||
    header === undefined ||
    data === undefined ||
    header.flag !== HEADER_FLAG ||
    header.payload.length !== HEADER_LENGTH ||
    data.flag !== DATA_FLAG
  ) {
    return { payload: bytes, container: null };
  }
  return { payload: data.payload, container: header.payload };
}
