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
