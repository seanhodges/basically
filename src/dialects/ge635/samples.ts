// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { SampleFile } from '../types';

/**
 * The bundled sample programs. Not written yet.
 *
 * Expect three rather than the full five, as the GE-235 ships: the paddle
 * sample needs a key read this BASIC cannot do, and the kaleidoscope needs
 * machine code a BASIC-only machine has nowhere to put.
 */
export const ge635Samples: SampleFile[] = [];
