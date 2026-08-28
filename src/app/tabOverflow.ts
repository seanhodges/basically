// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Which of the editor's tabs the strip has room to show, and which fall into
 * its overflow menu.
 *
 * The whole decision, kept out of the component so it is checkable without a
 * browser: the component measures - the bar's width, each tab's width - and
 * this says what to draw. The one part only a browser can answer is the
 * measurement itself.
 */

/**
 * How many of the tabs shown may be files the program saved.
 *
 * Recency alone is not enough: a program saving in a loop writes files that are
 * all more recent than anything the user opened, and would push every block and
 * scratch tab into the overflow. The BASIC tab is pinned so the program itself
 * is never lost, but the user's own tabs should not be evictable by machine
 * output either.
 */
export const MAX_DATA_TABS = 4;

/** A tab as the strip holds it, in the strip's own order. */
export interface StripTab {
  key: string;
  kind: 'basic' | 'block' | 'scratch' | 'data';
  /** When the program wrote it. Data tabs only - what they rank by unshown. */
  updatedAt?: number;
}

/**
 * Generic in the tab so a caller can hand in whatever it needs to draw a tab -
 * its label, its glyph, the `ActiveTab` it selects - and get those back rather
 * than a key to look the tab up by again.
 */
export interface FitInput<T extends StripTab = StripTab> {
  /** Every tab, in the order the strip draws them, the BASIC tab first. */
  tabs: readonly T[];
  /** Measured tab widths by key. A key absent has not been measured yet. */
  widths: ReadonlyMap<string, number>;
  /** When each tab was last shown (`IdeState.tabTouchedAt`). */
  touchedAt: Readonly<Record<string, number>>;
  /** The strip's own width. 0 means it has not been measured yet. */
  barWidth: number;
  /** Width of the add-a-tab button, which is always drawn. */
  addWidth: number;
  /** Width of the overflow button, needed only where there is overflow. */
  overflowWidth: number;
}

export interface Fit<T extends StripTab = StripTab> {
  /** The tabs to draw, in the strip's own order. */
  shown: readonly T[];
  /** The tabs the overflow menu lists, in the strip's own order. */
  hidden: readonly T[];
}

/**
 * How recently a tab was used. A tab never shown ranks by when it came into
 * being, which for a saved file is when the program wrote it - the same
 * `Date.now()` scale the stamps are on, so a file written a second ago outranks
 * a block last opened a minute ago with no rule of its own for arrival. A block
 * or buffer never shown ranks oldest, which puts a freshly opened document's
 * tabs in the strip's own order.
 */
export function rankOf(
  tab: StripTab,
  touchedAt: Readonly<Record<string, number>>,
) {
  const stamp = touchedAt[tab.key];
  if (stamp !== undefined) return stamp;
  return tab.kind === 'data' ? (tab.updatedAt ?? 0) : 0;
}

/**
 * The tabs competing for the room left over, most recently used first. Ties
 * break on the strip's order, so equal stamps read left to right.
 */
function ranked<T extends StripTab>(input: FitInput<T>): T[] {
  return input.tabs
    .map((tab, index) => ({ tab, index }))
    .filter((e) => e.tab.kind !== 'basic')
    .sort((a, b) => {
      const diff =
        rankOf(b.tab, input.touchedAt) - rankOf(a.tab, input.touchedAt);
      return diff !== 0 ? diff : a.index - b.index;
    })
    .map((e) => e.tab);
}

/**
 * One pass of the fit. An unmeasured tab costs nothing, so a first render shows
 * everything and the layout effect that measures corrects it before paint,
 * rather than the strip opening empty.
 */
function admit<T extends StripTab>(
  input: FitInput<T>,
  reserveOverflow: boolean,
): Set<string> {
  const shown = new Set<string>();
  let budget = input.barWidth - input.addWidth;
  if (reserveOverflow) budget -= input.overflowWidth;

  const basic = input.tabs.find((t) => t.kind === 'basic');
  if (basic) {
    // Pinned: shown whatever the width, so the way back to the program is never
    // hidden. It can overrun the budget, and then nothing else fits.
    shown.add(basic.key);
    budget -= input.widths.get(basic.key) ?? 0;
  }

  let dataShown = 0;
  for (const tab of ranked(input)) {
    if (tab.kind === 'data' && dataShown >= MAX_DATA_TABS) continue;
    const width = input.widths.get(tab.key) ?? 0;
    // Stop rather than look further down the ranking for something narrower:
    // admitting by width would order the strip by size, so a tab would appear
    // while a more recently used one did not, for no reason the user can see.
    if (width > budget) break;
    budget -= width;
    shown.add(tab.key);
    if (tab.kind === 'data') dataShown += 1;
  }
  return shown;
}

/**
 * Split the strip into the tabs it can show and the tabs its overflow menu
 * lists. Both come back in the strip's own order: recency decides which tabs
 * are shown, never where a shown tab sits, so a tab does not move under the
 * pointer as it is used.
 */
export function fitTabs<T extends StripTab>(input: FitInput<T>): Fit<T> {
  // Unmeasured: show everything for the one render before the bar is observed.
  if (input.barWidth <= 0) return { shown: input.tabs, hidden: [] };

  // The overflow button needs room only once it exists, which is not known
  // until the fit is computed - so compute it without, and again with it if
  // anything was left over. Exact, where reserving it always would leave a gap
  // whenever every tab fits.
  let shown = admit(input, false);
  if (shown.size < input.tabs.length) shown = admit(input, true);

  return {
    shown: input.tabs.filter((t) => shown.has(t.key)),
    hidden: input.tabs.filter((t) => !shown.has(t.key)),
  };
}
