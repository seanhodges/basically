// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * What a caller's projections are, to everything that is not the listener.
 *
 * The interfaces live apart from `./host.ts` so that the arrangement projecting
 * nothing - a caller in a browser, a test, a host serving one caller over its
 * own streams - can be had without the listener, its pages and the socket
 * framing coming with it.
 */

import { noMap, type SessionMap } from '../map/link';
import { noPlay, type SessionPlay } from '../play/link';
import { noView, type SessionView } from '../view/link';

/**
 * One caller's projections: a view of its machine, a play channel onto it, and
 * a map of its memory.
 *
 * At most one of the view and the play channel is open at a time, because they
 * are two ways of showing one display. The map is not a display and stands
 * outside that choice: it may be open beside either, and opening it ends
 * neither.
 */
export interface SessionProjection {
  view: SessionView;
  play: SessionPlay;
  map: SessionMap;
  /** The caller is gone: end whichever projections it had. */
  end(): Promise<void>;
}

export interface ProjectionHost {
  /** The projections for one caller. Binds nothing until the caller asks. */
  forSession(): SessionProjection;
  /** Stop listening; every projection ends. */
  close(): Promise<void>;
}

/** A host that projects nothing, for an arrangement that serves none of them. */
export function noProjections(): ProjectionHost {
  return {
    forSession: () => ({
      view: noView(),
      play: noPlay(),
      map: noMap(),
      end: () => Promise.resolve(),
    }),
    close: () => Promise.resolve(),
  };
}
