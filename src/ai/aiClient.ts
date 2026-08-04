import type {
  AiProviderId,
  ChatMessage,
  ProviderBackend,
  StreamHandle,
  StreamOptions,
  StreamResult,
  ToolCall,
  ToolResult,
} from './providers/types';
import { clampToProvider, getProvider } from './providers/registry';

export type {
  ChatMessage,
  StopReason,
  StreamHandle,
  StreamResult,
  ToolCall,
  ToolDefinition,
  ToolResult,
} from './providers/types';

/** Runs one tool the model asked for and answers it. */
export type ToolRunner = (call: ToolCall) => Promise<ToolResult>;

/**
 * How many rounds of running tools one turn may take before it is made to
 * conclude.
 *
 * Chosen against the prompt cache rather than taste. A cache breakpoint walks
 * back at most twenty content blocks looking for the previous turn's entry, and
 * each round appends two - the model's calls and our results - so a turn that
 * ran more than ten rounds would stop hitting the cache without saying so.
 * Eight leaves room for the turn's own text and still allows more back-and-forth
 * than any sensible use needs.
 *
 * It is also the bound on what a runaway model can spend of the user's key.
 */
export const MAX_TOOL_ROUNDS = 8;

/**
 * What the model is told when it has used up its rounds.
 *
 * Phrased as an instruction to finish rather than as a failure, because that is
 * what it is: nothing has gone wrong with the program, the turn has simply run
 * as long as it may. Sent as an error result so it cannot be mistaken for the
 * tool having worked.
 */
export const TOOL_ROUNDS_EXHAUSTED =
  'No more tool calls are available on this turn. Answer now with what you already know.';

/**
 * Lazily load each backend so its (heavy) vendor SDK is code-split into its own
 * chunk and fetched only when that provider is first used. The `import()`
 * targets are string literals so the bundler can split them statically.
 */
const loaders: Record<AiProviderId, () => Promise<ProviderBackend>> = {
  anthropic: () =>
    import('./providers/anthropic').then((m) => m.anthropicBackend),
  openai: () => import('./providers/openai').then((m) => m.openaiBackend),
  gemini: () => import('./providers/gemini').then((m) => m.geminiBackend),
};

/** Backends are cached after first load so reuse (and `describeAiError`) is sync. */
const backendCache = new Map<AiProviderId, ProviderBackend>();

async function loadBackend(id: AiProviderId): Promise<ProviderBackend> {
  const cached = backendCache.get(id);
  if (cached) return cached;
  const backend = await loaders[id]();
  backendCache.set(id, backend);
  return backend;
}

/**
 * Stream a chat completion from whichever backend the user has selected. The
 * key is supplied by the user and only ever lives in localStorage. This is the
 * single seam the app talks to; the backend is loaded on demand but the handle
 * is returned synchronously so callers can `abort()` even before it finishes
 * loading.
 */
export function streamChat(
  providerId: AiProviderId,
  opts: StreamOptions,
  onText: (delta: string) => void,
  /**
   * Runs a tool the model asked for. Without one, a reply that calls a tool
   * ends the turn as it always did - so a caller that offers no tools is on
   * exactly the path it was on before tools existed.
   */
  runTool?: ToolRunner,
): StreamHandle {
  let inner: StreamHandle | null = null;
  let aborted = false;

  const stopped = () => {
    const err = new Error('Generation stopped.');
    err.name = 'AbortError';
    return err;
  };

  // Fitted to the backend here rather than in each one: this is the single seam
  // every request passes through, so a caller cannot route around it. The budget
  // is one app-wide number but the backends' ceilings differ, and a backend that
  // supports no effort control must not be handed a stale stored one - nor tools
  // it would silently drop.
  const meta = getProvider(providerId);
  const fitted: StreamOptions = {
    ...opts,
    maxTokens: clampToProvider(providerId, opts.maxTokens),
    ...(meta.supportsEffort ? {} : { effort: undefined }),
    ...(meta.supportsTools ? {} : { tools: undefined }),
  };

  const done = loadBackend(providerId).then(async (backend) => {
    if (aborted) throw stopped();

    // One request per pass, with the history growing by the model's calls and
    // our answers to them. The loop lives here rather than in the backends
    // because it is the same loop for all three: only the wire translation
    // differs, and the bound, the termination rule and what abort means must
    // not.
    const history: ChatMessage[] = [...fitted.messages];
    let text = '';
    let rounds = 0;

    for (;;) {
      inner = backend.streamChat({ ...fitted, messages: history }, onText);
      const result: StreamResult = await inner.done;
      text += result.text;

      const calls = result.toolCalls ?? [];
      if (!calls.length || !runTool) return { ...result, text };
      if (aborted) throw stopped();

      // The round that would exceed the bound answers every call with the same
      // refusal instead of running anything, so the model gets a turn to
      // conclude rather than being cut off mid-thought.
      const exhausted = rounds >= MAX_TOOL_ROUNDS;
      const results: ToolResult[] = exhausted
        ? calls.map((c) => ({
            callId: c.id,
            content: TOOL_ROUNDS_EXHAUSTED,
            isError: true,
          }))
        : await Promise.all(calls.map((c) => runTool(c)));

      if (aborted) throw stopped();
      history.push({
        role: 'assistant',
        content: result.text,
        toolCalls: calls,
      });
      history.push({ role: 'user', content: '', toolResults: results });
      rounds++;

      if (exhausted) {
        // Offered no tools, so the only thing left to do is answer.
        inner = backend.streamChat(
          { ...fitted, messages: history, tools: undefined },
          onText,
        );
        const final: StreamResult = await inner.done;
        return { ...final, text: text + final.text };
      }
    }
  });

  return {
    done,
    abort: () => {
      aborted = true;
      inner?.abort();
    },
  };
}

/** Turn a provider error into a short, user-facing message. */
export function describeAiError(
  providerId: AiProviderId,
  err: unknown,
): string {
  if (err instanceof Error && err.name === 'AbortError') {
    return 'Generation stopped.';
  }
  // By the time a real API error fires the backend is already cached; fall back
  // to a generic message if the failure was the dynamic import itself.
  const backend = backendCache.get(providerId);
  if (backend) return backend.describeError(err);
  return err instanceof Error ? err.message : String(err);
}
