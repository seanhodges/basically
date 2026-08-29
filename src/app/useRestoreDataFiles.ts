// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Put the files this tab's programs saved back on screen when the IDE boots,
 * so a reload finds them without the user pressing Run.
 *
 * It also does the two pieces of bookkeeping that have to happen once per
 * session: the store is tagged with the machine it is holding files for - the
 * mirror writes a machine id with every row, and a row written under an empty
 * one could never be found again - and this tab announces itself to the shared
 * registry, which is what says whose rows are still owned by a tab that could
 * come back.
 */

import { useEffect } from 'react';
import { useIdeStore } from './store';
import { refreshTabRegistry } from '../storage/settings';
import { emulatorVfs } from '../storage/vfs/vfsStore';

/** Tag the store, sweep what closed tabs left, and restore this tab's files. */
export async function restoreDataFiles(dialectId: string): Promise<void> {
  emulatorVfs.reclaim(refreshTabRegistry());
  await emulatorVfs.hydrate(dialectId);
}

/**
 * Run `fn` when the browser is next idle, so the restore never delays first
 * paint; returns the cancel. `requestIdleCallback` is missing on Safari before
 * 18, where a short timeout gets the same "after the first frames" placement.
 */
function whenIdle(fn: () => void): () => void {
  if (typeof requestIdleCallback === 'function') {
    const id = requestIdleCallback(fn, { timeout: 1000 });
    return () => cancelIdleCallback(id);
  }
  const id = setTimeout(fn, 200);
  return () => clearTimeout(id);
}

/** Mount-once hook: restore the current machine's saved files at boot. */
export function useRestoreDataFiles(): void {
  useEffect(() => {
    const dialectId = useIdeStore.getState().dialect.id;
    // Tagged now rather than with the restore: a program can save before an
    // idle callback runs, and that row needs the machine on it.
    emulatorVfs.setDialect(dialectId);
    return whenIdle(() => {
      void restoreDataFiles(dialectId);
    });
  }, []);
}
