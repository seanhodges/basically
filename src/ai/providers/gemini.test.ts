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

  it('sends a shown screen as an inline image part ahead of the text', () => {
    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: 'why is the circle squashed?',
        image: { mediaType: 'image/png', base64: 'AAAA' },
      },
    ];
    expect(toGeminiContents(messages)).toEqual([
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'image/png', data: 'AAAA' } },
          { text: 'why is the circle squashed?' },
        ],
      },
    ]);
  });

  it('sends a photographed listing as a JPEG, not re-encoded', () => {
    const [mapped] = toGeminiContents([
      {
        role: 'user',
        content: 'type this in',
        image: { mediaType: 'image/jpeg', base64: 'CCCC' },
      },
    ]);
    expect(mapped!.parts).toEqual([
      { inlineData: { mimeType: 'image/jpeg', data: 'CCCC' } },
      { text: 'type this in' },
    ]);
  });
});
