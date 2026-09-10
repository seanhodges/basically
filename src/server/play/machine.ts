// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * A machine while somebody is playing it: the clock that keeps it running and
 * the keys that reach it.
 *
 * This sits beside the machine - in its worker, or in the one thread of a host
 * serving a single caller - and it is the only place in the toolchain that
 * advances a machine nobody has asked anything of. Everything it does, it stops
 * doing the moment the channel ends, which is what confines the exception to a
 * machine that is explicitly being played.
 *
 * Each tick: advance whatever frames are due, paint the display, and send the
 * result unless it is the last frame over again or whoever is playing is behind
 * with the one before. Painting spends none of the machine's frames - it reads
 * the picture the machine already has - so the only thing carrying the display
 * costs is the time it takes, which the measurements above bounded.
 *
 * The channel follows the caller rather than the machine. A caller that runs a
 * second program is playing the new machine on the same address, and one that
 * lets its machine go is told there is nothing to play rather than left looking
 * at a picture of what has gone.
 */

import { resolveKeyName } from '../../keyboard/keyNames';
import type { Dialect, MachineEmulator } from '../../dialects/types';
import type { PaintedFrame } from '../../ops/types';
import { createPlayClock, type PlayClock } from './clock';
import { createPlayFrames } from './frames';
import type { PlaySink, PlayState } from './link';

/**
 * The key name that releases everything.
 *
 * A frame that loses the keyboard - the application behind it took focus, the
 * window went away - cannot send a key-up for what it never saw go up, so it
 * says this instead. Not a name any machine has, which is why it is safe to
 * spend on: `resolveKeyName` would refuse it.
 */
export const RELEASE_EVERYTHING = '*';

/**
 * How often a channel with no machine to play looks again.
 *
 * The clock runs whether or not a machine is up, because a channel has to
 * notice one turning up and has to notice its own ending. Ten times a second
 * is soon enough for both and costs a comparison each time.
 */
const IDLE_HZ = 10;

export interface PlayedMachineDeps {
  /** The machine that is up, or null when the caller holds none. */
  held(): { machine: MachineEmulator; dialect: Dialect } | null;
  /** Advance the held machine one frame, folding whatever its holder folds. */
  step(): void;
  /**
   * Paint the held machine's display now, charging nothing: painting reads the
   * machine's current picture rather than advancing it.
   */
  paint(): PaintedFrame | null;
  play: PlaySink;
  /** The clock's timing, injected by the tests; its own otherwise. */
  clock?: {
    now?(): number;
    schedule?(run: () => void, ms: number): () => void;
  };
}

export interface PlayedMachine {
  /** A channel has opened: start advancing the machine. */
  start(): void;
  /** Stop advancing it and let go of every key being held. */
  stop(): void;
  /** Whether the machine is advancing on the play channel's clock. */
  readonly running: boolean;
}

export function createPlayedMachine(deps: PlayedMachineDeps): PlayedMachine {
  const frames = createPlayFrames();
  // Every token whoever is playing has pressed and not released, so a channel
  // that ends mid-keypress cannot leave a key stuck down on the machine.
  const down = new Set<string>();
  /** The machine the last frame was painted from, so a new one starts afresh. */
  let painting: MachineEmulator | null = null;
  let clock: PlayClock | null = null;
  /** Said only when it changes: this runs at the machine's rate. */
  let saying: PlayState | null = null;

  const releaseEverything = (): void => {
    if (down.size === 0) return;
    const machine = deps.held()?.machine;
    for (const token of down) machine?.setKey(token, false);
    down.clear();
    // Belt and braces over the tokens this channel pressed: a machine that
    // holds keys some other way lets go of those too.
    machine?.releaseAllKeys();
  };

  const press = (name: string, isDown: boolean): void => {
    const up = deps.held();
    if (!up) return;
    if (name === RELEASE_EVERYTHING && !isDown) {
      releaseEverything();
      return;
    }
    // The same names a written schedule presses, resolved through the same
    // resolver: a key pressed by hand and the same key in a schedule reach the
    // machine as the same key, or a program checked one way and played the
    // other would behave differently for no reason anyone could see. A name
    // this machine has no key for is refused here rather than pressed at
    // something nearby.
    const tokens = resolveKeyName(up.dialect.keyboardLayout, name);
    if (!tokens) return;
    for (const token of tokens) {
      up.machine.setKey(token, isDown);
      if (isDown) down.add(token);
      else down.delete(token);
    }
  };

  /** Paint what the machine shows now and send it, unless there is no point. */
  const show = (): void => {
    if (!deps.play.free()) return;
    const painted = deps.paint();
    if (!painted) return;
    const frame = frames.encode(painted.rgba, painted.width, painted.height);
    if (frame) deps.play.send(frame);
  };

  const tick = (): void => {
    // The host ends a channel when its caller gives it up, disconnects, or
    // asks for a view instead, and the clock is what notices: a machine goes
    // back to advancing only when asked without anything having to tell it.
    if (!deps.play.playing()) {
      stop();
      return;
    }
    const up = deps.held();
    const state: PlayState = up ? 'playing' : 'no-machine';
    if (state !== saying) {
      saying = state;
      deps.play.say(state);
    }
    if (!up) {
      painting = null;
      frames.reset();
      return;
    }
    // A caller that ran a second program is playing a new machine on the same
    // address, and the first frame of it must be sent whatever it shows.
    if (up.machine !== painting) {
      painting = up.machine;
      frames.reset();
      releaseEverything();
    }
    deps.step();
    show();
  };

  const stop = (): void => {
    clock?.stop();
    clock = null;
    releaseEverything();
    frames.reset();
    painting = null;
    saying = null;
  };

  return {
    start() {
      if (clock) return;
      deps.play.pressed(press);
      clock = createPlayClock({
        // Read every tick rather than cached: a machine whose rate comes from
        // display registers changes it as the program runs.
        frameHz: () => deps.held()?.machine.frameHz ?? IDLE_HZ,
        frame: tick,
        ...deps.clock,
      });
      clock.start();
    },
    stop,
    get running() {
      return clock !== null;
    },
  };
}
