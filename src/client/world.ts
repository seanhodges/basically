// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The node-only edge of reaching a host: sockets, files and child processes.
 *
 * Kept apart from `src/client/connect.ts` so the algorithm there - try, start,
 * try again, give up saying what was tried - is testable without binding
 * anything or starting anything.
 */

import net from 'node:net';
import { rm } from 'node:fs/promises';
import type { Connection, ConnectWorld } from './connect';
import { findHostPrograms, startHost } from './discover';

/**
 * How long to wait for a socket to accept a connection.
 *
 * Short: this only ever distinguishes "nothing is there" from "something is",
 * and a host that is there answers immediately. What a host may take a long
 * time over is a call, and that has a bound of its own.
 */
const DIAL_TIMEOUT_MS = 2000;

/** Connect to the address, or reject; the socket is a {@link Connection}. */
export function dial(address: string): Promise<Connection> {
  return new Promise<Connection>((resolve, reject) => {
    const socket = net.connect(address);
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`nothing answered at ${address}`));
    }, DIAL_TIMEOUT_MS);
    socket.once('connect', () => {
      clearTimeout(timer);
      socket.removeAllListeners('error');
      socket.on('error', () => {});
      resolve(socket as unknown as Connection);
    });
    socket.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

/** The world as the client really finds it. */
export function realWorld(
  besides: string[],
  platform: NodeJS.Platform = process.platform,
): ConnectWorld {
  return {
    dial,
    // What a stopped host left behind. `force` so a socket that is already
    // gone - another client cleared it first - is not an error.
    clear: (address) => rm(address, { force: true }),
    candidates: () => findHostPrograms(besides, process.env.PATH, platform),
    start: startHost,
    wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  };
}

/**
 * A host of this build's own, as a child of this process, spoken to over its
 * pipes.
 *
 * The fallback for a caller that cannot start a host that outlives it - a
 * sandbox that will not let a process be detached, say. It is the same host
 * program, speaking the same conversation, so every operation works and
 * nothing about an answer differs; what is lost is only the machine between
 * commands, because this host goes when the command does.
 *
 * Preferred over the client doing the work itself, which would mean carrying a
 * second copy of the whole toolchain - the dialect registry and every emulator
 * under it - in a program whose job is to parse arguments and render an answer.
 */
export function dialChildServer(bundle: string): Promise<Connection> {
  return import('node:child_process').then(({ spawn }) => {
    const child = spawn(process.execPath, [bundle, '--ops', '--stdio'], {
      // Its standard error is ours: a notice it has about itself belongs on the
      // same stream every other notice goes to.
      stdio: ['pipe', 'pipe', 'inherit'],
    });
    const connection: Connection = {
      write: (bytes) => void child.stdin.write(bytes),
      on(event: 'data' | 'close', listener: (chunk: Buffer) => void): void {
        // Reads come from the child's output; the connection closing is the
        // child ending, which is the same event either way.
        if (event === 'data') child.stdout.on('data', listener);
        else child.on('close', () => listener(Buffer.alloc(0)));
      },
      end: () => child.stdin.end(),
      destroy: () => void child.kill(),
    };
    return connection;
  });
}
