import type { AiProviderId, ProviderMeta } from './types';

/**
 * SDK-free metadata for every selectable backend, in dropdown order. This module
 * deliberately imports no vendor SDK so it (and everything that reads provider
 * metadata — settings, the settings form, the AI panel) stays in the main
 * bundle. The streaming implementations are code-split and loaded on demand by
 * `../aiClient`.
 */
export const PROVIDERS: ProviderMeta[] = [
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    defaultModel: 'claude-opus-4-8',
    apiKeyStorageKey: 'mbide.anthropicApiKey',
    keyPlaceholder: 'sk-ant-…',
    consoleUrl: 'https://platform.claude.com/',
    consoleLabel: 'platform.claude.com',
    apiHost: 'api.anthropic.com',
  },
  {
    id: 'openai',
    label: 'OpenAI (GPT)',
    defaultModel: 'gpt-4o',
    apiKeyStorageKey: 'mbide.openaiApiKey',
    keyPlaceholder: 'sk-…',
    consoleUrl: 'https://platform.openai.com/api-keys',
    consoleLabel: 'platform.openai.com',
    apiHost: 'api.openai.com',
  },
  {
    id: 'gemini',
    label: 'Google (Gemini)',
    defaultModel: 'gemini-2.0-flash',
    apiKeyStorageKey: 'mbide.geminiApiKey',
    keyPlaceholder: 'AIza…',
    consoleUrl: 'https://aistudio.google.com/apikey',
    consoleLabel: 'aistudio.google.com',
    apiHost: 'generativelanguage.googleapis.com',
  },
];

export const AI_PROVIDER_IDS: AiProviderId[] = PROVIDERS.map((p) => p.id);

/** The default backend when the user has never picked one. */
export const DEFAULT_PROVIDER_ID: AiProviderId = 'anthropic';

export function getProvider(id: AiProviderId): ProviderMeta {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0]!;
}
