// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Recorded cassette audio back into an editable document: the inverse of
 * `cassetteEncoder.ts`.
 *
 * Two steps, and only the first is this file's own work. Demodulating the
 * Kansas City half-cycles into framed bytes is `decodeKcsBytes`, and what those
 * bytes mean is `tapeFile.ts` and `tapeImport.ts`. What is decided here is the
 * tape speed, which nothing in the signal declares: the machine is *told* which
 * rate to read at by its own `SE T=` setting, so a recording of unknown origin
 * is demodulated at each of the machine's two rates and the one whose bytes
 * parse as a tape wins. The wrong rate does not produce a plausible tape - it
 * produces bytes with no hundred-byte lead in them - so there is nothing to
 * choose between.
 *
 * Throws when no valid signal is found, per the
 * {@link import('../../types').Dialect} `audio.decodeSamples` contract: a silent
 * empty result would look to the Import dialog like an empty program that
 * loaded fine.
 */

import { decodeKcsBytes } from '../../audio/kansasCity';
import type { AudioDecodeResult } from '../../types';
import { TapeRecordError, hasTapeLead, parseTapeRecords } from '../tapeFile';
import { importTapeRecords } from '../tapeImport';
import { SORCERER_FRAMINGS } from './cassetteEncoder';

const NO_SIGNAL = 'No cassette signal detected';

/** Recover the document on a recording, or throw if there isn't one. */
export function decodeCassette(
  samples: Float32Array,
  sampleRate: number,
): AudioDecodeResult {
  // Kept when a rate demodulates to something that *is* a tape and then fails
  // its checksum: that message names the real fault, and reporting "no signal"
  // instead would send the user off adjusting their volume.
  let corrupt: TapeRecordError | null = null;

  for (const framing of SORCERER_FRAMINGS) {
    const bytes = decodeKcsBytes(samples, sampleRate, framing);
    if (!hasTapeLead(bytes)) continue;
    try {
      const tape = importTapeRecords(parseTapeRecords(bytes));
      return {
        programName: tape.programName,
        source: tape.source,
        ...(tape.warnings.length > 0 ? { warnings: tape.warnings } : {}),
        ...(tape.blocks ? { blocks: tape.blocks } : {}),
      };
    } catch (e) {
      if (!(e instanceof TapeRecordError)) throw e;
      corrupt ??= e;
    }
  }
  throw corrupt ?? new Error(NO_SIGNAL);
}
