// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * One play channel: the machine's picture going out, and keys coming back.
 *
 * The counterpart of `src/server/view/feed.ts`, and the differences between
 * them are the differences between watching and playing. A view is written as
 * text because its frames are occasional and its traffic is one-way; this
 * carries binary because it takes every frame the machine draws, and it reads
 * as well as writes because somebody is typing.
 *
 * The back-pressure rule is the view's, and for the view's reason: a frame
 * handed over while the last one has not been taken is dropped rather than
 * queued, so what a player sees is the machine's present rather than an
 * accumulating past. What is dropped here is never noticed - the next frame is
 * twenty milliseconds away.
 *
 * Nothing here knows about sockets: a player is something that can be written
 * to and closed, which is what lets the whole channel be tested without binding
 * anything.
 *
 * ## What crosses the wire
 *
 * Private, and deliberately undocumented anywhere a player can see: the
 * contract with an embedding application is an address to put in a frame, not
 * a protocol. Out, each message is one byte of kind and then its body - a frame
 * carries its width and height as two big-endian shorts and then the display's
 * raw-deflated pixels, and a state carries its name as text. In, a message is
 * JSON naming a key and whether it went down.
 */

import type { PlayFrame } from './frames';
import type { PlayState } from './link';
import type { PlaySocket } from './socket';

/** The kind byte every outgoing message starts with. */
const FRAME = 0x01;
const STATE = 0x02;

/** A key pressed at the far end, once it has been read off the wire. */
export interface PlayKey {
  /** The key's name in the vocabulary a schedule uses. */
  key: string;
  /** True as it goes down, false as it comes up. */
  down: boolean;
}

export interface PlayChannel {
  /**
   * Attach whoever is playing; they are sent the state at once. Returns the
   * matching detach.
   */
  attach(socket: PlaySocket): () => void;
  /** Show this frame. */
  push(frame: PlayFrame): void;
  /** Say what the channel is showing. */
  say(state: PlayState): void;
  /** Whether a frame handed over now would be written rather than queued. */
  free(): boolean;
  /** How many are playing; the listener reports it, tests read it. */
  readonly players: number;
  /** What to do with a key pressed at the far end. */
  onKey(press: (key: PlayKey) => void): void;
  /**
   * A message has arrived from a player. Called by whoever attached the
   * socket, so the reading of the wire and the channel's own lifetime stay one
   * thing rather than two that have to agree about when it ended.
   */
  received(payload: Buffer, binary: boolean): void;
  /** End the channel: whoever is playing is closed and nothing more is written. */
  end(): void;
}

/** One outgoing frame message. */
function frameMessage(frame: PlayFrame): Uint8Array {
  const message = Buffer.alloc(5 + frame.pixels.length);
  message[0] = FRAME;
  message.writeUInt16BE(frame.width, 1);
  message.writeUInt16BE(frame.height, 3);
  message.set(frame.pixels, 5);
  return message;
}

/** One outgoing state message. */
function stateMessage(state: PlayState): Uint8Array {
  return Buffer.concat([Buffer.from([STATE]), Buffer.from(state, 'utf8')]);
}

/** A key message from the far end, or null when it is not one. */
function keyOf(payload: Buffer): PlayKey | null {
  let value: unknown;
  try {
    value = JSON.parse(payload.toString('utf8'));
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const { key, down } = value as { key?: unknown; down?: unknown };
  if (typeof key !== 'string' || typeof down !== 'boolean') return null;
  // A name is a key name, not a sentence: anything longer is not something
  // this machine has a key for and is refused before it reaches the machine.
  if (key.length === 0 || key.length > 32) return null;
  return { key, down };
}

export function createPlayChannel(): PlayChannel {
  const playing = new Set<PlaySocket>();
  /**
   * The last frame sent, kept so somebody attaching is shown the machine at
   * once. A channel is open from the moment its caller was given the address,
   * and whoever it hands that address to arrives later - to a machine that may
   * be sitting at a prompt drawing the same picture for the rest of the
   * evening, every frame of which is skipped for being the last one over again.
   */
  let latest: Uint8Array | null = null;
  let state: PlayState = 'no-machine';
  let ended = false;
  let press: ((key: PlayKey) => void) | null = null;
  // Players whose last write has not been taken yet; a frame handed over while
  // any of them is behind is dropped rather than queued.
  let behind = 0;

  const writeTo = (socket: PlaySocket, message: Uint8Array): void => {
    if (socket.send(message)) return;
    behind++;
    socket.ondrain(() => {
      behind = Math.max(0, behind - 1);
    });
  };

  const broadcast = (message: Uint8Array): void => {
    for (const socket of playing) writeTo(socket, message);
  };

  return {
    attach(socket) {
      if (ended) {
        socket.close();
        return () => {};
      }
      playing.add(socket);
      // Whatever is true now: a player attaching to a machine that is not up,
      // or to one drawing an unchanging screen, would otherwise face a blank
      // page until something happened.
      writeTo(socket, stateMessage(state));
      if (latest) writeTo(socket, latest);
      return () => {
        playing.delete(socket);
      };
    },
    push(frame) {
      if (ended) return;
      latest = frameMessage(frame);
      broadcast(latest);
    },
    say(next) {
      if (ended || next === state) return;
      state = next;
      // The picture of a machine that has gone is not the machine: a player
      // told there is none must not be left looking at one.
      if (next === 'no-machine') latest = null;
      broadcast(stateMessage(state));
    },
    free: () => behind === 0,
    get players() {
      return playing.size;
    },
    onKey(handler) {
      press = handler;
    },
    received(payload, binary) {
      // Keys are text; nothing a player sends is framed as binary, so a binary
      // message is somebody else's protocol and is ignored rather than parsed.
      if (ended || binary) return;
      const key = keyOf(payload);
      if (key) press?.(key);
    },
    end() {
      ended = true;
      latest = null;
      for (const socket of playing) socket.close();
      playing.clear();
      behind = 0;
      press = null;
    },
  };
}
