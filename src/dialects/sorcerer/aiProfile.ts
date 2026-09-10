// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { AiProfile } from '../types';

/**
 * What the assistant is told about this machine. Not written yet.
 *
 * Keep the composed profile under 5000 characters - `ai/promptStability.test.ts`
 * caps it there, and only says so once the dialect registers. A profile that
 * runs long is usually restating the keyword table and the `facts.ts`
 * substitutions the same prompt already carries.
 */
export const sorcererAiProfile: AiProfile = {
  systemPrompt: '',
};
