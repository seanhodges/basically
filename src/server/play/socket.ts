// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The WebSocket a play channel is carried on, written against `node:http`'s
 * upgrade rather than taken from a library.
 *
 * A play channel needs bytes going both ways at the machine's rate: frames out
 * fifty times a second, and keys in as they are pressed. The view's carriage is
 * Server-Sent Events, which is text - every frame would pay base64 on top of
 * its compression - and it carries nothing back, so keys would need a second
 * path whose ordering against the frames they caused is defined nowhere.
 *
 * The published toolchain has one runtime dependency and that is deliberate, so
 * the handshake and the framing are here: about two hundred lines, every one of
 * them decided by RFC 6455 rather than by us, over `node:crypto` and a socket.
 *
 * Only the part a server needs is implemented, and what is left out is left out
 * on purpose:
 *
 * - **Client frames must be masked**, which the specification requires of every
 *   one of them; an unmasked frame is a protocol error and the connection ends
 *   rather than tolerating it.
 * - **Server frames are never masked**, which the specification requires of
 *   every one of them.
 * - **No extensions and no subprotocol are negotiated.** The frames are
 *   compressed by the time they reach here, so permessage-deflate would spend
 *   time compressing what is already compressed.
 * - **A client message is capped**, because the only thing a client sends is a
 *   key press. Anything larger is somebody else's traffic or somebody's
 *   experiment, and either way the connection ends.
 */

import { createHash } from 'node:crypto';
import type { Duplex } from 'node:stream';

/**
 * The fixed string the protocol appends to a client's key before hashing it.
 * RFC 6455 section 4.2.2; it is the same for every WebSocket ever opened.
 */
const ACCEPT_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

/** Frame opcodes; the ones a server has to know. */
const CONTINUATION = 0x0;
const TEXT = 0x1;
const BINARY = 0x2;
const CLOSE = 0x8;
const PING = 0x9;
const PONG = 0xa;

/**
 * The largest message a client may send.
 *
 * Whoever is playing sends key presses, which are a few dozen bytes. A
 * kilobyte is generous for that and small enough that nothing can be
 * accumulated here on the strength of a length field alone.
 */
const MAX_CLIENT_MESSAGE = 1024;

/** Close codes this end sends. */
const CLOSE_GOING_AWAY = 1001;
const CLOSE_PROTOCOL_ERROR = 1002;
const CLOSE_TOO_BIG = 1009;

/** The answer to a client's `Sec-WebSocket-Key`. */
export function acceptKey(key: string): string {
  return createHash('sha1')
    .update(key + ACCEPT_GUID)
    .digest('base64');
}

/**
 * Whether the headers are a well-formed upgrade to a WebSocket.
 *
 * Checked rather than assumed: this socket has been handed over by the HTTP
 * server and nothing after this point speaks HTTP, so a request that is not
 * actually an upgrade must be refused here or it is never refused at all.
 */
export function upgradeKeyOf(headers: {
  upgrade?: string;
  'sec-websocket-key'?: string;
  'sec-websocket-version'?: string;
}): string | null {
  if ((headers.upgrade ?? '').toLowerCase() !== 'websocket') return null;
  if ((headers['sec-websocket-version'] ?? '') !== '13') return null;
  const key = headers['sec-websocket-key'];
  // 16 bytes base64: the specification's own length, and the only check worth
  // making on a value whose whole job is to come back hashed.
  if (!key || Buffer.from(key, 'base64').length !== 16) return null;
  return key;
}

/** One message from whoever is playing. */
export interface PlaySocketHandlers {
  /** A whole message; `binary` says which kind it was framed as. */
  message(payload: Buffer, binary: boolean): void;
  /** The socket has gone, however it went. */
  closed(): void;
}

/** The end of a play channel that writes. */
export interface PlaySocket {
  /** Send one binary message. False means the far end is not keeping up. */
  send(payload: Uint8Array): boolean;
  /** Run this once the far end has caught up. */
  ondrain(run: () => void): void;
  /** Say goodbye and end the socket. */
  close(): void;
}

/** Frame a payload as this end sends it: never masked, never fragmented. */
export function encodeFrame(opcode: number, payload: Uint8Array): Uint8Array {
  const length = payload.length;
  const header =
    length < 126
      ? Buffer.from([0x80 | opcode, length])
      : length <= 0xffff
        ? Buffer.from([0x80 | opcode, 126, length >> 8, length & 0xff])
        : (() => {
            const head = Buffer.alloc(10);
            head[0] = 0x80 | opcode;
            head[1] = 127;
            // A length above 2^32 cannot occur here - it would be a frame
            // larger than any display - so the high word is written as zero.
            head.writeUInt32BE(0, 2);
            head.writeUInt32BE(length, 6);
            return head;
          })();
  return Buffer.concat([header, payload]);
}

/** A close frame carrying its code, which is two bytes of payload. */
function closeFrame(code: number): Uint8Array {
  const body = Buffer.alloc(2);
  body.writeUInt16BE(code, 0);
  return encodeFrame(CLOSE, body);
}

/**
 * Take over a socket the HTTP server has upgraded, and read frames off it.
 *
 * The handshake response is written here; from this point the socket carries no
 * HTTP at all.
 */
export function serveWebSocket(
  socket: Duplex,
  key: string,
  handlers: PlaySocketHandlers,
): PlaySocket {
  let ended = false;
  let buffer = Buffer.alloc(0);
  /** A fragmented message being assembled, and what it was started as. */
  let assembling: { binary: boolean; parts: Buffer[]; length: number } | null =
    null;

  const finish = (): void => {
    if (ended) return;
    ended = true;
    handlers.closed();
    socket.end();
  };

  const fail = (code: number): void => {
    if (!ended) socket.write(closeFrame(code));
    finish();
  };

  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${acceptKey(key)}\r\n` +
      // The address is the only thing protecting this channel, so it must not
      // travel to whatever the page embedding it reaches next.
      'Referrer-Policy: no-referrer\r\n\r\n',
  );
  // Nagle would hold a small frame back waiting for company; a played machine
  // wants each one as it is written.
  if ('setNoDelay' in socket) {
    (socket as unknown as { setNoDelay(on: boolean): void }).setNoDelay(true);
  }

  /** Read whole frames out of `buffer`; false means wait for more bytes. */
  const readFrame = (): boolean => {
    if (buffer.length < 2) return false;
    const first = buffer[0]!;
    const second = buffer[1]!;
    const fin = (first & 0x80) !== 0;
    const opcode = first & 0x0f;
    const masked = (second & 0x80) !== 0;
    let length = second & 0x7f;
    let at = 2;
    if (length === 126) {
      if (buffer.length < at + 2) return false;
      length = buffer.readUInt16BE(at);
      at += 2;
    } else if (length === 127) {
      if (buffer.length < at + 8) return false;
      // Read as two words: a length that needs the high one is far past the
      // cap below, and reading it as a float would lose precision.
      if (buffer.readUInt32BE(at) !== 0) {
        fail(CLOSE_TOO_BIG);
        return false;
      }
      length = buffer.readUInt32BE(at + 4);
      at += 8;
    }
    // Every frame a client sends is masked; one that is not is a protocol
    // error rather than something to read anyway.
    if (!masked) {
      fail(CLOSE_PROTOCOL_ERROR);
      return false;
    }
    if (length > MAX_CLIENT_MESSAGE) {
      fail(CLOSE_TOO_BIG);
      return false;
    }
    if (buffer.length < at + 4 + length) return false;
    const mask = buffer.subarray(at, at + 4);
    at += 4;
    const payload = Buffer.from(buffer.subarray(at, at + length));
    for (let i = 0; i < payload.length; i++) payload[i]! ^= mask[i % 4]!;
    buffer = buffer.subarray(at + length);

    switch (opcode) {
      case CLOSE:
        fail(CLOSE_GOING_AWAY);
        return false;
      case PING:
        socket.write(encodeFrame(PONG, payload));
        return true;
      case PONG:
        return true;
      case CONTINUATION: {
        if (!assembling) {
          fail(CLOSE_PROTOCOL_ERROR);
          return false;
        }
        assembling.parts.push(payload);
        assembling.length += payload.length;
        if (assembling.length > MAX_CLIENT_MESSAGE) {
          fail(CLOSE_TOO_BIG);
          return false;
        }
        if (!fin) return true;
        const whole = assembling;
        assembling = null;
        handlers.message(Buffer.concat(whole.parts), whole.binary);
        return true;
      }
      case TEXT:
      case BINARY: {
        if (assembling) {
          fail(CLOSE_PROTOCOL_ERROR);
          return false;
        }
        if (!fin) {
          assembling = {
            binary: opcode === BINARY,
            parts: [payload],
            length: payload.length,
          };
          return true;
        }
        handlers.message(payload, opcode === BINARY);
        return true;
      }
      default:
        fail(CLOSE_PROTOCOL_ERROR);
        return false;
    }
  };

  socket.on('data', (chunk: Buffer) => {
    if (ended) return;
    buffer =
      buffer.length === 0 ? Buffer.from(chunk) : Buffer.concat([buffer, chunk]);
    while (!ended && readFrame());
  });
  socket.on('close', finish);
  socket.on('end', finish);
  socket.on('error', finish);

  return {
    send: (payload) =>
      ended ? false : socket.write(encodeFrame(BINARY, payload)),
    ondrain: (run) => socket.once('drain', run),
    close: () => {
      if (!ended) socket.write(closeFrame(CLOSE_GOING_AWAY));
      finish();
    },
  };
}
