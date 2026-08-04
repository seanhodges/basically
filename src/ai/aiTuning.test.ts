import { beforeEach, describe, expect, it } from 'vitest';
import { resolveAiTuning } from './aiTuning';
import {
  DEFAULT_AI_EFFORT,
  DEFAULT_AI_MAX_TOKENS,
  setProviderEffort,
  setProviderMaxTokens,
} from '../storage/settings';

/** Minimal in-memory Storage for the node test environment. */
function memoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
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

describe('resolveAiTuning', () => {
  beforeEach(() => {
    globalThis.localStorage = memoryStorage();
  });

  it('gives the shared defaults when nothing is overridden', () => {
    expect(resolveAiTuning('anthropic')).toEqual({
      maxTokens: DEFAULT_AI_MAX_TOKENS,
      effort: DEFAULT_AI_EFFORT,
    });
  });

  it('prefers this provider’s override', () => {
    setProviderMaxTokens('anthropic', 32000);
    setProviderEffort('anthropic', 'max');
    expect(resolveAiTuning('anthropic')).toEqual({
      maxTokens: 32000,
      effort: 'max',
    });
  });

  // An inert setting is worse than none: it would be stored, shown as chosen, and
  // silently ignored. Backends without the control get no effort at all.
  it('omits effort for a backend that has no such control', () => {
    setProviderEffort('openai', 'max');
    expect(resolveAiTuning('openai')).toEqual({
      maxTokens: DEFAULT_AI_MAX_TOKENS,
    });
    expect(resolveAiTuning('openai').effort).toBeUndefined();
  });

  it('resolves each provider independently', () => {
    setProviderMaxTokens('anthropic', 32000);
    expect(resolveAiTuning('openai').maxTokens).toBe(DEFAULT_AI_MAX_TOKENS);
  });
});
