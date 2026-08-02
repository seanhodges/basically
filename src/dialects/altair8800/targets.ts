// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { BuildTarget } from '../types';

/**
 * File export targets for the Altair (Stage 4).
 *
 * The machine had no single program container, so the targets follow what the
 * hardware actually offered rather than inventing a `.altair` format:
 *
 * - **Cassette audio** over the 88-ACR board, which used the Kansas City
 *   Standard at 300 baud. That codec is already understood in this project -
 *   the BBC's CFS and the Acorn Atom's tapes are both 300-baud KCS FSK - so
 *   `src/transfer/wav.ts` and the existing Acorn encoders are the reference,
 *   not the Sinclair pulse scheme.
 * - **Paper tape / plain ASCII**, the listing as BASIC itself would re-read it
 *   line by line. Trivially also the human-readable export.
 * - **Tokenized program image**, as `CSAVE` wrote it.
 *
 * Import is the mirror: `binaryImports` on the dialect lists whatever
 * `detokenize()` can read back, and `audio.decodeSamples` recovers a program
 * from recorded cassette audio. `src/dialects/cassetteRoundTrip.test.ts`
 * enforces that a dialect offering `decodeSamples` can import what it exports.
 */
export const altair8800BuildTargets: BuildTarget[] = [];
