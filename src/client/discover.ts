// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Where a host program might be, and how to start one.
 *
 * Beside the client first, then on `PATH`. Beside first because a checkout
 * being worked on should be served by its own build rather than by whatever
 * happens to be installed - the two would in any case listen at different
 * addresses, so reaching for the installed one would silently start a second
 * host rather than use the intended one.
 *
 * The name differs by platform: `basically-server` is a shell script that
 * cmd.exe cannot run, and `basically-server.cmd` is the one it can. Both are
 * looked for, in the order that platform prefers, so a checkout works from
 * PowerShell and from a POSIX shell alike.
 */

import { access, constants } from 'node:fs/promises';
import path from 'node:path';

/** The file names a host program goes by, most preferred first. */
export function programNames(platform: NodeJS.Platform): string[] {
  return platform === 'win32'
    ? ['basically-server.cmd', 'basically-server.bat', 'basically-server']
    : ['basically-server'];
}

/**
 * The directories to look in, in order: beside the client, then each entry of
 * `PATH`.
 */
export function searchPath(
  besides: string[],
  pathVariable: string | undefined,
  platform: NodeJS.Platform,
): string[] {
  const separator = platform === 'win32' ? ';' : ':';
  const fromPath = (pathVariable ?? '')
    .split(separator)
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');
  return [...besides, ...fromPath];
}

async function runnable(
  file: string,
  platform: NodeJS.Platform,
): Promise<boolean> {
  try {
    // Windows has no execute bit worth asking about; being there is the test.
    await access(file, platform === 'win32' ? constants.F_OK : constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** Every host program found, in the order to prefer them. */
export async function findHostPrograms(
  besides: string[],
  pathVariable: string | undefined,
  platform: NodeJS.Platform,
): Promise<string[]> {
  const found: string[] = [];
  for (const directory of searchPath(besides, pathVariable, platform)) {
    for (const name of programNames(platform)) {
      const file = path.join(directory, name);
      if (await runnable(file, platform)) found.push(file);
    }
  }
  return found;
}

/**
 * Start a host and stop caring about it.
 *
 * Detached and with its streams let go, so the host outlives the command that
 * started it: a client that starts a host and then exits must not take it down
 * with it, and must not be kept alive by it either.
 */
export async function startHost(program: string): Promise<void> {
  const { spawn } = await import('node:child_process');
  const child = spawn(program, [], {
    detached: true,
    stdio: 'ignore',
    // A `.cmd` is not an executable image; Windows needs its shell to run one.
    shell: process.platform === 'win32' && program.endsWith('.cmd'),
  });
  await new Promise<void>((resolve, reject) => {
    child.once('error', reject);
    // Nothing to wait for beyond the spawn succeeding: the host binds its
    // address when it is ready, and the caller is already retrying the connect.
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });
}
