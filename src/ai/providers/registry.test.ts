import { describe, expect, it } from 'vitest';
import { PROVIDERS, clampToProvider, getProvider } from './registry';
import { DEFAULT_AI_MAX_TOKENS } from '../../storage/settings';

describe('provider capabilities', () => {
  it('declares an output ceiling and effort support for every backend', () => {
    for (const p of PROVIDERS) {
      expect(p.maxOutputTokens).toBeGreaterThan(0);
      expect(typeof p.supportsEffort).toBe('boolean');
    }
  });

  // The budget is one app-wide number now, so the tightest backend decides what
  // that number may be. If a provider is ever added below the default, either the
  // default comes down or that provider silently truncates every long answer.
  it('accepts the default budget on every backend', () => {
    for (const p of PROVIDERS) {
      expect(p.maxOutputTokens).toBeGreaterThanOrEqual(DEFAULT_AI_MAX_TOKENS);
    }
  });

  it('only claims effort support where there is a control to use', () => {
    expect(getProvider('anthropic').supportsEffort).toBe(true);
    expect(getProvider('openai').supportsEffort).toBe(false);
    expect(getProvider('gemini').supportsEffort).toBe(false);
  });
});

describe('clampToProvider', () => {
  it('leaves a budget the provider accepts alone', () => {
    expect(clampToProvider('anthropic', 32_000)).toBe(32_000);
  });

  it('brings a too-large budget down instead of letting it be rejected', () => {
    const ceiling = getProvider('openai').maxOutputTokens;
    expect(clampToProvider('openai', ceiling + 50_000)).toBe(ceiling);
  });

  it('clamps per provider, not to one shared limit', () => {
    // The same request would be legal on one backend and not on another.
    const big = getProvider('openai').maxOutputTokens + 1;
    expect(clampToProvider('anthropic', big)).toBe(big);
    expect(clampToProvider('openai', big)).toBe(big - 1);
  });
});
