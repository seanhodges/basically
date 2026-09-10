// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The callers a host is serving, and the machine each of them holds.
 *
 * A machine belongs to one caller: what one does to its machine is invisible
 * to every other, and neither is refused because the other holds one. That is
 * the whole reason a machine lives in a worker rather than in the host - see
 * `src/server/machineWorker.ts` for why the process could otherwise hold only
 * one.
 *
 * Who "a caller" is differs by conversation, and the difference is the point.
 * A caller holding its connection open for as long as it is working - an agent
 * - is a session per connection, let go when that connection ends. The command
 * line is not that: each command is its own connection, so a session that went
 * with the connection would let the machine go before the next command could
 * see it, and "held between commands" would mean nothing. So the command line
 * shares one session across its connections, released when it says so, when the
 * host is stopped, or when the host lets itself go.
 *
 * The holder is made lazily either way. A session that only ever lints a
 * program never starts a worker, which is what keeps the cheap operations cheap
 * on a host that can run machines.
 */

import type { CallOutcome } from './ops';
import type { MachineHolder } from './machineWorker';
import {
  noProjections,
  type ProjectionHost,
  type SessionProjection,
} from './projection/link';

/** One caller of the host, for as long as it is connected. */
export interface HostSession {
  readonly id: number;
  /** Run one call for this caller, against this caller's machine. */
  call(operation: string, input: unknown): Promise<CallOutcome>;
  /** The machine this caller holds, named, or null when none is. */
  held(): Promise<string | null>;
  /** Let this caller's machine go, keeping the session open. */
  release(): Promise<void>;
  /** Give up this caller's view, keeping the machine and the session. */
  unview(): Promise<void>;
  /**
   * Give up this caller's play channel, keeping the machine and the session.
   * The machine stops advancing unasked and is again one that advances only
   * when a request asks it to.
   */
  unplay(): Promise<void>;
  /** The caller is gone: let go of the machine and the worker under it. */
  close(): Promise<void>;
}

export interface Sessions {
  /** A session for a caller that has just connected, ending with it. */
  open(): HostSession;
  /**
   * The command line's session, the same one every time.
   *
   * Outlives any one connection, because each command is a connection and the
   * machine has to survive between them. Made on first use, like any other.
   */
  shared(): HostSession;
  /** How many sessions exist, shared or not. */
  readonly openCount: number;
  /** Close every session, letting go of every machine. */
  closeAll(): Promise<void>;
}

/**
 * `newHolder` is what a session's machine is held by - a worker on a listening
 * host, this thread on one serving a single caller over its own streams. It is
 * handed the caller's projections because the machine is what produces the
 * frames and what a key reaches, and a machine let go and started again is
 * projected to the same address: a projection follows the caller, not any one
 * machine.
 *
 * `projections` is where a caller's view and play channel come from. The
 * default projects nothing, which is a host that binds no network address at
 * all.
 */
export function createSessions(
  newHolder: (projection: SessionProjection) => MachineHolder,
  projections: ProjectionHost = noProjections(),
): Sessions {
  const live = new Map<number, HostSession>();
  let nextId = 1;
  let commandLine: HostSession | null = null;

  const sessions: Sessions = {
    open(): HostSession {
      const id = nextId++;
      // Both made on first use rather than on connecting: a caller that only
      // lints pays for neither a worker nor a network address.
      let holder: MachineHolder | null = null;
      const projection = projections.forSession();
      const view = projection.view;
      const require = () => (holder ??= newHolder(projection));

      const letGo = async () => {
        const held = holder;
        holder = null;
        // The machine has gone; whoever is watching is told so rather than
        // left looking at a picture of it, and whoever is playing is told
        // there is nothing to play. Both projections stay open, and their
        // addresses stay valid, because they belong to the caller.
        view.settled(null);
        projection.play.say('no-machine');
        await held?.dispose();
      };

      const session: HostSession = {
        id,
        call: async (operation, input) => {
          const machine = require();
          view.working();
          try {
            return await machine.call(operation, input);
          } finally {
            // Asked only while somebody is watching, so a caller with no view
            // pays nothing for the state a view would have shown.
            view.settled(
              view.watching() ? await machine.held().catch(() => null) : null,
            );
          }
        },
        held: () => holder?.held() ?? Promise.resolve(null),
        release: letGo,
        unview: () => view.end(),
        unplay: () => projection.play.end(),
        close: async () => {
          live.delete(id);
          await projection.end();
          await letGo();
        },
      };
      live.set(id, session);
      return session;
    },

    shared(): HostSession {
      // The same session for every command, so the machine one command leaves
      // up is the machine the next one acts on.
      commandLine ??= (() => {
        const session = sessions.open();
        return {
          ...session,
          // A command ending is not the command line going away, so closing
          // its connection must not take the machine - or the view of it -
          // with it. Only an explicit release, a stop, or the host letting
          // itself go does that.
          close: () => Promise.resolve(),
        };
      })();
      return commandLine;
    },

    get openCount() {
      return live.size;
    },

    async closeAll() {
      // Copied first: closing a session removes it from the map underneath.
      // The command line's is in there too, under the id it was opened with,
      // so it is released here like any other.
      const all = [...live.values()];
      commandLine = null;
      await Promise.all(all.map((session) => session.close()));
      live.clear();
      // Nothing is left to project to, so nothing goes on listening.
      await projections.close();
    },
  };
  return sessions;
}
