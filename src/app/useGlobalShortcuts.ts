// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Mounts the single app-global keyboard listener. It dispatches the desktop
 * shortcuts declared in {@link ./shortcuts} to store actions.
 *
 * Design notes:
 * - It bails when `e.defaultPrevented` is already set, so anything CodeMirror or
 *   the emulator canvas has handled (Undo, Find, Enter auto-numbering, the F9
 *   breakpoint binding, Escape…) is never double-handled here. That also means
 *   editor-context shortcuts fall through to the editor when it's focused, and
 *   only run globally (e.g. Find from anywhere) when it isn't.
 * - Function-key runs (F5/Shift+F5) must `preventDefault` or the browser
 *   reloads / does nothing useful.
 * - Native combos (Undo/Redo/Cut/Copy/Paste/Renumber/Breakpoint/Escape) are in
 *   the table for display only and have no dispatch case, so they pass through.
 */

import { useEffect } from 'react';
import { useIdeStore } from './store';
import { SHORTCUTS, matchesShortcut, type ShortcutId } from './shortcuts';
import { newDocument, openDocument, saveDocument } from './fileCommands';
import { referenceTopic } from './docsTopic';

/** Surface a rejected file command without crashing the listener. */
function report(p: Promise<void>): void {
  p.catch((err) => console.error('shortcut command failed', err));
}

/**
 * Run the action for a shortcut id. Returns true when the key was consumed (so
 * the caller calls `preventDefault`), false when it was a no-op — e.g. a debug
 * shortcut fired while not paused, or an id with no global action.
 */
function dispatch(id: ShortcutId): boolean {
  const s = useIdeStore.getState();
  switch (id) {
    case 'file.new':
      newDocument();
      return true;
    case 'file.open':
      report(openDocument());
      return true;
    case 'file.save':
      report(saveDocument());
      return true;
    case 'file.import':
      s.setImportOpen(true);
      return true;
    case 'file.export':
      s.setTransferOpen(true);
      return true;
    case 'edit.find':
      s.requestEditorCommand('find');
      return true;
    case 'edit.outline':
      s.setProcedureListOpen(true);
      return true;
    case 'run.play':
      s.requestRun();
      return true;
    case 'run.stop':
      s.requestStop();
      return true;
    case 'run.step':
      if (s.dialect.debuggable && s.emulatorStatus === 'paused') {
        s.requestStep();
        return true;
      }
      return false;
    case 'run.continue':
      if (s.dialect.debuggable && s.emulatorStatus === 'paused') {
        s.requestContinue();
        return true;
      }
      return false;
    case 'run.reset':
      s.requestReset();
      return true;
    case 'run.mute':
      if (s.emulatorAudio) s.setEmulatorMuted(!s.emulatorMuted);
      return true;
    case 'view.ai':
      s.toggleAiPanel();
      return true;
    case 'view.settings':
      s.setSettingsOpen(true);
      return true;
    case 'view.docs': {
      // Toggle: F1 closes the drawer if it's already open.
      if (s.docsDrawerOpen) {
        s.closeDocs();
      } else {
        const topic = referenceTopic(s.dialect, s.editorSelection);
        s.openDocs(topic ?? undefined);
      }
      return true;
    }
    case 'view.keyboard':
      s.setKeyboardEnabled(!s.keyboardEnabled);
      return true;
    case 'view.watcher':
      s.setVariableWatcher(!s.variableWatcher);
      return true;
    case 'view.controller':
      s.setControllerEnabled(!s.controllerEnabled);
      return true;
    default:
      // Native/editor-only shortcuts (undo, copy, renumber, breakpoint, escape…)
      // have no global action — let the browser/editor handle them.
      return false;
  }
}

export function useGlobalShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Anything the editor or emulator already handled is off-limits.
      if (e.defaultPrevented) return;
      for (const sc of SHORTCUTS) {
        if (!matchesShortcut(e, sc)) continue;
        // A chord maps to exactly one shortcut, so stop at the first match
        // whether or not it produced an action.
        if (dispatch(sc.id)) e.preventDefault();
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
