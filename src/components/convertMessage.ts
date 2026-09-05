// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Which machines a "convert this program" message from the porting guide names.
 *
 * The guide runs in the docs iframe, so nothing typechecks across the boundary
 * and every field arrives as `unknown`. Resolving them is pure and testable, so
 * it lives here rather than inside the drawer component - the same split
 * `machinePicker.ts` and `inputOverlayMode.ts` already use.
 */
import { dialects } from '../dialects/registry';
import type { Dialect } from '../dialects/types';

/**
 * Resolve a machine id from the guide to a dialect.
 *
 * The guide sends a machine id and nothing else, and the lookup matches on id
 * only. A docs page slug would not do: several machines share a page, so the
 * match would return whichever family member came first in the registry, and
 * converting to Locomotive BASIC would open a CPC 464 however clearly the
 * reader had asked for a 6128.
 */
export function dialectForMachineId(id: unknown): Dialect | undefined {
  if (typeof id !== 'string') return undefined;
  return dialects.find((d) => d.id === id);
}

/**
 * The machine a port is coming *from*: what the request named, else the machine
 * the guide last asked to have the program read as, else none.
 *
 * The second step is not belt and braces. The documentation site is a separately
 * built artifact with its own service worker, so a cached older bundle posting
 * only `toId`/`toLabel` is a real case - and that bundle still asks what the
 * program uses, naming the machine it wants it read as, which is the same
 * answer.
 *
 * The chain ends in `null` rather than in the selected dialect, and never
 * returns the target. The guide is normally reached by switching to a machine
 * that will not run the program and keeping it, so the selected dialect at
 * convert time is the machine being ported *to*; a report built on a wrongly
 * guessed source is confidently wrong advice carrying the authority of tested
 * data, which is worse than the recollection this replaces. No source means no
 * report, never a different one.
 *
 * Pure and exported so each step is pinned by a test rather than by a click, and
 * so "no source" is a value the caller has to handle rather than a fallback it
 * cannot see.
 */
export function convertSource(
  fromId: unknown,
  lastReadAs: string | null,
  target: Dialect,
): Dialect | null {
  const named = dialectForMachineId(fromId) ?? dialectForMachineId(lastReadAs);
  if (named === undefined || named.id === target.id) return null;
  return named;
}
