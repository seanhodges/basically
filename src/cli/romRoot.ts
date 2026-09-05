// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Where this installation reads ROM images from.
 *
 * Three answers, in order, and the order is the whole of this module: what the
 * caller named on this run, then what the installation was told once, then
 * nothing - which leaves the runner's own upward walk (`findRomRoot`) to look
 * near the bundle and near the working directory. A checkout reaches the third
 * and behaves exactly as it always has.
 *
 * The variable exists because a published toolchain carries no images at all,
 * so a user who keeps their own would otherwise repeat `--rom-root` on every
 * single run.
 *
 * Resolved to an absolute path here, in the client, for the same reason
 * `--rom-root` already is: a relative path means what it means in the directory
 * the user typed it in, and the host that will read it is somewhere else
 * entirely. Nothing crosses to the host as a relative path.
 */

import path from 'node:path';

/** What an installation says its ROM directory is, once, for every run. */
export const ROM_ROOT_VARIABLE = 'BASICALLY_ROM_ROOT';

/**
 * The ROM root to send with a call, or undefined to leave the runner to look.
 *
 * An empty or blank variable is the same as not setting one: an exported shell
 * variable that never got a value should not be read as "read ROMs from the
 * root directory".
 */
export function romRootFor(
  option: string | undefined,
  environment: NodeJS.ProcessEnv,
): string | undefined {
  const said = option ?? environment[ROM_ROOT_VARIABLE];
  if (said === undefined || said.trim() === '') return undefined;
  return path.resolve(said);
}

/** The same, folded into an operation's input beside whatever else it carries. */
export function withRomRoot<T extends { romRoot?: string }>(
  input: T,
  environment: NodeJS.ProcessEnv,
): T {
  const root = romRootFor(input.romRoot, environment);
  return root === undefined ? input : { ...input, romRoot: root };
}
