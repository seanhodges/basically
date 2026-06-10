import Anthropic from '@anthropic-ai/sdk';
import type { AiProfile } from '../dialects/types';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface StreamHandle {
  /** Resolves with the complete assistant text. */
  done: Promise<string>;
  abort(): void;
}

/**
 * Stream a chat completion from the Claude API directly from the browser.
 * The key is supplied by the user and only ever lives in localStorage.
 */
export function streamChat(
  apiKey: string,
  profile: AiProfile,
  system: string,
  messages: ChatMessage[],
  onText: (delta: string) => void,
): StreamHandle {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const stream = client.messages.stream({
    model: profile.model,
    max_tokens: profile.maxTokens,
    thinking: { type: 'adaptive' },
    system,
    messages,
  });

  stream.on('text', (delta) => onText(delta));

  const done = stream.finalMessage().then((message) => {
    let text = '';
    for (const block of message.content) {
      if (block.type === 'text') text += block.text;
    }
    return text;
  });

  return {
    done,
    abort: () => stream.abort(),
  };
}

export function describeAiError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) {
    return 'Invalid API key — check it in AI settings.';
  }
  if (err instanceof Anthropic.RateLimitError) {
    return 'Rate limited by the Claude API — wait a moment and try again.';
  }
  if (err instanceof Anthropic.APIError) {
    return `Claude API error ${err.status ?? ''}: ${err.message}`;
  }
  if (err instanceof Error && err.name === 'AbortError') {
    return 'Generation stopped.';
  }
  return err instanceof Error ? err.message : String(err);
}
