// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * File actions (New / Open / Save) shared by the toolbar File menu and the
 * global keyboard-shortcut handler, so both drive one implementation. They read
 * and mutate the store imperatively via `getState()`; Import/Export are simple
 * dialog toggles reachable directly on the store, so they aren't wrapped here.
 */

import { useIdeStore } from './store';
import {
  openTextFile,
  saveTextFile,
  saveProjectFile,
  toProjectFileName,
} from '../storage/files';
import { importProgram, importStatusMessage } from './importProgram';
import {
  serializeProject,
  parseProject,
  isProjectFile,
} from '../storage/projectFile';

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

/**
 * Open a `.txt`/`.bas`/`.bproj` from disk into the editor (guarded by
 * {@link confirmDiscard}). A `.bproj` - or a `.txt` that sniffs as one, see
 * {@link isProjectFile} - is parsed as a project bundle and installs its
 * source and memory blocks atomically; anything else loads as plain source
 * with no blocks, exactly as before. If the project was saved under a
 * different dialect than the one currently active, the document still loads
 * but a status notice warns that its memory blocks may not work (see
 * {@link dialectMismatchNotice}) - no auto-switch.
 */
export async function openDocument(): Promise<void> {
  if (!confirmDiscard()) return;
  const opened = await openTextFile();
  if (!opened) return;
  const { dialect, replaceDocument, setStatusNotice } = useIdeStore.getState();
  const ext = fileExtension(opened.name);
  if (ext === '.bproj' || (ext === '.txt' && isProjectFile(opened.text))) {
    try {
      const parsed = parseProject(opened.text);
      replaceDocument(parsed.source, opened.name, {
        blocks: parsed.blocks,
        listingBlockMeta: parsed.listingBlockMeta,
        autoStart: parsed.autoStart,
        tapeFiles: parsed.tapeFiles,
        bootDisc: parsed.bootDisc,
      });
      const mismatch = dialectMismatchNotice(parsed.dialect, dialect.id);
      if (mismatch) setStatusNotice(mismatch);
    } catch (e) {
      setStatusNotice(
        e instanceof Error ? e.message : `Could not open ${opened.name}.`,
      );
    }
    return;
  }
  replaceDocument(opened.text, opened.name);
}

/**
 * Save the current program to disk and mark it saved. Plain `.txt`/`.bas`
 * stays the format for a pure-BASIC document; once it carries memory blocks or
 * preserved tape files, Save switches to the `.bproj` project bundle instead
 * (see `src/storage/projectFile.ts`), so they survive the round trip.
 */
export async function saveDocument(): Promise<void> {
  const {
    fileName,
    source,
    blocks,
    listingBlockMeta,
    autoStart,
    tapeFiles,
    bootDisc,
    dialect,
    markSaved,
  } = useIdeStore.getState();
  // A pure-BASIC document (including a listing-backed one with no metadata
  // overrides - its #BIN blocks live in `source`) saves as portable text; blocks,
  // preserved tape, a boot-disc image, or listing-block overrides switch Save to
  // the .bproj bundle.
  const hasListingMeta = Object.keys(listingBlockMeta).length > 0;
  if (
    blocks.length > 0 ||
    tapeFiles.length > 0 ||
    hasListingMeta ||
    bootDisc !== null
  ) {
    const json = serializeProject(
      dialect.id,
      source,
      blocks,
      autoStart,
      tapeFiles,
      listingBlockMeta,
      bootDisc,
    );
    const saved = await saveProjectFile(toProjectFileName(fileName), json);
    if (saved !== null) markSaved(saved);
    return;
  }
  const saved = await saveTextFile(fileName, source);
  if (saved !== null) markSaved(saved);
}

/** Lower-cased extension including the leading dot (e.g. '.bas'), or '' if none. */
function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot).toLowerCase();
}

/**
 * Status notice for a `.bproj` whose saved `dialect` differs from the
 * currently-active one, or `null` when they match. A warning only - Open
 * still installs the source/blocks as parsed (see the doc comments above);
 * auto-switching dialects is out of scope here and belongs to a later
 * share/compatibility stage.
 */
function dialectMismatchNotice(
  parsedDialect: string,
  activeDialectId: string,
): string | null {
  if (parsedDialect === activeDialectId) return null;
  return `This project was saved for "${parsedDialect}" but the active dialect is "${activeDialectId}"; its memory blocks may not work here.`;
}

/**
 * Open a file dropped onto the editor. A `.bproj` project bundle - or a
 * `.txt` that sniffs as one, see {@link isProjectFile} - installs its source
 * and memory blocks atomically, like File → Open; a plain `.txt`/`.bas` file
 * loads as a named document the same way; a file whose extension matches one
 * of the current dialect's binary import formats (e.g. `.prg`, `.tap`) is
 * detokenized back into the editor exactly like Import - including the
 * block-carrying disc/tape containers (`.ssd`, `.d64`, `.TAP`, `.dsk`), which
 * bring the program back with its memory blocks. All document-replacing paths
 * are guarded by {@link confirmDiscard}, so the
 * user is warned before losing unsaved changes (adding a block isn't
 * destructive, so it isn't). Unsupported types and read/detokenize/parse
 * failures surface a status-bar notice, as does a `.bproj` saved under a
 * different dialect (see {@link dialectMismatchNotice}) - a warning only, the
 * document still loads.
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
    if (ext === '.bproj') {
      if (!confirmDiscard()) return;
      const parsed = parseProject(await file.text());
      replaceDocument(parsed.source, file.name, {
        blocks: parsed.blocks,
        listingBlockMeta: parsed.listingBlockMeta,
        autoStart: parsed.autoStart,
        tapeFiles: parsed.tapeFiles,
        bootDisc: parsed.bootDisc,
      });
      const mismatch = dialectMismatchNotice(parsed.dialect, dialect.id);
      if (mismatch) setStatusNotice(mismatch);
    } else if (ext === '.bas' || ext === '.txt') {
      const text = await file.text();
      if (ext === '.txt' && isProjectFile(text)) {
        if (!confirmDiscard()) return;
        const parsed = parseProject(text);
        replaceDocument(parsed.source, file.name, {
          blocks: parsed.blocks,
          listingBlockMeta: parsed.listingBlockMeta,
          autoStart: parsed.autoStart,
          tapeFiles: parsed.tapeFiles,
          bootDisc: parsed.bootDisc,
        });
        const mismatch = dialectMismatchNotice(parsed.dialect, dialect.id);
        if (mismatch) setStatusNotice(mismatch);
      } else {
        if (!confirmDiscard()) return;
        replaceDocument(text, file.name);
      }
    } else if (binaryFmt) {
      if (!confirmDiscard()) return;
      const bytes = new Uint8Array(await file.arrayBuffer());
      // Import loads real, not-yet-saved content: untitled but dirty, so the
      // discard guard fires before the next load (mirrors the Import dialog).
      const { source, warnings, blocks, tapeFiles, autoStart, bootDisc } =
        importProgram(dialect, bytes);
      loadUnsavedDocument(source, {
        dirty: true,
        blocks,
        tapeFiles,
        autoStart,
        bootDisc,
      });
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
