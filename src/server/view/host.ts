// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The one part of the toolchain that is reachable at a network address, and
 * only while a caller has asked for it.
 *
 * Every other conversation the host serves goes over a Unix socket or a named
 * pipe, whose ownership the operating system decides - nobody names an address
 * and nobody presents a secret. A view cannot work that way, because the thing
 * that shows it is a web page. So this is the exception, and its terms are
 * stated rather than left to be inferred:
 *
 * - **Nothing is bound until a view is asked for**, and the listener stops as
 *   soon as the last view ends. A host nobody has asked a view from binds
 *   nothing at all.
 * - **The loopback interface only**, so nothing off this computer can reach it.
 * - **Possession of the address is the whole of admission.** It is unguessable,
 *   different for every view, and never handed out twice. There is nothing
 *   else, and `openspec/specs/display-view` says so plainly rather than
 *   implying depth that is not here.
 *
 * Two things are defended specifically. A page anywhere on the internet can
 * point a request at a loopback address, so the `Host` header is checked and a
 * name that is not this listener's is refused - which is what stops DNS
 * rebinding turning a stranger's page into a viewer. And the address must not
 * leak to the network of whatever embeds the view, so no referrer is sent.
 *
 * What cannot be defended is who may frame a view: an application embedding
 * one from a page of its own is the entire point, so no framing restriction is
 * sent and none is relied upon.
 */

import { randomBytes } from 'node:crypto';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import PAGE from './page.html?raw';
import { createViewFeed, type ViewFeed } from './feed';
import { noViews, type SessionView } from './link';
import type { ViewOpened } from '../../ops/types';

/** The interface a view is bound to; nothing off this computer reaches it. */
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

export interface ViewHost {
  /** A view channel for one caller. Binds nothing until the caller asks. */
  forSession(): SessionView;
  /** Stop listening; every view ends. */
  close(): Promise<void>;
}

export { noViews };

export interface ViewHostOptions {
  /** Something happened worth recording. */
  note?(message: string): void;
}

export function createViewHost(options: ViewHostOptions = {}): ViewHost {
  const open = new Map<string, ViewFeed>();
  // Kept so that an address is never handed to a second view, and so that one
  // that has ended is refused as pointedly as one that never existed.
  const retired = new Set<string>();
  let server: Server | null = null;
  let port = 0;
  let starting: Promise<number> | null = null;

  /** The headers every answer carries, whatever it is answering. */
  function head(response: ServerResponse, status: number, type: string): void {
    response.writeHead(status, {
      'content-type': type,
      // A view is the machine now; nothing about it is worth keeping.
      'cache-control': 'no-store',
      // The address is the only thing protecting this view, so it must not
      // travel to whatever the page embedding it reaches next.
      'referrer-policy': 'no-referrer',
      'x-content-type-options': 'nosniff',
      // Deliberately no cross-origin headers of any kind: a view is read by
      // the page it is framed in, not fetched by scripts from elsewhere.
    });
  }

  function refuse(response: ServerResponse, status: number): void {
    head(response, status, 'text/plain; charset=utf-8');
    response.end('no\n');
  }

  /** The feed a request is asking for, or null if it is asking for nothing. */
  function route(url: string): { feed: ViewFeed; stream: boolean } | null {
    const path = url.split('?')[0] ?? '';
    const match = /^\/v\/([A-Za-z0-9_-]+)\/(stream)?$/.exec(path);
    if (!match) return null;
    const feed = open.get(match[1]!);
    // A retired token and one that never existed are answered identically:
    // there is nothing to learn here about which addresses have been issued.
    if (!feed) return null;
    return { feed, stream: match[2] === 'stream' };
  }

  function serve(request: IncomingMessage, response: ServerResponse): void {
    // A viewer receives a picture and can do nothing else, so nothing but a
    // read is answered at all.
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      refuse(response, 405);
      return;
    }
    if (!addressedHere(request.headers.host, port)) {
      refuse(response, 403);
      return;
    }
    const asked = route(request.url ?? '');
    if (!asked) {
      refuse(response, 404);
      return;
    }
    if (!asked.stream) {
      head(response, 200, 'text/html; charset=utf-8');
      response.end(request.method === 'HEAD' ? undefined : PAGE);
      return;
    }
    head(response, 200, 'text/event-stream');
    // Nagle would hold a small frame back waiting for company; a view wants
    // each one as it is written.
    request.socket.setNoDelay(true);
    const stop = asked.feed.watch({
      write: (chunk) => response.write(chunk),
      ondrain: (run) => response.once('drain', run),
      close: () => response.end(),
    });
    request.on('close', stop);
  }

  /** Bind, once, on the first view anybody asks for. */
  async function listening(): Promise<number> {
    if (server) return port;
    starting ??= (async () => {
      const http = await import('node:http');
      const bound = http.createServer(serve);
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
        throw new Error('the view listener bound no port');
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

  /** Stop listening as soon as there is no view left to serve. */
  async function stopIfSpent(): Promise<void> {
    if (open.size > 0 || !server) return;
    const bound = server;
    server = null;
    port = 0;
    await new Promise<void>((resolve) => bound.close(() => resolve()));
  }

  return {
    forSession(): SessionView {
      let token: string | null = null;
      let feed: ViewFeed | null = null;

      const address = (of: string) => `http://${LOOPBACK}:${port}/v/${of}/`;

      return {
        open: async (): Promise<ViewOpened> => {
          // One view per caller: a caller that has lost its address gets the
          // one it already has rather than a second projection of one machine.
          if (feed && token) {
            return { address: address(token), problem: null, already: true };
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
            };
          }
          let fresh = randomBytes(TOKEN_BYTES).toString('base64url');
          while (open.has(fresh) || retired.has(fresh)) {
            fresh = randomBytes(TOKEN_BYTES).toString('base64url');
          }
          token = fresh;
          feed = createViewFeed();
          open.set(fresh, feed);
          return { address: address(fresh), problem: null, already: false };
        },
        watching: () => feed !== null,
        free: () => feed?.free() ?? true,
        send: (frame) => feed?.push(frame),
        working: () => feed?.say('working'),
        settled: (held) => feed?.say(held === null ? 'no-machine' : 'idle'),
        end: async () => {
          const ending = feed;
          const was = token;
          feed = null;
          token = null;
          if (was !== null) {
            open.delete(was);
            retired.add(was);
          }
          ending?.end();
          await stopIfSpent();
        },
      };
    },

    close: async () => {
      for (const [was, feed] of open) {
        retired.add(was);
        feed.end();
      }
      open.clear();
      await stopIfSpent();
    },
  };
}
