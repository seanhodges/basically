// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * One view's picture and state, and whoever is watching them.
 *
 * Written as Server-Sent Events because the machine advances only when a
 * request asks it to: the stream is silent for as long as nobody is asking
 * anything of the machine, which is most of the time, and a one-way push is
 * everything a viewer that cannot act needs. There is no clock here and no
 * pacing loop - a frame is written when a request produced one.
 *
 * A still picture is ambiguous on its own, so the state travels beside it: a
 * machine nobody is asking anything of looks exactly like one that has gone,
 * and a viewer is entitled to know which it is looking at.
 *
 * Nothing here knows about HTTP: a watcher is something that can be written to
 * and closed, which is what lets the whole feed be tested without binding
 * anything.
 */

import type { ViewFrame } from '../../dialects/headless/frameTap';

/** What a view is showing, beside the picture. */
export type ViewState =
  /** A machine is up and nothing is being asked of it. */
  | 'idle'
  /** A request is working on the machine now. */
  | 'working'
  /** No machine is up; the picture, if any, is of one that has gone. */
  | 'no-machine';

/** Somewhere a view's events are written; an HTTP response satisfies it. */
export interface ViewWatcher {
  /** Write one event. False means the far end is not keeping up. */
  write(chunk: string): boolean;
  /** Run this once the far end has caught up. */
  ondrain(run: () => void): void;
  /** Stop writing to this watcher. */
  close(): void;
}

export interface ViewFeed {
  /** Attach a watcher, which is sent the state and the latest picture at once. */
  watch(watcher: ViewWatcher): () => void;
  /** Show this picture. */
  push(frame: ViewFrame): void;
  /** Say what the machine is doing. */
  say(state: ViewState): void;
  /** Whether a picture handed over now would be written rather than queued. */
  free(): boolean;
  /** How many are watching; the listener reports it, tests read it. */
  readonly watchers: number;
  /** End the view: every watcher is closed and nothing more is written. */
  end(): void;
}

/** One Server-Sent Event. */
function event(name: string, data: unknown): string {
  return `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function createViewFeed(): ViewFeed {
  const watching = new Set<ViewWatcher>();
  let latest: { width: number; height: number; png: string } | null = null;
  let state: ViewState = 'no-machine';
  let ended = false;
  // Watchers whose last write has not been taken yet. A picture handed over
  // while any of them is behind is dropped rather than queued, so what a
  // viewer sees is the machine's present rather than an accumulating past.
  let behind = 0;

  const writeTo = (watcher: ViewWatcher, chunk: string): void => {
    if (watcher.write(chunk)) return;
    behind++;
    watcher.ondrain(() => {
      behind = Math.max(0, behind - 1);
    });
  };

  const broadcast = (chunk: string): void => {
    for (const watcher of watching) writeTo(watcher, chunk);
  };

  const feed: ViewFeed = {
    watch(watcher) {
      if (ended) {
        watcher.close();
        return () => {};
      }
      watching.add(watcher);
      // Whatever is true now, before anything else happens: a viewer arriving
      // between requests would otherwise face a blank page until the next one.
      writeTo(watcher, event('state', { state }));
      if (latest) writeTo(watcher, event('frame', latest));
      return () => {
        watching.delete(watcher);
      };
    },
    push(frame) {
      if (ended) return;
      latest = {
        width: frame.width,
        height: frame.height,
        // Text because an event stream is text. The frames are a few kilobytes
        // of a two-colour screen, so the third this costs is not worth a
        // second channel to avoid.
        png: Buffer.from(frame.png).toString('base64'),
      };
      broadcast(event('frame', latest));
    },
    say(next) {
      if (ended || next === state) return;
      state = next;
      // The picture of a machine that has gone is not the machine: a viewer
      // told there is none must not be left looking at one.
      if (next === 'no-machine') latest = null;
      broadcast(event('state', { state }));
    },
    free: () => behind === 0,
    get watchers() {
      return watching.size;
    },
    end() {
      ended = true;
      latest = null;
      for (const watcher of watching) watcher.close();
      watching.clear();
      behind = 0;
    },
  };
  return feed;
}
