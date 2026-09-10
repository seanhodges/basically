import { describe, expect, it } from 'vitest';
import { getDialect } from '../../dialects/registry';
import type { Dialect, MachineEmulator } from '../../dialects/types';
import type { PaintedFrame } from '../../ops/types';
import type { PlayFrame } from './frames';
import type { PlaySink, PlayState } from './link';
import { createPlayedMachine, RELEASE_EVERYTHING } from './machine';

/**
 * A machine that records what was pressed on it, without booting anything.
 *
 * The keys are the subject, and the tokens they resolve to are the real
 * dialect's - a stub layout would be checking the stub. The emulator itself is
 * where nothing is learned by booting one: `setKey` takes an opaque token and
 * puts it on a matrix.
 */
function stubMachine(frameHz = 50): MachineEmulator & { keys: string[] } {
  const keys: string[] = [];
  return {
    keys,
    frameHz,
    setKey: (token: string, down: boolean) =>
      keys.push(`${down ? '+' : '-'}${token}`),
    releaseAllKeys: () => keys.push('*'),
  } as unknown as MachineEmulator & { keys: string[] };
}

/** A channel that records what reached it, and can be told it is behind. */
function stubPlay() {
  const frames: PlayFrame[] = [];
  const states: PlayState[] = [];
  let open = true;
  let free = true;
  let press: ((key: string, down: boolean) => void) | null = null;
  const sink: PlaySink = {
    playing: () => open,
    free: () => free,
    send: (frame) => frames.push(frame),
    say: (state) => states.push(state),
    pressed: (handler) => {
      press = handler;
    },
  };
  return {
    sink,
    frames,
    states,
    type: (key: string, down: boolean) => press?.(key, down),
    fallBehind: () => {
      free = false;
    },
    catchUp: () => {
      free = true;
    },
    end: () => {
      open = false;
    },
  };
}

/** A virtual clock, so the pacing is exact rather than a tolerance. */
function fakeTime() {
  let at = 0;
  let pending: { at: number; run: () => void } | null = null;
  return {
    now: () => at,
    schedule: (run: () => void, ms: number) => {
      pending = { at: at + ms, run };
      return () => {
        pending = null;
      };
    },
    advance(ms: number) {
      const until = at + ms;
      for (let guard = 0; guard < 100_000; guard++) {
        if (!pending || pending.at > until) break;
        at = Math.max(at, pending.at);
        const due = pending;
        pending = null;
        due.run();
      }
      at = until;
    },
  };
}

/** A picture whose every pixel is `value`, so two of them compare equal. */
function flat(value: number): PaintedFrame {
  return { width: 4, height: 2, rgba: new Uint8ClampedArray(32).fill(value) };
}

function played(options: {
  play: ReturnType<typeof stubPlay>;
  time: ReturnType<typeof fakeTime>;
  machine?: MachineEmulator | null;
  picture?: () => PaintedFrame | null;
}) {
  let steps = 0;
  const dialect = getDialect('zx81') as Dialect;
  const machine =
    options.machine === undefined ? stubMachine() : options.machine;
  return {
    steps: () => steps,
    machine,
    played: createPlayedMachine({
      held: () => (machine ? { machine, dialect } : null),
      step: () => steps++,
      paint: options.picture ?? (() => flat(0)),
      play: options.play.sink,
      clock: { now: options.time.now, schedule: options.time.schedule },
    }),
  };
}

describe('a machine while somebody is playing it', () => {
  it('advances on its own clock, and not at all before a channel opens', () => {
    const time = fakeTime();
    const play = stubPlay();
    const one = played({ play, time });
    // The clock exists and is not running: a machine nobody is playing
    // advances only when a request asks it to.
    time.advance(1000);
    expect(one.steps()).toBe(0);
    one.played.start();
    time.advance(1000);
    expect(one.steps()).toBe(51);
    expect(play.states).toEqual(['playing']);
  });

  it('stops advancing the moment the channel ends', () => {
    const time = fakeTime();
    const play = stubPlay();
    const one = played({ play, time });
    one.played.start();
    time.advance(1000);
    const ran = one.steps();
    // Ended by the host - the caller gave it up, or asked for a view - which
    // this thread learns by asking rather than by being interrupted.
    play.end();
    time.advance(1000);
    expect(one.steps()).toBe(ran);
    expect(one.played.running).toBe(false);
  });

  it('presses the key a schedule of the same name would press', () => {
    const time = fakeTime();
    const play = stubPlay();
    const one = played({ play, time });
    one.played.start();
    play.type('A', true);
    play.type('A', false);
    play.type('ENTER', true);
    // The names resolve through the same resolver a written schedule uses, so
    // what reaches the matrix is the machine's own cell for that name.
    expect(one.machine!.keys).toEqual(['+KeyA', '-KeyA', '+Enter']);
  });

  it('presses nothing for a key the machine has not got', () => {
    const time = fakeTime();
    const play = stubPlay();
    const one = played({ play, time });
    one.played.start();
    play.type('F12', true);
    expect(one.machine!.keys).toEqual([]);
  });

  it('lets go of every key when the frame loses the keyboard, and when the channel ends', () => {
    const time = fakeTime();
    const play = stubPlay();
    const one = played({ play, time });
    one.played.start();
    play.type('A', true);
    play.type(RELEASE_EVERYTHING, false);
    expect(one.machine!.keys).toEqual(['+KeyA', '-KeyA', '*']);
    play.type('B', true);
    one.played.stop();
    // A channel that ends mid-keypress must not leave the key down.
    expect(one.machine!.keys.slice(3)).toEqual(['+KeyB', '-KeyB', '*']);
  });

  it('drops a frame rather than queueing it when the far end is behind', () => {
    const time = fakeTime();
    const play = stubPlay();
    let shade = 0;
    const one = played({ play, time, picture: () => flat(shade++) });
    one.played.start();
    time.advance(100);
    const sent = play.frames.length;
    expect(sent).toBeGreaterThan(1);
    play.fallBehind();
    time.advance(100);
    // The machine goes on running; what is not sent is the past.
    expect(play.frames.length).toBe(sent);
    expect(one.steps()).toBeGreaterThan(sent);
    play.catchUp();
    time.advance(100);
    expect(play.frames.length).toBeGreaterThan(sent);
  });

  it('sends nothing for a machine drawing the same picture', () => {
    const time = fakeTime();
    const play = stubPlay();
    const one = played({ play, time, picture: () => flat(9) });
    one.played.start();
    time.advance(1000);
    expect(one.steps()).toBe(51);
    // At a prompt the machine draws the same thing every frame, and the
    // channel is silent for it.
    expect(play.frames).toHaveLength(1);
  });

  it('says there is no machine rather than showing one that has gone', () => {
    const time = fakeTime();
    const play = stubPlay();
    const one = played({ play, time, machine: null });
    one.played.start();
    time.advance(1000);
    expect(play.states).toEqual(['no-machine']);
    expect(play.frames).toEqual([]);
    expect(one.steps()).toBe(0);
  });
});
