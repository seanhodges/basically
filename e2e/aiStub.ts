import type { Page } from '@playwright/test';

/**
 * A stubbed Claude backend, so the assistant can actually be asked something in
 * an end-to-end test.
 *
 * Everything the assistant does after an answer arrives - running it on the
 * machine, saying which stage it is at, handing the finished screen back - is
 * invisible to a test that can only restore a thread from storage, because a
 * restored thread was checked in the session that produced it. This stubs the
 * network instead: the app, the store, the emulator and the panel are all the
 * real ones, and only the far side of the API call is fake.
 *
 * The stub speaks the SDK's own streaming wire format rather than mocking the
 * SDK, so a change to how the app talks to the provider is a change this has to
 * survive - which is the point of testing it at this level at all.
 */

/** localStorage keys the app reads its provider settings from (test-only). */
const PROVIDER_KEY = 'mbide.aiProvider';
const ANTHROPIC_KEY_STORE = 'mbide.anthropicApiKey';

/** One server-sent event in the Messages streaming format. */
function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** A complete streamed reply carrying `text` as a single text block. */
function streamBody(text: string): string {
  return (
    sse('message_start', {
      type: 'message_start',
      message: {
        id: 'msg_stub',
        type: 'message',
        role: 'assistant',
        model: 'stub',
        content: [],
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 },
      },
    }) +
    sse('content_block_start', {
      type: 'content_block_start',
      index: 0,
      content_block: { type: 'text', text: '' },
    }) +
    sse('content_block_delta', {
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'text_delta', text },
    }) +
    sse('content_block_stop', { type: 'content_block_stop', index: 0 }) +
    sse('message_delta', {
      type: 'message_delta',
      delta: { stop_reason: 'end_turn', stop_sequence: null },
      usage: { output_tokens: 1 },
    }) +
    sse('message_stop', { type: 'message_stop' })
  );
}

/** A user turn as it went over the wire, with whatever it carried. */
export interface SentTurn {
  role: string;
  /** Text, or the provider's content blocks where the turn carried an image. */
  content: unknown;
}

/** What a test can ask the stub about the requests it has answered. */
export interface AssistantStub {
  /** Every request so far, oldest first, as the turns it was sent. */
  requests(): SentTurn[][];
}

/** How the stub answers, beyond the replies themselves. */
export interface StubOptions {
  /**
   * Hold each request open this long before answering, so a test can do
   * something to the panel while an answer is still outstanding.
   *
   * Kept as a delay before a whole answer rather than a genuinely dribbled
   * stream: `route.fulfill` sends one complete response, so a part-written
   * answer is not something this level can produce. What it can prove is that
   * the request outlives whatever the test does to the panel meanwhile, which is
   * the behaviour worth pinning.
   */
  delayMs?: number;
}

/**
 * Answer the assistant's requests with `replies`, in order; the last is reused
 * once they run out, so a test that only cares about the first answer does not
 * have to predict how many corrections follow.
 *
 * Call before `openApp`.
 */
export async function stubAssistant(
  page: Page,
  replies: readonly string[],
  options: StubOptions = {},
): Promise<AssistantStub> {
  await page.addInitScript(
    ([providerKey, keyStore]) => {
      try {
        localStorage.setItem(providerKey!, 'anthropic');
        localStorage.setItem(keyStore!, 'test-key');
      } catch {
        /* opaque origin - nothing to seed */
      }
    },
    [PROVIDER_KEY, ANTHROPIC_KEY_STORE],
  );

  let n = 0;
  const sent: SentTurn[][] = [];
  await page.route('https://api.anthropic.com/**', async (route) => {
    const reply = replies[Math.min(n, replies.length - 1)] ?? '';
    n++;
    // Recorded so a test can assert what a request actually carried - the one
    // thing only the wire can settle.
    const body = route.request().postDataJSON() as { messages?: SentTurn[] };
    sent.push(body?.messages ?? []);
    if (options.delayMs) {
      await new Promise((done) => setTimeout(done, options.delayMs));
    }
    try {
      await route.fulfill({
        status: 200,
        headers: {
          'content-type': 'text/event-stream',
          'access-control-allow-origin': '*',
        },
        body: streamBody(reply),
      });
    } catch {
      // The page went away while the answer was outstanding - which is a thing
      // a test may be doing on purpose. Nothing left to answer.
    }
  });

  return { requests: () => sent.map((turns) => [...turns]) };
}
