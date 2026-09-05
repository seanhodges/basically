// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * A menu of what the editor can say about the token a click lands on.
 *
 * One row per question the picked token can answer - where a variable is used,
 * what a keyword means - opened under the token itself. Each row comes from a
 * {@link MenuRowSource}, asked in turn; a source with nothing to say about this
 * token returns null and contributes no row. Today the sources are mutually
 * exclusive (a name is not a keyword), so the menu is one row wide, but nothing
 * here assumes that.
 *
 * A pointer is the only way in, by design. The caret alone would pop the menu on
 * every arrow-key press and would fight the completion popup for the same
 * anchor; hovering is not available on the touch devices this editor is used on.
 * For the same reason the menu is withheld while a completion is open and
 * dropped the moment the document changes.
 *
 * The menu borrows the completion popup's shape, so a token answers where a
 * completion would. It is chrome, and is themed with the rest of the editor's
 * CodeMirror furniture in src/styles.css.
 *
 * Mounted by both editors, including the assembly editor, which has neither
 * autocompletion nor the search panel. Both guards below degrade safely there -
 * see the comment on {@link searchJustOpened} and on the completion check.
 */
import {
  EditorView,
  keymap,
  showTooltip,
  type Tooltip,
} from '@codemirror/view';
import {
  StateEffect,
  StateField,
  type EditorState,
  type Extension,
  type Transaction,
} from '@codemirror/state';
import { completionStatus } from '@codemirror/autocomplete';
import { searchPanelOpen } from '@codemirror/search';

/** One row: what it says, and what pressing it does. */
export interface MenuRow {
  /** The picked token's start, which the menu anchors on. */
  from: number;
  to: number;
  /** The row's visible text, e.g. `Usages`. */
  label: string;
  /** Icon class suffix, e.g. `usages` for `.cm-clickMenuIcon-usages`. */
  icon: string;
  /** `title` and `aria-label`: what pressing the row does, in words. */
  title: string;
  run(view: EditorView): void;
}

/**
 * Asked what it can say about the token at `pos`. Takes a state rather than a
 * view so a source can be tested without mounting an editor - the test suite
 * runs in Node, with no DOM to mount one into.
 */
export type MenuRowSource = (state: EditorState, pos: number) => MenuRow | null;

/** The menu on show, with the key that says whether it is already the right one. */
interface OpenMenu {
  tooltip: Tooltip;
  key: string;
}

const showMenu = StateEffect.define<OpenMenu | null>();

/**
 * True of the transaction that opens the find/replace panel.
 *
 * Safe to ask from inside a field's own `update`: EditorState fills in
 * `tr.state` before computing any slot, so this reads the state being built
 * rather than re-entering the update; and `searchPanelOpen` reads only
 * @codemirror/search's field, returning false where that extension is absent.
 */
export function searchJustOpened(tr: Transaction): boolean {
  return !searchPanelOpen(tr.startState) && searchPanelOpen(tr.state);
}

/** Where the menu is, if it is anywhere. */
const menuField = StateField.define<OpenMenu | null>({
  create: () => null,
  update(menu, tr) {
    // An edit invalidates the offsets the rows hold, and the answers they stand
    // for may no longer be true - re-asking is one click away.
    if (tr.docChanged) return null;
    if (searchJustOpened(tr)) return null;
    for (const effect of tr.effects)
      if (effect.is(showMenu)) return effect.value;
    return menu;
  },
  provide: (field) => showTooltip.from(field, (menu) => menu?.tooltip ?? null),
});

/** Withdraw the menu, if one is open. */
export function hideClickMenu(view: EditorView): void {
  view.dispatch({ effects: showMenu.of(null) });
}

/**
 * The menu itself: rows in a list, shaped like completion options.
 *
 * No `above`, so it opens below the token as a completion does, and CodeMirror
 * is still free to flip it above on the last visible row. Each row is a button
 * inside the list rather than the list item itself - a listbox that acts on
 * click reads poorly to a screen reader, and the button carries the name of
 * what pressing it does.
 */
function menuTooltip(rows: readonly MenuRow[]): Tooltip {
  return {
    pos: rows[0]!.from,
    create: (view) => {
      const dom = document.createElement('div');
      dom.className = 'cm-clickMenu';

      const list = document.createElement('ul');
      list.className = 'cm-clickMenuList';
      for (const row of rows) {
        const item = document.createElement('li');

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'cm-clickMenuRow';
        button.title = row.title;
        button.setAttribute('aria-label', row.title);
        button.addEventListener('mousedown', (event) => event.preventDefault());
        button.addEventListener('click', () => {
          // Taking up an offer retires the menu, whatever the row then does.
          hideClickMenu(view);
          row.run(view);
        });

        const icon = document.createElement('span');
        icon.className = `cm-clickMenuIcon cm-clickMenuIcon-${row.icon}`;
        icon.setAttribute('aria-hidden', 'true');
        const label = document.createElement('span');
        label.className = 'cm-clickMenuLabel';
        label.textContent = row.label;
        button.append(icon, label);

        item.appendChild(button);
        list.appendChild(item);
      }
      dom.appendChild(list);
      return { dom };
    },
  };
}

/** The extension. Rows come from `sources`, asked in order at every click. */
export function clickMenu(sources: readonly MenuRowSource[]): Extension {
  /** Open (or withdraw) the menu for the document position under the pointer. */
  function offerAt(view: EditorView, x: number, y: number): void {
    // While the completion popup is up the caret's neighbourhood is already
    // spoken for, and two tooltips would fight for the same anchor. Only an
    // 'active' status means a visible popup - 'pending' is a query in flight,
    // which outlives typing and would suppress the menu for good. Returns null
    // where autocompletion is not mounted at all, as in the assembly editor.
    if (completionStatus(view.state) === 'active') return;
    const pos = view.posAtCoords({ x, y });
    const rows =
      pos === null
        ? []
        : sources
            .map((source) => source(view.state, pos))
            .filter((row): row is MenuRow => row !== null);
    // A tap arrives twice - as a touch and as a synthesised mouse event - so
    // re-offering the same rows on the same token is a no-op rather than a
    // second dispatch. Keyed by the rows as well as the position: which rows a
    // token can answer is the other half of "the same menu".
    const key = rows.length
      ? `${rows[0]!.from}|${rows.map((row) => row.label).join(',')}`
      : '';
    const current = view.state.field(menuField, false) ?? null;
    if ((current?.key ?? '') === key) return;
    view.dispatch({
      effects: showMenu.of(
        rows.length ? { tooltip: menuTooltip(rows), key } : null,
      ),
    });
  }

  return [
    menuField,
    EditorView.domEventHandlers({
      mousedown: (event, view) => {
        if (event.button === 0) offerAt(view, event.clientX, event.clientY);
        return false;
      },
      touchstart: (event, view) => {
        const touch = event.touches[0];
        if (touch) offerAt(view, touch.clientX, touch.clientY);
        return false;
      },
    }),
    keymap.of([
      {
        key: 'Escape',
        run: (view) => {
          // Only when there is a menu of ours to dismiss, so Escape still
          // reaches the completion popup, the find panel, and - once the menu
          // is gone - whatever surface stands behind the editor.
          if (completionStatus(view.state) === 'active') return false;
          if (!view.state.field(menuField, false)) return false;
          hideClickMenu(view);
          view.focus();
          return true;
        },
      },
    ]),
  ];
}
