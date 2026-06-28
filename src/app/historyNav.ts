// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { useIdeStore } from './store';

/**
 * Browser back-navigation for the app's ephemeral UI surfaces.
 *
 * The IDE has no router: mobile tabs, the settings dialog, the AI panel, the
 * on-screen keyboard, the gamepad and the docs drawer are all toggled through
 * the Zustand store. None of them participate in browser history, so on mobile
 * the hardware Back button leaves the app instead of closing whatever is open.
 *
 * This module makes Back close the most recently opened surface, stepping back
 * through stacked surfaces in LIFO order, using only the History API. It is a
 * pure observer of the store: when a surface opens it pushes a history entry,
 * and on `popstate` it writes the popped snapshot back into the store via the
 * existing setters. The store stays the single source of truth — no open/close
 * call site changes. A single guard flag stops the writes performed during a
 * `popstate` from re-triggering a push (no feedback loop).
 */

/** The store state, derived so `store.ts` needn't export its private interface. */
type StoreState = ReturnType<typeof useIdeStore.getState>;

/** A navigable surface key. Note the four mobile tabs collapse to a single
 *  `'tab'` key: switching between non-editor tabs is lateral (one Back returns
 *  straight to the editor), matching the chosen mobile UX. */
export type NavKey =
  | 'tab'
  | 'settings'
  | 'ai'
  | 'keyboard'
  | 'controller'
  | 'docs';

/**
 * The slice of UI state that participates in history. Both the mobile
 * (`mobileTab`) and desktop (`settingsOpen`/`aiPanelOpen`) representations are
 * captured, layout-gated by {@link computeSnapshot}, so a restore is exact and
 * survives a breakpoint flip mid-session.
 */
export interface NavSnapshot {
  /** A non-editor mobile tab (`'preview' | 'ai' | 'settings'`), or `null` for
   *  the base editor tab / any desktop layout. */
  mobileTab: 'preview' | 'ai' | 'settings' | null;
  /** Desktop settings dialog. */
  settingsOpen: boolean;
  /** Desktop AI panel. */
  aiPanelOpen: boolean;
  /** On-screen keyboard docked (`bottomOverlay === 'keyboard'`). */
  keyboard: boolean;
  /** Gamepad enabled. */
  controller: boolean;
  /** Docs drawer open. */
  docsOpen: boolean;
  /** Docs sub-path the drawer is showing (only meaningful while open). */
  docsTopic: string | null;
}

/** Everything closed — the baseline entry and the fallback for a `null` state. */
export const BASELINE: NavSnapshot = {
  mobileTab: null,
  settingsOpen: false,
  aiPanelOpen: false,
  keyboard: false,
  controller: false,
  docsOpen: false,
  docsTopic: null,
};

/** Derive the navigable snapshot from store state, gated by the current layout. */
export function computeSnapshot(s: StoreState, isMobile: boolean): NavSnapshot {
  return {
    // On mobile the tab carries editor/preview/ai/settings; on desktop those
    // surfaces live in their own fields, so the tab is irrelevant there.
    mobileTab: isMobile && s.mobileTab !== 'editor' ? s.mobileTab : null,
    settingsOpen: isMobile ? false : s.settingsOpen,
    aiPanelOpen: isMobile ? false : s.aiPanelOpen,
    keyboard: s.bottomOverlay === 'keyboard',
    controller: s.controllerEnabled,
    docsOpen: s.docsDrawerOpen,
    docsTopic: s.docsDrawerOpen ? s.docsTopic : null,
  };
}

export function snapshotsEqual(a: NavSnapshot, b: NavSnapshot): boolean {
  return (
    a.mobileTab === b.mobileTab &&
    a.settingsOpen === b.settingsOpen &&
    a.aiPanelOpen === b.aiPanelOpen &&
    a.keyboard === b.keyboard &&
    a.controller === b.controller &&
    a.docsOpen === b.docsOpen &&
    a.docsTopic === b.docsTopic
  );
}

/** The set of surfaces currently open in a snapshot, as history keys. */
export function openKeys(s: NavSnapshot): NavKey[] {
  const keys: NavKey[] = [];
  if (s.mobileTab !== null) keys.push('tab');
  if (s.settingsOpen) keys.push('settings');
  if (s.aiPanelOpen) keys.push('ai');
  if (s.keyboard) keys.push('keyboard');
  if (s.controller) keys.push('controller');
  if (s.docsOpen) keys.push('docs');
  return keys;
}

/** The keyboard is auto-opening (editor gained focus with auto-show on) rather
 *  than being opened by an explicit tap — such opens must not trap Back. */
export function isAutoShow(s: StoreState): boolean {
  return s.keyboardAutoShow && s.editorFocused;
}

/**
 * Write a snapshot back into the store, calling only the setters whose surface
 * differs from the live state. Persisted setters (`setBottomOverlay`,
 * `setControllerEnabled`) still write through to localStorage; unrelated state
 * is left untouched. Called only from inside the `popstate` guard.
 */
export function applySnapshot(target: NavSnapshot, isMobile: boolean): void {
  const s = useIdeStore.getState();
  const cur = computeSnapshot(s, isMobile);

  if (cur.mobileTab !== target.mobileTab) {
    s.setMobileTab(target.mobileTab ?? 'editor');
  }
  if (cur.settingsOpen !== target.settingsOpen) {
    s.setSettingsOpen(target.settingsOpen);
  }
  if (cur.aiPanelOpen !== target.aiPanelOpen) {
    // No dedicated setter for the raw flag; `toggleAiPanel` would be ambiguous.
    useIdeStore.setState({ aiPanelOpen: target.aiPanelOpen });
  }
  if (cur.keyboard !== target.keyboard) {
    s.setBottomOverlay(target.keyboard ? 'keyboard' : 'none');
  }
  if (cur.controller !== target.controller) {
    s.setControllerEnabled(target.controller);
  }
  if (cur.docsOpen !== target.docsOpen) {
    if (target.docsOpen) s.openDocs(target.docsTopic ?? undefined);
    else s.closeDocs();
  } else if (target.docsOpen && cur.docsTopic !== target.docsTopic) {
    s.openDocs(target.docsTopic ?? undefined);
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
  /** React to a store change — push / replace / go as the transition warrants. */
  onStoreChange(state: StoreState): void;
  /** React to a `popstate` — apply the popped snapshot back into the store. */
  onPop(event: { state: unknown }): void;
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

    // Deepen: a surface opened → push one entry (excluding an auto-shown
    // keyboard, which must not consume a Back press).
    if (opened.length > 0) {
      const pushable = opened.filter(
        (k) => !(k === 'keyboard' && isAutoShow(state)),
      );
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
        history.go(-steps);
        return;
      }
      // Only untracked surfaces closed (e.g. an auto-shown keyboard) — nothing
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

    applySnapshot(target, getIsMobile());
    last = target;
    applyingPop = false;
  }

  return { init, onStoreChange, onPop };
}
