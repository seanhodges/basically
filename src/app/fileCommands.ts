// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * File actions (New / Open / Save) shared by the toolbar File menu and the
 * global keyboard-shortcut handler, so both drive one implementation. They read
 * and mutate the store imperatively via `getState()`; Import/Export are simple
 * dialog toggles reachable directly on the store, so they aren't wrapped here.
 */

import { useIdeStore } from './store';
import { openTextFile, saveTextFile } from '../storage/files';

/**
 * True when it's safe to replace the current document — nothing unsaved, an
 * empty document, or the user confirms discarding. Mirrors the guard the sample
 * loader uses.
 */
export function confirmDiscard(): boolean {
  const { dirty, source } = useIdeStore.getState();
  return !dirty || !source.trim() || window.confirm('Discard unsaved changes?');
}

/** Clear the editor to a fresh untitled program (guarded by {@link confirmDiscard}). */
export function newDocument(): void {
  if (!confirmDiscard()) return;
  useIdeStore.getState().replaceDocument('', 'untitled.bas');
}

/** Open a `.bas` from disk into the editor (guarded by {@link confirmDiscard}). */
export async function openDocument(): Promise<void> {
  if (!confirmDiscard()) return;
  const opened = await openTextFile();
  if (opened) useIdeStore.getState().replaceDocument(opened.text, opened.name);
}

/** Save the current program to disk and mark it saved. */
export async function saveDocument(): Promise<void> {
  const { fileName, source, markSaved } = useIdeStore.getState();
  const saved = await saveTextFile(fileName, source);
  if (saved !== null) markSaved(saved);
}
