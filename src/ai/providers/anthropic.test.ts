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

  it('sends a photographed listing as a JPEG, not re-encoded', () => {
    const [mapped] = toAnthropicMessages([
      {
        role: 'user',
        content: 'type this in',
        image: { mediaType: 'image/jpeg', base64: 'CCCC' },
      },
    ]);
    expect(mapped!.content).toEqual([
      {
        type: 'image',
        source: { type: 'base64', media_type: 'image/jpeg', data: 'CCCC' },
      },
      { type: 'text', text: 'type this in' },
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

  it('sends tool calls as blocks, after any text the reply led with', () => {
    const mapped = toAnthropicMessages([
      {
        role: 'assistant',
        content: 'let me look at the screen',
        toolCalls: [{ id: 'tu_1', name: 'look', input: { as: 'text' } }],
      },
    ]);
    expect(mapped[0]).toEqual({
      role: 'assistant',
      content: [
        { type: 'text', text: 'let me look at the screen' },
        { type: 'tool_use', id: 'tu_1', name: 'look', input: { as: 'text' } },
      ],
    });
  });

  it('omits the text block when the reply called without narrating', () => {
    const mapped = toAnthropicMessages([
      {
        role: 'assistant',
        content: '',
        toolCalls: [{ id: 'tu_1', name: 'look', input: {} }],
      },
    ]);
    // An empty text block is not the same as no text block, and the API is
    // entitled to reject one.
    expect(mapped[0]!.content).toEqual([
      { type: 'tool_use', id: 'tu_1', name: 'look', input: {} },
    ]);
  });

  it('names the call each result answers, so the two cannot drift apart', () => {
    const mapped = toAnthropicMessages([
      {
        role: 'user',
        content: '',
        toolResults: [
          { callId: 'tu_1', content: 'READY' },
          { callId: 'tu_2', content: 'no such key', isError: true },
        ],
      },
    ]);
    expect(mapped[0]!.content).toEqual([
      { type: 'tool_result', tool_use_id: 'tu_1', content: 'READY' },
      {
        type: 'tool_result',
        tool_use_id: 'tu_2',
        content: 'no such key',
        is_error: true,
      },
    ]);
  });

  it('leaves an ordinary thread alone now that tools exist', () => {
    // The regression that would matter most: every conversation already stored
    // must map byte-for-byte as it did, or its cached prefix is worthless.
    const messages: ChatMessage[] = [
      { role: 'user', content: 'write breakout' },
      { role: 'assistant', content: '10 PRINT' },
    ];
    expect(toAnthropicMessages(messages)).toEqual([
      { role: 'user', content: 'write breakout' },
      { role: 'assistant', content: '10 PRINT' },
    ]);
  });
});
