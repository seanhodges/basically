// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

// The player → IDE handover (docs/contributing/standalone-player.md): the player's
// "See the Code" button opens `/?open=<shareId>`, and this hook - mounted once
// in App - re-fetches the share and loads it into the editor with the right
// machine selected. Refetching (rather than a sessionStorage handoff) makes
// the URL refresh-safe and shareable in its own right.

import { useEffect } from 'react';
import { useIdeStore } from './store';
import { SHARE_ID_RE } from '../player/routes';
import { fetchSharedProgram, ShareApiError } from '../share/shareClient';

/** The valid share id in a `?open=` query string, or null. */
export function parseOpenParam(search: string): string | null {
  const id = new URLSearchParams(search).get('open');
  return id !== null && SHARE_ID_RE.test(id) ? id : null;
}

/** Status-bar wording for a failed shared-program load. */
function describeOpenError(e: unknown): string {
  if (e instanceof ShareApiError) {
    switch (e.kind) {
      case 'unconfigured':
        return 'Shared programs cannot load - this site has no share service configured.';
      case 'invalid-id':
      case 'not-found':
        return 'The shared program in this link no longer exists.';
      case 'expired':
        return 'This share link has expired.';
      case 'network':
        return 'Could not load the shared program - check your connection and reload.';
      default:
        return 'Could not load the shared program.';
    }
  }
  return 'Could not load the shared program.';
}

/**
 * Act on a `?open=<shareId>` in the current URL: fetch the share, load it into
 * the IDE, and strip the param (so a later refresh reloads the user's edits
 * instead of re-clobbering them with the share). On failure the param is left
 * in place - a refresh retries - and the status bar shows why. Resolves true
 * when a shared program was loaded.
 */
export async function openSharedFromUrl(): Promise<boolean> {
  const id = parseOpenParam(location.search);
  if (id === null) return false;
  try {
    const rec = await fetchSharedProgram(id);
    useIdeStore.getState().openSharedInIde({
      dialectId: rec.dialectId,
      source: rec.source,
    });
    const url = new URL(location.href);
    url.searchParams.delete('open');
    // Keep whatever state is current (useHistorySync seeds its baseline here).
    history.replaceState(history.state, '', url);
    return true;
  } catch (e) {
    useIdeStore.getState().setStatusNotice(describeOpenError(e));
    return false;
  }
}

/** Mount-once hook: handle a `?open=` handover when the IDE boots. */
export function useOpenShared(): void {
  useEffect(() => {
    void openSharedFromUrl();
  }, []);
}
