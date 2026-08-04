/**
 * Shared contracts for the AI provider layer. The rest of the app talks to a
 * provider only through these types, so Anthropic, OpenAI, and Gemini stay
 * interchangeable behind the `streamChat` dispatcher (`../aiClient`).
 */

/**
 * An image sent alongside a user turn - in practice the machine's display,
 * captured from the emulator (see `../../app/screenCapture`).
 *
 * PNG only: what is ever sent is a retro screen, where lossy compression
 * destroys the single-pixel detail that is the point of showing it.
 */
export interface ChatImage {
  mediaType: 'image/png';
  /** The image data, base64, without the `data:` URI prefix. */
  base64: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  /**
   * An image shown to the assistant with this turn. User turns only - no
   * provider accepts an image on an assistant turn, and nothing here produces
   * one. Absent on every turn that shows nothing, which is most of them.
   */
  image?: ChatImage;
}

/**
 * Why the model stopped generating. `truncated` and `refused` both arrive as
 * successful responses, so without this an answer cut off mid-program - or a
 * declined request, which returns no text at all - is indistinguishable from a
 * finished one.
 */
export type StopReason = 'complete' | 'truncated' | 'refused';

export interface StreamResult {
  /** The assistant text produced, which may be partial when `truncated`. */
  text: string;
  stop: StopReason;
}

export interface StreamHandle {
  /** Resolves with the assistant text and why generation stopped. */
  done: Promise<StreamResult>;
  abort(): void;
}

/** The backends the user can choose between in AI settings. */
export type AiProviderId = 'anthropic' | 'openai' | 'gemini';

/**
 * How hard the model is asked to think before answering.
 *
 * Only meaningful on a backend whose {@link ProviderMeta.supportsEffort} is set;
 * the others ignore it. Ordered from cheapest to most thorough.
 */
export type AiEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export const AI_EFFORTS: AiEffort[] = ['low', 'medium', 'high', 'xhigh', 'max'];

/** Everything a provider needs to stream one completion. */
export interface StreamOptions {
  apiKey: string;
  model: string;
  maxTokens: number;
  system: string;
  messages: ChatMessage[];
  /**
   * How hard to think before answering. Ignored by a backend that has no such
   * control - the setting is never offered for one, so an ignored value here
   * means a caller that didn't check rather than a user who chose it.
   */
  effort?: AiEffort;
}

/**
 * Synchronous, SDK-free metadata for a backend. Lives in the main bundle (the
 * settings dropdown and key storage need it eagerly); the heavy SDK code is
 * kept out of here and loaded on demand - see `ProviderBackend`.
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
  /**
   * Whether this backend can be shown an image ({@link ChatMessage.image}).
   *
   * Stated here rather than discovered by trying: the attach control and the
   * system prompt both have to know before a request is made, and neither may
   * load a vendor SDK to find out. All three backends accept images today; the
   * flag exists so a backend that cannot is honestly incapable - no image sent,
   * nothing offered - instead of failing a request the user has already made.
   */
  acceptsImages: boolean;
  /**
   * The largest `max_tokens` this backend accepts for its configured model.
   *
   * Declared here for the same reason as {@link acceptsImages}: the settings form
   * needs it to bound the input, and the request builder needs it to clamp, and
   * neither may load a vendor SDK to ask. Since the budget is now one app-wide
   * number rather than a per-machine one, the tightest backend would otherwise
   * turn a raised default into a rejected request.
   */
  maxOutputTokens: number;
  /**
   * Whether this backend has a reasoning-effort control.
   *
   * Only Claude does today. Stated rather than discovered so the settings form can
   * decline to offer a setting that would do nothing - an inert control reads as a
   * broken one.
   */
  supportsEffort: boolean;
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
