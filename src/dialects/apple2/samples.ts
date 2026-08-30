// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { SampleFile } from '../types';

/**
 * The canonical sample set in Integer BASIC.
 *
 * All five, `breakout` included: `PEEK(-16384)` reads the keyboard latch without
 * stopping the program, which is the read the Apple I cannot offer.
 */
export const apple2Samples: SampleFile[] = [];
