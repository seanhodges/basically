import { beforeEach, describe, expect, it } from 'vitest';
import {
  loadAiConversation,
  saveAiConversation,
  clearAiConversation,
  getAiProvider,
  setAiProvider,
  getProviderApiKey,
  setProviderApiKey,
  type PersistedMessage,
} from './settings';

const KEY = 'mbide.autosave.ai';

/** Minimal in-memory localStorage for the node test environment. */
function installLocalStorage() {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

describe('AI conversation persistence', () => {
  beforeEach(() => {
    installLocalStorage();
  });

  it('round-trips messages', () => {
    const messages: PersistedMessage[] = [
      { role: 'user', content: 'write breakout' },
      { role: 'assistant', content: '10 PRINT' },
    ];
    saveAiConversation(messages);
    expect(loadAiConversation()).toEqual(messages);
  });

  it('preserves the incomplete marker on a truncated answer', () => {
    const messages: PersistedMessage[] = [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'partial…', incomplete: true },
    ];
    saveAiConversation(messages);
    expect(loadAiConversation()).toEqual(messages);
  });

  it('returns [] when nothing is stored', () => {
    expect(loadAiConversation()).toEqual([]);
  });

  it('removes the key when saving an empty array', () => {
    saveAiConversation([{ role: 'user', content: 'x' }]);
    saveAiConversation([]);
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(loadAiConversation()).toEqual([]);
  });

  it('clearAiConversation removes the stored thread', () => {
    saveAiConversation([{ role: 'user', content: 'x' }]);
    clearAiConversation();
    expect(loadAiConversation()).toEqual([]);
  });

  it('returns [] for corrupt JSON', () => {
    localStorage.setItem(KEY, '{not json');
    expect(loadAiConversation()).toEqual([]);
  });

  it('returns [] for non-array JSON', () => {
    localStorage.setItem(KEY, '{"role":"user"}');
    expect(loadAiConversation()).toEqual([]);
  });
});

describe('AI provider settings', () => {
  beforeEach(() => {
    installLocalStorage();
  });

  it('defaults to anthropic and round-trips the selected provider', () => {
    expect(getAiProvider()).toBe('anthropic');
    setAiProvider('gemini');
    expect(getAiProvider()).toBe('gemini');
  });

  it('falls back to anthropic for an unknown stored provider', () => {
    localStorage.setItem('mbide.aiProvider', 'bogus');
    expect(getAiProvider()).toBe('anthropic');
  });

  it('persists each provider key independently', () => {
    setProviderApiKey('anthropic', 'sk-ant-1');
    setProviderApiKey('openai', 'sk-oai-2');
    setProviderApiKey('gemini', 'AIza-3');

    expect(getProviderApiKey('anthropic')).toBe('sk-ant-1');
    expect(getProviderApiKey('openai')).toBe('sk-oai-2');
    expect(getProviderApiKey('gemini')).toBe('AIza-3');
  });

  it('reuses the legacy anthropic key location', () => {
    setProviderApiKey('anthropic', 'sk-ant-legacy');
    expect(localStorage.getItem('mbide.anthropicApiKey')).toBe('sk-ant-legacy');
  });

  it('clearing a key removes it without touching others', () => {
    setProviderApiKey('openai', 'sk-oai');
    setProviderApiKey('gemini', 'AIza');
    setProviderApiKey('openai', '');
    expect(getProviderApiKey('openai')).toBe('');
    expect(getProviderApiKey('gemini')).toBe('AIza');
  });
});
