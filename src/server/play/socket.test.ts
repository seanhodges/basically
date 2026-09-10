import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import {
  acceptKey,
  encodeFrame,
  serveWebSocket,
  upgradeKeyOf,
  type PlaySocket,
} from './socket';

/**
 * A socket in both directions, without binding anything.
 *
 * The framing is the subject, and a pipe pair shows it exactly as a real
 * socket does; the listener that hands a real one over is proved where it is.
 */
function socketPair() {
  const fromClient = new PassThrough();
  const toClient = new PassThrough();
  const both = Object.create(fromClient, {
    write: { value: (chunk: Buffer | string) => toClient.write(chunk) },
    end: { value: () => toClient.end() },
  }) as PassThrough;
  let written = Buffer.alloc(0);
  toClient.on('data', (chunk: Buffer) => {
    written = Buffer.concat([written, chunk]);
  });
  return {
    both,
    fromClient,
    written: () => written,
    /** Frame a payload the way a client must: masked, with a fresh mask. */
    clientFrame(opcode: number, payload: Buffer, fin = true) {
      const mask = Buffer.from([1, 2, 3, 4]);
      const masked = Buffer.from(payload);
      for (let i = 0; i < masked.length; i++) masked[i]! ^= mask[i % 4]!;
      const head = Buffer.from([
        (fin ? 0x80 : 0) | opcode,
        0x80 | masked.length,
      ]);
      return Buffer.concat([head, mask, masked]);
    },
  };
}

const KEY = Buffer.alloc(16, 7).toString('base64');

function served(pair: ReturnType<typeof socketPair>) {
  const seen: { text: string; binary: boolean }[] = [];
  let closed = 0;
  const socket: PlaySocket = serveWebSocket(pair.both, KEY, {
    message: (payload, binary) =>
      seen.push({ text: payload.toString('utf8'), binary }),
    closed: () => closed++,
  });
  return { socket, seen, closed: () => closed };
}

describe('the socket a play channel is carried on', () => {
  it('answers the handshake with the key the protocol asks for', () => {
    // The accept key is the one value in the handshake that is not a
    // constant, and a browser that disagrees with it refuses the connection
    // with nothing to read but "incorrect hash". RFC 6455's own worked
    // example, so a wrong constant cannot pass here by agreeing with itself.
    expect(acceptKey('dGhlIHNhbXBsZSBub25jZQ==')).toBe(
      's3pPLMBiTxaQ9kYGzzhZRbK+xOo=',
    );
    const pair = socketPair();
    served(pair);
    const head = pair.written().toString('utf8');
    expect(head).toMatch(/^HTTP\/1\.1 101 Switching Protocols\r\n/);
    expect(head).toContain(`Sec-WebSocket-Accept: ${acceptKey(KEY)}`);
    expect(head).toContain('Referrer-Policy: no-referrer');
  });

  it('takes an upgrade only where it is well formed', () => {
    const good = {
      upgrade: 'WebSocket',
      'sec-websocket-key': KEY,
      'sec-websocket-version': '13',
    };
    expect(upgradeKeyOf(good)).toBe(KEY);
    expect(upgradeKeyOf({ ...good, upgrade: 'h2c' })).toBeNull();
    expect(upgradeKeyOf({ ...good, 'sec-websocket-version': '8' })).toBeNull();
    expect(upgradeKeyOf({ ...good, 'sec-websocket-key': 'short' })).toBeNull();
  });

  it('reads a masked message, whole or in fragments', async () => {
    const pair = socketPair();
    const end = served(pair);
    pair.fromClient.write(pair.clientFrame(0x1, Buffer.from('PRESS A')));
    pair.fromClient.write(pair.clientFrame(0x1, Buffer.from('PRE'), false));
    pair.fromClient.write(pair.clientFrame(0x0, Buffer.from('SS B')));
    await new Promise((r) => setTimeout(r, 10));
    expect(end.seen).toEqual([
      { text: 'PRESS A', binary: false },
      { text: 'PRESS B', binary: false },
    ]);
  });

  it('ends a connection whose frames are not masked', async () => {
    // Every frame a client sends is masked; one that is not is a protocol
    // error rather than something to read anyway.
    const pair = socketPair();
    const end = served(pair);
    pair.fromClient.write(encodeFrame(0x1, Buffer.from('unmasked')));
    await new Promise((r) => setTimeout(r, 10));
    expect(end.seen).toEqual([]);
    expect(end.closed()).toBe(1);
  });

  it('sends a frame as one binary message, unmasked', async () => {
    const pair = socketPair();
    const end = served(pair);
    const before = pair.written().length;
    expect(end.socket.send(Uint8Array.from([1, 2, 3]))).toBe(true);
    await new Promise((r) => setTimeout(r, 10));
    const frame = pair.written().subarray(before);
    // FIN set, binary opcode, no mask bit, then the bytes themselves.
    expect(frame[0]).toBe(0x82);
    expect(frame[1]).toBe(3);
    expect([...frame.subarray(2)]).toEqual([1, 2, 3]);
  });

  it('answers a ping and stands down on a close', async () => {
    const pair = socketPair();
    const end = served(pair);
    const before = pair.written().length;
    pair.fromClient.write(pair.clientFrame(0x9, Buffer.from('hi')));
    await new Promise((r) => setTimeout(r, 10));
    expect(pair.written().subarray(before)[0]).toBe(0x8a);
    pair.fromClient.write(pair.clientFrame(0x8, Buffer.alloc(0)));
    await new Promise((r) => setTimeout(r, 10));
    expect(end.closed()).toBe(1);
    expect(end.socket.send(Uint8Array.from([1]))).toBe(false);
  });
});
