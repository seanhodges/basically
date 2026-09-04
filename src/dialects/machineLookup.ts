// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Resolve a machine by whatever a caller might call it - a CLI `-m` flag, a
 * `#MACHINE` declaration - against the registry. Split out from
 * `headless/runListing.ts` (which re-exports both for its existing callers)
 * so `resolveListing.ts` can use the very same lookup without importing a
 * module that also touches `node:fs`/`node:path` for ROM discovery.
 */

import { dialects } from './registry';
import type { Dialect } from './types';

/** Resolve a dialect by id or by the name the machine picker shows. */
export function findMachine(name: string): Dialect | undefined {
  const wanted = name.trim().toLowerCase();
  return (
    dialects.find((d) => d.id === name) ??
    dialects.find((d) => d.id.toLowerCase() === wanted) ??
    dialects.find((d) => d.name.toLowerCase() === wanted)
  );
}

/** Every registered machine, in registry order. */
export function machineList(): { id: string; name: string; blurb: string }[] {
  return dialects.map((d) => ({ id: d.id, name: d.name, blurb: d.blurb }));
}
