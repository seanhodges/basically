import { describe, expect, it } from 'vitest';
import { toOpenAiMessages } from './openai';
import type { ChatMessage } from './types';

describe('toOpenAiMessages', () => {
  it('leaves a thread with nothing shown exactly as it was', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'write breakout' },
      { role: 'assistant', content: '10 PRINT' },
    ];
    expect(toOpenAiMessages(messages)).toEqual(messages);
  });

  it('sends a shown screen as a data-URI image part ahead of the text', () => {
    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: 'why is the circle squashed?',
        image: { mediaType: 'image/png', base64: 'AAAA' },
      },
    ];
    expect(toOpenAiMessages(messages)).toEqual([
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: 'data:image/png;base64,AAAA' },
          },
          { type: 'text', text: 'why is the circle squashed?' },
        ],
      },
    ]);
  });

  it('sends a photographed listing as a JPEG data URI, not re-encoded', () => {
    const [mapped] = toOpenAiMessages([
      {
        role: 'user',
        content: 'type this in',
        image: { mediaType: 'image/jpeg', base64: 'CCCC' },
      },
    ]);
    expect(mapped!.content).toEqual([
      { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,CCCC' } },
      { type: 'text', text: 'type this in' },
    ]);
  });
});
