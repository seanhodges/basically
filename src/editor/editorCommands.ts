// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The Edit-menu commands that mean the same thing in any editor: undo, redo,
 * cut, copy, paste and the find/replace panel.
 *
 * They live here rather than in either editor because the menu acts on the
 * buffer the user is looking at, which is the BASIC editor on one tab and a
 * memory block's assembly editor on another - both run this same code so the
 * menu cannot do two different things depending on which surface is showing.
 * Renumbering is not here: it is a BASIC operation, and the toolbar withholds
 * it while another kind of buffer is showing.
 *
 * The keyboard reaches undo/redo/cut/copy/paste through CodeMirror's own
 * keymaps; this is the menu's path to the same operations, plus the clipboard
 * fallbacks a menu click needs that a real Ctrl+C does not (a menu click is not
 * a paste gesture, so the browser may refuse the read).
 */

import { redo, undo } from '@codemirror/commands';
import { closeSearchPanel, openSearchPanel } from '@codemirror/search';
import type { EditorView } from '@codemirror/view';
import type { EditorCommandName } from '../app/store';
import { isMac } from '../app/shortcuts';

/** The commands every editable buffer offers, whatever kind of code it holds. */
const VIEW_COMMANDS = [
  'undo',
  'redo',
  'cut',
  'copy',
  'paste',
  'find',
  'closeFind',
] as const;

export type ViewEditorCommandName = (typeof VIEW_COMMANDS)[number];

const VIEW_COMMAND_SET: ReadonlySet<string> = new Set(VIEW_COMMANDS);

/** Whether `name` is one of the commands {@link runViewEditorCommand} runs. */
export function isViewEditorCommand(
  name: EditorCommandName,
): name is ViewEditorCommandName {
  return VIEW_COMMAND_SET.has(name);
}

/**
 * Range to act on for copy/cut: the main selection, or - when it's empty - the
 * whole current line (incl. trailing newline), mirroring CodeMirror's default
 * clipboard behaviour for an empty selection.
 */
export function clipboardRange(view: EditorView): { from: number; to: number } {
  const sel = view.state.selection.main;
  if (!sel.empty) return { from: sel.from, to: sel.to };
  const line = view.state.doc.lineAt(sel.head);
  return { from: line.from, to: Math.min(line.to + 1, view.state.doc.length) };
}

/**
 * Write to the clipboard, tolerating browsers/contexts without the async
 * Clipboard API (insecure http origins; older browsers). Falls back to the
 * legacy execCommand path via a temporary off-screen textarea. Returns whether
 * the text actually reached the clipboard.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to the legacy path (e.g. permission denied)
    }
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}

/**
 * Read the clipboard, or null when this browser doesn't allow it (Firefox
 * < 125 has no readText; insecure contexts have no navigator.clipboard; the
 * user may deny the paste permission prompt). There is no legacy read
 * fallback - execCommand('paste') is blocked in web content.
 */
export async function readTextFromClipboard(): Promise<string | null> {
  if (!navigator.clipboard?.readText) return null;
  try {
    return await navigator.clipboard.readText();
  } catch {
    return null;
  }
}

/**
 * Run one Edit-menu command against `view`, and report whether it was one of
 * the view-generic ones. A caller that owns further commands (the BASIC editor's
 * renumbering) handles the `false` cases itself.
 */
export async function runViewEditorCommand(
  view: EditorView,
  name: EditorCommandName,
): Promise<boolean> {
  switch (name) {
    case 'undo':
      undo(view);
      break;
    case 'redo':
      redo(view);
      break;
    case 'copy':
    case 'cut': {
      const { from, to } = clipboardRange(view);
      const copied = await copyTextToClipboard(view.state.sliceDoc(from, to));
      // Never cut what didn't reach the clipboard - that would destroy text.
      if (name === 'cut' && copied) {
        view.dispatch({ changes: { from, to }, userEvent: 'delete.cut' });
      }
      break;
    }
    case 'paste': {
      const text = await readTextFromClipboard();
      if (text === null) {
        window.alert(
          `This browser doesn't allow pasting from the menu - press ${
            isMac() ? '⌘V' : 'Ctrl+V'
          } in the editor instead.`,
        );
        break;
      }
      if (text)
        view.dispatch(view.state.replaceSelection(text), {
          userEvent: 'input.paste',
        });
      break;
    }
    case 'find':
      // The panel contains both find and replace rows; one entry covers both.
      openSearchPanel(view);
      return true;
    case 'closeFind':
      // Dismiss the panel without stealing focus back into the editor (so a tap
      // on the emulator that triggered this keeps its own focus).
      closeSearchPanel(view);
      return true;
    default:
      return false;
  }
  // The find/replace panel manages its own focus (both cases returned above);
  // everything else returns to the editor.
  view.focus();
  return true;
}
