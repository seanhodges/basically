import { beforeEach, describe, expect, it } from 'vitest';
import {
  loadAiConversation,
  saveAiConversation,
  clearAiConversation,
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
