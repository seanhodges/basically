// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { AiProfile } from '../types';

/**
 * What the assistant needs to know to write MSX BASIC rather than the generic
 * Microsoft BASIC it will otherwise reach for. The budget goes on the
 * divergences - the VRAM/RAM split behind VPOKE and VPEEK, what each SCREEN
 * mode can draw, the sprite statements and PLAY's music strings - and not on
 * restating the keyword table the same prompt already carries.
 */
export const hb10pAiProfile: AiProfile = {
  systemPrompt: '',
};
