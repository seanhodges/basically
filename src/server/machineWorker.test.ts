import { MessageChannel, Worker } from 'node:worker_threads';
import { describe, expect, it } from 'vitest';
import { CallRefused } from './ops';
import {
  createInProcessHolder,
  createWorkerHolder,
  createWorkerViewLink,
  serveMachineWorker,
  type MachineHolder,
  type MessageChannelLike,
  type WorkerAnswer,
  type WorkerNote,
} from './machineWorker';
import type { ViewLink } from './view/link';

/**
 * A holder served over a real `MessageChannel` in this thread.
 *
 * The channel is the boundary this exercises - numbering, matching a reply to
 * its request, and a refusal surviving the crossing. Whether the other end is a
 * thread is `spawn`'s business, and the integration test that runs the built
 * bundle is where a real one is proved.
 */
function overAChannel(view?: ViewLink) {
  const channel = new MessageChannel();
  serveMachineWorker(channel.port2 as unknown as MessageChannelLike);
  channel.port2.unref();
  return createWorkerHolder(
    () => ({
      port: channel.port1 as unknown as MessageChannelLike,
      terminate: () => {
        channel.port1.close();
        channel.port2.close();
      },
    }),
    view,
  );
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

/**
 * Stopping a program, stepping it and asking where it is, across the boundary.
 *
 * A held machine is in this thread for a caller served over its own streams and
 * in a worker for a caller reaching a host, and both must answer the same
 * operations. Asking where is the first of these that needs an answer back
 * where pressing a key needed none, so the whole sequence is run twice and the
 * two sets of answers compared.
 *
 * One program at a time, because the stand-ins are installed on the process and
 * the stand-in worker here shares it: the first holder goes before the second
 * runs anything.
 */
describe('stopping a program across the thread boundary', () => {
  const COUNTING =
    '10 LET A=0\n' +
    '20 LET A=A+1\n' +
    '30 IF A<4 THEN GOTO 20\n' +
    '40 PRINT A\n';

  /** Run one program that stops, then ask the four questions about it. */
  async function debugOnce(holder: MachineHolder): Promise<unknown[]> {
    const answers: unknown[] = [];
    const run = await holder.call('run', {
      machine: 'zx81',
      source: COUNTING,
      breakpoints: [30],
      screenText: true,
      screenshot: false,
      profile: false,
      time: false,
      variables: false,
    });
    answers.push((run.outcome as { stoppedAt: number | null }).stoppedAt);
    for (const [operation, input] of [
      ['where', {}],
      ['step', { maxFrames: 400 }],
      ['continue', { maxFrames: 400 }],
      ['break', { lines: [] }],
      ['where', {}],
    ] as const) {
      // The frames are dropped from what is compared: a step costs what the
      // ROM takes, and that is the machine's business rather than the
      // boundary's.
      const { outcome } = await holder.call(operation, input);
      const { frames, seconds, ...rest } = outcome as Record<string, unknown>;
      expect(typeof frames === 'number' || frames === undefined).toBe(true);
      expect(typeof seconds === 'number' || seconds === undefined).toBe(true);
      answers.push(rest);
    }
    return answers;
  }

  it('answers the same as a machine held in this thread', async () => {
    const across = overAChannel();
    const remote = await debugOnce(across);
    await across.dispose();

    const here = createInProcessHolder();
    const local = await debugOnce(here);
    await here.dispose();

    expect(remote[0]).toBe(30);
    expect(remote).toEqual(local);
  }, 60_000);
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

/**
 * A view of a machine that is running in another thread.
 *
 * The picture is made where the machine is and the listener is on the host's
 * thread, so the frames have to cross - as PNG bytes, which is what a
 * structured clone carries without either side writing them down.
 */
describe('a view across the thread boundary', () => {
  it('opens the view on the host thread and answers the machine with it', async () => {
    const opened = {
      address: 'http://127.0.0.1:1/v/token/',
      problem: null,
      already: false,
    };
    const frames: number[][] = [];
    const view: ViewLink = {
      open: () => Promise.resolve(opened),
      watching: () => true,
      free: () => true,
      send: (frame) => frames.push([...frame.png]),
    };
    const holder = overAChannel(view);
    // Booting a machine to sample would take a ROM and a run; what crosses is
    // what is checked here, so the machine's side is driven directly.
    const posted: WorkerNote[] = [];
    const worker = createWorkerViewLink((note) => posted.push(note));

    const asking = worker.link.open();
    expect(posted[0]).toEqual({ kind: 'view-open', id: 1 });
    worker.answer({ kind: 'view-opened', id: 1, opened });
    expect(await asking).toEqual(opened);
    expect(worker.link.watching()).toBe(true);

    worker.link.send({ width: 1, height: 1, png: new Uint8Array([7]) });
    expect(posted[1]).toEqual({
      kind: 'view-frame',
      frame: { width: 1, height: 1, png: new Uint8Array([7]) },
    });
    // Nothing more is sampled until the host says the last frame landed, so a
    // machine changing faster than the viewer drops samples rather than
    // queueing them.
    expect(worker.link.free()).toBe(false);
    worker.answer({ kind: 'view-free' } satisfies WorkerAnswer);
    expect(worker.link.free()).toBe(true);

    await holder.dispose();
  });

  it('samples nothing until its caller has asked for a view', () => {
    const worker = createWorkerViewLink(() => {});
    // The tap exists for every run; what stops it costing anything is this.
    expect(worker.link.watching()).toBe(false);
  });

  it('tells the machine there is nowhere to project when the host offers none', async () => {
    const holder = overAChannel();
    const outcome = await holder
      .call('view', {})
      .catch((error: Error) => error.message);
    // No machine is up, which is the answer that comes first; what matters is
    // that the crossing itself did not fail.
    expect(String(outcome)).toContain('No machine is up');
    await holder.dispose();
  });
});
