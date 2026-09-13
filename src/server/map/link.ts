// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The seam between a caller's machine and the map of its memory.
 *
 * The arrangement the other two projections' seams span - a machine that may be
 * in this thread or in a worker of its own, a listener always on the host's
 * thread - satisfied directly where the machine is in-process and by a proxy
 * over the thread's port where it is not.
 *
 * Read-only in the direction that matters, as a view's is and a play channel's
 * is not: the layout and the activity go from the machine to whoever is
 * watching, and nothing comes back but the address. There is no path from a
 * watcher to any of this, and nothing here carries the value at an address -
 * what a machine records is which addresses were touched and whether the access
 * was a read or a write, and that is all there is to carry.
 */

import type { ActivitySink } from '../../dialects/headless/activityTap';
import { CANNOT_PROJECT_MAP } from '../../ops/map';
import type { MapOpened } from '../../ops/types';
import type { MemoryRegion } from '../../dialects/types';

/** One band of the map, as the page is given it ready to draw. */
export interface MapBand {
  label: string;
  kind: MemoryRegion['kind'];
  start: number;
  end: number;
}

/**
 * The machine a map is showing, sent once whenever it changes.
 *
 * The bands rather than the regions, because which regions collapse into which
 * band is a rule and the page should not have to carry it; the addresses, so
 * the page can label what it draws; and whether the machine can report what it
 * touches, because a machine that cannot say and a program that did nothing are
 * different facts and a watcher is entitled to know which it is looking at.
 */
export interface MapLayout {
  /** The machine's name, as it is written wherever a machine is named. */
  machine: string;
  addressSpace: number;
  /** What one address counts, where the machine does not count bytes. */
  addressUnit: 'byte' | 'word';
  bands: MapBand[];
  /** Whether this machine can report which addresses its processor touches. */
  reports: boolean;
}

/** What a map is showing, beside the layout and the activity. */
export type MapState =
  /** A machine is up and nothing is being asked of it. */
  | 'idle'
  /** A request is working on the machine now. */
  | 'working'
  /** No machine is up; there is nothing to map. */
  | 'no-machine';

/**
 * What the thing beside the machine does with the layout and the activity.
 *
 * Separate from {@link MapLink} for the reason a play channel's sink is: the
 * tap that drains a machine has no business opening a map, and is handed one
 * that is already open.
 */
export interface MapSink extends ActivitySink {
  /** The machine being mapped, or null when the caller holds none. */
  show(layout: MapLayout | null): void;
}

/**
 * What the machine's side of a map can do, wherever the machine is running.
 *
 * The opening half of `MapProjection` and not the whole of it: whether a
 * machine has a described layout to map is a question about the machine, and
 * the link is what carries the layout across a thread rather than what knows
 * which machine is up. Whoever holds the machine answers that, and hands the
 * operation a projection made of the two.
 */
export interface MapLink extends MapSink {
  /**
   * Open a map of the machine that is up, or hand back the one already open.
   * Answers rather than throws when no map can be projected.
   */
  open(): Promise<MapOpened>;
}

/**
 * One caller's map, as the session holding it sees it.
 *
 * The session is the only thing that knows when a request starts and stops
 * working on the machine, so what a watcher is told about that is said from
 * there rather than derived beside the machine - exactly as a view's is.
 */
export interface SessionMap extends MapLink {
  /** A request has begun working on this caller's machine. */
  working(): void;
  /** The request has settled; `held` names the machine that is up, or null. */
  settled(held: string | null): void;
  /** The caller is gone, or has given the map up: end it. */
  end(): Promise<void>;
}

// Said by the operation that answers it, so a caller told it by an arrangement
// that projects nothing is told exactly what the operation would have said.
export { CANNOT_PROJECT_MAP };

/** A map that never opens, for an arrangement that projects none. */
export function noMap(): SessionMap {
  return {
    open: () =>
      Promise.resolve<MapOpened>({
        address: null,
        problem: CANNOT_PROJECT_MAP,
        already: false,
      }),
    watching: () => false,
    free: () => true,
    send: () => {},
    show: () => {},
    working: () => {},
    settled: () => {},
    end: () => Promise.resolve(),
  };
}
