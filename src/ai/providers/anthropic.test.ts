import { describe, expect, it } from 'vitest';
import { toAnthropicMessages } from './anthropic';
import type { ChatMessage } from './types';

describe('toAnthropicMessages', () => {
  it('leaves a thread with nothing shown exactly as it was', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'write breakout' },
      { role: 'assistant', content: '10 PRINT' },
    ];
    // Plain string content, not a one-element block array: the cached prefix
    // has to stay byte-identical to what it was before images existed.
    expect(toAnthropicMessages(messages)).toEqual(messages);
  });

  it('sends a shown screen as an image block ahead of the text', () => {
    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: 'why is the circle squashed?',
        image: { mediaType: 'image/png', base64: 'AAAA' },
      },
    ];
    expect(toAnthropicMessages(messages)).toEqual([
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data: 'AAAA' },
          },
          { type: 'text', text: 'why is the circle squashed?' },
        ],
      },
    ]);
  });

  it('keeps an image on its own turn, leaving the rest of the thread alone', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'write breakout' },
      { role: 'assistant', content: '10 PRINT' },
      {
        role: 'user',
        content: 'this is what it draws',
        image: { mediaType: 'image/png', base64: 'BBBB' },
      },
    ];
    const mapped = toAnthropicMessages(messages);
    expect(mapped[0]).toEqual({ role: 'user', content: 'write breakout' });
    expect(mapped[1]).toEqual({ role: 'assistant', content: '10 PRINT' });
    expect(Array.isArray(mapped[2]!.content)).toBe(true);
  });
});
