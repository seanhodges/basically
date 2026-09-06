// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * What to say when an operation needs a ROM this installation has not got.
 *
 * Two operations refuse for this reason and both used to stop at the diagnosis,
 * which left the user with a true statement and nothing to do about it. The
 * remedies are the command line's - a download, an agreement, a directory - so
 * naming them is a matter of text, and nothing here reaches the filesystem or
 * the network. Those live in `src/cli/romCache.ts`, which this layer may not
 * import.
 */

/** The refusal: what is missing, why it stops this, and what to do about it. */
export function noRomHere(machineName: string, soThat: string): string {
  return (
    `this installation carries no ROM for ${machineName}, so there is ${soThat}. ` +
    'Run "basically roms accept" to download the published images, or point ' +
    '--rom-root at a set you already have'
  );
}
