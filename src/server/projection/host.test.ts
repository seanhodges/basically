import http from 'node:http';
import net from 'node:net';
import { deflateRawSync, inflateRawSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';
import { watchLifetime, type LifetimeClock } from '../lifetime';
import { createSessions } from '../sessions';
import { createProjectionHost } from './host';
import type { ProjectionHost } from './link';

/**
 * The one part of the toolchain that binds a network address.
 *
 * Everything here is about what is reachable and by whom, so it is checked
 * against a real listener over a real socket: a stand-in would be checking the
 * stand-in. The requests are made with `fetch`, which is what a web view makes
 * too, and the `Host` header is set by hand where the point is that it is
 * wrong.
 */

let host: ProjectionHost | null = null;

function serving(): ProjectionHost {
  host = createProjectionHost();
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
    const view = views.forSession().view;
    // A host is running and nobody has asked: there is nothing to reach,
    // which is checked by there being no address to try.
    expect(view.watching()).toBe(false);

    const { address } = await view.open();
    expect(address).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/v\/[\w-]+\/$/);
    expect(view.watching()).toBe(true);
  });

  it('serves the page and its stream to whoever holds the address', async () => {
    const views = serving();
    const view = views.forSession().view;
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
    const view = views.forSession().view;
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
    const view = views.forSession().view;
    const first = await view.open();
    const again = await view.open();
    expect(again.address).toBe(first.address);
    expect(again.already).toBe(true);
  });

  it('gives two callers different addresses, and neither the other', async () => {
    const views = serving();
    const one = await views.forSession().view.open();
    const other = await views.forSession().view.open();
    expect(one.address).not.toBe(other.address);
  });

  it('shows nothing at an address it was not given', async () => {
    const views = serving();
    const { address } = await views.forSession().view.open();
    const guess = new URL('/v/notatoken/', address!).toString();
    expect((await get(guess)).status).toBe(404);
  });

  it('shows nothing at an address whose view has ended, and never reissues it', async () => {
    const views = serving();
    const view = views.forSession().view;
    const { address } = await view.open();
    expect((await get(address!)).status).toBe(200);

    // Still listening, because a second caller is watching; what has ended is
    // this one's view.
    const other = views.forSession();
    await other.view.open();
    await view.end();

    expect((await get(address!)).status).toBe(404);
    const next = await views.forSession().view.open();
    expect(next.address).not.toBe(address);
  });

  it('refuses a request that calls the listener by another name', async () => {
    const views = serving();
    const { address } = await views.forSession().view.open();
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
    const { address } = await views.forSession().view.open();
    for (const method of ['POST', 'PUT', 'DELETE']) {
      expect((await get(address!, { method })).status, method).toBe(405);
    }
  });

  it('stops listening once the last view has ended', async () => {
    const views = serving();
    const view = views.forSession().view;
    const { address } = await view.open();
    await view.end();
    // Nothing is bound any more, so the connection itself is refused rather
    // than answered with a refusal.
    await expect(get(address!)).rejects.toThrow();
  });

  it('ends every view when the host stops', async () => {
    const views = serving();
    const { address } = await views.forSession().view.open();
    await views.close();
    await expect(get(address!)).rejects.toThrow();
  });

  it('does not keep a host alive: a view is not a caller', async () => {
    // What keeps a host alive is a caller connected to it. Somebody watching
    // is not one - it holds no machine and reaches no operation - so a host
    // whose callers have all gone still lets itself go, and the views go with
    // the sessions that owned them.
    const views = serving();
    const { address } = await views.forSession().view.open();
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

/** Open a socket onto a play channel and collect what it says. */
function playAt(address: string) {
  const socket = new WebSocket(`${address.replace(/^http/, 'ws')}socket`);
  socket.binaryType = 'arraybuffer';
  const frames: { width: number; height: number; pixels: Uint8Array }[] = [];
  const states: string[] = [];
  socket.addEventListener('message', (message) => {
    const bytes = new Uint8Array(message.data as ArrayBuffer);
    if (bytes[0] === 0x01) {
      const head = new DataView(message.data as ArrayBuffer, 1, 4);
      frames.push({
        width: head.getUint16(0),
        height: head.getUint16(2),
        pixels: bytes.subarray(5),
      });
      return;
    }
    if (bytes[0] === 0x02) {
      states.push(new TextDecoder().decode(bytes.subarray(1)));
    }
  });
  return {
    socket,
    frames,
    states,
    open: () =>
      new Promise<void>((resolve, reject) => {
        socket.addEventListener('open', () => resolve());
        socket.addEventListener('error', () => reject(new Error('refused')));
      }),
    type: (key: string, down: boolean) =>
      socket.send(JSON.stringify({ key, down })),
    close: () => socket.close(),
  };
}

/** Poll for what a socket has been sent; nothing here is worth a fixed wait. */
async function until(ready: () => boolean, why: string): Promise<void> {
  for (let waited = 0; waited < 5000; waited += 10) {
    if (ready()) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error(why);
}

/** A raw upgrade request, so the `Host` header can be written by hand. */
function upgradeCalling(address: string, called: string): Promise<string> {
  const url = new URL(address);
  return new Promise((resolve, reject) => {
    const socket = net.connect(Number(url.port), url.hostname, () => {
      socket.write(
        `GET ${url.pathname}socket HTTP/1.1\r\n` +
          `Host: ${called}\r\n` +
          'Upgrade: websocket\r\nConnection: Upgrade\r\n' +
          `Sec-WebSocket-Key: ${Buffer.alloc(16, 3).toString('base64')}\r\n` +
          'Sec-WebSocket-Version: 13\r\n\r\n',
      );
    });
    let seen = '';
    socket.on('data', (chunk: Buffer) => {
      seen += chunk.toString('utf8');
      if (seen.includes('\r\n\r\n')) {
        socket.destroy();
        resolve(seen);
      }
    });
    socket.on('close', () => resolve(seen));
    socket.on('error', reject);
  });
}

describe('a play channel onto a held machine', () => {
  it('binds nothing until a caller asks for one', async () => {
    const host = serving();
    const play = host.forSession().play;
    expect(play.playing()).toBe(false);
    const { address } = await play.open();
    expect(address).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/p\/[\w-]+\/$/);
    expect(play.playing()).toBe(true);
    expect((await get(address!)).status).toBe(200);
  });

  it('hands one caller the same channel twice rather than opening a second', async () => {
    const host = serving();
    const play = host.forSession().play;
    const first = await play.open();
    const again = await play.open();
    expect(again.address).toBe(first.address);
    expect(again.already).toBe(true);
  });

  it('shows nothing at an address it was not given, or at one that has ended', async () => {
    const host = serving();
    const session = host.forSession();
    const { address } = await session.play.open();
    // Still listening, because a second caller is playing; what has ended is
    // this one's channel.
    const other = host.forSession();
    await other.play.open();

    const guessed = address!.replace(/\/p\/[\w-]+\//, '/p/notatoken/');
    expect((await get(guessed)).status).toBe(404);
    await expect(playAt(guessed).open()).rejects.toThrow();

    await session.play.end();
    expect((await get(address!)).status).toBe(404);
    await expect(playAt(address!).open()).rejects.toThrow();
    const next = await host.forSession().play.open();
    expect(next.address).not.toBe(address);
  });

  it('refuses an upgrade that calls the listener by another name', async () => {
    // A page anywhere on the internet can point a socket at a loopback
    // address; the name it calls this listener by is what gives it away, and
    // an upgrade never passes through the request handler that checks it.
    const host = serving();
    const { address } = await host.forSession().play.open();
    const answer = await upgradeCalling(address!, 'somewhere.example');
    expect(answer).toMatch(/^HTTP\/1\.1 403/);
  });

  it("carries the machine's picture out and a key back in", async () => {
    const host = serving();
    const session = host.forSession();
    const pressed: string[] = [];
    session.play.pressed((key, down) =>
      pressed.push(`${down ? '+' : '-'}${key}`),
    );
    const { address } = await session.play.open();

    const player = playAt(address!);
    await player.open();
    // Attaching is answered at once with whatever the channel is showing,
    // which is how a player arriving at a machine that is not up is not left
    // facing a blank page.
    await until(() => player.states.length > 0, 'nobody attached');
    expect(player.states).toEqual(['no-machine']);
    session.play.say('playing');
    session.play.send({
      width: 2,
      height: 1,
      pixels: deflateRawSync(Buffer.from([1, 2, 3, 4, 5, 6, 7, 8])),
    });
    await until(() => player.frames.length > 0, 'no frame arrived');
    expect(player.states).toContain('playing');
    const frame = player.frames[0]!;
    expect([frame.width, frame.height]).toEqual([2, 1]);
    expect([...inflateRawSync(Buffer.from(frame.pixels))]).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);

    player.type('A', true);
    player.type('A', false);
    await until(() => pressed.length === 2, 'no key reached the machine');
    expect(pressed).toEqual(['+A', '-A']);
    player.close();
  });
});

/** Open a socket onto a map and collect what it says. */
function mapAt(address: string) {
  const socket = new WebSocket(`${address.replace(/^http/, 'ws')}socket`);
  socket.binaryType = 'arraybuffer';
  const layouts: unknown[] = [];
  const samples: { addressesPerCell: number; cells: Uint8Array }[] = [];
  const states: string[] = [];
  socket.addEventListener('message', (message) => {
    const bytes = new Uint8Array(message.data as ArrayBuffer);
    if (bytes[0] === 0x01) {
      layouts.push(JSON.parse(new TextDecoder().decode(bytes.subarray(1))));
      return;
    }
    if (bytes[0] === 0x02) {
      const head = new DataView(message.data as ArrayBuffer, 1, 2);
      samples.push({
        addressesPerCell: head.getUint16(0),
        cells: inflateRawSync(Buffer.from(bytes.subarray(3))),
      });
      return;
    }
    if (bytes[0] === 0x03) {
      states.push(new TextDecoder().decode(bytes.subarray(1)));
    }
  });
  return {
    socket,
    layouts,
    samples,
    states,
    open: () =>
      new Promise<void>((resolve, reject) => {
        socket.addEventListener('open', () => resolve());
        socket.addEventListener('error', () => reject(new Error('refused')));
      }),
    close: () => socket.close(),
  };
}

const A_LAYOUT = {
  machine: 'ZX81',
  addressSpace: 0x10000,
  addressUnit: 'byte' as const,
  bands: [{ label: 'ROM', kind: 'rom' as const, start: 0, end: 0x1fff }],
  reports: true,
};

describe('a map of a held machine’s memory', () => {
  it('binds nothing until a caller asks for one', async () => {
    const maps = serving();
    const map = maps.forSession().map;
    expect(map.watching()).toBe(false);

    const { address } = await map.open();
    expect(address).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/m\/[\w-]+\/$/);
    expect(map.watching()).toBe(true);
  });

  it('serves the page to whoever holds the address', async () => {
    const maps = serving();
    const { address } = await maps.forSession().map.open();
    const page = await get(address!);
    expect(page.status).toBe(200);
    expect(page.headers.get('content-type')).toContain('text/html');
    expect(page.headers.get('referrer-policy')).toBe('no-referrer');
    expect(await page.text()).toContain('<canvas id="bands">');
  });

  it('hands one caller the same map twice rather than opening a second', async () => {
    const maps = serving();
    const map = maps.forSession().map;
    const first = await map.open();
    const again = await map.open();
    expect(again.address).toBe(first.address);
    expect(again.already).toBe(true);
  });

  it('shows nothing at an address it was not given, or at one that has ended', async () => {
    const maps = serving();
    const session = maps.forSession();
    const { address } = await session.map.open();
    const elsewhere = address!.replace(/\/m\/[^/]+\//, '/m/nothingwasgiven/');
    expect((await get(elsewhere)).status).toBe(404);

    // A second map keeps the listener up, so the first address can be tried
    // after its own map has gone.
    const other = await maps.forSession().map.open();
    await session.map.end();
    expect((await get(address!)).status).toBe(404);
    // Told apart from an address that never existed by nothing at all, which
    // is the point: they are the same answer.
    expect((await get(elsewhere)).status).toBe(404);
    expect((await get(other.address!)).status).toBe(200);
  });

  it('refuses a request that calls the listener by another name', async () => {
    const maps = serving();
    const { address } = await maps.forSession().map.open();
    // A page anywhere can point a request at a loopback address; what stops it
    // being answered is the name it called this listener by.
    expect(await withHost(address!, 'memory.example.com')).toBe(403);
    expect(await withHost(address!, `127.0.0.1:${portOf(address!)}`)).toBe(200);
  });

  it('refuses an upgrade that calls the listener by another name', async () => {
    const maps = serving();
    const { address } = await maps.forSession().map.open();
    expect(await upgradeCalling(address!, 'memory.example.com')).toContain(
      '403',
    );
  });

  it('refuses anything but a read: a watcher receives and never sends', async () => {
    const maps = serving();
    const { address } = await maps.forSession().map.open();
    expect((await get(address!, { method: 'POST' })).status).toBe(405);
  });

  it('carries the layout and the activity out, and takes nothing back in', async () => {
    const maps = serving();
    const session = maps.forSession();
    const { address } = await session.map.open();
    session.map.show(A_LAYOUT);
    session.map.settled('ZX81');

    const watching = mapAt(address!);
    await watching.open();
    await until(
      () => watching.layouts.length > 0,
      'the map never carried a layout',
    );
    session.map.send({
      addressesPerCell: 16,
      cells: deflateRawSync(Buffer.from([1, 2, 0, 3])),
    });
    await until(
      () => watching.samples.length > 0,
      'the map never carried a sample',
    );
    expect(watching.layouts[0]).toEqual(A_LAYOUT);
    expect(watching.samples[0]!.addressesPerCell).toBe(16);
    expect([...watching.samples[0]!.cells]).toEqual([1, 2, 0, 3]);
    expect(watching.states).toContain('idle');

    // Whoever holds the address can send; nothing is done with it, and the
    // map goes on carrying what it was carrying.
    watching.socket.send(JSON.stringify({ key: 'A', down: true }));
    session.map.send({
      addressesPerCell: 16,
      cells: deflateRawSync(Buffer.from([4])),
    });
    await until(
      () => watching.samples.length > 1,
      'the map stopped carrying samples',
    );
    watching.close();
  });

  it('stops listening once the last projection has ended', async () => {
    const maps = serving();
    const map = maps.forSession().map;
    const { address } = await map.open();
    await map.end();
    await expect(get(address!)).rejects.toThrow();
  });
});

describe('a machine is projected one way or the other', () => {
  it('ends the view when the same machine is asked to be played, and says so', async () => {
    const host = serving();
    const session = host.forSession();
    const view = await session.view.open();
    const play = await session.play.open();
    expect(play.endedView).toBe(true);
    expect(session.view.watching()).toBe(false);
    // The ended projection's address admits nothing, on the same terms as any
    // address whose projection has ended.
    expect((await get(view.address!)).status).toBe(404);
  });

  it('ends the play channel when the same machine is asked to be viewed, and says so', async () => {
    const host = serving();
    const session = host.forSession();
    const play = await session.play.open();
    const view = await session.view.open();
    expect(view.endedPlay).toBe(true);
    expect(session.play.playing()).toBe(false);
    expect((await get(play.address!)).status).toBe(404);
    await expect(playAt(play.address!).open()).rejects.toThrow();
  });

  it('leaves a map exactly as it was, and is left exactly as it was by one', async () => {
    // The exclusion is about the display, and a map is not one: it stands
    // outside the pair rather than becoming a third arm of the same choice.
    const host = serving();
    const session = host.forSession();
    const map = await session.map.open();
    const view = await session.view.open();
    expect(view.endedPlay).toBe(false);
    expect(session.map.watching()).toBe(true);
    expect((await get(map.address!)).status).toBe(200);

    const play = await session.play.open();
    expect(play.endedView).toBe(true);
    expect(session.map.watching()).toBe(true);
    expect((await get(map.address!)).status).toBe(200);

    // And asking for the map while the machine is being played ends nothing.
    const again = await session.map.open();
    expect(again.address).toBe(map.address);
    expect(session.play.playing()).toBe(true);
    expect((await get(play.address!)).status).toBe(200);
  });
});
