import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type {
  ChatMessage,
  ProviderBackend,
  StopReason,
  StreamHandle,
  StreamOptions,
} from './types';

/**
 * Map the app's history onto OpenAI `messages`. A turn with nothing shown keeps
 * its plain string content; a turn carrying an image becomes content parts,
 * the image (as a data URI) ahead of the text.
 */
export function toOpenAiMessages(
  messages: ChatMessage[],
): ChatCompletionMessageParam[] {
  return messages.map((m) =>
    m.image && m.role === 'user'
      ? {
          role: 'user' as const,
          content: [
            {
              type: 'image_url' as const,
              image_url: {
                url: `data:${m.image.mediaType};base64,${m.image.base64}`,
              },
            },
            { type: 'text' as const, text: m.content },
          ],
        }
      : { role: m.role, content: m.content },
  );
}

/**
 * Stream a chat completion from the OpenAI API directly from the browser.
 * The system prompt is sent as a leading `system` message; the rest of the
 * conversation maps 1:1 onto OpenAI's `user`/`assistant` roles.
 */
function streamChat(
  { apiKey, model, maxTokens, system, messages }: StreamOptions,
  onText: (delta: string) => void,
): StreamHandle {
  const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
  const controller = new AbortController();

  const done = (async () => {
    const stream = await client.chat.completions.create(
      {
        model,
        max_tokens: maxTokens,
        stream: true,
        messages: [
          { role: 'system', content: system },
          ...toOpenAiMessages(messages),
        ],
      },
      { signal: controller.signal },
    );
    let text = '';
    let stop: StopReason = 'complete';
    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      const delta = choice?.delta?.content ?? '';
      if (delta) {
        text += delta;
        onText(delta);
      }
      if (choice?.finish_reason === 'length') stop = 'truncated';
      else if (choice?.finish_reason === 'content_filter') stop = 'refused';
    }
    return { text, stop };
  })();

  return {
    done,
    abort: () => controller.abort(),
  };
}

function describeError(err: unknown): string {
  if (err instanceof OpenAI.AuthenticationError) {
    return 'Invalid API key - check it in AI settings.';
  }
  if (err instanceof OpenAI.RateLimitError) {
    return 'Rate limited by the OpenAI API - wait a moment and try again.';
  }
  if (err instanceof OpenAI.APIError) {
    return `OpenAI API error ${err.status ?? ''}: ${err.message}`;
  }
  if (err instanceof Error && err.name === 'AbortError') {
    return 'Generation stopped.';
  }
  return err instanceof Error ? err.message : String(err);
}

export const openaiBackend: ProviderBackend = { streamChat, describeError };
