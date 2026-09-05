// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The callers a host is serving, and the machine each of them holds.
 *
 * One session per connection, and a machine that belongs to that session
 * alone: what one caller does to its machine is invisible to every other, and
 * neither is refused because the other holds one. That is the whole reason a
 * machine lives in a worker rather than in the host - see
 * `src/server/machineWorker.ts` for why the process could otherwise hold only
 * one.
 *
 * A machine is let go when its caller releases it, disconnects, or disappears
 * without saying so, because all three arrive here as the session closing. A
 * caller that is killed therefore strands neither a machine nor the worker
 * under it.
 *
 * The holder is made lazily. A session that only ever lints a program never
 * starts a worker, which is what keeps the cheap operations cheap on a host
 * that can run machines.
 */

import type { CallOutcome } from './ops';
import type { MachineHolder } from './machineWorker';

/** One caller of the host, for as long as it is connected. */
export interface HostSession {
  readonly id: number;
  /** Run one call for this caller, against this caller's machine. */
  call(operation: string, input: unknown): Promise<CallOutcome>;
  /** The machine this caller holds, named, or null when none is. */
  held(): Promise<string | null>;
  /** Let this caller's machine go, keeping the session open. */
  release(): Promise<void>;
  /** The caller is gone: let go of the machine and the worker under it. */
  close(): Promise<void>;
}

export interface Sessions {
  /** A session for a caller that has just connected. */
  open(): HostSession;
  /** How many callers are connected; what stops an idle host letting go. */
  readonly openCount: number;
  /** Close every session, letting go of every machine. */
  closeAll(): Promise<void>;
}

/**
 * `newHolder` is what a session's machine is held by - a worker on a listening
 * host, this thread on one serving a single caller over its own streams.
 */
export function createSessions(newHolder: () => MachineHolder): Sessions {
  const live = new Map<number, HostSession>();
  let nextId = 1;

  return {
    open(): HostSession {
      const id = nextId++;
      // Made on first use rather than on connecting: a caller that only lints
      // never pays for a worker.
      let holder: MachineHolder | null = null;
      const require = () => (holder ??= newHolder());

      const letGo = async () => {
        const held = holder;
        holder = null;
        await held?.dispose();
      };

      const session: HostSession = {
        id,
        call: (operation, input) => require().call(operation, input),
        held: () => holder?.held() ?? Promise.resolve(null),
        release: letGo,
        close: async () => {
          live.delete(id);
          await letGo();
        },
      };
      live.set(id, session);
      return session;
    },

    get openCount() {
      return live.size;
    },

    async closeAll() {
      // Copied first: closing a session removes it from the map underneath.
      await Promise.all([...live.values()].map((session) => session.close()));
      live.clear();
    },
  };
}
