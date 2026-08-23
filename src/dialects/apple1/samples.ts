// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { SampleFile } from '../types';

/**
 * The canonical sample set, ported to Integer BASIC against the tightest budget
 * in the project: 2048 bytes shared between program and variables, integer-only
 * arithmetic and a 40x24 uppercase text screen.
 */
export const apple1Samples: SampleFile[] = [];
