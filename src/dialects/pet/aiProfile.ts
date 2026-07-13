import type { AiProfile } from '../types';

/**
 * TODO (pet Stage 3): full system prompt - BASIC 4.0, 40×25 mono, screen RAM
 * 32768 ($8000), no colour/SID/sprites, GET for game input, disk keywords
 * tokenize but no disk is wired. See docs/contributing/dialect-plans/pet.md.
 */
export const petAiProfile: AiProfile = {
  systemPrompt: 'TODO (pet Stage 3)',
  maxTokens: 8192,
};
