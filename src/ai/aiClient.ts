import type {
  AiProviderId,
  ProviderBackend,
  StreamHandle,
  StreamOptions,
} from './providers/types';
import { clampToProvider, getProvider } from './providers/registry';

export type {
  ChatMessage,
  StopReason,
  StreamHandle,
  StreamResult,
} from './providers/types';

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
): StreamHandle {
  let inner: StreamHandle | null = null;
  let aborted = false;

  // Fitted to the backend here rather than in each one: this is the single seam
  // every request passes through, so a caller cannot route around it. The budget
  // is one app-wide number but the backends' ceilings differ, and a backend that
  // supports no effort control must not be handed a stale stored one.
  const meta = getProvider(providerId);
  const fitted: StreamOptions = {
    ...opts,
    maxTokens: clampToProvider(providerId, opts.maxTokens),
    ...(meta.supportsEffort ? {} : { effort: undefined }),
  };

  const done = loadBackend(providerId).then((backend) => {
    if (aborted) {
      const err = new Error('Generation stopped.');
      err.name = 'AbortError';
      throw err;
    }
    inner = backend.streamChat(fitted, onText);
    return inner.done;
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
