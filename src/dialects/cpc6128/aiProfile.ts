import type { AiProfile } from '../types';

/**
 * Placeholder until Stage C: the real profile teaches Locomotive BASIC 1.1
 * (the 464 profile plus the eleven 1.1 additions; tape I/O needs |TAPE).
 * See docs/contributing/dialect-plans/cpc6128.md.
 */
export const cpc6128AiProfile: AiProfile = {
  systemPrompt:
    'You are an expert Amstrad CPC 6128 Locomotive BASIC 1.1 programmer. ' +
    '(Placeholder profile - Stage C of docs/contributing/dialect-plans/cpc6128.md replaces this.)',
  maxTokens: 8192,
};
