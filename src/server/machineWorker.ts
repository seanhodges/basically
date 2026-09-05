// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * One caller's machine, and where it actually runs.
 *
 * The stand-ins a machine needs outside a browser - the ROM loading and the
 * canvas globals - are installed on the process rather than on the machine, so
 * one process holds at most one machine: a second set nested inside the first
 * would come off in the wrong order. A host serving several callers at once
 * cannot live with that limit, and the way out is that each worker thread has a
 * `globalThis` of its own. Put a caller's machine in a worker and the limit
 * becomes one machine per worker, which is exactly the invariant
 * `src/mcp/session.ts` already keeps - unchanged, not weakened.
 *
 * Because the machine is in the worker, so is the call: an operation runs
 * beside the machine it acts on, and only its input and its outcome cross the
 * boundary. They already survive that, being JSON by contract.
 *
 * {@link MachineHolder} is the seam. The in-process holder is what a host
 * serving one caller over its own streams uses, and what these tests use; the
 * worker holder is what a listening host gives each caller. Both answer the
 * same way, so nothing above here knows which it has.
 */

import type { Operation } from '../ops/types';
import { serverContext, type ServerContextOptions } from '../mcp/context';
import { createServerMachine, type ServerMachine } from '../mcp/session';
import { CallRefused, runOperation, type CallOutcome } from './ops';
import type { FailureKind } from './protocol';

/** A machine, wherever it is running, and the calls that act on it. */
export interface MachineHolder {
  /** Run one call against this holder's machine. */
  call(operation: string, input: unknown): Promise<CallOutcome>;
  /** The machine held now, named, or null when none is. */
  held(): Promise<string | null>;
  /** Let go of whatever is held, and of the worker if there is one. */
  dispose(): Promise<void>;
}

/** Which operations a caller of the host reaches. */
export function reachesFromCli(op: Operation): boolean {
  return op.cli !== undefined;
}

/**
 * A machine in this thread.
 *
 * Correct only where nothing else in the process will hold one - a host serving
 * a single caller over its own streams, or a test. A listening host gives each
 * caller a worker instead.
 */
export function createInProcessHolder(
  options: ServerContextOptions = {},
  reaches: (op: Operation) => boolean = reachesFromCli,
): MachineHolder {
  const server: ServerMachine = createServerMachine();
  return {
    call: (operation, input) =>
      runOperation(
        operation,
        input,
        {
          context: () => serverContext(server, options),
          heldMachine: () => {
            const held = server.held();
            return held && { name: held.dialect.name, token: held.machine };
          },
        },
        reaches,
      ),
    held: () => Promise.resolve(server.held()?.dialect.name ?? null),
    dispose: () => {
      server.dispose();
      return Promise.resolve();
    },
  };
}

/* ------------------------------------------------------------------ */
/* What crosses the thread boundary                                    */
/* ------------------------------------------------------------------ */

/** What is asked of the thread holding the machine, before it is numbered. */
export type WorkerAsk =
  | { kind: 'call'; operation: string; input: unknown }
  | { kind: 'held' }
  | { kind: 'dispose' };

/**
 * The same, numbered so a reply can be matched to it. Intersected rather than
 * written into each member: `Omit` over a union distributes over its members
 * and loses the properties that are not common to all of them.
 */
export type WorkerRequest = WorkerAsk & { id: number };

export type WorkerReply =
  | { id: number; kind: 'ok'; value: unknown }
  | { id: number; kind: 'refused'; failure: FailureKind; message: string }
  | { id: number; kind: 'threw'; message: string };

/** Enough of a `MessagePort` for either side; the real ones satisfy it. */
export interface MessageChannelLike {
  postMessage(value: unknown): void;
  on(event: 'message', listener: (value: never) => void): void;
  on(event: 'error', listener: (error: Error) => void): void;
  on(event: 'exit', listener: (code: number) => void): void;
}

/**
 * Serve one machine over a port, in the thread that owns it.
 *
 * Called by the worker's entry point. A refusal crosses as a refusal rather
 * than as a thrown error, so the host answers its caller in the same terms
 * whichever side of the boundary the machine was on; anything else is a bug and
 * is reported as one.
 */
export function serveMachineWorker(
  port: MessageChannelLike,
  options: ServerContextOptions = {},
  reaches: (op: Operation) => boolean = reachesFromCli,
): void {
  const holder = createInProcessHolder(options, reaches);
  port.on('message', (request: WorkerRequest) => {
    const reply = (message: WorkerReply) => port.postMessage(message);
    const fail = (error: unknown) => {
      if (error instanceof CallRefused) {
        reply({
          id: request.id,
          kind: 'refused',
          failure: error.failure,
          message: error.message,
        });
        return;
      }
      reply({
        id: request.id,
        kind: 'threw',
        message: error instanceof Error ? error.message : String(error),
      });
    };
    try {
      switch (request.kind) {
        case 'call':
          holder
            .call(request.operation, request.input)
            .then((value) => reply({ id: request.id, kind: 'ok', value }))
            .catch(fail);
          return;
        case 'held':
          holder
            .held()
            .then((value) => reply({ id: request.id, kind: 'ok', value }))
            .catch(fail);
          return;
        case 'dispose':
          holder
            .dispose()
            .then(() => reply({ id: request.id, kind: 'ok', value: null }))
            .catch(fail);
          return;
      }
    } catch (error) {
      fail(error);
    }
  });
}

/**
 * A machine in a worker of its own, reached over a port.
 *
 * `spawn` is handed in so this is testable over a plain message channel: what
 * it returns has to answer a `WorkerRequest` with a `WorkerReply`, and whether
 * that is a thread or a stand-in is not this module's business.
 */
export function createWorkerHolder(
  spawn: () => {
    port: MessageChannelLike;
    terminate(): Promise<void> | void;
  },
): MachineHolder {
  let worker: ReturnType<typeof spawn> | null = null;
  let nextId = 1;
  const waiting = new Map<
    number,
    { resolve(value: unknown): void; reject(error: unknown): void }
  >();

  /** Everything still waiting fails together: the machine is gone. */
  const abandon = (reason: string) => {
    const pending = [...waiting.values()];
    waiting.clear();
    worker = null;
    for (const one of pending) one.reject(new CallRefused(reason));
  };

  function connected(): NonNullable<typeof worker> {
    if (worker) return worker;
    const started = spawn();
    worker = started;
    started.port.on('message', (reply: WorkerReply) => {
      const pending = waiting.get(reply.id);
      if (!pending) return;
      waiting.delete(reply.id);
      switch (reply.kind) {
        case 'ok':
          pending.resolve(reply.value);
          return;
        case 'refused':
          pending.reject(new CallRefused(reply.message, reply.failure));
          return;
        case 'threw':
          pending.reject(new Error(reply.message));
          return;
      }
    });
    started.port.on('error', (error: Error) => {
      abandon(`the machine stopped: ${error.message}`);
    });
    started.port.on('exit', () => {
      // A worker that exits with calls outstanding took the machine with it,
      // which is a refusal for each of them rather than a promise that never
      // settles.
      abandon('the machine stopped');
    });
    return started;
  }

  function ask<T>(request: WorkerAsk): Promise<T> {
    const started = connected();
    const id = nextId++;
    return new Promise<T>((resolve, reject) => {
      waiting.set(id, { resolve: resolve as (value: unknown) => void, reject });
      started.port.postMessage({ ...request, id } satisfies WorkerRequest);
    });
  }

  return {
    call: (operation, input) =>
      ask<CallOutcome>({ kind: 'call', operation, input }),
    // Asked of a worker that was never started, the answer is that nothing is
    // held - which is true, and cheaper than starting one to be told so.
    held: () =>
      worker ? ask<string | null>({ kind: 'held' }) : Promise.resolve(null),
    dispose: async () => {
      const started = worker;
      if (!started) return;
      try {
        await ask<null>({ kind: 'dispose' });
      } catch {
        // A worker that has already gone needs no telling.
      }
      worker = null;
      waiting.clear();
      await started.terminate();
    },
  };
}
