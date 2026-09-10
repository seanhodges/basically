// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * What a caller's projections are, to everything that is not the listener.
 *
 * The interfaces live apart from `./host.ts` so that the arrangement projecting
 * nothing - a caller in a browser, a test, a host serving one caller over its
 * own streams - can be had without the listener, its two pages and the socket
 * framing coming with it.
 */

import { noPlay, type SessionPlay } from '../play/link';
import { noView, type SessionView } from '../view/link';

/**
 * One caller's projections: a view of its machine, a play channel onto it, and
 * at most one of the two open at a time.
 */
export interface SessionProjection {
  view: SessionView;
  play: SessionPlay;
  /** The caller is gone: end whichever projection it had. */
  end(): Promise<void>;
}

export interface ProjectionHost {
  /** The projections for one caller. Binds nothing until the caller asks. */
  forSession(): SessionProjection;
  /** Stop listening; every projection ends. */
  close(): Promise<void>;
}

/** A host that projects nothing, for an arrangement that serves neither. */
export function noProjections(): ProjectionHost {
  return {
    forSession: () => ({
      view: noView(),
      play: noPlay(),
      end: () => Promise.resolve(),
    }),
    close: () => Promise.resolve(),
  };
}
