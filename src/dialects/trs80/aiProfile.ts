import type { AiProfile } from '../types';

// Stub — finalized in Stage 3 of docs/dialect-plans/trs80.md. The Stage 3 prompt
// teaches Level II rules: two-significant-char variable names, ':' multi-statement
// lines, SET(x,y)/RESET(x,y)/POINT(x,y) block graphics, no colour/sound, '?'=PRINT.
const SYSTEM_PROMPT = `You are an expert TRS-80 Model I Level II BASIC programmer. (Placeholder — see docs/dialect-plans/trs80.md Stage 3.)`;

export const trs80AiProfile: AiProfile = {
  systemPrompt: SYSTEM_PROMPT,
  maxTokens: 8192,
};
