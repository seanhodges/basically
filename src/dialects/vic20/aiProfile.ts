import type { AiProfile } from '../types';

/**
 * TODO (vic20 Stage 3): full system prompt - 22×23 display, screen RAM 7680
 * ($1E00), colour RAM 38400 ($9600), POKE 36879 for border/background, only
 * 3583 BASIC bytes free (keep programs small), no sprites/SID.
 * See docs/contributing/dialect-plans/vic20.md.
 */
export const vic20AiProfile: AiProfile = {
  systemPrompt: 'TODO (vic20 Stage 3)',
  maxTokens: 8192,
};
