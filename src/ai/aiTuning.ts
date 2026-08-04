import type { AiEffort, AiProviderId } from './providers/types';
import { getProvider } from './providers/registry';
import {
  getProviderEffort,
  getProviderMaxTokens,
} from '../storage/settings';

/** What a request needs to know about how long an answer may be. */
export interface AiTuning {
  maxTokens: number;
  /** Absent for a backend with no such control, so nothing inert is sent. */
  effort?: AiEffort;
}

/**
 * The one place a request's output budget is decided.
 *
 * Every path that builds a request resolves it here - the ones the user starts and
 * the ones the store raises for itself after a run. That matters more than it
 * looks: the unattended paths are where a cut-off answer hurts most and where
 * nobody is watching, so they are exactly the ones that must not quietly drift
 * onto different values from the panel's.
 *
 * Deliberately takes the provider rather than the dialect. How long an answer may
 * be is a fact about the model and the user's preference; the target machine has
 * no stake in it.
 */
export function resolveAiTuning(providerId: AiProviderId): AiTuning {
  const maxTokens = getProviderMaxTokens(providerId);
  return getProvider(providerId).supportsEffort
    ? { maxTokens, effort: getProviderEffort(providerId) }
    : { maxTokens };
}
