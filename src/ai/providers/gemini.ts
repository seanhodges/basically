import { GoogleGenAI, ApiError, type Content } from '@google/genai';
import type {
  AiProvider,
  ChatMessage,
  StreamHandle,
  StreamOptions,
} from './types';

/**
 * Map the app's `user`/`assistant` history onto Gemini `contents`. Gemini names
 * the model turn `model` (not `assistant`); each turn is a single text part.
 */
export function toGeminiContents(messages: ChatMessage[]): Content[] {
  return messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
}

/**
 * Stream a chat completion from the Gemini API directly from the browser. The
 * system prompt is passed as `systemInstruction`; aborting cancels the request
 * and breaks out of the streamed iteration.
 */
function streamChat(
  { apiKey, model, maxTokens, system, messages }: StreamOptions,
  onText: (delta: string) => void,
): StreamHandle {
  const ai = new GoogleGenAI({ apiKey });
  const controller = new AbortController();

  const done = (async () => {
    const stream = await ai.models.generateContentStream({
      model,
      contents: toGeminiContents(messages),
      config: {
        systemInstruction: system,
        maxOutputTokens: maxTokens,
        abortSignal: controller.signal,
      },
    });
    let text = '';
    for await (const chunk of stream) {
      if (controller.signal.aborted) break;
      const delta = chunk.text ?? '';
      if (delta) {
        text += delta;
        onText(delta);
      }
    }
    return text;
  })();

  return {
    done,
    abort: () => controller.abort(),
  };
}

function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401 || err.status === 403) {
      return 'Invalid API key — check it in AI settings.';
    }
    if (err.status === 429) {
      return 'Rate limited by the Gemini API — wait a moment and try again.';
    }
    return `Gemini API error ${err.status ?? ''}: ${err.message}`;
  }
  if (err instanceof Error && err.name === 'AbortError') {
    return 'Generation stopped.';
  }
  return err instanceof Error ? err.message : String(err);
}

export const geminiProvider: AiProvider = {
  id: 'gemini',
  label: 'Google (Gemini)',
  defaultModel: 'gemini-2.0-flash',
  apiKeyStorageKey: 'mbide.geminiApiKey',
  keyPlaceholder: 'AIza…',
  consoleUrl: 'https://aistudio.google.com/apikey',
  consoleLabel: 'aistudio.google.com',
  apiHost: 'generativelanguage.googleapis.com',
  streamChat,
  describeError,
};
