// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { useEffect, useRef } from 'react';
import { useIdeStore } from './store';
import {
  useMediaQuery,
  MOBILE_QUERY,
  LANDSCAPE_MOBILE_QUERY,
} from './useMediaQuery';
import { createHistorySync } from './historyNav';

/**
 * Wire the browser History API to the IDE's ephemeral UI surfaces so the Back
 * button closes the most recently opened surface (mobile tab, settings, AI
 * panel, on-screen keyboard, gamepad, docs drawer) instead of leaving the app.
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

    const unsub = useIdeStore.subscribe((state) => sync.onStoreChange(state));
    const onPop = (e: PopStateEvent) => sync.onPop(e);
    window.addEventListener('popstate', onPop);

    return () => {
      unsub();
      window.removeEventListener('popstate', onPop);
    };
  }, []);
}
