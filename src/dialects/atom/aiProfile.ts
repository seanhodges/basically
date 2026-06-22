import type { AiProfile } from '../types';

/**
 * Claude assistant profile for Acorn Atom BASIC. STUB — Stage 3 writes the real
 * system prompt teaching the dialect's rules (line-numbered statements, `?`/`!`
 * indirection, `$` string area, dot-abbreviated keywords, MC6847 graphics modes).
 */
export const atomAiProfile: AiProfile = {
  systemPrompt:
    'TODO: teach Claude Acorn Atom BASIC (see docs/dialect-plans/atom.md).',
  maxTokens: 2048,
};
