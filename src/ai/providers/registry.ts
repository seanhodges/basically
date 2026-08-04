import type { AiProviderId, ProviderMeta } from './types';

/**
 * SDK-free metadata for every selectable backend, in dropdown order. This module
 * deliberately imports no vendor SDK so it (and everything that reads provider
 * metadata - settings, the settings form, the AI panel) stays in the main
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
    acceptsImages: true,
    maxOutputTokens: 128_000,
    supportsEffort: true,
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
    acceptsImages: true,
    // The tightest of the three, and therefore what bounds DEFAULT_AI_MAX_TOKENS.
    maxOutputTokens: 16_384,
    supportsEffort: false,
  },
  {
    id: 'gemini',
    label: 'Google (Gemini)',
    defaultModel: 'gemini-3.1-pro-preview',
    apiKeyStorageKey: 'mbide.geminiApiKey',
    keyPlaceholder: 'AIza…',
    consoleUrl: 'https://aistudio.google.com/apikey',
    consoleLabel: 'aistudio.google.com',
    apiHost: 'generativelanguage.googleapis.com',
    acceptsImages: true,
    // UNCONFIRMED: Google publishes no specifications table for the preview
    // models, so this is the preceding Pro generation's documented ceiling on the
    // assumption a Pro model does not regress below it. Only bounds how high a
    // user may set the Gemini override by hand - the default sits far below it -
    // so an over-generous value fails visibly at the moment it is typed rather
    // than silently later. Confirm against `models.get` when a key is to hand.
    maxOutputTokens: 65_536,
    supportsEffort: false,
  },
];

export const AI_PROVIDER_IDS: AiProviderId[] = PROVIDERS.map((p) => p.id);

/** The default backend when the user has never picked one. */
export const DEFAULT_PROVIDER_ID: AiProviderId = 'anthropic';

export function getProvider(id: AiProviderId): ProviderMeta {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0]!;
}

/**
 * The budget to actually request of a provider: what was asked for, bounded by
 * what that backend accepts.
 *
 * The budget is one app-wide number (see `../aiTuning`), but the backends do not
 * share a ceiling - so without this, raising the default far enough to stop the
 * tightest backend truncating would instead make it reject the request outright.
 * Clamping degrades a too-large setting to a shorter answer, which is the failure
 * this whole change exists to make rarer.
 */
export function clampToProvider(id: AiProviderId, maxTokens: number): number {
  return Math.min(maxTokens, getProvider(id).maxOutputTokens);
}
