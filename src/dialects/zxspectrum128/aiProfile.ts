import type { AiProfile } from '../types';

// Stub — finalized in Stage 3 of docs/dialect-plans/zxspectrum128.md. The Stage 3
// prompt teaches 128 BASIC: the same Sinclair BASIC as the 48K (':' multi-statement
// lines, full-screen editor, INK/PAPER/BRIGHT/FLASH/OVER/INVERSE colour, BIN, IN/OUT)
// plus PLAY for AY music, the larger program space, and the 128 menu/RAMdisk
// commands; SPECTRUM drops back to 48 BASIC.
const SYSTEM_PROMPT = `You are an expert ZX Spectrum 128K BASIC programmer. (Placeholder — see docs/dialect-plans/zxspectrum128.md Stage 3.)`;

export const spectrum128AiProfile: AiProfile = {
  systemPrompt: SYSTEM_PROMPT,
  maxTokens: 8192,
};
