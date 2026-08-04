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

  it('states whether each backend can be given tools', () => {
    // Stated rather than discovered, for the same reason as images: what the
    // assistant is told it can do is settled while the system prompt is built,
    // long before any vendor SDK is loaded to ask.
    for (const p of PROVIDERS) {
      expect(typeof p.supportsTools).toBe('boolean');
    }
  });

  it('only claims tool support where the backend actually wires them', () => {
    expect(getProvider('anthropic').supportsTools).toBe(true);
    // Both SDKs are capable; neither backend passes tools through yet. An
    // untested yes here would have the assistant asked to do something that is
    // then silently dropped, which is the failure the flag exists to prevent.
    expect(getProvider('openai').supportsTools).toBe(false);
    expect(getProvider('gemini').supportsTools).toBe(false);
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
