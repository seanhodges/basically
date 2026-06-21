import { getProvider } from './providers/registry';
import type {
  AiProviderId,
  StreamHandle,
  StreamOptions,
} from './providers/types';

export type { ChatMessage, StreamHandle } from './providers/types';

/**
 * Stream a chat completion from whichever backend the user has selected. The
 * key is supplied by the user and only ever lives in localStorage. This is the
 * single seam the app talks to — each backend lives behind the `AiProvider`
 * interface in `./providers`.
 */
export function streamChat(
  providerId: AiProviderId,
  opts: StreamOptions,
  onText: (delta: string) => void,
): StreamHandle {
  return getProvider(providerId).streamChat(opts, onText);
}

/** Turn a provider error into a short, user-facing message. */
export function describeAiError(
  providerId: AiProviderId,
  err: unknown,
): string {
  return getProvider(providerId).describeError(err);
}
