// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { useEffect, useRef } from 'react';
import { useIdeStore } from './store';
import {
  useMediaQuery,
  MOBILE_QUERY,
  LANDSCAPE_MOBILE_QUERY,
} from './useMediaQuery';
import { createHistorySync, type HistorySync } from './historyNav';

/**
 * The mounted sync, so the Escape handler can reach it. History is a per-window
 * singleton and this hook is mounted once at the app root, so a module-level
 * reference is the honest shape here - there is nothing to have more than one of.
 */
let active: HistorySync | null = null;

/**
 * Dismiss the topmost open surface, the same one the platform Back gesture
 * would close. Returns false when nothing is open, so the caller can let the
 * keypress through rather than navigating away from the app.
 *
 * This is deliberately routed through `history.back()` rather than closing the
 * surface directly: Back and Escape then share one implementation of "what
 * closes next" and cannot drift apart, which is exactly how the two gestures
 * came to cover different sets of surfaces before.
 */
export function dismissTopSurface(): boolean {
  if (!active?.hasOpenSurfaces()) return false;
  window.history.back();
  return true;
}

/**
 * Wire the browser History API to the IDE's ephemeral UI surfaces so the Back
 * button closes the most recently opened surface instead of leaving the app.
 * Which surfaces participate is declared in {@link ./surfaces}.
 *
 * Mount once, near the app root. All the logic lives in
 * {@link createHistorySync}; this hook just connects it to `window.history`,
 * the store subscription and the `popstate` event, and feeds it the current
 * layout so mobile and desktop map their surfaces correctly.
 */
export function useHistorySync(): void {
  // The tab layout (mobile surfaces map to history entries) is active for a
  // narrow viewport or a phone in landscape; the split desktop maps differently.
  const narrow = useMediaQuery(MOBILE_QUERY);
  const landscape = useMediaQuery(LANDSCAPE_MOBILE_QUERY);
  const tabbed = narrow || landscape;
  // The subscription is set up once, so read the live layout through a ref
  // rather than re-subscribing on every breakpoint change.
  const isMobileRef = useRef(tabbed);
  isMobileRef.current = tabbed;

  useEffect(() => {
    const sync = createHistorySync({
      history: window.history,
      getIsMobile: () => isMobileRef.current,
    });
    sync.init(useIdeStore.getState());
    active = sync;

    const unsub = useIdeStore.subscribe((state) => sync.onStoreChange(state));
    const onPop = (e: PopStateEvent) => sync.onPop(e);
    window.addEventListener('popstate', onPop);

    return () => {
      unsub();
      window.removeEventListener('popstate', onPop);
      if (active === sync) active = null;
    };
  }, []);
}
