// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * File actions (New / Open / Save) shared by the toolbar File menu and the
 * global keyboard-shortcut handler, so both drive one implementation. They read
 * and mutate the store imperatively via `getState()`; Import/Export are simple
 * dialog toggles reachable directly on the store, so they aren't wrapped here.
 */

import { useIdeStore, hydrateScratchBuffers } from './store';
import {
  openDocumentFile,
  saveProjectZip,
  toProjectFileName,
  PROJECT_EXTENSIONS,
} from '../storage/files';
import { importProgram, importStatusMessage } from './importProgram';
import { isPictureFile } from './listingPhoto';
import { useAiStore } from '../ai/aiStore';
import {
  serializeProjectZip,
  parseProjectZip,
  type ParsedProject,
} from '../storage/projectFile';
import { findDialect } from '../dialects/registry';

const textDecoder = new TextDecoder();

/**
 * True when it's safe to replace the current document - nothing unsaved, an
 * empty document, or the user confirms discarding. Mirrors the guard the sample
 * loader uses.
 *
 * Scratch buffers are a second trigger of their own: editing one deliberately
 * never marks the document dirty, yet replacing the document now destroys them,
 * so without this a snippet would vanish with no warning at all.
 */
export function confirmDiscard(): boolean {
  const { dirty, source, scratchBuffers } = useIdeStore.getState();
  const unsavedDocument = dirty && source.trim() !== '';
  if (!unsavedDocument && scratchBuffers.length === 0) return true;
  return window.confirm(
    unsavedDocument
      ? 'Discard unsaved changes?'
      : 'Discard your scratch buffers?',
  );
}

/**
 * Start a new project: run the discard guard, then open the New-project dialog
 * where the user chooses the machine, a name and what to start from. The guard
 * runs *first* so its `window.confirm` never appears underneath the modal; the
 * dialog itself installs the document via `createProject`.
 */
export function newDocument(): void {
  if (!confirmDiscard()) return;
  useIdeStore.getState().setNewProjectOpen(true);
}

/**
 * Open a project or source file from disk into the editor (guarded by
 * {@link confirmDiscard}). A project bundle (a `.zip`, or a legacy `.bproj`) is
 * unzipped and parsed, installing its source and memory blocks atomically and
 * switching to the dialect it was saved under (see {@link installParsedProject});
 * a plain `.bas`/`.txt` (or any other extension) loads as plain source with no
 * blocks.
 */
export async function openDocument(): Promise<void> {
  if (!confirmDiscard()) return;
  const opened = await openDocumentFile();
  if (!opened) return;
  const { replaceDocument, setStatusNotice } = useIdeStore.getState();
  const ext = fileExtension(opened.name);
  if (isProjectExtension(ext)) {
    try {
      installParsedProject(parseProjectZip(opened.bytes), opened.name);
    } catch (e) {
      setStatusNotice(
        e instanceof Error ? e.message : `Could not open ${opened.name}.`,
      );
    }
    return;
  }
  replaceDocument(textDecoder.decode(opened.bytes), opened.name);
}

/**
 * Install a parsed project bundle into the store, switching to the dialect it
 * was saved under so the document loads on the machine it was authored for (its
 * memory blocks are addressed for that machine). When the saved dialect is one
 * this build doesn't ship, the document still loads - under the currently-active
 * dialect - but a status notice warns its blocks may not work. Shared by
 * File → Open and the drag-and-drop path.
 */
function installParsedProject(parsed: ParsedProject, fileName: string): void {
  const { dialect, openProject, replaceDocument, setStatusNotice } =
    useIdeStore.getState();
  const target = findDialect(parsed.dialect);
  if (!target) {
    // Unknown machine: load the parts under the active dialect and warn.
    replaceDocument(parsed.source, fileName, {
      blocks: parsed.blocks,
      listingBlockMeta: parsed.listingBlockMeta,
      autoStart: parsed.autoStart,
      tapeFiles: parsed.tapeFiles,
      bootDisc: parsed.bootDisc,
    });
    // No buffers here: they hold code in a dialect the active machine does not
    // speak, the same reasoning that discards them on a machine switch.
    setStatusNotice(unknownDialectNotice(parsed.dialect, dialect.id));
    return;
  }
  const switched = target.id !== dialect.id;
  openProject({
    dialectId: target.id,
    source: parsed.source,
    fileName,
    blocks: parsed.blocks,
    listingBlockMeta: parsed.listingBlockMeta,
    autoStart: parsed.autoStart,
    tapeFiles: parsed.tapeFiles,
    bootDisc: parsed.bootDisc,
    scratch: hydrateScratchBuffers(parsed.scratch),
  });
  if (switched) {
    setStatusNotice(`Switched to ${target.name} to match this project.`);
  }
}

/**
 * Save the current document to disk as a `.zip` project bundle (a zip of the
 * BASIC source plus any memory blocks and metadata; see
 * `src/storage/projectFile.ts`) and mark it saved. Every document saves as this
 * bundle now - a single-file `.bas` is a per-tab download instead (see
 * `src/components/EditorTabBar.tsx`).
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
    scratchBuffers,
    dialect,
    markSaved,
  } = useIdeStore.getState();
  const zip = serializeProjectZip(
    dialect.id,
    source,
    blocks,
    autoStart,
    tapeFiles,
    listingBlockMeta,
    bootDisc,
    scratchBuffers,
  );
  const saved = await saveProjectZip(toProjectFileName(fileName), zip);
  if (saved !== null) markSaved(saved);
}

/** Lower-cased extension including the leading dot (e.g. '.bas'), or '' if none. */
function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot).toLowerCase();
}

/** Whether `ext` (a lower-cased '.foo') names a Basically project bundle. */
function isProjectExtension(ext: string): boolean {
  return (PROJECT_EXTENSIONS as readonly string[]).includes(ext);
}

/**
 * Status notice for a project saved under a dialect this build doesn't ship:
 * the document loads under `activeDialectId` instead, and its memory blocks
 * (addressed for the missing machine) may not work. A warning only - the source
 * still loads, without the project's scratch buffers.
 */
function unknownDialectNotice(
  parsedDialect: string,
  activeDialectId: string,
): string {
  return `This project was saved for "${parsedDialect}", which isn't available; loaded under "${activeDialectId}" instead - its memory blocks may not work here.`;
}

/**
 * Open a file dropped onto the editor. A project bundle (a `.zip`, or a legacy
 * `.bproj`) is unzipped and installs its source and memory blocks atomically,
 * like File → Open; a plain `.txt`/`.bas` file loads as a named document; a file
 * whose extension matches one of the current dialect's binary import formats
 * (e.g. `.prg`, `.tap`) is detokenized back into the editor exactly like Import
 * - including the block-carrying disc/tape containers (`.ssd`, `.d64`, `.TAP`,
 * `.dsk`), which bring the program back with its memory blocks; a picture is a
 * photograph or scan of a printed listing and goes to the AI assistant, which
 * reports its own outcome in the panel. All document-replacing paths are guarded
 * by {@link confirmDiscard}, so the user is warned before losing unsaved changes
 * (adding a block isn't destructive, so it isn't, and neither is attaching a
 * picture). Unsupported types and read/detokenize/parse failures surface a
 * status-bar notice. A project bundle switches to the dialect it was saved under
 * (see {@link installParsedProject}).
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
    if (isProjectExtension(ext)) {
      if (!confirmDiscard()) return;
      const parsed = parseProjectZip(new Uint8Array(await file.arrayBuffer()));
      installParsedProject(parsed, file.name);
    } else if (ext === '.bas' || ext === '.txt') {
      if (!confirmDiscard()) return;
      replaceDocument(await file.text(), file.name);
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
    } else if (isPictureFile(file.name, file.type)) {
      // The one branch here that must NOT run the discard guard: attaching a
      // picture to the assistant replaces nothing. What the assistant makes of
      // it lands through the apply actions, which guard themselves.
      //
      // A HEIC counts as a picture on purpose (see `isPictureFile`), so it
      // reaches the preparer and earns a sentence saying what to do about it
      // rather than falling through to "unsupported file type" below.
      await useAiStore.getState().attachPhoto(file);
    } else {
      setStatusNotice(`Can't open ${file.name} - unsupported file type.`);
    }
  } catch (e) {
    setStatusNotice(
      e instanceof Error ? e.message : `Could not open ${file.name}.`,
    );
  }
}
