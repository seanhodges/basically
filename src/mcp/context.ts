// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * What the server hands an operation.
 *
 * The command line's context is the node-only edge of the toolchain - ROMs
 * found on disk, a display painted through the headless canvas - and all of it
 * is this caller's too. What differs is the two members that describe a caller
 * holding a machine: the session is the machine that is up, and the runner is
 * the one that leaves the machine it booted running.
 */

import { cliContext } from '../cli/roms';
import type { OpContext } from '../ops/types';
import type { ServerMachine } from './session';

export interface ServerContextOptions {
  /**
   * The machine the server was started with, standing as the default for a
   * program that names none and declares none. Absent when the client is
   * expected to say which machine it means on each request.
   */
  defaultMachine?: string;
}

/**
 * The context as it stands now. Built per call rather than once, so a request
 * arriving after a program has been run is given the machine that program left
 * running rather than the absence there was at startup.
 */
export function serverContext(
  server: ServerMachine,
  options: ServerContextOptions = {},
): OpContext {
  return {
    ...cliContext(),
    session: server.session(),
    runner: server.run,
    ...(options.defaultMachine !== undefined
      ? { defaultMachine: options.defaultMachine }
      : {}),
  };
}
