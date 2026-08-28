// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import {
  fitTabs,
  MAX_DATA_TABS,
  type FitInput,
  type StripTab,
} from './tabOverflow';

const BASIC: StripTab = { key: 'basic', kind: 'basic' };

/** Every tab 100 wide unless named otherwise, so budgets read as tab counts. */
function fit(
  tabs: readonly StripTab[],
  barWidth: number,
  opts: {
    touchedAt?: Record<string, number>;
    widths?: Record<string, number>;
    addWidth?: number;
    overflowWidth?: number;
  } = {},
) {
  const widths = new Map<string, number>(
    tabs.map((t) => [t.key, opts.widths?.[t.key] ?? 100]),
  );
  const input: FitInput = {
    tabs,
    widths,
    touchedAt: opts.touchedAt ?? {},
    barWidth,
    addWidth: opts.addWidth ?? 0,
    overflowWidth: opts.overflowWidth ?? 0,
  };
  const result = fitTabs(input);
  return {
    shown: result.shown.map((t) => t.key),
    hidden: result.hidden.map((t) => t.key),
  };
}

const block = (id: string): StripTab => ({ key: `block:${id}`, kind: 'block' });
const scratch = (id: string): StripTab => ({
  key: `scratch:${id}`,
  kind: 'scratch',
});
const data = (name: string, updatedAt: number): StripTab => ({
  key: `data:${name}`,
  kind: 'data',
  updatedAt,
});

describe('fitTabs', () => {
  it('shows every tab and overflows nothing when they all fit', () => {
    const tabs = [BASIC, block('a'), scratch('b')];
    expect(fit(tabs, 500)).toEqual({
      shown: ['basic', 'block:a', 'scratch:b'],
      hidden: [],
    });
  });

  it('shows every tab while the bar is unmeasured', () => {
    // The first render, before the ResizeObserver has reported: opening empty
    // and filling in would flash, where showing everything settles down.
    const tabs = [BASIC, block('a'), block('b')];
    expect(fit(tabs, 0).shown).toEqual(['basic', 'block:a', 'block:b']);
  });

  it('pins the BASIC tab even where nothing else fits', () => {
    const tabs = [BASIC, block('a')];
    expect(fit(tabs, 120)).toEqual({ shown: ['basic'], hidden: ['block:a'] });
  });

  it('keeps the BASIC tab where the bar is narrower than the tab itself', () => {
    const tabs = [BASIC, block('a')];
    expect(fit(tabs, 40).shown).toEqual(['basic']);
  });

  it('keeps the most recently used tab over an older one of the same width', () => {
    const tabs = [BASIC, block('old'), block('new')];
    expect(
      fit(tabs, 250, {
        touchedAt: { 'block:old': 1_000, 'block:new': 2_000 },
      }),
    ).toEqual({ shown: ['basic', 'block:new'], hidden: ['block:old'] });
  });

  it('draws the tabs it shows in the strip order, not in recency order', () => {
    const tabs = [BASIC, block('a'), block('b'), block('c')];
    // `c` is the most recent, `a` next - but the strip's order is a, b, c.
    expect(
      fit(tabs, 350, {
        touchedAt: { 'block:a': 2_000, 'block:c': 3_000 },
      }).shown,
    ).toEqual(['basic', 'block:a', 'block:c']);
  });

  it('shows the tab that was just used', () => {
    // The tab being shown was the last one activated, so recency alone keeps it
    // out of the overflow - there is no second rule enforcing it.
    const tabs = [BASIC, block('a'), block('b'), block('c'), block('d')];
    for (const key of ['block:a', 'block:b', 'block:c', 'block:d']) {
      expect(
        fit(tabs, 250, { touchedAt: { [key]: Date.now() } }).shown,
      ).toContain(key);
    }
  });

  it('reserves room for the overflow button only where there is overflow', () => {
    const tabs = [BASIC, block('a'), block('b')];
    // Exactly the three tabs fit; nothing overflows, so no room is set aside
    // and the strip is not one tab short of what it can hold.
    expect(fit(tabs, 300, { overflowWidth: 40 }).hidden).toEqual([]);
    // One pixel less and the third tab has to go - and the button that lists it
    // has to be paid for, which costs the second tab as well.
    expect(fit(tabs, 299, { overflowWidth: 260 })).toEqual({
      shown: ['basic'],
      hidden: ['block:a', 'block:b'],
    });
  });

  it('stops at the first tab that does not fit rather than finding a narrower one', () => {
    const tabs = [BASIC, block('wide'), block('thin')];
    expect(
      fit(tabs, 260, {
        widths: { basic: 100, 'block:wide': 200, 'block:thin': 20 },
        touchedAt: { 'block:wide': 2_000, 'block:thin': 1_000 },
      }),
    ).toEqual({ shown: ['basic'], hidden: ['block:wide', 'block:thin'] });
  });

  it('counts the add-a-tab button against the width', () => {
    const tabs = [BASIC, block('a')];
    expect(fit(tabs, 240, { addWidth: 45 }).hidden).toEqual(['block:a']);
    expect(fit(tabs, 240, { addWidth: 40 }).hidden).toEqual([]);
  });

  it('holds saved files to their bound however recent they are', () => {
    const files = Array.from({ length: MAX_DATA_TABS + 3 }, (_, i) =>
      data(`F${i}`, 9_000 + i),
    );
    const tabs = [BASIC, block('mine'), scratch('mine'), ...files];
    // Room for everything, and every file is more recent than either of the
    // user's own tabs - which is exactly a program saving in a loop.
    const result = fit(tabs, 10_000, {
      touchedAt: { 'block:mine': 1_000, 'scratch:mine': 1_000 },
    });
    expect(result.shown).toContain('block:mine');
    expect(result.shown).toContain('scratch:mine');
    expect(result.shown.filter((k) => k.startsWith('data:'))).toHaveLength(
      MAX_DATA_TABS,
    );
    // The bound is on how many show, not on which: the three oldest overflow.
    expect(result.hidden).toEqual(['data:F0', 'data:F1', 'data:F2']);
  });

  it('ranks an unshown saved file by when the program wrote it', () => {
    const tabs = [BASIC, block('a'), data('FRESH', 5_000)];
    expect(fit(tabs, 250, { touchedAt: { 'block:a': 4_000 } }).shown).toEqual([
      'basic',
      'data:FRESH',
    ]);
    expect(fit(tabs, 250, { touchedAt: { 'block:a': 6_000 } }).shown).toEqual([
      'basic',
      'block:a',
    ]);
  });

  it('opens an untouched document on its first tabs, in order', () => {
    const tabs = [BASIC, block('a'), block('b'), block('c')];
    expect(fit(tabs, 300).shown).toEqual(['basic', 'block:a', 'block:b']);
  });
});
