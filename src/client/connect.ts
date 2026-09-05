// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Finding a host, or starting one.
 *
 * A caller never asks for a host and should not have to know whether one is
 * running: it connects, and if nothing answers it starts one and connects to
 * that. Two callers doing this at the same moment is the ordinary case rather
 * than a race to lose - one of them binds the address and the other finds it
 * bound, which is the arrangement working. So a failure to start is not a
 * failure until connecting has been tried again.
 *
 * What a stopped host leaves behind is a socket file that accepts no
 * connection. That is remains rather than a host, and is cleared rather than
 * waited on. On Windows a named pipe goes with its process, so the case does
 * not arise there.
 *
 * Nothing here decides an address - `src/server/address.ts` does - and the ways
 * of reaching the world are handed in, so the whole algorithm is testable
 * without binding a socket or starting a process.
 */

/** How this module reaches the world; supplied so a test can supply otherwise. */
export interface ConnectWorld {
  /** Open a connection to the address, or reject saying why. */
  dial(address: string): Promise<Connection>;
  /** Remove what a stopped host left behind. Not called on Windows. */
  clear(address: string): Promise<void>;
  /** Where a host program can be run from, in the order to prefer them. */
  candidates(): Promise<string[]>;
  /** Start a host, detached, and return without waiting for it. */
  start(program: string): Promise<void>;
  /** Wait this long. */
  wait(ms: number): Promise<void>;
}

/** A connection to a host, in the terms this module needs. */
export interface Connection {
  write(bytes: Buffer): void;
  on(event: 'data', listener: (chunk: Buffer) => void): void;
  on(event: 'close', listener: () => void): void;
  end(): void;
  destroy(): void;
}

/** Nothing could be reached and nothing could be started. */
export class NoHost extends Error {}

/**
 * How long to keep trying after starting a host.
 *
 * A host has to load the toolchain before it binds, and the backoff is over
 * roughly ten seconds in total - generous, because the alternative to waiting
 * is telling a user their command failed when it was about to work. Doubling
 * rather than polling, so a host that binds quickly is found quickly.
 */
const BACKOFF_MS = [25, 50, 100, 200, 400, 800, 1600, 3200, 3200];

export interface ConnectOptions {
  address: string;
  world: ConnectWorld;
  /** Windows has no socket file to clear; a pipe goes with its process. */
  clearable: boolean;
  /** Do not start a host; fail instead if none is running. */
  neverStart?: boolean;
}

/**
 * A connection to a host of this build, starting one if none is running.
 */
export async function connectOrStart(
  options: ConnectOptions,
): Promise<Connection> {
  const { address, world } = options;

  const dial = async (): Promise<Connection | null> => {
    try {
      return await world.dial(address);
    } catch {
      return null;
    }
  };

  const first = await dial();
  if (first) return first;
  if (options.neverStart) {
    throw new NoHost(`no host is listening on ${address}`);
  }

  // Nothing answered. Either no host was ever started, or one stopped and left
  // its socket behind - which would make every later attempt fail the same way
  // until it is removed.
  if (options.clearable) await world.clear(address);

  const programs = await world.candidates();
  if (programs.length === 0) {
    throw new NoHost(
      'no host is running and none could be found: looked for ' +
        'basically-server beside this program and on PATH',
    );
  }

  const refusals: string[] = [];
  for (const program of programs) {
    try {
      await world.start(program);
    } catch (error) {
      refusals.push(
        `${program}: ${error instanceof Error ? error.message : String(error)}`,
      );
      continue;
    }
    for (const ms of BACKOFF_MS) {
      await world.wait(ms);
      // Another caller may have won the race and bound the address first. That
      // is this working, not failing: whichever host is there is the one to
      // use, and the loser exits on its own once it finds the address taken.
      const connection = await dial();
      if (connection) return connection;
    }
    refusals.push(`${program}: started, but nothing was listening after`);
  }

  throw new NoHost(
    `no host could be reached on ${address}; tried ${refusals.join('; ')}`,
  );
}
