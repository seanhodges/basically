// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The seam between a caller's machine and the play channel onto it.
 *
 * The same arrangement the view's seam spans - a machine that may be in this
 * thread or in a worker of its own, a listener always on the host's thread -
 * satisfied directly where the machine is in-process and by a proxy over the
 * thread's port where it is not, so nothing above either knows which it has.
 *
 * What is new here is the direction. A view's seam is read-only both ways:
 * frames go from the machine to the viewer and nothing comes back but the
 * address. A key is the first thing to travel the other way, from whoever is
 * playing to the machine, which is why {@link PlayLink.pressed} exists and why
 * a play channel can never be described as a view that also does something.
 */

import type { PlayOpened, PlayProjection } from '../../ops/types';
import type { PlayFrame } from './frames';

/** What a play channel is showing, beside the picture. */
export type PlayState =
  /** A machine is up and running on the play channel's own clock. */
  | 'playing'
  /** No machine is up; there is nothing to play. */
  | 'no-machine';

/**
 * What the machine's side of a play channel does with the display and the keys.
 *
 * Separate from {@link PlayLink} because the thing beside the machine that
 * paints frames and presses keys has no business opening a channel: it is
 * handed one that is already open.
 */
export interface PlaySink {
  /**
   * Whether a play channel is open at all. False until one has been asked for,
   * which is most of the time, and painting for one then costs nothing.
   */
  playing(): boolean;
  /**
   * Whether a frame handed over now would reach whoever is playing, rather
   * than queue behind one still on its way. A link that says no has its frame
   * dropped: what a player sees is the machine's present.
   */
  free(): boolean;
  /** One frame of the display. */
  send(frame: PlayFrame): void;
  /** Say what the channel is showing. */
  say(state: PlayState): void;
  /**
   * What to do with a key pressed at the far end. Registered by whatever holds
   * the machine, and called with the key names the schedule grammar uses.
   */
  pressed(press: (key: string, down: boolean) => void): void;
}

/** What the machine's side of a play channel can do, wherever it is running. */
export interface PlayLink extends PlaySink, PlayProjection {}

/** One caller's play channel, as the session holding it sees it. */
export interface SessionPlay extends PlayLink {
  /**
   * Say so when this channel ends, however it ends - given up, disconnected,
   * or replaced by a view. Where the machine is in a worker it is the only way
   * that thread learns to stop its clock, since nothing it asked for is being
   * answered.
   */
  ended(tell: () => void): void;
  /** The caller is gone, or has given the channel up: end it. */
  end(): Promise<void>;
}

/** What a caller is told when its toolchain cannot serve a play channel. */
export const CANNOT_PLAY =
  'This toolchain cannot serve a play channel. A machine is played through a ' +
  'host that is holding it for you.';

/** A play channel that never opens, for an arrangement that serves none. */
export function noPlay(): SessionPlay {
  return {
    open: () =>
      Promise.resolve<PlayOpened>({
        address: null,
        problem: CANNOT_PLAY,
        already: false,
        endedView: false,
      }),
    playing: () => false,
    free: () => true,
    send: () => {},
    say: () => {},
    pressed: () => {},
    ended: () => {},
    end: () => Promise.resolve(),
  };
}
