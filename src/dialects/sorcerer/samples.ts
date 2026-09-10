// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { SampleFile } from '../types';

/**
 * The canonical sample set, built through `standardSamples` in
 * `src/dialects/sampleKit.ts` once the programs exist under `samples/`.
 * Not populated yet.
 *
 * With a 64x30 monochrome character display and no PLOT, `circles` and `kaleido`
 * are drawn out of the graphics characters - degrade gracefully rather than
 * dropping either. Use the `authoring-dialect-samples` sub-skill, and run each
 * program on the machine: tokenizing clean proves nothing.
 */
export const sorcererSamples: SampleFile[] = [];
