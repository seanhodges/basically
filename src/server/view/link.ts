// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The seam between a caller's machine and the view of it.
 *
 * A machine may be running in this thread or in a worker of its own, and the
 * listener that serves the picture is always on the host's thread. One
 * interface spans both: satisfied directly where the machine is in-process,
 * and by a proxy over the thread's port where it is not, so nothing above
 * either arrangement knows which it has.
 *
 * Read-only in both directions that matter. Frames go from the machine to the
 * view; nothing comes back but the address, which is the caller's answer to
 * its own request. There is no path from a viewer to any of this, which is
 * what lets a machine be watched without being shared.
 */

import type { FrameSink } from '../../dialects/headless/frameTap';
import { CANNOT_PROJECT } from '../../ops/view';
import type { ViewOpened, ViewProjection } from '../../ops/types';

/** What the machine's side of a view can do, wherever the machine is running. */
export interface ViewLink extends FrameSink, ViewProjection {}

/**
 * One caller's view, as the session holding it sees it.
 *
 * The session is the only thing that knows when a request starts and stops
 * working on the machine, and whether one is up at all, so the state a viewer
 * is shown is set from here rather than derived beside the machine.
 */
export interface SessionView extends ViewLink {
  /** A request has begun working on this caller's machine. */
  working(): void;
  /** The request has settled; `held` names the machine that is up, or null. */
  settled(held: string | null): void;
  /** The caller is gone, or has given the view up: end it. */
  end(): Promise<void>;
}

/** A host that projects nothing, for an arrangement that serves no view. */
export function noViews(): {
  forSession(): SessionView;
  close(): Promise<void>;
} {
  return {
    forSession: () => ({
      open: () =>
        Promise.resolve<ViewOpened>({
          address: null,
          problem: CANNOT_PROJECT,
          already: false,
        }),
      watching: () => false,
      free: () => true,
      send: () => {},
      working: () => {},
      settled: () => {},
      end: () => Promise.resolve(),
    }),
    close: () => Promise.resolve(),
  };
}
