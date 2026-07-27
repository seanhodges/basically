import Anthropic from '@anthropic-ai/sdk';
import type {
  ProviderBackend,
  StopReason,
  StreamHandle,
  StreamOptions,
} from './types';

/**
 * Stream a chat completion from the Claude API directly from the browser.
 * The key is supplied by the user and only ever lives in localStorage.
 */
function streamChat(
  { apiKey, model, maxTokens, system, messages }: StreamOptions,
  onText: (delta: string) => void,
): StreamHandle {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const stream = client.messages.stream({
    model,
    max_tokens: maxTokens,
    thinking: { type: 'adaptive' },
    system,
    messages,
    // Cache the conversation prefix. Every turn re-sends the system prompt and
    // the whole thread, and that prefix is already byte-stable: the system
    // prompt is a per-dialect constant, there are no tools, and history is
    // append-only. The top-level form puts the breakpoint at the end of the
    // whole prefix - deliberately NOT on the system prompt alone, which is
    // under the model's minimum cacheable size on most dialects and would
    // silently never cache. Default 5-minute TTL: a read costs about a tenth
    // of an input token against a 1.25x write, so it pays from the second turn.
    cache_control: { type: 'ephemeral' },
  });

  stream.on('text', (delta) => onText(delta));

  const done = stream.finalMessage().then((message) => {
    let text = '';
    for (const block of message.content) {
      if (block.type === 'text') text += block.text;
    }
    // Both of these come back as ordinary successful responses. `max_tokens`
    // means the answer stops mid-thought - and the output budget is shared
    // with adaptive thinking, so a long listing can hit it; `refusal` returns
    // no content at all, which would otherwise look like an empty reply.
    const stop: StopReason =
      message.stop_reason === 'max_tokens'
        ? 'truncated'
        : message.stop_reason === 'refusal'
          ? 'refused'
          : 'complete';
    return { text, stop };
  });

  return {
    done,
    abort: () => stream.abort(),
  };
}

function describeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) {
    return 'Invalid API key - check it in AI settings.';
  }
  if (err instanceof Anthropic.RateLimitError) {
    return 'Rate limited by the Claude API - wait a moment and try again.';
  }
  if (err instanceof Anthropic.APIError) {
    return `Claude API error ${err.status ?? ''}: ${err.message}`;
  }
  if (err instanceof Error && err.name === 'AbortError') {
    return 'Generation stopped.';
  }
  return err instanceof Error ? err.message : String(err);
}

export const anthropicBackend: ProviderBackend = { streamChat, describeError };
