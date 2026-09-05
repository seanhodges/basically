// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * When a host stops.
 *
 * A host is started without being asked for - a caller that finds none starts
 * one - so it has to be willing to go again, or a single command would leave a
 * process running for the rest of the session. It lets itself go when nothing
 * has needed it for a while and no caller is connected; a connected caller
 * keeps it alive however quiet it is, because the machine that caller is
 * holding is the whole point of the host.
 *
 * The clock is handed in so this is testable without waiting: a test drives the
 * time rather than sleeping through it.
 */

/** What the idle timer needs to know and do. */
export interface LifetimeHost {
  /** How many callers are connected right now. */
  connected(): number;
  /** Let everything go and stop listening. */
  shutdown(): Promise<void>;
}

export interface LifetimeClock {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface Lifetime {
  /** Something happened; the host is wanted, so start the wait again. */
  touch(): void;
  /** Stop watching. Called when the host is going for another reason. */
  cancel(): void;
  /** Stop the host now, whatever the clock says. */
  stop(): Promise<void>;
}

/**
 * How long a host with nothing to do waits before letting itself go.
 *
 * Long enough that a shell user running one command after another always finds
 * it warm, short enough that a single command does not leave a process behind
 * for the afternoon. A caller that is connected is not idle at all, so this
 * only ever measures the gap between one caller leaving and the next arriving.
 */
export const IDLE_MS = 10 * 60 * 1000;

export function watchLifetime(
  host: LifetimeHost,
  idleMs: number = IDLE_MS,
  clock: LifetimeClock = globalThis,
): Lifetime {
  let handle: unknown = null;
  let stopped = false;

  const clear = () => {
    if (handle !== null) clock.clearTimeout(handle);
    handle = null;
  };

  const stop = async () => {
    if (stopped) return;
    stopped = true;
    clear();
    await host.shutdown();
  };

  const arm = () => {
    clear();
    if (stopped) return;
    handle = clock.setTimeout(() => {
      handle = null;
      // Checked when the timer fires rather than only when it was set: a
      // caller may have connected in between, and its machine is not something
      // to let go of behind its back.
      if (host.connected() > 0) return;
      void stop();
    }, idleMs);
  };

  arm();
  return {
    touch: arm,
    cancel: () => {
      stopped = true;
      clear();
    },
    stop,
  };
}
