import type { AiProfile } from '../types';

/**
 * Placeholder until Stage 3: the real profile teaches Locomotive BASIC 1.0
 * (real ELSE, WHILE/WEND, AFTER/EVERY timers, graphics/sound statements,
 * no 1.1-only keywords). See docs/contributing/dialect-plans/cpc464.md.
 */
export const cpc464AiProfile: AiProfile = {
  systemPrompt:
    'You are an expert Amstrad CPC 464 Locomotive BASIC 1.0 programmer. ' +
    '(Placeholder profile - Stage 3 of docs/contributing/dialect-plans/cpc464.md replaces this.)',
  maxTokens: 8192,
};
