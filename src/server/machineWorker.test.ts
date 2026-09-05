import { MessageChannel, Worker } from 'node:worker_threads';
import { describe, expect, it } from 'vitest';
import { CallRefused } from './ops';
import {
  createInProcessHolder,
  createWorkerHolder,
  serveMachineWorker,
  type MessageChannelLike,
} from './machineWorker';

/**
 * A holder served over a real `MessageChannel` in this thread.
 *
 * The channel is the boundary this exercises - numbering, matching a reply to
 * its request, and a refusal surviving the crossing. Whether the other end is a
 * thread is `spawn`'s business, and the integration test that runs the built
 * bundle is where a real one is proved.
 */
function overAChannel() {
  const channel = new MessageChannel();
  serveMachineWorker(channel.port2 as unknown as MessageChannelLike);
  channel.port2.unref();
  return createWorkerHolder(() => ({
    port: channel.port1 as unknown as MessageChannelLike,
    terminate: () => {
      channel.port1.close();
      channel.port2.close();
    },
  }));
}

describe('a machine held in this thread', () => {
  it('holds nothing until a program has been run', async () => {
    const holder = createInProcessHolder();
    expect(await holder.held()).toBeNull();
    await holder.dispose();
  });

  it('answers an operation that needs no machine', async () => {
    const holder = createInProcessHolder();
    const { outcome } = await holder.call('machines', {});
    expect(Array.isArray(outcome)).toBe(true);
    await holder.dispose();
  });

  it('says how to get a machine when one is needed and none is held', async () => {
    const holder = createInProcessHolder();
    await expect(holder.call('look', {})).rejects.toThrow(/No machine is up/);
    await holder.dispose();
  });

  it('installs no stand-in merely by existing', () => {
    // The stand-ins go on when a machine boots, not when a holder is made, so
    // a host that has served nothing has a clean global object. This is what
    // makes one worker per caller enough: nothing is installed until there is
    // a machine to install it for.
    const globals = globalThis as Record<string, unknown>;
    const before = globals.document;
    const holder = createInProcessHolder();
    expect(globals.document).toBe(before);
    void holder.dispose();
  });
});

describe('a machine held across a boundary', () => {
  it('answers a call made over the channel', async () => {
    const holder = overAChannel();
    const { outcome } = await holder.call('machines', {});
    expect(Array.isArray(outcome)).toBe(true);
    await holder.dispose();
  });

  it('matches every reply to its own request, whatever order they finish in', async () => {
    const holder = overAChannel();
    const answers = await Promise.all([
      holder.call('machines', {}),
      holder.call('info', { machine: 'zx81' }),
      holder.call('machines', {}),
    ]);
    expect(Array.isArray(answers[0].outcome)).toBe(true);
    expect((answers[1].outcome as { id: string }).id).toBe('zx81');
    expect(Array.isArray(answers[2].outcome)).toBe(true);
    await holder.dispose();
  });

  it('carries a refusal across as a refusal, with which failure it was', async () => {
    const holder = overAChannel();
    const error = await holder.call('teleport', {}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CallRefused);
    expect((error as CallRefused).failure).toBe('request');
    expect((error as CallRefused).message).toMatch(/no operation called/);
    await holder.dispose();
  });

  it('starts nothing to answer that it holds no machine', async () => {
    let spawned = 0;
    const holder = createWorkerHolder(() => {
      spawned += 1;
      const channel = new MessageChannel();
      serveMachineWorker(channel.port2 as unknown as MessageChannelLike);
      channel.port2.unref();
      return {
        port: channel.port1 as unknown as MessageChannelLike,
        terminate: () => {
          channel.port1.close();
          channel.port2.close();
        },
      };
    });
    expect(await holder.held()).toBeNull();
    expect(spawned).toBe(0);
    await holder.dispose();
    expect(spawned).toBe(0);
  });

  it('refuses everything outstanding when the machine goes away', async () => {
    let fail: ((error: Error) => void) | undefined;
    const holder = createWorkerHolder(() => ({
      port: {
        postMessage: () => {},
        on: (event: string, listener: (value: never) => void) => {
          if (event === 'error') fail = listener as (error: Error) => void;
        },
      } as unknown as MessageChannelLike,
      terminate: () => {},
    }));
    const pending = holder.call('machines', {});
    fail?.(new Error('the worker died'));
    await expect(pending).rejects.toBeInstanceOf(CallRefused);
    await expect(pending).rejects.toThrow(/the machine stopped/);
  });

  it('is safe to dispose when nothing was ever held', async () => {
    const holder = createWorkerHolder(() => {
      throw new Error('should not be started');
    });
    await expect(holder.dispose()).resolves.toBeUndefined();
  });
});

describe('the fact one worker per caller rests on', () => {
  it('gives each worker thread a global object of its own', async () => {
    // The stand-ins are installed on `globalThis`, so a host serving several
    // callers can only hold several machines if that object is per-thread.
    // Everything above depends on this being true of the runtime, not of our
    // code, so it is checked against a real thread rather than assumed.
    (globalThis as Record<string, unknown>).document = 'the host';
    try {
      const worker = new Worker(
        `import { parentPort } from 'node:worker_threads';
         const before = globalThis.document ?? null;
         globalThis.document = 'the worker';
         parentPort.postMessage({ before, after: globalThis.document });`,
        { eval: true },
      );
      const seen = await new Promise<{ before: unknown; after: unknown }>(
        (resolve, reject) => {
          worker.on('message', resolve);
          worker.on('error', reject);
        },
      );
      await worker.terminate();
      expect(seen.before).toBeNull();
      expect(seen.after).toBe('the worker');
      expect((globalThis as Record<string, unknown>).document).toBe('the host');
    } finally {
      delete (globalThis as Record<string, unknown>).document;
    }
  });
});
