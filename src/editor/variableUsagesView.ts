// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Clicking a variable offers to show where else it is used.
 *
 * Three pieces: a one-row menu, which opens under the name a click or tap lands
 * on; a set of marks over every usage once that row is pressed; and a bar at the
 * foot of the editor naming the variable, counting the usages and stepping
 * between them. Which occurrences count is {@link ./variableUsages}' answer, and
 * it is the machine's - see there.
 *
 * A pointer is the only way in, by design. The caret alone would pop the menu on
 * every arrow-key press and would fight the completion popup for the same
 * anchor; hovering is not available on the touch devices this editor is used on.
 * For the same reason the offer is withheld while a completion is open and
 * dropped the moment the document changes.
 *
 * The menu borrows the completion popup's shape and the bar the find/replace
 * panel's, so a name answers where a keyword would and the foot of the editor
 * has one look. Both are chrome, and are themed with the rest of the editor's
 * CodeMirror furniture in src/styles.css; only the marks, which sit on the
 * editor's own paper, are themed here.
 */
import {
  Decoration,
  EditorView,
  keymap,
  showPanel,
  showTooltip,
  type DecorationSet,
  type Panel,
  type Tooltip,
} from '@codemirror/view';
import {
  EditorSelection,
  StateEffect,
  StateField,
  type Extension,
  type Transaction,
} from '@codemirror/state';
import { completionStatus } from '@codemirror/autocomplete';
import { closeSearchPanel, searchPanelOpen } from '@codemirror/search';
import type { EditorKeyword } from '../dialects/types';
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
/** The pending offer: a tooltip to show, or null to withdraw one. */
const offerUsages = StateEffect.define<Tooltip | null>();

const usageMark = Decoration.mark({ class: 'cm-variableUsage' });
const currentUsageMark = Decoration.mark({
  class: 'cm-variableUsage cm-variableUsage-current',
});

/**
 * True of the transaction that opens the find/replace panel.
 *
 * Safe to ask from inside a field's own `update`: EditorState fills in
 * `tr.state` before computing any slot, so this reads the state being built
 * rather than re-entering the update; and `searchPanelOpen` reads only
 * @codemirror/search's field, which reads nothing of ours. Asking
 * `tr.state.facet(showPanel)` instead would throw - that facet is computed from
 * `usagesField.provide`, so reading it from within `usagesField` is a cycle.
 */
function searchJustOpened(tr: Transaction): boolean {
  return !searchPanelOpen(tr.startState) && searchPanelOpen(tr.state);
}

function usageDecorations(active: ActiveUsages | null): DecorationSet {
  if (!active) return Decoration.none;
  return Decoration.set(
    active.ranges.map((r, i) =>
      (i === active.index ? currentUsageMark : usageMark).range(r.from, r.to),
    ),
  );
}

/**
 * The extension. `dialectId` and `keywords` are read once: the host rebuilds the
 * editor when the dialect changes, so there is nothing to reconfigure.
 */
export function variableUsagesExtension(
  dialectId: string,
  keywords: EditorKeyword[],
): Extension {
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

  /** The offer floating over the clicked name. */
  const offerField = StateField.define<Tooltip | null>({
    create: () => null,
    update(offer, tr) {
      if (tr.docChanged) return null;
      if (searchJustOpened(tr)) return null;
      for (const effect of tr.effects) {
        if (effect.is(offerUsages)) return effect.value;
        // Taking up the offer retires it; the panel says the rest.
        if (effect.is(setUsages) || effect.is(clearUsages)) return null;
      }
      return offer;
    },
    provide: (field) => showTooltip.from(field),
  });

  /** Show the usages of the variable at `pos`, with that one current. */
  function reveal(view: EditorView, pos: number): void {
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
      barButton(
        '✕',
        'Close usages',
        () => close(view),
        'cm-variableUsagesClose',
      ),
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
      update: (update) =>
        render(update.state.field(usagesField, false) ?? null),
    };
  }

  /**
   * The offer: a one-row menu below the name, shaped like a completion option.
   *
   * No `above`, so it opens below the name as a completion does, and CodeMirror
   * is still free to flip it above on the last visible row. The row is a button
   * inside the list rather than the list item itself - a one-option listbox that
   * acts on click reads poorly to a screen reader, and the button carries the
   * name of what pressing it does.
   */
  function offerTooltip(pos: number, name: string): Tooltip {
    return {
      pos,
      create: (view) => {
        const dom = document.createElement('div');
        dom.className = 'cm-variableUsagesTooltip';

        const list = document.createElement('ul');
        list.className = 'cm-variableUsagesList';
        const item = document.createElement('li');

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'cm-variableUsagesOffer';
        button.title = `Show where ${name} is used`;
        button.setAttribute('aria-label', `Show where ${name} is used`);
        button.addEventListener('mousedown', (event) => event.preventDefault());
        button.addEventListener('click', () => reveal(view, pos));

        const icon = document.createElement('span');
        icon.className = 'cm-variableUsagesIcon';
        icon.setAttribute('aria-hidden', 'true');
        const label = document.createElement('span');
        label.className = 'cm-variableUsagesOfferLabel';
        label.textContent = 'Usages';
        button.append(icon, label);

        item.appendChild(button);
        list.appendChild(item);
        dom.appendChild(list);
        return { dom };
      },
    };
  }

  /** Offer (or withdraw) at the document position under the pointer. */
  function offerAt(view: EditorView, x: number, y: number): void {
    // While the completion popup is up the caret's neighbourhood is already
    // spoken for, and two tooltips would fight for the same anchor. Only an
    // 'active' status means a visible popup - 'pending' is a query in flight,
    // which outlives typing and would suppress the offer for good.
    if (completionStatus(view.state) === 'active') return;
    const pos = view.posAtCoords({ x, y });
    const token =
      pos === null
        ? null
        : variableTokenAt(view.state.doc.toString(), dialectId, keywords, pos);
    const current = view.state.field(offerField, false) ?? null;
    // A tap arrives twice - as a touch and as a synthesised mouse event - so
    // re-offering the same name is a no-op rather than a second dispatch.
    if ((current?.pos ?? null) === (token ? token.from : null)) return;
    view.dispatch({
      effects: offerUsages.of(
        token ? offerTooltip(token.from, token.name) : null,
      ),
    });
  }

  return [
    usagesField,
    offerField,
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
}

/**
 * The marks alone. They lie on the editor's own paper, which is light whatever
 * the app's chrome does, so their colours are fixed here rather than taken from
 * the theme; the menu and the bar are chrome and are themed in src/styles.css
 * alongside the completion popup and the find/replace panel they follow.
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
