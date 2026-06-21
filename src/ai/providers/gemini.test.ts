import { describe, expect, it } from 'vitest';
import { toGeminiContents } from './gemini';
import type { ChatMessage } from './types';

describe('toGeminiContents', () => {
  it('maps the assistant role onto Gemini “model” and keeps user', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'write breakout' },
      { role: 'assistant', content: '10 PRINT' },
      { role: 'user', content: 'make it faster' },
    ];
    expect(toGeminiContents(messages)).toEqual([
      { role: 'user', parts: [{ text: 'write breakout' }] },
      { role: 'model', parts: [{ text: '10 PRINT' }] },
      { role: 'user', parts: [{ text: 'make it faster' }] },
    ]);
  });

  it('returns an empty array for no messages', () => {
    expect(toGeminiContents([])).toEqual([]);
  });
});
