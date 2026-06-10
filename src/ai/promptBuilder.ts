import type { Dialect, TokenizeError } from '../dialects/types';

/**
 * The system prompt stays byte-stable per dialect (good for prompt caching);
 * volatile context — current program, lint errors — rides in the user turn.
 */
export function buildSystemPrompt(dialect: Dialect): string {
  return dialect.aiProfile.systemPrompt;
}

export function buildUserMessage(
  request: string,
  currentSource: string,
  errors: TokenizeError[],
): string {
  let msg = '';
  const source = currentSource.trim();
  if (source !== '') {
    msg += `Current program in my editor:\n\`\`\`basic\n${source}\n\`\`\`\n\n`;
  }
  if (errors.length > 0) {
    msg += `Current tokenizer errors:\n`;
    for (const e of errors.slice(0, 20)) {
      msg += `- editor line ${e.line}: ${e.message}\n`;
    }
    msg += '\n';
  }
  msg += request;
  return msg;
}
