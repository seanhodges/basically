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
 * A pluggable AI backend: UI/runtime metadata plus the two behaviours the app
 * relies on (stream a completion, turn an error into a friendly message).
 */
export interface AiProvider {
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
  streamChat(
    opts: StreamOptions,
    onText: (delta: string) => void,
  ): StreamHandle;
  describeError(err: unknown): string;
}
