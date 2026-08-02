// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { SampleFile } from '../types';

/**
 * Bundled example programs for the Altair (Stage 3) - the canonical set every
 * dialect ships, in the canonical order, ported to Altair 8K BASIC. Write them
 * with the `authoring-dialect-samples` skill, which covers the per-sample
 * intent and the accuracy traps.
 *
 * This machine forces the hardest "degrade gracefully" call in the project,
 * because it has no graphics of any kind: no PLOT, no SET, no block characters,
 * not even a cursor-addressable screen - only `PRINT` to a scrolling terminal.
 * So the visual samples become character-cell rendering:
 *
 * - `hello` - the starter for a fresh document. Straightforward.
 * - `circles` - plot into a character grid held in a string array, then print
 *   the grid. Keep the Pitteway recurrence the other dialects use rather than
 *   inventing a circle routine.
 * - `breakout` - playable, but redrawn as whole frames; there is no way to
 *   update one cell. Check it stays responsive at the terminal's scroll rate.
 * - `maze` - the same fixed wall map, printed as rows of characters.
 * - `kaleido` - mirrored plotting into the same character grid. Its
 *   machine-code block is **dropped**: this dialect has no established
 *   convention for carrying one, and the TRS-80 sets the precedent for a
 *   four-sample set.
 *
 * `src/dialects/roundTrip.test.ts` tokenizes every entry here once the dialect
 * is registered, so a sample that does not tokenize cleanly fails the build.
 */
export const altair8800Samples: SampleFile[] = [];
