import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages';
import type {
  ChatMessage,
  ProviderBackend,
  StopReason,
  StreamHandle,
  StreamOptions,
  ToolCall,
} from './types';

/**
 * Map the app's history onto Claude `messages`.
 *
 * A turn with nothing shown keeps its plain string content, byte for byte as
 * before - the prefix has to stay stable for the cache to hit. A turn carrying
 * an image becomes two blocks, the image first: what the text says about the
 * screen reads better once the screen has been seen.
 *
 * A turn carrying tool calls or tool results becomes blocks too, and for the
 * same reason it must: the calls and the results they answer have to travel as
 * structure, not prose, or the model cannot tell which result belongs to which
 * call. Text still leads on a turn that has any, so a model that narrated
 * before calling keeps its narration.
 */
export function toAnthropicMessages(messages: ChatMessage[]): MessageParam[] {
  return messages.map((m) => {
    if (m.toolCalls?.length) {
      return {
        role: m.role,
        content: [
          ...(m.content ? [{ type: 'text' as const, text: m.content }] : []),
          ...m.toolCalls.map((c) => ({
            type: 'tool_use' as const,
            id: c.id,
            name: c.name,
            input: c.input,
          })),
        ],
      };
    }
    if (m.toolResults?.length) {
      return {
        role: m.role,
        content: [
          ...m.toolResults.map((r) => ({
            type: 'tool_result' as const,
            tool_use_id: r.callId,
            content: r.content,
            ...(r.isError ? { is_error: true } : {}),
          })),
          ...(m.content ? [{ type: 'text' as const, text: m.content }] : []),
        ],
      };
    }
    return m.image
      ? {
          role: m.role,
          content: [
            {
              type: 'image' as const,
              source: {
                type: 'base64' as const,
                media_type: m.image.mediaType,
                data: m.image.base64,
              },
            },
            { type: 'text' as const, text: m.content },
          ],
        }
      : { role: m.role, content: m.content };
  });
}

/**
 * Stream a chat completion from the Claude API directly from the browser.
 * The key is supplied by the user and only ever lives in localStorage.
 */
function streamChat(
  { apiKey, model, maxTokens, system, messages, effort, tools }: StreamOptions,
  onText: (delta: string) => void,
): StreamHandle {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const stream = client.messages.stream({
    model,
    max_tokens: maxTokens,
    thinking: { type: 'adaptive' },
    // Offered only when the caller has some; omitted entirely otherwise, so a
    // request that wants none is byte-identical to what it was before tools
    // existed here - which is what keeps the cached prefix of every existing
    // conversation valid.
    ...(tools?.length
      ? {
          tools: tools.map((t) => ({
            name: t.name,
            description: t.description,
            input_schema: t.input as Anthropic.Tool['input_schema'],
          })),
        }
      : {}),
    // Stated rather than left to default: unset means the model's highest
    // setting, and `max_tokens` is spent on thinking and on the answer together -
    // so an unbounded think is what used to leave a long listing unfinished.
    ...(effort ? { output_config: { effort } } : {}),
    system,
    messages: toAnthropicMessages(messages),
    // Cache the conversation prefix. Every turn re-sends the system prompt and
    // the whole thread, and that prefix is already byte-stable: the system
    // prompt is a per-dialect constant, the tool set is fixed for a
    // conversation, and history is append-only - including a shown screen,
    // which stays on the turn that showed it rather than being rewritten out of
    // the prefix later (a cached image reads for a fraction of an input token;
    // rewriting it would cost a full cache write on every turn after).
    //
    // Tools are the one part of that prefix a caller could easily get wrong.
    // They render AHEAD of the system prompt, so a set that gains, loses or
    // reorders an entry between turns invalidates everything behind it - the
    // system prompt and the whole thread - which is worse than never caching.
    // What matters is that the set does not vary, not that it is empty: a fixed
    // set is exactly as stable as the per-dialect system prompt already is.
    //
    // The top-level form puts the
    // breakpoint at the end of the
    // whole prefix - deliberately NOT on the system prompt alone, which is
    // under the model's minimum cacheable size on most dialects and would
    // silently never cache. Default 5-minute TTL: a read costs about a tenth
    // of an input token against a 1.25x write, so it pays from the second turn.
    cache_control: { type: 'ephemeral' },
  });

  stream.on('text', (delta) => onText(delta));

  const done = stream.finalMessage().then((message) => {
    let text = '';
    // Tool calls are collected rather than ignored. This loop used to keep only
    // text and silently drop everything else, which for a reply that called a
    // tool produced an empty answer and no way to tell why - the one failure
    // nothing downstream can diagnose.
    const toolCalls: ToolCall[] = [];
    for (const block of message.content) {
      if (block.type === 'text') text += block.text;
      else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          input: (block.input ?? {}) as Record<string, unknown>,
        });
      }
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
    return { text, stop, ...(toolCalls.length ? { toolCalls } : {}) };
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
