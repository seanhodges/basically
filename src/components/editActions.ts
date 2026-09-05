// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Which Edit-menu entries can act on the buffer the editor pane is showing.
 *
 * Undo, redo, cut, copy, paste and find mean the same thing in any buffer and
 * are always offered - whichever editor is on screen runs them. The rest are
 * BASIC operations: renumbering rewrites line numbers and the references to
 * them, and the outline lists a program's procedures and jump targets. Neither
 * has any meaning for a memory block's assembly, so on a block tab they are
 * withheld rather than offered and quietly acted on the hidden program.
 */

import type { ActiveTab, EditorCommandName } from '../app/store';

/** Menu entries that read or rewrite BASIC, whatever they are wired to. */
export type EditAction = EditorCommandName | 'outline';

const BASIC_ONLY: ReadonlySet<EditAction> = new Set<EditAction>([
  'renumber',
  'renumberFile',
  'outline',
]);

/** Whether `action` has a buffer to act on while `tab` is the one showing. */
export function editActionAvailable(
  action: EditAction,
  tab: ActiveTab,
): boolean {
  return !BASIC_ONLY.has(action) || tab.kind !== 'block';
}
