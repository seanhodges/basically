// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * One map: the machine's memory layout going out, its activity after it, and
 * nothing at all coming back.
 *
 * The counterpart of `src/server/view/feed.ts` and `src/server/play/channel.ts`,
 * and the differences are the differences between watching a screen, driving
 * one, and watching memory. It carries binary over the socket the play channel
 * already serves, because activity arrives as often as the machine paints and
 * is compressed before it gets here. It reads nothing: whoever holds a map's
 * address watches memory and can do nothing else, so a message arriving from
 * that end is somebody else's protocol and is ignored rather than parsed.
 *
 * The back-pressure rule is the other two projections', for a gentler reason.
 * A sample handed over while the last one has not been taken is dropped rather
 * than queued - but nothing is lost by that, because what the machine records
 * is everything it has touched since it was last drained, so the next sample
 * covers the skipped one's addresses as well as its own.
 *
 * Nothing here knows about sockets: a watcher is something that can be written
 * to and closed, which is what lets the whole channel be tested without binding
 * anything.
 *
 * ## What crosses the wire
 *
 * Private, and deliberately undocumented anywhere a watcher can see: the
 * contract with an embedding application is an address to put in a frame, not a
 * protocol. Each message is one byte of kind and then its body - a layout
 * carries JSON (the machine, its bands, and whether it can report what it
 * touches) or the text `null` when there is no machine, a sample carries its
 * cell width as a big-endian short and then the raw-deflated cells, and a state
 * carries its name as text. Nothing carries the value at an address: what a
 * machine records is which addresses were touched, and there is nothing else
 * here to send.
 */

import type { MapActivity } from '../../dialects/headless/activityTap';
import type { MapLayout, MapState } from './link';
import type { PlaySocket } from '../play/socket';

/** The kind byte every outgoing message starts with. */
const LAYOUT = 0x01;
const ACTIVITY = 0x02;
const STATE = 0x03;

export interface MapChannel {
  /**
   * Attach whoever is watching; they are sent the state, the layout and the
   * last sample at once. Returns the matching detach.
   */
  attach(socket: PlaySocket): () => void;
  /** Show this machine's layout, or say there is no machine to map. */
  show(layout: MapLayout | null): void;
  /** Show what the machine has touched. */
  push(activity: MapActivity): void;
  /** Say what the map is showing. */
  say(state: MapState): void;
  /** Whether a sample handed over now would be written rather than queued. */
  free(): boolean;
  /** How many are watching; the listener reports it, tests read it. */
  readonly watchers: number;
  /** End the map: every watcher is closed and nothing more is written. */
  end(): void;
}

/** One outgoing layout message. */
function layoutMessage(layout: MapLayout | null): Uint8Array {
  return Buffer.concat([
    Buffer.from([LAYOUT]),
    Buffer.from(JSON.stringify(layout), 'utf8'),
  ]);
}

/** One outgoing activity message. */
function activityMessage(activity: MapActivity): Uint8Array {
  const message = Buffer.alloc(3 + activity.cells.length);
  message[0] = ACTIVITY;
  message.writeUInt16BE(activity.addressesPerCell, 1);
  message.set(activity.cells, 3);
  return message;
}

/** One outgoing state message. */
function stateMessage(state: MapState): Uint8Array {
  return Buffer.concat([Buffer.from([STATE]), Buffer.from(state, 'utf8')]);
}

export function createMapChannel(): MapChannel {
  const watching = new Set<PlaySocket>();
  /**
   * The layout and the last sample, kept so somebody attaching is shown the
   * machine at once. A map is open from the moment its caller was given the
   * address, and whoever it hands that address to arrives later - to a machine
   * that may have been sitting at a prompt since.
   */
  let layout: Uint8Array | null = null;
  let latest: Uint8Array | null = null;
  let state: MapState = 'no-machine';
  let ended = false;
  // Watchers whose last write has not been taken yet; a sample handed over
  // while any of them is behind is dropped, and its addresses turn up in the
  // next one.
  let behind = 0;

  const writeTo = (socket: PlaySocket, message: Uint8Array): void => {
    if (socket.send(message)) return;
    behind++;
    socket.ondrain(() => {
      behind = Math.max(0, behind - 1);
    });
  };

  const broadcast = (message: Uint8Array): void => {
    for (const socket of watching) writeTo(socket, message);
  };

  return {
    attach(socket) {
      if (ended) {
        socket.close();
        return () => {};
      }
      watching.add(socket);
      // Whatever is true now: a watcher arriving between requests, or in the
      // middle of a long one, would otherwise face a blank page until the
      // machine next did something.
      writeTo(socket, stateMessage(state));
      if (layout) writeTo(socket, layout);
      if (latest) writeTo(socket, latest);
      return () => {
        watching.delete(socket);
      };
    },
    show(next) {
      if (ended) return;
      layout = layoutMessage(next);
      // A new machine's activity is not the old one's: a sample drawn over the
      // wrong layout would put one machine's accesses in another's regions.
      latest = null;
      broadcast(layout);
    },
    push(activity) {
      if (ended) return;
      latest = activityMessage(activity);
      broadcast(latest);
    },
    say(next) {
      if (ended || next === state) return;
      state = next;
      broadcast(stateMessage(state));
    },
    free: () => behind === 0,
    get watchers() {
      return watching.size;
    },
    end() {
      ended = true;
      layout = null;
      latest = null;
      for (const socket of watching) socket.close();
      watching.clear();
      behind = 0;
    },
  };
}
