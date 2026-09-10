import http from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { watchLifetime, type LifetimeClock } from '../lifetime';
import { createSessions } from '../sessions';
import { createViewHost, type ViewHost } from './host';

/**
 * The one part of the toolchain that binds a network address.
 *
 * Everything here is about what is reachable and by whom, so it is checked
 * against a real listener over a real socket: a stand-in would be checking the
 * stand-in. The requests are made with `fetch`, which is what a web view makes
 * too, and the `Host` header is set by hand where the point is that it is
 * wrong.
 */

let host: ViewHost | null = null;

function serving(): ViewHost {
  host = createViewHost();
  return host;
}

afterEach(async () => {
  await host?.close();
  host = null;
});

/** The port an address was issued on, for aiming a request at it by hand. */
const portOf = (address: string) => new URL(address).port;

async function get(address: string, init: RequestInit = {}): Promise<Response> {
  return await fetch(address, { redirect: 'manual', ...init });
}

/**
 * One request with the `Host` header written by hand.
 *
 * `fetch` will not set it - it is a forbidden header there - and the header is
 * the whole point of the rebinding check, so this goes through node's own
 * client, which is also what a browser aimed at a loopback address is.
 */
function withHost(address: string, called: string): Promise<number> {
  const url = new URL(address);
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        host: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'GET',
        headers: { host: called },
      },
      (response) => {
        response.resume();
        resolve(response.statusCode ?? 0);
      },
    );
    request.on('error', reject);
    request.end();
  });
}

describe('a view of a held machine', () => {
  it('binds nothing until a caller asks for one', async () => {
    const views = serving();
    const view = views.forSession();
    // A host is running and nobody has asked: there is nothing to reach,
    // which is checked by there being no address to try.
    expect(view.watching()).toBe(false);

    const { address } = await view.open();
    expect(address).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/v\/[\w-]+\/$/);
    expect(view.watching()).toBe(true);
  });

  it('serves the page and its stream to whoever holds the address', async () => {
    const views = serving();
    const view = views.forSession();
    const { address } = await view.open();

    const page = await get(address!);
    expect(page.status).toBe(200);
    expect(page.headers.get('content-type')).toContain('text/html');
    // The address is the only thing protecting a view, so it must not travel
    // on to whatever the embedding page reaches next.
    expect(page.headers.get('referrer-policy')).toBe('no-referrer');
    // Nothing invites a fetch from anywhere else.
    expect(page.headers.get('access-control-allow-origin')).toBeNull();
    expect(await page.text()).toContain('EventSource');
  });

  it('carries the picture and the state to a viewer as events', async () => {
    const views = serving();
    const view = views.forSession();
    const { address } = await view.open();

    const stream = await get(new URL('stream', address!).toString());
    expect(stream.status).toBe(200);
    expect(stream.headers.get('content-type')).toContain('text/event-stream');

    const reader = stream.body!.getReader();
    const decoder = new TextDecoder();
    let seen = '';
    const until = (has: string) =>
      (async () => {
        while (!seen.includes(has)) {
          const { value, done } = await reader.read();
          if (done) break;
          seen += decoder.decode(value, { stream: true });
        }
      })();

    // What is true the moment the viewer arrives: no machine has run.
    await until('"no-machine"');

    view.settled('ZX81');
    view.working();
    view.send({ width: 2, height: 1, png: new Uint8Array([9, 9]) });
    await until('CQk=');
    expect(seen).toContain('"working"');
    expect(seen).toContain('event: frame');

    await reader.cancel();
  }, 20_000);

  it('hands one caller the same view twice rather than opening a second', async () => {
    const views = serving();
    const view = views.forSession();
    const first = await view.open();
    const again = await view.open();
    expect(again.address).toBe(first.address);
    expect(again.already).toBe(true);
  });

  it('gives two callers different addresses, and neither the other', async () => {
    const views = serving();
    const one = await views.forSession().open();
    const other = await views.forSession().open();
    expect(one.address).not.toBe(other.address);
  });

  it('shows nothing at an address it was not given', async () => {
    const views = serving();
    const { address } = await views.forSession().open();
    const guess = new URL('/v/notatoken/', address!).toString();
    expect((await get(guess)).status).toBe(404);
  });

  it('shows nothing at an address whose view has ended, and never reissues it', async () => {
    const views = serving();
    const view = views.forSession();
    const { address } = await view.open();
    expect((await get(address!)).status).toBe(200);

    // Still listening, because a second caller is watching; what has ended is
    // this one's view.
    const other = views.forSession();
    await other.open();
    await view.end();

    expect((await get(address!)).status).toBe(404);
    const next = await views.forSession().open();
    expect(next.address).not.toBe(address);
  });

  it('refuses a request that calls the listener by another name', async () => {
    const views = serving();
    const { address } = await views.forSession().open();
    // A page anywhere on the internet can point a request at a loopback
    // address; what it cannot do is make the browser call it 127.0.0.1.
    const port = portOf(address!);
    expect(await withHost(address!, `attacker.example:${port}`)).toBe(403);
    // The right name at the wrong port is no better: it is not this listener.
    expect(await withHost(address!, 'localhost:1')).toBe(403);
    // And the two spellings a browser really uses are admitted.
    expect(await withHost(address!, `localhost:${port}`)).toBe(200);
    expect(await withHost(address!, `127.0.0.1:${port}`)).toBe(200);
  });

  it('refuses anything but a read: a viewer receives a picture and nothing else', async () => {
    const views = serving();
    const { address } = await views.forSession().open();
    for (const method of ['POST', 'PUT', 'DELETE']) {
      expect((await get(address!, { method })).status, method).toBe(405);
    }
  });

  it('stops listening once the last view has ended', async () => {
    const views = serving();
    const view = views.forSession();
    const { address } = await view.open();
    await view.end();
    // Nothing is bound any more, so the connection itself is refused rather
    // than answered with a refusal.
    await expect(get(address!)).rejects.toThrow();
  });

  it('ends every view when the host stops', async () => {
    const views = serving();
    const { address } = await views.forSession().open();
    await views.close();
    await expect(get(address!)).rejects.toThrow();
  });

  it('does not keep a host alive: a view is not a caller', async () => {
    // What keeps a host alive is a caller connected to it. Somebody watching
    // is not one - it holds no machine and reaches no operation - so a host
    // whose callers have all gone still lets itself go, and the views go with
    // the sessions that owned them.
    const views = serving();
    const { address } = await views.forSession().open();
    expect((await get(address!)).status).toBe(200);

    let fired: (() => void) | null = null;
    const clock: LifetimeClock = {
      setTimeout: (fn) => {
        fired = fn;
        return 1;
      },
      clearTimeout: () => {},
    };
    const sessions = createSessions(() => {
      throw new Error('no machine is needed here');
    }, views);
    const life = watchLifetime(
      { connected: () => 0, shutdown: () => sessions.closeAll() },
      1000,
      clock,
    );
    expect(life).toBeTruthy();
    fired!();
    // The shutdown is asynchronous; the view is gone once it has settled.
    await sessions.closeAll();
    await expect(get(address!)).rejects.toThrow();
  });
});
