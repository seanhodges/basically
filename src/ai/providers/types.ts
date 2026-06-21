/**
 * Shared contracts for the AI provider layer. The rest of the app talks to a
 * provider only through these types, so Anthropic, OpenAI, and Gemini stay
 * interchangeable behind the `streamChat` dispatcher (`../aiClient`).
 */

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface StreamHandle {
  /** Resolves with the complete assistant text. */
  done: Promise<string>;
  abort(): void;
}

/** The backends the user can choose between in AI settings. */
export type AiProviderId = 'anthropic' | 'openai' | 'gemini';

/** Everything a provider needs to stream one completion. */
export interface StreamOptions {
  apiKey: string;
  model: string;
  maxTokens: number;
  system: string;
  messages: ChatMessage[];
}

/**
 * Synchronous, SDK-free metadata for a backend. Lives in the main bundle (the
 * settings dropdown and key storage need it eagerly); the heavy SDK code is
 * kept out of here and loaded on demand — see `ProviderBackend`.
 */
export interface ProviderMeta {
  id: AiProviderId;
  /** Human label for the settings selector. */
  label: string;
  /** Fixed model id used for this provider (no in-UI model picker). */
  defaultModel: string;
  /** localStorage key the user's API key is persisted under. */
  apiKeyStorageKey: string;
  /** Placeholder shown in the key input, hinting the key format. */
  keyPlaceholder: string;
  /** Where the user creates a key. */
  consoleUrl: string;
  consoleLabel: string;
  /** Host the key is sent to (shown in the privacy warning). */
  apiHost: string;
}

/**
 * The SDK-backed behaviour of a provider: stream a completion and turn an error
 * into a friendly message. Each implementation pulls in its vendor SDK, so it
 * is imported lazily (dynamic `import()`) by `../aiClient` only when selected.
 */
export interface ProviderBackend {
  streamChat(
    opts: StreamOptions,
    onText: (delta: string) => void,
  ): StreamHandle;
  describeError(err: unknown): string;
}
