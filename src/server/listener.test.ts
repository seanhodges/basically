import { PassThrough, type Duplex } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { CallRefused } from './ops';
import { encodeFrame, FrameReader, type Conversation } from './protocol';
import { serveConnection, type HostServices } from './listener';

/**
 * A connection with both ends in reach: `client` is what a caller writes to and
 * reads from, `served` is what the host is given.
 */
function connected() {
  const toHost = new PassThrough();
  const toClient = new PassThrough();
  // A duplex whose reads come from the client and whose writes go to it.
  const pair: Duplex = Object.create(toHost, {
    write: { value: (chunk: Buffer) => toClient.write(chunk) },
    end: { value: () => toClient.end() },
    destroy: { value: () => toClient.end() },
    writableEnded: { get: () => toClient.writableEnded },
  }) as Duplex;

  const reader = new FrameReader();
  const received: unknown[] = [];
  toClient.on('data', (chunk: Buffer) => received.push(...reader.push(chunk)));

  return {
    connection: pair,
    say: (message: unknown) => toHost.write(encodeFrame(message)),
    /** Everything the host has written back so far. */
    heard: async () => {
      await new Promise((r) => setImmediate(r));
      return received;
    },
  };
}

function services(over: Partial<HostServices> = {}): HostServices {
  return {
    serving: ['ops', 'lsp', 'mcp'] as Conversation[],
    sessions: {
      open: () => ({
        id: 1,
        call: (operation: string) =>
          Promise.resolve({ outcome: { operation }, notes: [], failed: false }),
        held: () => Promise.resolve('ZX81'),
        release: () => Promise.resolve(),
        close: () => Promise.resolve(),
      }),
      openCount: 0,
      closeAll: () => Promise.resolve(),
    },
    serveEditor: () => {},
    serveAgent: () => {},
    stop: () => {},
    ...over,
  };
}

describe('routing a connection', () => {
  it('welcomes a caller asking for a conversation it serves', async () => {
    const link = connected();
    serveConnection(link.connection, services());
    link.say({ kind: 'hello', conversation: 'ops', buildId: 'x' });
    expect(await link.heard()).toEqual([
      { kind: 'welcome', serving: ['ops', 'lsp', 'mcp'] },
    ]);
  });

  it('hands an editor connection to the editor server, whole', async () => {
    const serveEditor = vi.fn();
    const link = connected();
    serveConnection(link.connection, services({ serveEditor }));
    link.say({ kind: 'hello', conversation: 'lsp', buildId: 'x' });
    await link.heard();
    expect(serveEditor).toHaveBeenCalledWith(link.connection);
  });

  it('hands an agent connection to the agent server, whole', async () => {
    const serveAgent = vi.fn();
    const link = connected();
    serveConnection(link.connection, services({ serveAgent }));
    link.say({ kind: 'hello', conversation: 'mcp', buildId: 'x' });
    await link.heard();
    expect(serveAgent).toHaveBeenCalledWith(link.connection);
  });

  it('refuses a conversation this host was not started for, naming what it serves', async () => {
    const serveEditor = vi.fn();
    const link = connected();
    serveConnection(
      link.connection,
      services({ serving: ['ops'] as Conversation[], serveEditor }),
    );
    link.say({ kind: 'hello', conversation: 'lsp', buildId: 'x' });
    expect(await link.heard()).toEqual([
      {
        kind: 'refusal',
        reason: 'this host does not serve "lsp"',
        serving: ['ops'],
      },
    ]);
    expect(serveEditor).not.toHaveBeenCalled();
  });

  it('refuses a conversation that does not exist at all', async () => {
    const link = connected();
    serveConnection(link.connection, services());
    link.say({ kind: 'hello', conversation: 'gopher', buildId: 'x' });
    const heard = (await link.heard()) as { kind: string; reason: string }[];
    expect(heard[0].kind).toBe('refusal');
    expect(heard[0].reason).toMatch(/no conversation called "gopher"/);
  });

  it('answers a call once the conversation has been named', async () => {
    const link = connected();
    serveConnection(link.connection, services());
    link.say({ kind: 'hello', conversation: 'ops', buildId: 'x' });
    link.say({ kind: 'call', id: 7, operation: 'machines', input: {} });
    const heard = await link.heard();
    expect(heard[1]).toEqual({
      kind: 'result',
      id: 7,
      outcome: { value: { operation: 'machines' }, notes: [], failed: false },
    });
  });

  it('carries a refusal back with which failure it was', async () => {
    const link = connected();
    serveConnection(
      link.connection,
      services({
        sessions: {
          ...services().sessions,
          open: () => ({
            id: 1,
            call: () => Promise.reject(new CallRefused('nope', 'program')),
            held: () => Promise.resolve(null),
            release: () => Promise.resolve(),
            close: () => Promise.resolve(),
          }),
        },
      }),
    );
    link.say({ kind: 'hello', conversation: 'ops', buildId: 'x' });
    link.say({ kind: 'call', id: 1, operation: 'run', input: {} });
    const heard = await link.heard();
    expect(heard[1]).toEqual({
      kind: 'error',
      id: 1,
      failure: 'program',
      message: 'nope',
    });
  });

  it('answers rather than dying when an operation has a bug in it', async () => {
    const note = vi.fn();
    const link = connected();
    serveConnection(
      link.connection,
      services({
        note,
        sessions: {
          ...services().sessions,
          open: () => ({
            id: 1,
            call: () => Promise.reject(new TypeError('a bug')),
            held: () => Promise.resolve(null),
            release: () => Promise.resolve(),
            close: () => Promise.resolve(),
          }),
        },
      }),
    );
    link.say({ kind: 'hello', conversation: 'ops', buildId: 'x' });
    link.say({ kind: 'call', id: 1, operation: 'run', input: {} });
    const heard = (await link.heard()) as { kind: string }[];
    expect(heard[1].kind).toBe('error');
    expect(note).toHaveBeenCalled();
  });

  it('reports what is served and what is held', async () => {
    const link = connected();
    serveConnection(link.connection, services());
    link.say({ kind: 'hello', conversation: 'ops', buildId: 'x' });
    link.say({ kind: 'host', id: 2, action: 'status' });
    const heard = await link.heard();
    expect(heard[1]).toEqual({
      kind: 'host-result',
      id: 2,
      serving: ['ops', 'lsp', 'mcp'],
      holding: 'ZX81',
    });
  });

  it('answers that it is stopping before it stops', async () => {
    const stop = vi.fn();
    const link = connected();
    serveConnection(link.connection, services({ stop }));
    link.say({ kind: 'hello', conversation: 'ops', buildId: 'x' });
    link.say({ kind: 'host', id: 3, action: 'stop' });
    const heard = await link.heard();
    expect(heard[1]).toEqual({ kind: 'host-result', id: 3, stopping: true });
    expect(stop).toHaveBeenCalled();
  });

  it('refuses a request that arrives before the conversation is named', async () => {
    const note = vi.fn();
    const link = connected();
    serveConnection(link.connection, services({ note }));
    link.say({ kind: 'call', id: 1, operation: 'machines', input: {} });
    await link.heard();
    expect(note).toHaveBeenCalledWith(
      'a caller sent a request before saying which conversation it is',
    );
  });

  it('refuses a second hello on one connection', async () => {
    const note = vi.fn();
    const link = connected();
    serveConnection(link.connection, services({ note }));
    link.say({ kind: 'hello', conversation: 'ops', buildId: 'x' });
    link.say({ kind: 'hello', conversation: 'ops', buildId: 'x' });
    await link.heard();
    expect(note).toHaveBeenCalledWith('a caller said hello twice on one connection');
  });

  it('ends a connection whose framing it can no longer trust', async () => {
    const note = vi.fn();
    const link = connected();
    serveConnection(link.connection, services({ note }));
    link.say({ kind: 'hello', conversation: 'ops', buildId: 'x' });
    (link.connection as unknown as { emit(e: string, c: Buffer): void }).emit(
      'data',
      Buffer.from('Content-Type: nonsense\r\n\r\n', 'ascii'),
    );
    await link.heard();
    expect(note).toHaveBeenCalledWith(expect.stringMatching(/no length/));
  });

  it('lets the caller machine go when the connection closes', async () => {
    const close = vi.fn(() => Promise.resolve());
    const link = connected();
    serveConnection(
      link.connection,
      services({
        sessions: {
          ...services().sessions,
          open: () => ({
            id: 1,
            call: () => Promise.resolve({ outcome: null, notes: [], failed: false }),
            held: () => Promise.resolve(null),
            release: () => Promise.resolve(),
            close,
          }),
        },
      }),
    );
    link.say({ kind: 'hello', conversation: 'ops', buildId: 'x' });
    await link.heard();
    link.connection.emit('close');
    expect(close).toHaveBeenCalled();
  });
});
