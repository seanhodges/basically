/**
 * Shared contracts for the AI provider layer. The rest of the app talks to a
 * provider only through these types, so Anthropic, OpenAI, and Gemini stay
 * interchangeable behind the `streamChat` dispatcher (`../aiClient`).
 */

/**
 * An image sent alongside a user turn - either the machine's display, captured
 * from the emulator (see `../../app/screenCapture`), or a photograph of a
 * printed listing the user attached (see `../../app/listingPhoto`).
 *
 * Two media types because the two pictures want opposite encodings, and each
 * one states its reasoning where it is produced: a retro screen is PNG because
 * lossy compression destroys the single-pixel detail that is the point of
 * showing it, and a photograph of paper is JPEG because photographic noise
 * defeats PNG's filters entirely for no readability gain. Every backend passes
 * this field through rather than asserting on it.
 */
export interface ChatImage {
  mediaType: 'image/png' | 'image/jpeg';
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
  /**
   * Tools this turn asked to use. Assistant turns only, and set only by the
   * exchange loop in `../aiClient` when it feeds a reply back for another pass.
   */
  toolCalls?: ToolCall[];
  /**
   * What running those tools produced, answering the calls on the turn before.
   * User turns only, and index-free: each result names the call it answers, so
   * the two lists cannot silently drift out of step.
   */
  toolResults?: ToolResult[];
}

/**
 * A tool a request offers the model.
 *
 * `input` is a JSON Schema object describing the tool's arguments. It is passed
 * to the provider as given, so it must be a plain serializable value - the same
 * bytes every turn of a conversation, or the prompt cache is lost (see the
 * caching note in `./anthropic`).
 */
export interface ToolDefinition {
  name: string;
  description: string;
  input: Record<string, unknown>;
}

/** A model asking for a tool to be run. */
export interface ToolCall {
  /** Provider-assigned; what a {@link ToolResult} refers back to. */
  id: string;
  name: string;
  /** The arguments, already parsed - never the raw JSON text. */
  input: Record<string, unknown>;
}

/** What running one tool produced, sent back as the next turn. */
export interface ToolResult {
  /** The {@link ToolCall.id} this answers. */
  callId: string;
  content: string;
  /**
   * True when the tool could not do what was asked - an argument that made no
   * sense, or a name that is not a tool at all.
   *
   * Reported rather than thrown so the model can correct itself and carry on:
   * a turn that dies on a bad call wastes everything the model did before it,
   * where a turn told "that key does not exist on this machine" can pick
   * another one.
   */
  isError?: boolean;
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
  /**
   * Tools the model asked to run before it would go on. Empty or absent on
   * every reply that asked for none, which is every reply the IDE makes today.
   *
   * A backend MUST report these rather than dropping them: a call that vanishes
   * looks like an empty answer, which is the one failure nothing can diagnose.
   */
  toolCalls?: ToolCall[];
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
  /**
   * Tools this request offers the model, or absent to offer none.
   *
   * Must be the same set, in the same order, for every turn of one
   * conversation. Tool definitions render ahead of the system prompt, so a set
   * that varies between turns invalidates the whole cached prefix behind it -
   * the system prompt and the entire thread - which costs more than not caching
   * at all. A fixed set is exactly as stable as the per-dialect system prompt
   * already is.
   */
  tools?: ToolDefinition[];
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
  // The four capability fields below are declared, not discovered. The settings
  // form, the attach control and the system prompt all have to know what a
  // backend can do before a request is made, and none of them may load a vendor
  // SDK to find out. A backend that lacks a capability is then honestly
  // incapable - nothing offered, nothing sent - rather than failing a request
  // the user has already made.

  /** Whether this backend can be shown an image ({@link ChatMessage.image}). */
  acceptsImages: boolean;
  /**
   * The largest `max_tokens` this backend accepts for its configured model. The
   * budget is one app-wide number, so the tightest backend would otherwise turn
   * a raised default into a rejected request.
   */
  maxOutputTokens: number;
  /** Whether this backend has a reasoning-effort control. Only Claude does. */
  supportsEffort: boolean;
  /** Whether this backend can be offered tools ({@link StreamOptions.tools}). */
  supportsTools: boolean;
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
