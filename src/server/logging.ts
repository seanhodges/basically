// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Keep what the machines say off the channel that carries an answer.
 *
 * jsbeeb announces each ROM it loads on `console.log`, which would otherwise
 * land in the middle of the screen text on standard output and make the output
 * useless to anything reading it. The same rule holds for a server for its
 * whole life: standard output belongs to the protocol it is speaking.
 *
 * Its own module rather than the command line's, because a host has no command
 * line around it and importing one would run it.
 */

/** Send anything logged to standard error until the returned undo is called. */
export function divertLogging(): () => void {
  const kept = { log: console.log, info: console.info, debug: console.debug };
  const toStderr = (...parts: unknown[]) =>
    process.stderr.write(`${parts.map(String).join(' ')}\n`);
  console.log = toStderr;
  console.info = toStderr;
  console.debug = toStderr;
  return () => Object.assign(console, kept);
}
