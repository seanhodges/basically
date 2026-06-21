import type { AiProvider, AiProviderId } from './types';
import { anthropicProvider } from './anthropic';
import { openaiProvider } from './openai';
import { geminiProvider } from './gemini';

/** All selectable backends, in the order shown in the settings dropdown. */
export const PROVIDERS: AiProvider[] = [
  anthropicProvider,
  openaiProvider,
  geminiProvider,
];

export const AI_PROVIDER_IDS: AiProviderId[] = PROVIDERS.map((p) => p.id);

/** The default backend when the user has never picked one. */
export const DEFAULT_PROVIDER_ID: AiProviderId = 'anthropic';

export function getProvider(id: AiProviderId): AiProvider {
  return PROVIDERS.find((p) => p.id === id) ?? anthropicProvider;
}
