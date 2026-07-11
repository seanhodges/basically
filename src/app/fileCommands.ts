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
import { importProgram, importStatusMessage } from './importProgram';

/**
 * True when it's safe to replace the current document - nothing unsaved, an
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
  useIdeStore.getState().loadUnsavedDocument('');
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

/** Lower-cased extension including the leading dot (e.g. '.bas'), or '' if none. */
function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot).toLowerCase();
}

/**
 * Open a file dropped onto the editor. A `.bas`/`.txt` file loads as a named
 * document exactly like File → Open; a file whose extension matches one of the
 * current dialect's binary import formats (e.g. `.prg`, `.tap`) is detokenized
 * back into the editor exactly like Import. Both paths are guarded by
 * {@link confirmDiscard}, so the user is warned before losing unsaved changes.
 * Unsupported types and read/detokenize failures surface a status-bar notice.
 */
export async function openDroppedFile(file: File): Promise<void> {
  const store = useIdeStore.getState();
  const { dialect, replaceDocument, loadUnsavedDocument, setStatusNotice } =
    store;
  const ext = fileExtension(file.name);
  const binaryFmt = dialect.binaryImports?.find(
    (f) => f.extension.toLowerCase() === ext,
  );
  try {
    if (ext === '.bas' || ext === '.txt') {
      if (!confirmDiscard()) return;
      replaceDocument(await file.text(), file.name);
    } else if (binaryFmt) {
      if (!confirmDiscard()) return;
      const bytes = new Uint8Array(await file.arrayBuffer());
      // Import loads real, not-yet-saved content: untitled but dirty, so the
      // discard guard fires before the next load (mirrors the Import dialog).
      const { source, warnings } = importProgram(dialect, bytes);
      loadUnsavedDocument(source, { dirty: true });
      setStatusNotice(importStatusMessage(file.name, warnings));
    } else {
      setStatusNotice(`Can't open ${file.name} - unsupported file type.`);
    }
  } catch (e) {
    setStatusNotice(
      e instanceof Error ? e.message : `Could not open ${file.name}.`,
    );
  }
}
