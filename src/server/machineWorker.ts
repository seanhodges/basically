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

import type { ViewFrame } from '../dialects/headless/frameTap';
import type {
  Operation,
  PlayOpened,
  PlayProjection,
  ViewOpened,
} from '../ops/types';
import { serverContext, type ServerContextOptions } from '../mcp/context';
import { CANNOT_PROJECT } from '../ops/view';
import type { ViewLink } from './view/link';
import type { PlayFrame } from './play/frames';
import {
  CANNOT_PLAY,
  type PlayLink,
  type PlayState,
  type SessionPlay,
} from './play/link';
import { createPlayedMachine } from './play/machine';
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
  view?: ViewLink,
  play?: PlayLink,
): MachineHolder {
  const server: ServerMachine = createServerMachine(view);
  // The clock and the keys, beside the machine. Made whether or not a channel
  // is ever asked for: it starts nothing until one is, and a caller that never
  // plays pays for a closure.
  const played = play
    ? createPlayedMachine({
        held: () => server.held(),
        step: () => void server.session()?.advance(1),
        paint: () => server.paint(),
        play,
      })
    : null;
  // The operation is given a projection whose opening starts the clock: the
  // machine has to be running by the time the caller has an address to hand
  // somebody, and nothing else knows that a channel has just opened.
  const projection: PlayProjection | undefined =
    play && played
      ? {
          open: async (): Promise<PlayOpened> => {
            const opened = await play.open();
            if (opened.address !== null) played.start();
            return opened;
          },
          playing: () => play.playing(),
        }
      : undefined;
  return {
    call: async (operation, input) => {
      try {
        return await runOperation(
          operation,
          input,
          {
            context: () => serverContext(server, options, view, projection),
            heldMachine: () => {
              const held = server.held();
              return held && { name: held.dialect.name, token: held.machine };
            },
          },
          reaches,
        );
      } finally {
        // The frame a request stopped on is the one a viewer will be looking
        // at until the next request, and a sampled run is as likely as not to
        // have skipped it. Refused and failed calls settle too: what the
        // machine shows now is what it shows.
        server.settleView();
      }
    },
    held: () => Promise.resolve(server.held()?.dialect.name ?? null),
    dispose: () => {
      played?.stop();
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

/**
 * What the thread holding the machine says without having been asked.
 *
 * The only traffic that starts on the worker's side. Both projections are
 * served from the host's thread, because that is where a listener can be, while
 * the machine and its picture are here - so the frames travel one way and the
 * address that answers the caller travels back.
 *
 * A key is the one thing that travels the other way, from the host to the
 * machine: a `play-key` answer, sent when somebody typed rather than in reply
 * to anything. That direction did not exist before a machine could be played,
 * and it is why a play channel is not a view that also does something.
 */
export type WorkerNote =
  /** Asking the host to open (or hand back) this caller's view. */
  | { kind: 'view-open'; id: number }
  /**
   * One sampled frame. Already PNG bytes, which is what a structured clone
   * carries across a thread without either side writing them down.
   */
  | { kind: 'view-frame'; frame: ViewFrame }
  /** Asking the host to open (or hand back) this caller's play channel. */
  | { kind: 'play-open'; id: number }
  /** One frame of a played machine, already compressed. */
  | { kind: 'play-frame'; frame: PlayFrame }
  /** What the play channel is showing. */
  | { kind: 'play-state'; state: PlayState };

/** What the host says back to a {@link WorkerNote}. */
export type WorkerAnswer =
  | { kind: 'view-opened'; id: number; opened: ViewOpened }
  /** The last frame has reached the viewers; another may be sent. */
  | { kind: 'view-free' }
  | { kind: 'play-opened'; id: number; opened: PlayOpened }
  /** The last frame has reached whoever is playing; another may be sent. */
  | { kind: 'play-free' }
  /** Somebody typed. Unprompted: the one thing that travels toward the machine. */
  | { kind: 'play-key'; key: string; down: boolean }
  /** The channel has ended, so the machine stops advancing unasked. */
  | { kind: 'play-ended' };

const NOTE_KINDS = new Set([
  'view-open',
  'view-frame',
  'play-open',
  'play-frame',
  'play-state',
]);

const ANSWER_KINDS = new Set([
  'view-opened',
  'view-free',
  'play-opened',
  'play-free',
  'play-key',
  'play-ended',
]);

/** Whether a message from the worker is one of its own notes. */
function asNote(value: unknown): WorkerNote | null {
  if (typeof value !== 'object' || value === null) return null;
  const kind = (value as { kind?: unknown }).kind;
  return typeof kind === 'string' && NOTE_KINDS.has(kind)
    ? (value as WorkerNote)
    : null;
}

/** Whether a message from the host is an answer rather than a request. */
function asAnswer(value: unknown): WorkerAnswer | null {
  if (typeof value !== 'object' || value === null) return null;
  const kind = (value as { kind?: unknown }).kind;
  return typeof kind === 'string' && ANSWER_KINDS.has(kind)
    ? (value as WorkerAnswer)
    : null;
}

/**
 * The machine's side of a view, over the port to the thread holding the view.
 *
 * `free` has to answer without waiting, because the tap asks it in the middle
 * of a frame, so it is a flag the host clears rather than a question: a frame
 * is on its way until the host says otherwise, and a sample due while one is
 * is dropped.
 */
export function createWorkerViewLink(post: (note: WorkerNote) => void): {
  link: ViewLink;
  answer(message: WorkerAnswer): void;
} {
  const waiting = new Map<number, (opened: ViewOpened) => void>();
  let nextId = 1;
  let projecting = false;
  let inFlight = false;

  return {
    link: {
      open: () =>
        new Promise<ViewOpened>((resolve) => {
          const id = nextId++;
          waiting.set(id, (opened) => {
            if (opened.address !== null) projecting = true;
            resolve(opened);
          });
          post({ kind: 'view-open', id });
        }),
      watching: () => projecting,
      free: () => !inFlight,
      send: (frame) => {
        inFlight = true;
        post({ kind: 'view-frame', frame });
      },
    },
    answer(message) {
      if (message.kind !== 'view-opened') {
        if (message.kind === 'view-free') inFlight = false;
        return;
      }
      const pending = waiting.get(message.id);
      if (!pending) return;
      waiting.delete(message.id);
      pending(message.opened);
    },
  };
}

/**
 * The machine's side of a play channel, over the port to the thread serving it.
 *
 * The same shape as the view's link and for the same reasons - `free` is a flag
 * the host clears rather than a question, because the clock asks it in the
 * middle of a frame - with one addition the view has no use for: a key arriving
 * unprompted from the host, which is handed to whatever registered for it.
 */
export function createWorkerPlayLink(post: (note: WorkerNote) => void): {
  link: PlayLink;
  answer(message: WorkerAnswer): void;
} {
  const waiting = new Map<number, (opened: PlayOpened) => void>();
  let nextId = 1;
  let playing = false;
  let inFlight = false;
  let press: ((key: string, down: boolean) => void) | null = null;

  return {
    link: {
      open: () =>
        new Promise<PlayOpened>((resolve) => {
          const id = nextId++;
          waiting.set(id, (opened) => {
            if (opened.address !== null) playing = true;
            resolve(opened);
          });
          post({ kind: 'play-open', id });
        }),
      playing: () => playing,
      free: () => !inFlight,
      send: (frame) => {
        inFlight = true;
        post({ kind: 'play-frame', frame });
      },
      say: (state) => post({ kind: 'play-state', state }),
      pressed: (handler) => {
        press = handler;
      },
    },
    answer(message) {
      switch (message.kind) {
        case 'play-free':
          inFlight = false;
          return;
        case 'play-key':
          press?.(message.key, message.down);
          return;
        case 'play-ended':
          playing = false;
          inFlight = false;
          return;
        case 'play-opened': {
          const pending = waiting.get(message.id);
          if (!pending) return;
          waiting.delete(message.id);
          pending(message.opened);
          return;
        }
        default:
          return;
      }
    },
  };
}

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
  const post = (note: WorkerNote) => port.postMessage(note);
  const view = createWorkerViewLink(post);
  const play = createWorkerPlayLink(post);
  const holder = createInProcessHolder(options, reaches, view.link, play.link);
  port.on('message', (request: WorkerRequest) => {
    const answer = asAnswer(request);
    if (answer) {
      view.answer(answer);
      play.answer(answer);
      return;
    }
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
  view?: ViewLink,
  play?: SessionPlay,
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

  /**
   * What the machine's thread says of its own accord: the frames it sampled,
   * and its caller asking for a view. Answered here, on the thread where a
   * listener can be.
   */
  async function serveNote(
    port: MessageChannelLike,
    note: WorkerNote,
  ): Promise<void> {
    switch (note.kind) {
      case 'view-frame':
        view?.send(note.frame);
        // The tap holds off until this lands, so a machine that changes faster
        // than the viewer can be shown drops samples rather than queueing them.
        port.postMessage({ kind: 'view-free' } satisfies WorkerAnswer);
        return;
      case 'view-open': {
        const opened = view
          ? await view.open()
          : {
              address: null,
              problem: CANNOT_PROJECT,
              already: false,
              endedPlay: false,
            };
        port.postMessage({
          kind: 'view-opened',
          id: note.id,
          opened,
        } satisfies WorkerAnswer);
        return;
      }
      case 'play-frame':
        play?.send(note.frame);
        // The clock holds off until this lands, so a machine drawing faster
        // than the channel can carry drops frames rather than queueing them.
        port.postMessage({ kind: 'play-free' } satisfies WorkerAnswer);
        return;
      case 'play-state':
        play?.say(note.state);
        return;
      case 'play-open': {
        const opened = play
          ? await play.open()
          : {
              address: null,
              problem: CANNOT_PLAY,
              already: false,
              endedView: false,
            };
        // Keys travel toward the machine from here on: whoever is playing
        // types at the host's thread and the press crosses to the worker.
        if (opened.address !== null) {
          play?.pressed((key, down) =>
            port.postMessage({
              kind: 'play-key',
              key,
              down,
            } satisfies WorkerAnswer),
          );
        }
        port.postMessage({
          kind: 'play-opened',
          id: note.id,
          opened,
        } satisfies WorkerAnswer);
        return;
      }
    }
  }

  function connected(): NonNullable<typeof worker> {
    if (worker) return worker;
    const started = spawn();
    worker = started;
    // The channel can end without this thread having asked anything - the
    // caller gave it up, or asked for a view instead - and the machine's own
    // thread has no other way to learn that it should stop its clock.
    play?.ended(() =>
      started.port.postMessage({ kind: 'play-ended' } satisfies WorkerAnswer),
    );
    started.port.on('message', (reply: WorkerReply) => {
      const note = asNote(reply);
      if (note) {
        void serveNote(started.port, note);
        return;
      }
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
