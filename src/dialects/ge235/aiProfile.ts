// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { AiProfile } from '../types';

/**
 * The composed prompt has to stay under 5000 characters, which
 * `ai/promptStability.test.ts` enforces once the dialect is registered. Length
 * is usually spent restating the keyword table the same prompt already carries.
 */
export const ge235AiProfile: AiProfile = { systemPrompt: '' };
