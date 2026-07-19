// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Long-press detection for pointer targets, shared by the editor tab strip's
 * delete gesture. Same shape as the GameController's remap gesture: a timer
 * armed on pointerdown, cancelled when the pointer lifts or travels far
 * enough to read as a drag/scroll, firing the callback when it elapses.
 *
 * The pure tracker (`createLongPressTracker`) holds all timing/cancel logic
 * so it unit-tests with fake timers and no DOM; `useLongPress` is the thin
 * React binding that turns it into spreadable pointer-event props.
 */

import { useMemo, useRef } from 'react';

/** Matches the GameController's remap gesture. */
const LONG_PRESS_MS = 500;
/** Pointer travel beyond this reads as a drag/scroll, not a press. */
const LONG_PRESS_MOVE_CANCEL = 12;

export interface LongPressTracker<T> {
  down(pointerId: number, x: number, y: number, payload: T): void;
  move(pointerId: number, x: number, y: number): void;
  /** Pointer lifted or cancelled: disarm without firing. */
  end(pointerId: number): void;
  /**
   * True (once) when the last gesture fired the callback - lets a click
   * handler on the same target swallow the synthetic click that follows a
   * completed long-press.
   */
  consumeFired(): boolean;
}

export function createLongPressTracker<T>(
  onLongPress: (payload: T) => void,
): LongPressTracker<T> {
  let armed: {
    pointerId: number;
    x: number;
    y: number;
    timer: ReturnType<typeof setTimeout>;
  } | null = null;
  let fired = false;

  const disarm = () => {
    if (armed) {
      clearTimeout(armed.timer);
      armed = null;
    }
  };

  return {
    down(pointerId, x, y, payload) {
      disarm();
      fired = false;
      armed = {
        pointerId,
        x,
        y,
        timer: setTimeout(() => {
          armed = null;
          fired = true;
          onLongPress(payload);
        }, LONG_PRESS_MS),
      };
    },
    move(pointerId, x, y) {
      if (!armed || armed.pointerId !== pointerId) return;
      if (Math.hypot(x - armed.x, y - armed.y) > LONG_PRESS_MOVE_CANCEL) {
        disarm();
      }
    },
    end(pointerId) {
      if (armed?.pointerId === pointerId) disarm();
    },
    consumeFired() {
      const was = fired;
      fired = false;
      return was;
    },
  };
}

/**
 * React binding: `bind(payload)` spreads onto the pressable element;
 * `consumeFired()` in the element's onClick suppresses the click that
 * follows a fired long-press.
 */
export function useLongPress<T>(onLongPress: (payload: T) => void) {
  const callbackRef = useRef(onLongPress);
  callbackRef.current = onLongPress;
  const tracker = useMemo(
    () => createLongPressTracker<T>((payload) => callbackRef.current(payload)),
    [],
  );
  const bind = (payload: T) => ({
    onPointerDown: (e: React.PointerEvent) =>
      tracker.down(e.pointerId, e.clientX, e.clientY, payload),
    onPointerMove: (e: React.PointerEvent) =>
      tracker.move(e.pointerId, e.clientX, e.clientY),
    onPointerUp: (e: React.PointerEvent) => tracker.end(e.pointerId),
    onPointerCancel: (e: React.PointerEvent) => tracker.end(e.pointerId),
  });
  return { bind, consumeFired: tracker.consumeFired };
}
