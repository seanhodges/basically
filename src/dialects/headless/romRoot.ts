// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Which directory the ROM images are read from.
 *
 * Its own module, and it has to stay that way. The command line's process
 * asks this question too - to report on it, and to decide whether it must
 * offer to download anything - and `runListing.ts`, where this used to sit,
 * reaches the boot harness and through it every emulator. Importing it from
 * there put the whole toolchain back into a program that boots no machine,
 * which `src/client/thinness.test.ts` exists to catch. So this file imports
 * nothing but node and the download cache.
 */

import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cachedRomRoot, heldRomRoot } from '../../cli/romCache';

/**
 * The directory holding the ROMs: what the command line obtained for itself,
 * else the `public/` of the installation this is running from.
 *
 * Bundled, this module has no idea where the checkout is - its own path is
 * wherever the bundle was written - so the directory is searched for rather
 * than derived. Returns null when there is none, which is a machine that draws
 * its missing-image notice rather than a failure.
 *
 * Read-only, deliberately: this never downloads and never asks anything. All of
 * that lives in the command line's own process, which is the only one with a
 * terminal - see `src/cli/romCache.ts`. Here the obtained set is just another
 * directory shaped like `public/`, so the three callers of this function (the
 * runner, the held-machine session and the command line's ROM probe) all see it
 * from one place rather than three.
 *
 * A *complete* obtained set wins outright: it is the one source that was
 * verified against a published manifest and is kept current. An incomplete one
 * comes last instead, behind the installation's own images, so a set briefly
 * short of a machine added upstream cannot shadow a checkout that has it.
 */
export function findRomRoot(): string | null {
  const obtained = cachedRomRoot();
  if (obtained) return obtained;

  const starts = [path.dirname(fileURLToPath(import.meta.url)), process.cwd()];
  for (const start of starts) {
    for (let dir = start; ; dir = path.dirname(dir)) {
      const candidate = path.join(dir, 'public');
      if (existsSync(path.join(candidate, 'roms'))) return candidate;
      if (path.dirname(dir) === dir) break;
    }
  }
  return heldRomRoot();
}
