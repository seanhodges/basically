// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLongPressTracker } from './useLongPress';

describe('createLongPressTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires the callback with the press position after the interval', () => {
    const fired: [string, { x: number; y: number }][] = [];
    const t = createLongPressTracker<string>((p, pos) => fired.push([p, pos]));
    t.down(1, 10, 20, 'blk');
    vi.advanceTimersByTime(499);
    expect(fired).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(fired).toEqual([['blk', { x: 10, y: 20 }]]);
  });

  it('does not fire when the pointer lifts early', () => {
    const fired: string[] = [];
    const t = createLongPressTracker<string>((p) => fired.push(p));
    t.down(1, 10, 10, 'blk');
    vi.advanceTimersByTime(300);
    t.end(1);
    vi.advanceTimersByTime(1000);
    expect(fired).toEqual([]);
  });

  it('cancels when the pointer travels beyond the drag threshold', () => {
    const fired: string[] = [];
    const t = createLongPressTracker<string>((p) => fired.push(p));
    t.down(1, 10, 10, 'blk');
    t.move(1, 30, 10); // 20px: a horizontal tab-strip scroll
    vi.advanceTimersByTime(1000);
    expect(fired).toEqual([]);
  });

  it('survives small pointer jitter', () => {
    const fired: string[] = [];
    const t = createLongPressTracker<string>((p) => fired.push(p));
    t.down(1, 10, 10, 'blk');
    t.move(1, 14, 12); // within the threshold
    vi.advanceTimersByTime(500);
    expect(fired).toEqual(['blk']);
  });

  it('ignores moves and ends from other pointers', () => {
    const fired: string[] = [];
    const t = createLongPressTracker<string>((p) => fired.push(p));
    t.down(1, 10, 10, 'blk');
    t.move(2, 300, 300);
    t.end(2);
    vi.advanceTimersByTime(500);
    expect(fired).toEqual(['blk']);
  });

  it('consumeFired reports a completed press exactly once', () => {
    const t = createLongPressTracker<string>(() => {});
    t.down(1, 0, 0, 'blk');
    vi.advanceTimersByTime(500);
    expect(t.consumeFired()).toBe(true);
    expect(t.consumeFired()).toBe(false);
    // An aborted press never reports fired.
    t.down(1, 0, 0, 'blk');
    t.end(1);
    expect(t.consumeFired()).toBe(false);
  });

  it('a new press re-arms after a fired one', () => {
    const fired: string[] = [];
    const t = createLongPressTracker<string>((p) => fired.push(p));
    t.down(1, 0, 0, 'a');
    vi.advanceTimersByTime(500);
    t.down(1, 0, 0, 'b');
    vi.advanceTimersByTime(500);
    expect(fired).toEqual(['a', 'b']);
  });
});
