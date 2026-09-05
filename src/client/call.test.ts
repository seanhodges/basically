import { describe, expect, it, vi } from 'vitest';
import { encodeFrame, FrameReader } from '../server/protocol';
import type { Connection } from './connect';
import {
  EXIT_BAD_PROGRAM,
  EXIT_BAD_REQUEST,
  exitCodeFor,
  HostRefused,
  HostUnreachable,
  openClient,
} from './call';

/** A connection whose other end is this test. */
function link() {
  const listeners: { data?: (c: Buffer) => void; close?: () => void } = {};
  const reader = new FrameReader();
  const sent: Record<string, unknown>[] = [];
  const connection: Connection = {
    write: (bytes) => {
      for (const message of reader.push(bytes)) {
        sent.push(message as Record<string, unknown>);
      }
    },
    on: (event, listener) => {
      if (event === 'data') listeners.data = listener as (c: Buffer) => void;
      else listeners.close = listener as () => void;
    },
    end: vi.fn(),
    destroy: vi.fn(),
  };
  return {
    connection,
    sent,
    say: (message: unknown) => listeners.data?.(encodeFrame(message)),
    raw: (bytes: Buffer) => listeners.data?.(bytes),
    hangUp: () => listeners.close?.(),
  };
}

/** A client that has been welcomed, ready to be asked things. */
async function welcomed(over = link()) {
  const opening = openClient(over.connection, 'ops', 'build-1');
  over.say({ kind: 'welcome', serving: ['ops', 'lsp', 'mcp'] });
  return { link: over, client: await opening };
}

describe('opening a conversation', () => {
  it('says hello naming the conversation and the build', async () => {
    const { link: over } = await welcomed();
    expect(over.sent[0]).toEqual({
      kind: 'hello',
      conversation: 'ops',
      buildId: 'build-1',
    });
  });

  it('reports what the host said it serves', async () => {
    const { client } = await welcomed();
    expect(client.serving()).toEqual(['ops', 'lsp', 'mcp']);
  });

  it('is refused when the host does not serve this conversation, saying what it does', async () => {
    const over = link();
    const opening = openClient(over.connection, 'mcp', 'build-1');
    over.say({
      kind: 'refusal',
      reason: 'this host does not serve "mcp"',
      serving: ['ops'],
    });
    await expect(opening).rejects.toThrow(
      /does not serve "mcp"; it serves ops/,
    );
  });

  it('gives up rather than waiting forever for a handshake', async () => {
    const over = link();
    await expect(openClient(over.connection, 'ops', 'b', 5)).rejects.toThrow(
      /did not answer the handshake/,
    );
  });
});

describe('asking for an operation', () => {
  it('carries the outcome, the notes and whether it failed', async () => {
    const { link: over, client } = await welcomed();
    const asking = client.call('machines', {});
    over.say({
      kind: 'result',
      id: 1,
      outcome: { value: [{ id: 'zx81' }], notes: ['a note'], failed: false },
    });
    await expect(asking).resolves.toEqual({
      value: [{ id: 'zx81' }],
      notes: ['a note'],
      failed: false,
    });
  });

  it('matches each reply to its own request, in whatever order they arrive', async () => {
    const { link: over, client } = await welcomed();
    const first = client.call('machines', {});
    const second = client.call('info', { machine: 'zx81' });
    over.say({
      kind: 'result',
      id: 2,
      outcome: { value: 'second', notes: [], failed: false },
    });
    over.say({
      kind: 'result',
      id: 1,
      outcome: { value: 'first', notes: [], failed: false },
    });
    expect((await first).value).toBe('first');
    expect((await second).value).toBe('second');
  });

  it('raises a refusal carrying which failure the host reached', async () => {
    const { link: over, client } = await welcomed();
    const asking = client.call('run', {});
    over.say({
      kind: 'error',
      id: 1,
      failure: 'program',
      message: 'a fatal problem',
    });
    const error = await asking.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HostRefused);
    expect((error as HostRefused).failure).toBe('program');
  });

  it('gives up on a host that never answers', async () => {
    const over = link();
    const opening = openClient(over.connection, 'ops', 'b', 20);
    over.say({ kind: 'welcome', serving: ['ops'] });
    const client = await opening;
    await expect(client.call('machines', {})).rejects.toThrow(
      /did not answer within/,
    );
  });

  it('fails everything outstanding when the host goes away', async () => {
    const { link: over, client } = await welcomed();
    const asking = client.call('machines', {});
    over.hangUp();
    await expect(asking).rejects.toBeInstanceOf(HostUnreachable);
  });

  it('ends the connection whose framing it can no longer trust', async () => {
    const { link: over, client } = await welcomed();
    const asking = client.call('machines', {});
    over.raw(Buffer.from('Content-Type: nonsense\r\n\r\n', 'ascii'));
    await expect(asking).rejects.toBeInstanceOf(HostUnreachable);
    expect(over.connection.destroy).toHaveBeenCalled();
  });
});

describe('asking the host about itself', () => {
  it('reports what is served and what is held', async () => {
    const { link: over, client } = await welcomed();
    const asking = client.ask('status');
    over.say({ kind: 'host-result', id: 1, serving: ['ops'], holding: 'ZX81' });
    await expect(asking).resolves.toMatchObject({ holding: 'ZX81' });
  });

  it('reports that a stop was accepted', async () => {
    const { link: over, client } = await welcomed();
    const asking = client.ask('stop');
    over.say({ kind: 'host-result', id: 1, stopping: true });
    await expect(asking).resolves.toMatchObject({ stopping: true });
  });
});

describe('the verdict a caller reports', () => {
  it('reserves its own code for a program the host found at fault', () => {
    expect(exitCodeFor(new HostRefused('bad program', 'program'))).toBe(
      EXIT_BAD_PROGRAM,
    );
  });

  it('treats a refused request as the caller asking for something impossible', () => {
    expect(exitCodeFor(new HostRefused('no such machine', 'request'))).toBe(
      EXIT_BAD_REQUEST,
    );
  });

  it('never reports an unreachable host as a program being at fault', () => {
    // Nothing was ever asked about a program, so the code reserved for one
    // would be a lie a script could act on.
    expect(exitCodeFor(new HostUnreachable('nothing listening'))).toBe(
      EXIT_BAD_REQUEST,
    );
    expect(exitCodeFor(new Error('anything else'))).toBe(EXIT_BAD_REQUEST);
  });
});
