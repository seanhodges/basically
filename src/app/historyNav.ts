// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { useIdeStore } from './store';
import { SURFACES, isOpenValue, type SurfaceValue } from './surfaces';

/**
 * Browser back-navigation for the app's ephemeral UI surfaces.
 *
 * The IDE has no router: dialogs, panels, drawers, overlays and the mobile tabs
 * are all toggled through the Zustand store. None of them participate in browser
 * history on their own, so on mobile the hardware Back button would leave the app
 * instead of closing whatever is open - losing the unsaved program.
 *
 * This module makes Back close the most recently opened surface, stepping back
 * through stacked surfaces in LIFO order, using only the History API. It is a
 * pure observer of the store: when a surface opens it pushes a history entry, and
 * on `popstate` it writes the popped snapshot back into the store via the
 * existing setters. The store stays the single source of truth - no open/close
 * call site changes. A single guard flag stops the writes performed during a
 * `popstate` from re-triggering a push (no feedback loop).
 *
 * *Which* surfaces participate is not decided here: {@link ./surfaces} holds that
 * list, so the Escape key (see {@link ./useGlobalShortcuts}) can dismiss exactly
 * the same set. Escape in fact routes through `history.back()`, so the two
 * gestures share this one implementation of "what closes next" and cannot drift
 * apart.
 */

/** The store state, derived so `store.ts` needn't export its private interface. */
type StoreState = ReturnType<typeof useIdeStore.getState>;

/** A navigable surface key - the `key` of a {@link SURFACES} entry. */
export type NavKey = string;

/**
 * The slice of UI state that participates in history: every registered surface's
 * value, layout-gated by {@link computeSnapshot} so a restore is exact and
 * survives a breakpoint flip mid-session.
 */
export type NavSnapshot = Readonly<Record<NavKey, SurfaceValue>>;

/** Everything closed - the baseline entry and the fallback for a `null` state. */
export const BASELINE: NavSnapshot = Object.freeze(
  Object.fromEntries(SURFACES.map((s) => [s.key, null])),
);

/**
 * Derive the navigable snapshot from store state, gated by the current layout.
 *
 * Closed surfaces are normalised to `null` whether they read as `false` or
 * `null`, so "closed" has one representation and snapshots compare by value.
 */
export function computeSnapshot(s: StoreState, isMobile: boolean): NavSnapshot {
  const out: Record<NavKey, SurfaceValue> = {};
  for (const surface of SURFACES) {
    const v = surface.read(s, isMobile);
    out[surface.key] = isOpenValue(v) ? v : null;
  }
  return out;
}

export function snapshotsEqual(a: NavSnapshot, b: NavSnapshot): boolean {
  return SURFACES.every((s) => (a[s.key] ?? null) === (b[s.key] ?? null));
}

/** The set of surfaces currently open in a snapshot, as history keys. */
export function openKeys(s: NavSnapshot): NavKey[] {
  return SURFACES.filter((surface) => isOpenValue(s[surface.key] ?? null)).map(
    (surface) => surface.key,
  );
}

/** The keys of surfaces that are open on the app's initiative rather than the
 *  user's - such opens must not trap Back. */
export function autoShownKeys(s: StoreState): NavKey[] {
  return SURFACES.filter((surface) => surface.autoShown?.(s)).map(
    (s2) => s2.key,
  );
}

/**
 * Write a snapshot back into the store, calling only the writers whose surface
 * differs from the live state. Persisted setters (`setKeyboardEnabled`,
 * `setControllerEnabled`) still write through to localStorage; unrelated state
 * is left untouched. Called only from inside the `popstate` guard.
 */
export function applySnapshot(target: NavSnapshot, isMobile: boolean): void {
  const s = useIdeStore.getState();
  const cur = computeSnapshot(s, isMobile);
  for (const surface of SURFACES) {
    const want = target[surface.key] ?? null;
    if ((cur[surface.key] ?? null) !== want) surface.write(s, want);
  }
}

/** One history entry's worth of opened surface keys (usually a single key). */
interface StackEntry {
  keys: NavKey[];
}

/** Shape we stash in `history.state` so a restore knows the snapshot + depth. */
interface NavHistoryState {
  nav: NavSnapshot;
  idx: number;
  keys: NavKey[];
}

/** Minimal `window.history` surface this module uses (eases testing). */
export interface HistoryLike {
  state: unknown;
  pushState(data: unknown, unused: string, url?: string | null): void;
  replaceState(data: unknown, unused: string, url?: string | null): void;
  go(delta: number): void;
}

export interface HistorySync {
  /** Seed the baseline entry from the initial store state (never pushes). */
  init(state: StoreState): void;
  /** React to a store change - push / replace / go as the transition warrants. */
  onStoreChange(state: StoreState): void;
  /** React to a `popstate` - apply the popped snapshot back into the store. */
  onPop(event: { state: unknown }): void;
  /** Whether any surface is open, i.e. whether Back has something to close.
   *  Escape consults this so it doesn't navigate away from a closed app. */
  hasOpenSurfaces(): boolean;
}

/**
 * The reconcile state machine, factored out of the React hook so it can be
 * unit-tested against a fake history. Holds the small amount of mutable
 * bookkeeping (the last reconciled snapshot, the entry stack, the current
 * depth index and the feedback guard).
 */
export function createHistorySync(opts: {
  history: HistoryLike;
  getIsMobile: () => boolean;
}): HistorySync {
  const { history, getIsMobile } = opts;

  let last: NavSnapshot = BASELINE;
  let idx = 0;
  let stack: StackEntry[] = [];
  let applyingPop = false;
  // True while a history.go() we issued for a UI-initiated close is in
  // flight. Its popstate must not write the popped snapshot back into the
  // store: the store already holds the user's state, which may have moved on
  // during the (async) round-trip - e.g. F1 opening the docs drawer right
  // after closing Settings with the mouse.
  let selfPopInFlight = false;

  function init(state: StoreState): void {
    last = computeSnapshot(state, getIsMobile());
    idx = 0;
    stack = [];
    // Replace, never push, so the first Back from a fully-closed state still
    // leaves the app rather than being trapped.
    const data: NavHistoryState = { nav: last, idx: 0, keys: [] };
    history.replaceState(data, '');
  }

  function onStoreChange(state: StoreState): void {
    if (applyingPop) return;

    const next = computeSnapshot(state, getIsMobile());
    if (snapshotsEqual(next, last)) return;

    const nowKeys = openKeys(next);
    const prevKeys = openKeys(last);
    const opened = nowKeys.filter((k) => !prevKeys.includes(k));
    const closed = prevKeys.filter((k) => !nowKeys.includes(k));

    // Deepen: a surface opened → push one entry (excluding anything auto-shown,
    // which must not consume a Back press).
    if (opened.length > 0) {
      const auto = autoShownKeys(state);
      const pushable = opened.filter((k) => !auto.includes(k));
      if (pushable.length > 0) {
        idx += 1;
        stack.push({ keys: pushable });
        const data: NavHistoryState = { nav: next, idx, keys: pushable };
        history.pushState(data, '');
      }
      last = next;
      return;
    }

    // Shallow: a surface closed via the UI. Pop the contiguous top entries that
    // are now fully closed and step history back by that many, keeping the stack
    // balanced. `popstate` does the actual store apply (a no-op here) and the
    // stack/index maintenance.
    if (closed.length > 0) {
      const closedSet = new Set(closed);
      let steps = 0;
      while (stack.length - steps > 0) {
        const entry = stack[stack.length - 1 - steps]!;
        if (
          entry.keys.length > 0 &&
          entry.keys.every((k) => closedSet.has(k))
        ) {
          steps += 1;
        } else {
          break;
        }
      }
      if (steps > 0) {
        applyingPop = true;
        selfPopInFlight = true;
        history.go(-steps);
        return;
      }
      // Only untracked surfaces closed (e.g. an auto-shown keyboard) - nothing
      // in history to undo; just resync our mirror.
      last = next;
      return;
    }

    // Same open set, different content: a lateral mobile-tab switch or a
    // docs-topic change. Update the current entry in place so Back still exits
    // the surface rather than walking sideways.
    const keys = stack[stack.length - 1]?.keys ?? [];
    const data: NavHistoryState = { nav: next, idx, keys };
    history.replaceState(data, '');
    last = next;
  }

  function onPop(event: { state: unknown }): void {
    applyingPop = true;
    const st = (event.state ?? null) as NavHistoryState | null;
    const target = st?.nav ?? BASELINE;
    const newIdx = typeof st?.idx === 'number' ? st.idx : 0;

    const delta = idx - newIdx;
    if (delta > 0) {
      for (let i = 0; i < delta && stack.length > 0; i += 1) stack.pop();
    } else if (delta < 0 && st?.keys) {
      // Forward navigation re-opens; we only know the destination entry's keys.
      stack.push({ keys: st.keys });
    }
    idx = newIdx;

    if (selfPopInFlight) {
      // Completion of our own go() for a UI close: don't apply the (stale)
      // popped snapshot - reconcile forward instead, so anything the user
      // opened or closed during the round-trip is tracked normally.
      selfPopInFlight = false;
      applyingPop = false;
      last = target;
      onStoreChange(useIdeStore.getState());
      return;
    }

    applySnapshot(target, getIsMobile());
    // Mirror what the store actually holds, not what we asked for. Some
    // surfaces decline to re-open from a forward navigation (a confirmation
    // prompt, the variable-detail snapshot), and trusting `target` over reality
    // would leave us believing something is open that isn't - which the next
    // store change would try to "close" with a spurious extra history step.
    last = computeSnapshot(useIdeStore.getState(), getIsMobile());
    applyingPop = false;
  }

  function hasOpenSurfaces(): boolean {
    return stack.length > 0;
  }

  return { init, onStoreChange, onPop, hasOpenSurfaces };
}
