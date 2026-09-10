import { describe, expect, it } from 'vitest';
import { createViewFeed, type ViewWatcher } from './feed';

/**
 * What a view shows, without anything that carries it.
 *
 * A watcher here is a recording of what was written, so every rule about the
 * picture and the state is checked against the events themselves rather than
 * against a browser reading them.
 */

function recorder(taking = true): ViewWatcher & {
  wrote: string[];
  closed: boolean;
  drain(): void;
} {
  let drained: (() => void)[] = [];
  const watcher = {
    wrote: [] as string[],
    closed: false,
    write(chunk: string) {
      watcher.wrote.push(chunk);
      return taking;
    },
    ondrain(run: () => void) {
      drained.push(run);
    },
    close() {
      watcher.closed = true;
    },
    drain() {
      const waiting = drained;
      drained = [];
      for (const run of waiting) run();
    },
  };
  return watcher;
}

const events = (watcher: { wrote: string[] }) =>
  watcher.wrote.map((chunk) => /^event: (\w+)/.exec(chunk)?.[1]);

const frame = (png = [1, 2, 3]) => ({
  width: 4,
  height: 2,
  png: new Uint8Array(png),
});

describe('what a view shows', () => {
  it('tells a watcher what is true the moment it arrives', () => {
    const feed = createViewFeed();
    feed.say('idle');
    feed.push(frame());

    const watcher = recorder();
    feed.watch(watcher);
    // A viewer arriving between two requests would otherwise face a blank
    // page until whenever the next one happens to come.
    expect(events(watcher)).toEqual(['state', 'frame']);
    expect(watcher.wrote[0]).toContain('"idle"');
    expect(watcher.wrote[1]).toContain('"png":"AQID"');
  });

  it('distinguishes idle from working from no machine at all', () => {
    const feed = createViewFeed();
    const watcher = recorder();
    feed.watch(watcher);
    feed.say('working');
    feed.say('working');
    feed.say('idle');
    // Said once per change: a still picture is ambiguous, an unchanged one
    // repeated is only noise.
    expect(watcher.wrote.filter((c) => c.startsWith('event: state'))).toEqual([
      'event: state\ndata: {"state":"no-machine"}\n\n',
      'event: state\ndata: {"state":"working"}\n\n',
      'event: state\ndata: {"state":"idle"}\n\n',
    ]);
  });

  it('stops showing a machine that has gone', () => {
    const feed = createViewFeed();
    feed.say('idle');
    feed.push(frame());
    feed.say('no-machine');

    const late = recorder();
    feed.watch(late);
    // The picture of a machine that has gone is not the machine, and a viewer
    // told there is none must not be left looking at one.
    expect(events(late)).toEqual(['state']);
    expect(late.wrote[0]).toContain('"no-machine"');
  });

  it('holds off a picture while a watcher is behind, and takes it up again', () => {
    const feed = createViewFeed();
    const slow = recorder(false);
    feed.watch(slow);
    expect(feed.free()).toBe(false);

    slow.drain();
    expect(feed.free()).toBe(true);
    feed.push(frame());
    expect(feed.free()).toBe(false);
    slow.drain();
    expect(feed.free()).toBe(true);
  });

  it('closes every watcher when the view ends, and admits no more', () => {
    const feed = createViewFeed();
    const watching = recorder();
    feed.watch(watching);
    feed.end();
    expect(watching.closed).toBe(true);
    expect(feed.watchers).toBe(0);

    const late = recorder();
    feed.watch(late);
    expect(late.closed).toBe(true);
    expect(late.wrote).toEqual([]);
  });
});
