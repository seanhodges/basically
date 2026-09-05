import { describe, expect, it } from 'vitest';
import {
  encodeFrame,
  FrameReader,
  isConversation,
  MAX_FRAME_BYTES,
} from './protocol';

/** Every message the reader yields from one buffer, pushed a byte at a time. */
function pushByByte(reader: FrameReader, bytes: Buffer): unknown[] {
  const out: unknown[] = [];
  for (const byte of bytes) out.push(...reader.push(Buffer.from([byte])));
  return out;
}

describe('framing a message', () => {
  it('round trips one message', () => {
    const message = { kind: 'hello', conversation: 'ops', buildId: 'abc' };
    expect(new FrameReader().push(encodeFrame(message))).toEqual([message]);
  });

  it('yields several that arrived in one chunk', () => {
    const frames = Buffer.concat([
      encodeFrame({ id: 1 }),
      encodeFrame({ id: 2 }),
      encodeFrame({ id: 3 }),
    ]);
    expect(new FrameReader().push(frames)).toEqual([
      { id: 1 },
      { id: 2 },
      { id: 3 },
    ]);
  });

  it('yields one that was split across every possible boundary', () => {
    const message = { kind: 'call', operation: 'lint', input: { source: 'x' } };
    expect(pushByByte(new FrameReader(), encodeFrame(message))).toEqual([
      message,
    ]);
  });

  it('yields nothing until a frame is whole', () => {
    const reader = new FrameReader();
    const frame = encodeFrame({ id: 1 });
    expect(reader.push(frame.subarray(0, frame.length - 1))).toEqual([]);
    expect(reader.push(frame.subarray(frame.length - 1))).toEqual([{ id: 1 }]);
  });

  it('counts bytes rather than characters, so text outside ASCII survives', () => {
    // A screen's text and a program's listing both carry these, and a reader
    // measuring in characters would cut the frame short.
    const message = { screen: '£ é ▓ 😀' };
    expect(pushByByte(new FrameReader(), encodeFrame(message))).toEqual([
      message,
    ]);
  });

  it('refuses a frame over the limit rather than buffering it', () => {
    const header = Buffer.from(
      `Content-Length: ${MAX_FRAME_BYTES + 1}\r\n\r\n`,
      'ascii',
    );
    expect(() => new FrameReader().push(header)).toThrow(/over the limit/);
  });

  it('refuses a header that never ends', () => {
    const reader = new FrameReader();
    expect(() => reader.push(Buffer.alloc(9000, 0x41))).toThrow(
      /before the header limit/,
    );
  });

  it('refuses a header with no length', () => {
    expect(() =>
      new FrameReader().push(Buffer.from('Content-Type: json\r\n\r\n', 'ascii')),
    ).toThrow(/no length/);
  });

  it('refuses a body that is not JSON', () => {
    const frame = Buffer.from('Content-Length: 3\r\n\r\nnot', 'ascii');
    expect(() => new FrameReader().push(frame)).toThrow(/not JSON/);
  });
});

describe('naming a conversation', () => {
  it('knows the three it serves', () => {
    expect(isConversation('ops')).toBe(true);
    expect(isConversation('lsp')).toBe(true);
    expect(isConversation('mcp')).toBe(true);
  });

  it('refuses anything else', () => {
    for (const value of ['', 'http', 'OPS', null, 42, undefined]) {
      expect(isConversation(value)).toBe(false);
    }
  });
});
