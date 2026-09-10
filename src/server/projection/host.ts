// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The one part of the toolchain that is reachable at a network address, and
 * only while a caller has asked for it.
 *
 * Every other conversation the host serves goes over a Unix socket or a named
 * pipe, whose ownership the operating system decides - nobody names an address
 * and nobody presents a secret. A projection cannot work that way, because the
 * thing that shows it is a web page. So this is the exception, and its terms
 * are stated rather than left to be inferred:
 *
 * - **Nothing is bound until a projection is asked for**, and the listener
 *   stops as soon as the last one ends. A host nobody has asked anything of
 *   binds nothing at all.
 * - **The loopback interface only**, so nothing off this computer can reach it.
 * - **Possession of the address is the whole of admission.** It is unguessable,
 *   different for every projection, and never handed out twice. There is
 *   nothing else, and `openspec/specs/display-view` and
 *   `openspec/specs/machine-play` each say so plainly rather than implying
 *   depth that is not here.
 *
 * Two projections, and what an address admits is not the same in each. A view
 * mirrors: whoever holds its address watches and can do nothing. A play channel
 * drives: whoever holds its address types at the machine. That is a larger
 * claim about a longer string, and it is why the play page and the play
 * documentation state it in their own words rather than by reference to the
 * view's.
 *
 * A machine has one or the other and never both, which is settled here rather
 * than by whoever asks: opening one ends the other, and the caller is told
 * which happened. A view exists so a machine driven by requests can be watched
 * by somebody who is not driving it, and a machine being played is already
 * being seen by whoever is driving it - so a second projection of one display
 * would double what carrying it costs and serve nobody.
 *
 * Two things are defended specifically. A page anywhere on the internet can
 * point a request at a loopback address, so the `Host` header is checked and a
 * name that is not this listener's is refused - which is what stops DNS
 * rebinding turning a stranger's page into a viewer, or into a player. And the
 * address must not leak to the network of whatever embeds it, so no referrer is
 * sent.
 *
 * What cannot be defended is who may frame a projection: an application
 * embedding one from a page of its own is the entire point, so no framing
 * restriction is sent and none is relied upon.
 */

import { randomBytes } from 'node:crypto';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import type { Duplex } from 'node:stream';
import VIEW_PAGE from '../view/page.html?raw';
import PLAY_PAGE from '../play/page.html?raw';
import { createViewFeed, type ViewFeed } from '../view/feed';
import type { SessionView } from '../view/link';
import { createPlayChannel, type PlayChannel } from '../play/channel';
import type { SessionPlay } from '../play/link';
import { serveWebSocket, upgradeKeyOf } from '../play/socket';
import type { ProjectionHost, SessionProjection } from './link';
import type { PlayOpened, ViewOpened } from '../../ops/types';

export { noProjections } from './link';
export type { ProjectionHost, SessionProjection } from './link';

/** The interface a projection is bound to; nothing off this computer reaches it. */
const LOOPBACK = '127.0.0.1';

/**
 * Bytes of address. Long enough that guessing is not a strategy even against
 * something that can try as fast as the loopback interface allows.
 */
const TOKEN_BYTES = 24;

/** The names a request may call this listener by. */
function addressedHere(header: string | undefined, port: number): boolean {
  if (!header) return false;
  // A bracketed IPv6 literal keeps its brackets; everything else splits on the
  // last colon, which is the port.
  const at = header.lastIndexOf(':');
  const name = at > header.lastIndexOf(']') ? header.slice(0, at) : header;
  const named = at > header.lastIndexOf(']') ? header.slice(at + 1) : '';
  if (named !== String(port)) return false;
  return name === LOOPBACK || name === 'localhost' || name === '[::1]';
}

export interface ProjectionHostOptions {
  /** Something happened worth recording. */
  note?(message: string): void;
}

export function createProjectionHost(
  options: ProjectionHostOptions = {},
): ProjectionHost {
  const views = new Map<string, ViewFeed>();
  const plays = new Map<string, PlayChannel>();
  // Kept so an address is never handed to a second projection, and so one that
  // has ended is refused as pointedly as one that never existed.
  const retired = new Set<string>();
  let server: Server | null = null;
  let port = 0;
  let starting: Promise<number> | null = null;

  /** The headers every answer carries, whatever it is answering. */
  function head(response: ServerResponse, status: number, type: string): void {
    response.writeHead(status, {
      'content-type': type,
      // A projection is the machine now; nothing about it is worth keeping.
      'cache-control': 'no-store',
      // The address is the only thing protecting this projection, so it must
      // not travel to whatever the page embedding it reaches next.
      'referrer-policy': 'no-referrer',
      'x-content-type-options': 'nosniff',
      // Deliberately no cross-origin headers of any kind: a projection is read
      // by the page it is framed in, not fetched by scripts from elsewhere.
    });
  }

  function refuse(response: ServerResponse, status: number): void {
    head(response, status, 'text/plain; charset=utf-8');
    response.end('no\n');
  }

  /** A fresh address that has never been issued and never will be again. */
  function mint(): string {
    let fresh = randomBytes(TOKEN_BYTES).toString('base64url');
    while (views.has(fresh) || plays.has(fresh) || retired.has(fresh)) {
      fresh = randomBytes(TOKEN_BYTES).toString('base64url');
    }
    return fresh;
  }

  /** What a request is asking for, or null when it is asking for nothing. */
  function route(
    url: string,
  ): { kind: 'view' | 'play'; token: string; tail: string } | null {
    const path = url.split('?')[0] ?? '';
    const match = /^\/([vp])\/([A-Za-z0-9_-]+)\/([a-z]*)$/.exec(path);
    if (!match) return null;
    return {
      kind: match[1] === 'v' ? 'view' : 'play',
      token: match[2]!,
      tail: match[3]!,
    };
  }

  function serve(request: IncomingMessage, response: ServerResponse): void {
    // Whoever is shown a projection reads it and, where it is a play channel,
    // types on the socket it upgrades to. Neither is a request that writes, so
    // nothing but a read is answered at all.
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      refuse(response, 405);
      return;
    }
    if (!addressedHere(request.headers.host, port)) {
      refuse(response, 403);
      return;
    }
    const asked = route(request.url ?? '');
    // A retired token and one that never existed are answered identically:
    // there is nothing to learn here about which addresses have been issued.
    if (!asked) {
      refuse(response, 404);
      return;
    }
    if (asked.kind === 'play') {
      // The socket is reached by upgrading, which never arrives here.
      if (!plays.has(asked.token) || asked.tail !== '') {
        refuse(response, 404);
        return;
      }
      head(response, 200, 'text/html; charset=utf-8');
      response.end(request.method === 'HEAD' ? undefined : PLAY_PAGE);
      return;
    }
    const feed = views.get(asked.token);
    if (!feed || (asked.tail !== '' && asked.tail !== 'stream')) {
      refuse(response, 404);
      return;
    }
    if (asked.tail === '') {
      head(response, 200, 'text/html; charset=utf-8');
      response.end(request.method === 'HEAD' ? undefined : VIEW_PAGE);
      return;
    }
    head(response, 200, 'text/event-stream');
    // Nagle would hold a small frame back waiting for company; a view wants
    // each one as it is written.
    request.socket.setNoDelay(true);
    const stop = feed.watch({
      write: (chunk) => response.write(chunk),
      ondrain: (run) => response.once('drain', run),
      close: () => response.end(),
    });
    request.on('close', stop);
  }

  /**
   * A play channel's socket, reached by upgrading its address.
   *
   * Every check `serve` makes is made again here rather than assumed: an
   * upgrade arrives on its own event and never passes through the request
   * handler, so a check written only there would not be made at all.
   */
  function upgrade(request: IncomingMessage, socket: Duplex): void {
    const deny = () => {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      socket.destroy();
    };
    if (!addressedHere(request.headers.host, port)) return deny();
    const asked = route(request.url ?? '');
    if (!asked || asked.kind !== 'play' || asked.tail !== 'socket') {
      return deny();
    }
    const channel = plays.get(asked.token);
    if (!channel) return deny();
    const key = upgradeKeyOf(request.headers);
    if (!key) return deny();
    let detach: (() => void) | null = null;
    const player = serveWebSocket(socket, key, {
      message: (payload, binary) => channel.received(payload, binary),
      closed: () => detach?.(),
    });
    detach = channel.attach(player);
  }

  /** Bind, once, on the first projection anybody asks for. */
  async function listening(): Promise<number> {
    if (server) return port;
    starting ??= (async () => {
      const http = await import('node:http');
      const bound = http.createServer(serve);
      bound.on('upgrade', upgrade);
      await new Promise<void>((resolve, reject) => {
        bound.once('error', reject);
        bound.listen(0, LOOPBACK, () => {
          bound.removeAllListeners('error');
          bound.on('error', (error) => options.note?.(String(error)));
          resolve();
        });
      });
      const address = bound.address();
      if (address === null || typeof address === 'string') {
        bound.close();
        throw new Error('the projection listener bound no port');
      }
      server = bound;
      port = address.port;
      return port;
    })();
    try {
      return await starting;
    } finally {
      starting = null;
    }
  }

  /** Stop listening as soon as there is no projection left to serve. */
  async function stopIfSpent(): Promise<void> {
    if (views.size > 0 || plays.size > 0 || !server) return;
    const bound = server;
    server = null;
    port = 0;
    await new Promise<void>((resolve) => bound.close(() => resolve()));
  }

  return {
    forSession(): SessionProjection {
      let viewToken: string | null = null;
      let feed: ViewFeed | null = null;
      let playToken: string | null = null;
      let channel: PlayChannel | null = null;
      let pressed: ((key: string, down: boolean) => void) | null = null;
      const whenPlayEnds = new Set<() => void>();

      const at = (kind: 'v' | 'p', token: string) =>
        `http://${LOOPBACK}:${port}/${kind}/${token}/`;

      const endView = (): boolean => {
        if (!feed || viewToken === null) return false;
        views.delete(viewToken);
        retired.add(viewToken);
        feed.end();
        feed = null;
        viewToken = null;
        return true;
      };

      const endPlay = (): boolean => {
        if (!channel || playToken === null) return false;
        plays.delete(playToken);
        retired.add(playToken);
        channel.end();
        channel = null;
        playToken = null;
        pressed = null;
        for (const tell of whenPlayEnds) tell();
        return true;
      };

      const view: SessionView = {
        open: async (): Promise<ViewOpened> => {
          // One view per caller: a caller that has lost its address gets the
          // one it already has rather than a second projection of one machine.
          if (feed && viewToken) {
            return {
              address: at('v', viewToken),
              problem: null,
              already: true,
              endedPlay: false,
            };
          }
          try {
            await listening();
          } catch (error) {
            return {
              address: null,
              problem: `no view could be opened: ${
                error instanceof Error ? error.message : String(error)
              }`,
              already: false,
              endedPlay: false,
            };
          }
          const endedPlay = endPlay();
          const fresh = mint();
          viewToken = fresh;
          feed = createViewFeed();
          views.set(fresh, feed);
          return {
            address: at('v', fresh),
            problem: null,
            already: false,
            endedPlay,
          };
        },
        watching: () => feed !== null,
        free: () => feed?.free() ?? true,
        send: (frame) => feed?.push(frame),
        working: () => feed?.say('working'),
        settled: (held) => feed?.say(held === null ? 'no-machine' : 'idle'),
        end: async () => {
          endView();
          await stopIfSpent();
        },
      };

      const play: SessionPlay = {
        open: async (): Promise<PlayOpened> => {
          if (channel && playToken) {
            return {
              address: at('p', playToken),
              problem: null,
              already: true,
              endedView: false,
            };
          }
          try {
            await listening();
          } catch (error) {
            return {
              address: null,
              problem: `no play channel could be opened: ${
                error instanceof Error ? error.message : String(error)
              }`,
              already: false,
              endedView: false,
            };
          }
          const endedView = endView();
          const fresh = mint();
          playToken = fresh;
          channel = createPlayChannel();
          channel.onKey(({ key, down }) => pressed?.(key, down));
          plays.set(fresh, channel);
          return {
            address: at('p', fresh),
            problem: null,
            already: false,
            endedView,
          };
        },
        playing: () => channel !== null,
        free: () => channel?.free() ?? true,
        send: (frame) => channel?.push(frame),
        say: (state) => channel?.say(state),
        pressed: (press) => {
          pressed = press;
        },
        ended: (tell) => {
          whenPlayEnds.add(tell);
        },
        end: async () => {
          endPlay();
          await stopIfSpent();
        },
      };

      return {
        view,
        play,
        end: async () => {
          endView();
          endPlay();
          await stopIfSpent();
        },
      };
    },

    close: async () => {
      for (const [was, feed] of views) {
        retired.add(was);
        feed.end();
      }
      views.clear();
      for (const [was, channel] of plays) {
        retired.add(was);
        channel.end();
      }
      plays.clear();
      await stopIfSpent();
    },
  };
}
