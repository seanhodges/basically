// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { AiProfile } from '../types';

/**
 * The system prompt teaching Claude to write Altair 8K BASIC (Stage 3, with an
 * accuracy pass in Stage 6).
 *
 * The placeholder below is deliberately thin. Compare `trs80/aiProfile.ts` for
 * the shape a finished profile takes - the machine, then the strict dialect
 * rules, then the idioms - and note what has to be *unlearned* for this one:
 * the model's instinct will be to write later Microsoft BASIC. 8K BASIC predates
 * almost all of it. No `ELSE`. No `INKEY$`. No `PRINT USING`, no integer or
 * double type tags, no `INSTR`, no `MID$` as an assignment target. Variable
 * names are significant to two characters. There is no screen to clear and no
 * graphics to draw - output is a scrolling terminal and `PRINT` is the whole
 * repertoire.
 *
 * Every claim in the finished prompt should be checkable against the MITS
 * *Altair BASIC Reference Manual* and the dialect's own `keywords.ts`.
 */
const SYSTEM_PROMPT = `You are an expert Altair 8K BASIC programmer. (Stage 3: replace this placeholder with the real profile - see the notes in aiProfile.ts.)`;

export const altair8800AiProfile: AiProfile = {
  systemPrompt: SYSTEM_PROMPT,
  maxTokens: 4096,
};
