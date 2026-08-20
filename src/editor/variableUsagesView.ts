// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Clicking a variable offers to show where else it is used.
 *
 * Two pieces here: a set of marks over every usage once the offer is taken up,
 * and a bar at the foot of the editor naming the variable, counting the usages
 * and stepping between them. The offer itself is a row in the editor's click
 * menu ({@link ./clickMenu}), which this contributes via
 * {@link variableUsagesRow}. Which occurrences count is
 * {@link ./variableUsages}' answer, and it is the machine's - see there.
 *
 * The bar borrows the find/replace panel's shape, so the foot of the editor has
 * one look. It is chrome, and is themed with the rest of the editor's
 * CodeMirror furniture in src/styles.css; only the marks, which sit on the
 * editor's own paper, are themed here.
 */
import {
  Decoration,
  EditorView,
  keymap,
  showPanel,
  type DecorationSet,
  type Panel,
} from '@codemirror/view';
import {
  EditorSelection,
  StateEffect,
  StateField,
  type Extension,
} from '@codemirror/state';
import { completionStatus } from '@codemirror/autocomplete';
import { closeSearchPanel, searchPanelOpen } from '@codemirror/search';
import type { EditorKeyword } from '../dialects/types';
import {
  hideClickMenu,
  searchJustOpened,
  type MenuRowSource,
} from './clickMenu';
import {
  findVariableUsages,
  variableTokenAt,
  type UsageRange,
} from './variableUsages';

/** The usages on show, and which of them the user is standing on. */
interface ActiveUsages {
  name: string;
  ranges: readonly UsageRange[];
  index: number;
}

const setUsages = StateEffect.define<ActiveUsages>();
const clearUsages = StateEffect.define<null>();

const usageMark = Decoration.mark({ class: 'cm-variableUsage' });
const currentUsageMark = Decoration.mark({
  class: 'cm-variableUsage cm-variableUsage-current',
});

function usageDecorations(active: ActiveUsages | null): DecorationSet {
  if (!active) return Decoration.none;
  return Decoration.set(
    active.ranges.map((r, i) =>
      (i === active.index ? currentUsageMark : usageMark).range(r.from, r.to),
    ),
  );
}

/** Move to the usage `delta` away, wrapping at either end. */
function step(view: EditorView, delta: number): void {
  const active = view.state.field(usagesField, false);
  if (!active || active.ranges.length === 0) return;
  const count = active.ranges.length;
  const index = (active.index + delta + count) % count;
  const target = active.ranges[index]!;
  view.dispatch({
    effects: setUsages.of({ ...active, index }),
    selection: EditorSelection.cursor(target.from),
    scrollIntoView: true,
  });
  view.focus();
}

function close(view: EditorView): void {
  view.dispatch({ effects: clearUsages.of(null) });
  // Dismissing the answer dismisses any offer opened since it was given, so one
  // press clears the editor of both.
  hideClickMenu(view);
  view.focus();
}

/**
 * A bar button that never steals focus from the editor. The close button takes
 * its own class rather than adding one: it and the steppers are styled by
 * rules of equal specificity, so wearing both would leave the winner to the
 * order of the stylesheet.
 */
function barButton(
  label: string,
  title: string,
  onPress: () => void,
  className = 'cm-variableUsagesAction',
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  button.title = title;
  button.setAttribute('aria-label', title);
  button.addEventListener('mousedown', (event) => event.preventDefault());
  button.addEventListener('click', onPress);
  return button;
}

function usagesPanel(view: EditorView): Panel {
  const dom = document.createElement('div');
  dom.className = 'cm-variableUsagesPanel';

  const label = document.createElement('span');
  label.className = 'cm-variableUsagesLabel';
  dom.appendChild(label);
  dom.appendChild(barButton('‹', 'Previous usage', () => step(view, -1)));
  dom.appendChild(barButton('›', 'Next usage', () => step(view, 1)));
  dom.appendChild(
    barButton('✕', 'Close usages', () => close(view), 'cm-variableUsagesClose'),
  );

  const render = (active: ActiveUsages | null) => {
    if (!active) return;
    const count = active.ranges.length;
    label.textContent = `${active.name} · ${count} usage${
      count === 1 ? '' : 's'
    } (${active.index + 1}/${count})`;
  };
  render(view.state.field(usagesField, false) ?? null);

  return {
    dom,
    top: false,
    update: (update) => render(update.state.field(usagesField, false) ?? null),
  };
}

/** Where the usages, if any, are on show. */
const usagesField = StateField.define<ActiveUsages | null>({
  create: () => null,
  update(active, tr) {
    // An edit invalidates the offsets, and the answer they stand for may no
    // longer be true - re-asking is one click away.
    if (tr.docChanged) return null;
    // The foot of the editor holds one bar: find/replace takes ours away.
    if (searchJustOpened(tr)) return null;
    for (const effect of tr.effects) {
      if (effect.is(setUsages)) return effect.value;
      if (effect.is(clearUsages)) return null;
    }
    return active;
  },
  provide: (field) => [
    EditorView.decorations.from(field, usageDecorations),
    showPanel.from(field, (active) => (active ? usagesPanel : null)),
  ],
});

/**
 * The marks alone. They lie on the editor's own paper, which is light whatever
 * the app's chrome does, so their colours are fixed here rather than taken from
 * the theme; the bar is chrome and is themed in src/styles.css alongside the
 * find/replace panel it follows.
 */
const usagesTheme = EditorView.baseTheme({
  '.cm-variableUsage': {
    backgroundColor: '#cfe0ff',
    borderRadius: '2px',
  },
  '.cm-variableUsage-current': {
    backgroundColor: '#9dc0ff',
    outline: '1px solid #4a7fd4',
  },
});

/** The marks, the bar and their keymap. Pair with {@link variableUsagesRow}. */
export const variableUsagesFeature: Extension = [
  usagesField,
  keymap.of([
    {
      key: 'Escape',
      run: (view) => {
        // Only when there is something of ours to dismiss, so Escape still
        // reaches the completion popup and the find panel.
        if (completionStatus(view.state) === 'active') return false;
        if (!view.state.field(usagesField, false)) return false;
        close(view);
        return true;
      },
    },
  ]),
  usagesTheme,
];

/**
 * The menu row. `dialectId` and `keywords` are read once: the host rebuilds the
 * editor when the dialect changes, so there is nothing to reconfigure.
 */
export function variableUsagesRow(
  dialectId: string,
  keywords: EditorKeyword[],
): MenuRowSource {
  return (state, pos) => {
    const token = variableTokenAt(
      state.doc.toString(),
      dialectId,
      keywords,
      pos,
    );
    if (!token) return null;
    return {
      from: token.from,
      to: token.to,
      label: 'Usages',
      icon: 'usages',
      title: `Show where ${token.name} is used`,
      run: (view) => reveal(view, dialectId, keywords, pos),
    };
  };
}

/** Show the usages of the variable at `pos`, with that one current. */
function reveal(
  view: EditorView,
  dialectId: string,
  keywords: EditorKeyword[],
  pos: number,
): void {
  const found = findVariableUsages(
    view.state.doc.toString(),
    dialectId,
    keywords,
    pos,
  );
  if (!found || found.ranges.length === 0) return;
  // The bar is about to take the slot find/replace would be sitting in. Asked
  // after the guard above, so a press that finds nothing leaves a search alone.
  if (searchPanelOpen(view.state)) closeSearchPanel(view);
  const index = Math.max(
    0,
    found.ranges.findIndex((r) => r.from === found.token.from),
  );
  view.dispatch({ effects: setUsages.of({ ...found, index }) });
  view.focus();
}
