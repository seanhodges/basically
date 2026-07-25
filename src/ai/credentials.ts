// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Resolving the active AI provider and its key, shared by every place that
 * hands work to the assistant (the docs drawer's compare actions, and starting
 * a project from a description).
 */

import { useIdeStore } from '../app/store';
import { getAiProvider, getProviderApiKey } from '../storage/settings';
import { getProvider } from './providers/registry';
import type { AiProviderId } from './providers/types';

/** Whether the assistant is usable at all - i.e. the active provider has a key. */
export function hasAiKey(): boolean {
  return getProviderApiKey(getAiProvider()) !== '';
}

/**
 * The active provider, its key and default model, or `null` when no key is set -
 * in which case the AI settings are opened so the user can add one.
 *
 * For a hand-off the user has already committed to. Somewhere that *offers* the
 * assistant as one option among several should gate on {@link hasAiKey} up
 * front instead, so it can say "not until that is set up" rather than accepting
 * the choice and then diverting.
 */
export function aiCredentials(): {
  providerId: AiProviderId;
  apiKey: string;
  model: string;
} | null {
  const providerId = getAiProvider();
  const provider = getProvider(providerId);
  const apiKey = getProviderApiKey(providerId);
  if (!apiKey) {
    useIdeStore.getState().openSettings('ai');
    return null;
  }
  return { providerId, apiKey, model: provider.defaultModel };
}
