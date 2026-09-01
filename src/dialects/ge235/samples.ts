// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { SampleFile } from '../types';

/**
 * This machine carries three of the five canonical samples, and both omissions
 * are properties of the hardware rather than gaps:
 *
 *  - no `breakout`, because a teletype gives a program no non-blocking key
 *    read (the Altair, ZX80 and Atom drop it for the same reason);
 *  - no `kaleido`, because the dialect supports no machine code at all, so
 *    there is no block for the sample to carry (the TRS-80 ships none either).
 */
export const ge235Samples: SampleFile[] = [];
