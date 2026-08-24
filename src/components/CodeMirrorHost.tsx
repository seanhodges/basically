import { useEffect, useMemo, useRef } from 'react';
import {
  Compartment,
  EditorState,
  Prec,
  Range,
  RangeSet,
  StateEffect,
  StateField,
} from '@codemirror/state';
import {
  Decoration,
  EditorView,
  gutter,
  GutterMarker,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  type DecorationSet,
} from '@codemirror/view';
import {
  cursorCharLeft,
  cursorCharRight,
  cursorLineDown,
  cursorLineUp,
  defaultKeymap,
  deleteCharBackward,
  deleteCharForward,
  history,
  historyKeymap,
  insertNewlineAndIndent,
  redo,
  undo,
} from '@codemirror/commands';
import {
  autocompletion,
  completionKeymap,
  completionStatus,
  hasNextSnippetField,
  hasPrevSnippetField,
  insertCompletionText,
  nextSnippetField,
  pickedCompletion,
  prevSnippetField,
  selectedCompletion,
} from '@codemirror/autocomplete';
import { lintKeymap, setDiagnosticsEffect } from '@codemirror/lint';
import {
  openSearchPanel,
  closeSearchPanel,
  searchPanelOpen,
  searchKeymap,
  highlightSelectionMatches,
} from '@codemirror/search';
import {
  syntaxHighlighting,
  defaultHighlightStyle,
} from '@codemirror/language';
import type { Dialect } from '../dialects/types';
import type { EditorKeyAction } from '../keyboard/layoutSchema';
import { dialectLinter } from '../editor/lintIntegration';
import { basicHighlightStyle } from '../editor/basicLanguage';
import { binaryLineExtension } from '../editor/binaryLineWidget';
import { controlChipExtension } from '../editor/controlChipWidget';
import {
  variableUsagesFeature,
  variableUsagesRow,
} from '../editor/variableUsagesView';
import { clickMenu } from '../editor/clickMenu';
import { BASIC_REFERENCE_KINDS, referenceRow } from '../editor/referenceRow';
import { operatorSpellings } from '../dialects/operators';
import { keywordSpellingsFor } from '../dialects/keywordSpellings';
import { referenceTopic } from '../app/docsTopic';
import { numberingConfig, fullCompletion } from '../editor/completions';
import { crunchMatcher } from '../editor/crunch';
import {
  useIdeStore,
  selectActiveBreakpoints,
  selectVisibleDebugLine,
  selectVisibleProfile,
} from '../app/store';
import { lineHeat, lineShares, type LineHeat } from '../app/runProfile';
import type { EditorCommandName } from '../app/store';
import { openDroppedFile } from '../app/fileCommands';
import {
  insertNumberedLineBelow,
  numberLineInPlace,
  parseLines,
  renumberLine,
  renumberProgram,
  MIN_LINE_NO,
  MAX_LINE_NO,
  type UnnumberedLine,
} from '../editor/lineNumbering';
import { isBinaryDirective } from '../dialects/binaryDirective';
import { findRowForLineNumber } from '../editor/programOutline';
import { isMobileViewport } from '../app/useMediaQuery';
import { useRetireEditorPopups } from '../app/useRetireEditorPopups';
import { isMac } from '../app/shortcuts';
import styles from './CodeMirrorHost.module.css';

/** Replace the whole document and drop the cursor at the end of `cursorLine`. */
function replaceDoc(
  view: EditorView,
  lines: string[],
  cursorLine: number,
): void {
  const text = lines.join('\n');
  const anchor = lines.slice(0, cursorLine + 1).join('\n').length;
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: text },
    selection: { anchor },
    scrollIntoView: true,
  });
}

/**
 * A machine's own unnumbered program lines as a predicate, or nothing at all
 * for a machine whose source is numbered lines and nothing else.
 */
function unnumberedFor(dialect: Dialect): UnnumberedLine | undefined {
  const key = dialect.unnumberedLineKey;
  return key ? (line: string) => key(line) !== null : undefined;
}

/**
 * The active machine's unnumbered program lines, as the facet carries them.
 *
 * The numbering handlers are keymap callbacks taking only a view, so the
 * dialect reaches them the same way the increment does - through the facet the
 * host configures - rather than by widening every signature.
 */
function unnumberedOf(view: EditorView): UnnumberedLine | undefined {
  return view.state.facet(numberingConfig).unnumbered;
}

/** Enter handler: auto-prefix a line number on the new line (and bootstrap the current one). */
function autoNumberOnEnter(view: EditorView): boolean {
  const { autoLineNumbering, lineNumberIncrement } = useIdeStore.getState();
  if (!autoLineNumbering) return false;
  const { state } = view;
  // Let an open autocomplete popup consume Enter (accept completion) first.
  if (completionStatus(state) === 'active') return false;
  const sel = state.selection.main;
  if (!sel.empty) return false;
  const line = state.doc.lineAt(sel.head);
  if (sel.head !== line.to) return false; // only at end of line - else split normally

  const physical = state.doc.toString().split('\n');
  const result = insertNumberedLineBelow(
    physical,
    line.number - 1,
    lineNumberIncrement,
    unnumberedOf(view),
  );
  if (!result) return false; // nothing to number - fall back to default newline
  replaceDoc(view, result.lines, result.cursorLine);
  return true;
}

/**
 * Enter handler used while editing: when a construct snippet is active, Enter
 * jumps to the next `${…}` placeholder (mobile has no Tab key, so Return stands
 * in for it - desktop Tab keeps working too). Otherwise Enter auto-numbers the
 * new line as before. An open completion popup still consumes Enter first.
 */
function handleEnter(view: EditorView): boolean {
  if (completionStatus(view.state) === 'active') return false;
  if (hasNextSnippetField(view.state)) return nextSnippetField(view);
  return autoNumberOnEnter(view);
}

/** Shift+Enter: step back to the previous snippet placeholder (mirrors Shift+Tab). */
function handleShiftEnter(view: EditorView): boolean {
  if (hasPrevSnippetField(view.state)) return prevSnippetField(view);
  return false;
}

/**
 * BBC-style keyword abbreviation: while the autocomplete popup is open, the `.`
 * key accepts the top (selected) suggestion instead of inserting a period, so
 * e.g. `PR.` completes to `PRINT`. The period is the abbreviation marker and is
 * consumed, not inserted.
 *
 * We apply the completion ourselves rather than calling `acceptCompletion`: that
 * command has an `interactionDelay` (75ms) guard that rejects a just-opened
 * popup, which is exactly the fast-typed `PR.` case. This mirrors CodeMirror's
 * internal `applyCompletion` - run the option's `apply` (so block constructs
 * still expand), or insert its label for a plain keyword. Returns false when no
 * popup is open (a no-op in that case) so the caller inserts `.` normally.
 *
 * Shared by all three input paths that can produce a period: the physical-keyboard
 * `keydown` handler, the native-mobile `inputHandler`, and the on-screen keyboard
 * via `applyEditorAction`. (A single DOM keydown handler is insufficient - soft
 * keyboards route through beforeinput/composition and the virtual keyboard never
 * emits key events.)
 *
 * The replace range is recomputed with the same leading-identifier pattern the
 * completion source matches (see buildCompletionSource in completions.ts); keep
 * the two in step. For crunched dialects (C64/TRS-80) the sources re-anchor
 * past glued keywords (`POKEA` completes only the `A`), so when the selected
 * option doesn't match the whole word we re-anchor the same way here.
 */
function acceptCompletionForPeriod(view: EditorView): boolean {
  if (completionStatus(view.state) !== 'active') return false;
  const option = selectedCompletion(view.state);
  if (!option) return false;

  const head = view.state.selection.main.head;
  const line = view.state.doc.lineAt(head);
  const before = view.state.sliceDoc(line.from, head);
  const word = /[A-Za-z][A-Za-z$]*$/.exec(before);
  let from = word ? head - word[0].length : head;
  const crunch = view.state.facet(crunchMatcher);
  if (
    crunch &&
    word &&
    !option.label.toUpperCase().startsWith(word[0].toUpperCase())
  ) {
    from = head - word[0].length + crunch.tailStart(word[0]);
  }

  const { apply } = option;
  if (typeof apply === 'function') {
    apply(view, option, from, head);
  } else {
    view.dispatch({
      ...insertCompletionText(view.state, apply ?? option.label, from, head),
      annotations: pickedCompletion.of(option),
    });
  }
  return true;
}

/** Physical-keyboard seam for {@link acceptCompletionForPeriod}. */
function acceptCompletionOnPeriod(
  event: KeyboardEvent,
  view: EditorView,
): boolean {
  if (event.key !== '.') return false;
  if (!acceptCompletionForPeriod(view)) return false;
  event.preventDefault();
  return true;
}

/**
 * Renumber the line under the cursor. A numbered line prompts for its new number
 * (and fixes references); a text line with no number is given a
 * position-appropriate number in place, no prompt.
 */
function renumberCurrentLine(view: EditorView): boolean {
  const { state } = view;
  const line = state.doc.lineAt(state.selection.main.head);
  const m = /^\s*(\d+)\s?/.exec(line.text);
  if (!m) return numberCurrentLineInPlace(view, line.number - 1);
  // A line the machine takes unnumbered never had a number to change.
  if (unnumberedOf(view)?.(line.text)) return true;
  const oldNo = parseInt(m[1]!, 10);

  const input = window.prompt(`Renumber line ${oldNo} to:`, String(oldNo));
  if (input === null) return true; // cancelled - but the key was ours
  const newNo = parseInt(input.trim(), 10);
  if (!Number.isInteger(newNo) || newNo < MIN_LINE_NO || newNo > MAX_LINE_NO) {
    window.alert(
      `Line number must be an integer between ${MIN_LINE_NO} and ${MAX_LINE_NO}.`,
    );
    return true;
  }
  if (newNo === oldNo) return true;
  const docText = state.doc.toString();
  if (parseLines(docText).some((l) => l.lineNo === newNo)) {
    window.alert(`Line ${newNo} already exists.`);
    return true;
  }

  const newLines = renumberLine(
    docText,
    oldNo,
    newNo,
    unnumberedOf(view),
  ).split('\n');
  const ci = newLines.findIndex((l) =>
    new RegExp(`^\\s*${newNo}(\\s|$)`).test(l),
  );
  replaceDoc(view, newLines, ci < 0 ? newLines.length - 1 : ci);
  view.focus();
  return true;
}

/**
 * Give the (unnumbered) physical line at `idx` a position-appropriate number in
 * place - the same number the Enter key would assign - cascading following lines
 * when there's no gap. A no-op (still consumed) on a blank line or when the
 * cascade would overflow. Undo reverts.
 */
function numberCurrentLineInPlace(view: EditorView, idx: number): boolean {
  const { state } = view;
  if (state.doc.line(idx + 1).text.trim() === '') return false; // blank - let the key pass
  const increment = useIdeStore.getState().lineNumberIncrement;
  const physical = state.doc.toString().split('\n');
  const result = numberLineInPlace(
    physical,
    idx,
    increment,
    unnumberedOf(view),
  );
  // Nothing to number: a line the machine takes as it stands, or a blank one.
  if (!result && unnumberedOf(view)?.(state.doc.line(idx + 1).text))
    return true;
  if (!result) {
    window.alert(
      `No room to number this line without exceeding ${MAX_LINE_NO}.`,
    );
    return true;
  }
  replaceDoc(view, result.lines, idx);
  view.focus();
  return true;
}

/**
 * Renumber the whole program to `increment, 2*increment, …` (the "Line number
 * increment" setting), rewriting every GOTO/GOSUB/etc. reference. No prompt -
 * Undo reverts. Keeps the cursor on the same program line.
 */
function renumberFile(view: EditorView): boolean {
  const { state } = view;
  const docText = state.doc.toString();
  const increment = useIdeStore.getState().lineNumberIncrement;
  const keep = unnumberedOf(view);
  const renumbered = renumberProgram(docText, increment, increment, keep);
  if (renumbered === null) {
    window.alert(
      `Too many lines to renumber with an increment of ${increment} - the ` +
        `last line would exceed ${MAX_LINE_NO}. Try a smaller increment.`,
    );
    return true;
  }
  if (renumbered === docText) return true; // empty program - nothing to do

  // Keep the cursor on the same program line. Each line that gets renumbered
  // takes its number from its 1-based rank in source order, so the cursor
  // line's new number is `increment ×` that rank. Only the lines renumbering
  // actually numbers may be counted - a blank line, a `#BIN` payload or a line
  // the machine takes unnumbered would each push the rank past the number the
  // line really got, and land the cursor somewhere else.
  const cursorIdx = state.doc.lineAt(state.selection.main.head).number - 1;
  const physical = docText.split('\n');
  const numbered = (row: string) =>
    row.trim() !== '' && !isBinaryDirective(row) && !keep?.(row);
  let rank = 0;
  for (let i = 0; i <= cursorIdx && i < physical.length; i++) {
    if (numbered(physical[i]!)) rank++;
  }
  const newNo = rank === 0 ? null : rank * increment;

  const newLines = renumbered.split('\n');
  const ci =
    newNo === null
      ? newLines.length - 1
      : newLines.findIndex((l) => new RegExp(`^\\s*${newNo}(\\s|$)`).test(l));
  replaceDoc(view, newLines, ci < 0 ? newLines.length - 1 : ci);
  view.focus();
  return true;
}

/**
 * F9: toggle a breakpoint on the BASIC line under the cursor. Reuses the same
 * row→line-number mapping the clickable gutter uses, so the shortcut and the
 * gutter click agree. A no-op (but still consumed) on a row without a number.
 */
function toggleBreakpointAtCursor(view: EditorView): boolean {
  const line = view.state.doc.lineAt(view.state.selection.main.head);
  const lineNo = rowLineNumber(line.text);
  if (lineNo === null) return true;
  useIdeStore.getState().toggleBreakpoint(lineNo);
  return true;
}

/** Mod-Shift-O: open the program Outline (mirrors the Edit-menu item). */
function openOutline(): boolean {
  useIdeStore.getState().setProcedureListOpen(true);
  return true;
}

/**
 * Range to act on for copy/cut: the main selection, or - when it's empty - the
 * whole current line (incl. trailing newline), mirroring CodeMirror's default
 * clipboard behaviour for an empty selection.
 */
function clipboardRange(view: EditorView): { from: number; to: number } {
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
async function copyTextToClipboard(text: string): Promise<boolean> {
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
async function readTextFromClipboard(): Promise<string | null> {
  if (!navigator.clipboard?.readText) return null;
  try {
    return await navigator.clipboard.readText();
  } catch {
    return null;
  }
}

/** Run an Edit-menu command against the editor. */
async function runEditorCommand(
  view: EditorView,
  name: EditorCommandName,
): Promise<void> {
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
      break;
    case 'closeFind':
      // Dismiss the panel without stealing focus back into the editor (so a tap
      // on the emulator that triggered this keeps its own focus).
      closeSearchPanel(view);
      break;
    case 'renumber':
      renumberCurrentLine(view);
      break;
    case 'renumberFile':
      renumberFile(view);
      break;
  }
  // The find/replace panel manages its own focus; everything else returns to the editor.
  if (name !== 'find' && name !== 'closeFind') view.focus();
}

const gutterCompartment = new Compartment();
const numberingCompartment = new Compartment();

function gutterExt(show: boolean) {
  return show ? [lineNumbers(), highlightActiveLineGutter()] : [];
}

/** The heat of the buffer on screen, for the gutter to draw. */
function visibleHeat(): Map<number, LineHeat> {
  const profile = selectVisibleProfile(useIdeStore.getState());
  return lineHeat(lineShares(profile?.lines ?? []));
}

/** Leading line number of an editor row, or null when the row has none. */
function rowLineNumber(text: string): number | null {
  const m = /^\s*(\d+)/.exec(text);
  return m ? parseInt(m[1]!, 10) : null;
}

/**
 * Carries the combined gutter, which is rebuilt whenever either of the two
 * things it draws from the store changes: the breakpoint set, and the profile
 * of the buffer on screen.
 */
const gutterMarkersCompartment = new Compartment();

/** A breakpoint marker: same size/style as the lint marker, but blue (see CSS). */
class BreakpointMarker extends GutterMarker {
  toDOM() {
    const el = document.createElement('div');
    el.className = `cm-lint-marker ${styles.breakpointDot!}`;
    return el;
  }
}
const bpMarker = new BreakpointMarker();

/**
 * A measured line's share of the run, drawn as a coloured bar down the inside
 * edge of the gutter (see {@link ../app/runProfile.lineHeat} for the banding).
 *
 * A bar rather than a third dot, because precedence between the three markings
 * has to end with none of them hidden: the bar occupies the gutter's edge, where
 * neither the red lint marker nor the blue breakpoint dot is drawn, so a line
 * carrying a diagnostic or a breakpoint still shows its cost and still shows the
 * marker. Between the two dots the existing rule stands - a diagnostic wins,
 * because a line that will not run is a more urgent thing to say about it than
 * how long it took last time.
 *
 * Carried as `elementClass` rather than as DOM so it composes: CodeMirror
 * concatenates the classes of every marker on a line onto one gutter element,
 * so the bar and a dot can be two markers in the same column.
 */
class HeatMarker extends GutterMarker {
  constructor(
    readonly level: number,
    readonly share: number,
  ) {
    super();
    this.elementClass = styles[`heat${level}`] ?? '';
  }

  override eq(other: HeatMarker): boolean {
    return other.level === this.level && other.share === this.share;
  }

  toDOM() {
    const el = document.createElement('div');
    el.className = styles.heatHit!;
    // Said on the marking itself, because a share is meaningless without both:
    // whose time it is, and what it excludes.
    el.title =
      `${(this.share * 100).toFixed(1)}% of the run's time on this machine.\n` +
      'This line only - time inside routines it calls is charged to them.';
    return el;
  }
}

/** Red error marker; DOM matches the default @codemirror/lint error marker. */
class LintErrorMarker extends GutterMarker {
  toDOM() {
    const el = document.createElement('div');
    el.className = 'cm-lint-marker cm-lint-marker-error';
    return el;
  }
  eq() {
    return true; // all error markers interchangeable -> stable RangeSet.eq
  }
}
const lintErrorMarker = new LintErrorMarker();

/**
 * One red marker per line carrying a diagnostic. Mirrors lintGutter's own
 * (unexported) field: rebuild only on setDiagnosticsEffect so the RangeSet
 * instance stays stable and the combined gutter only redraws when diagnostics
 * actually change (not on every keystroke or cursor move).
 */
const lintGutterMarkerField = StateField.define<RangeSet<GutterMarker>>({
  create: () => RangeSet.empty,
  update(markers, tr) {
    markers = markers.map(tr.changes);
    for (const e of tr.effects) {
      if (e.is(setDiagnosticsEffect)) {
        const seen = new Set<number>();
        const ranges = [];
        for (const d of e.value ?? []) {
          const from = tr.state.doc.lineAt(d.from).from;
          if (!seen.has(from)) {
            seen.add(from);
            ranges.push(lintErrorMarker.range(from));
          }
        }
        markers = RangeSet.of(ranges, true);
      }
    }
    return markers;
  },
});

/**
 * The clickable combined gutter: three markings in one column.
 *
 * Blue breakpoint dots (via lineMarker, reading the live breakpoint set kept by
 * BASIC line number so dots track edits/renumbering), red lint error markers
 * (via the reactive {@link lintGutterMarkerField}), and the measured cost of
 * each line as a coloured bar down the gutter's inside edge ({@link HeatMarker}).
 *
 * Precedence, decided so that nothing a user needs is hidden: the cost bar is
 * drawn on every measured line regardless, because it occupies an edge neither
 * dot uses. Between the two dots, which share the one centred position, a lint
 * marker still wins - a line that will not run is more urgent than how long it
 * took last time, and the breakpoint is still in the set and still shown the
 * moment the diagnostic is fixed.
 *
 * Toggles a breakpoint on a gutter click. Reconfigured via
 * {@link gutterMarkersCompartment} when the breakpoints or the profile change.
 */
function combinedGutterExt(
  breakpoints: ReadonlySet<number>,
  heat: ReadonlyMap<number, LineHeat>,
) {
  return gutter({
    class: 'cm-combined-gutter',
    markers: (view) => {
      const lint = view.state.field(lintGutterMarkerField);
      if (heat.size === 0) return lint;
      const ranges: Range<GutterMarker>[] = [];
      lint.between(0, view.state.doc.length, (from, _to, marker) => {
        ranges.push(marker.range(from));
      });
      const doc = view.state.doc;
      for (let row = 1; row <= doc.lines; row++) {
        const line = doc.line(row);
        const lineNo = rowLineNumber(line.text);
        const hot = lineNo === null ? undefined : heat.get(lineNo);
        if (hot)
          ranges.push(new HeatMarker(hot.level, hot.share).range(line.from));
      }
      return RangeSet.of(ranges, true);
    },
    lineMarker(view, line) {
      // A lint marker on this line takes priority over the breakpoint dot.
      let hasLint = false;
      view.state
        .field(lintGutterMarkerField)
        .between(line.from, line.from, () => {
          hasLint = true;
          return false;
        });
      if (hasLint) return null;
      const lineNo = rowLineNumber(view.state.doc.lineAt(line.from).text);
      return lineNo !== null && breakpoints.has(lineNo) ? bpMarker : null;
    },
    initialSpacer: () => bpMarker,
    domEventHandlers: {
      mousedown(view, line) {
        const lineNo = rowLineNumber(view.state.doc.lineAt(line.from).text);
        if (lineNo === null) return false;
        useIdeStore.getState().toggleBreakpoint(lineNo);
        return true;
      },
    },
  });
}

/** Effect carrying the 1-based editor row to highlight as paused (null clears). */
const setDebugRowEffect = StateEffect.define<number | null>();
const debugLineMark = Decoration.line({ class: styles.debugCurrentLine! });

/** Highlights the BASIC line the debugger is currently paused on. */
const debugLineField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    for (const e of tr.effects) {
      if (e.is(setDebugRowEffect)) {
        if (e.value === null) return Decoration.none;
        const line = tr.state.doc.line(e.value);
        return Decoration.set([debugLineMark.range(line.from)]);
      }
    }
    return deco.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

/** Suppresses the native on-screen keyboard while the virtual keyboard is the
    editor's input surface (the editor stays focusable and physical keyboards are
    unaffected). */
const inputModeCompartment = new Compartment();

function inputModeExt(virtualKeyboard: boolean) {
  return EditorView.contentAttributes.of(
    virtualKeyboard ? { inputmode: 'none' } : {},
  );
}

/**
 * The virtual keyboard is (or will be) the editor's input surface, so the native
 * OSK must be suppressed pre-emptively (before the focusing tap): either the
 * explicit toggle is on, or auto-show is on. The editor's contenteditable only
 * holds focus while the editor surface is active, and auto-show always fires on
 * the editor surface (the phone-landscape carve-out is emulator-only - see
 * {@link resolveInputOverlays}), so no layout check is needed here.
 */
function shouldSuppressNativeKeyboard(
  keyboardEnabled: boolean,
  keyboardAutoShow: boolean,
): boolean {
  return keyboardEnabled || keyboardAutoShow;
}

/** Apply one virtual-keyboard action to the editor. */
function applyEditorAction(view: EditorView, action: EditorKeyAction): void {
  if ('insert' in action) {
    // A period accepts the open completion (BBC-style abbreviation) rather than
    // inserting, mirroring the physical/native-keyboard seams.
    if (action.insert === '.' && acceptCompletionForPeriod(view)) return;
    view.dispatch(view.state.replaceSelection(action.insert), {
      scrollIntoView: true,
      userEvent: 'input.type',
    });
    return;
  }
  switch (action.action) {
    case 'backspace':
      deleteCharBackward(view);
      break;
    // The machines with a delete key but no backspace (the PMD 85): the key
    // takes the character the cursor is on, not the one behind it.
    case 'delete':
      deleteCharForward(view);
      break;
    case 'newline':
      if (!autoNumberOnEnter(view)) insertNewlineAndIndent(view);
      break;
    case 'left':
      cursorCharLeft(view);
      break;
    case 'right':
      cursorCharRight(view);
      break;
    case 'up':
      cursorLineUp(view);
      break;
    case 'down':
      cursorLineDown(view);
      break;
  }
}

interface Props {
  dialect: Dialect;
  /** Pushed into the editor whenever seq changes. */
  override: { text: string; seq: number };
  onChange(text: string): void;
  /** Receives a function the virtual keyboard calls to type into the editor. */
  inputRef?: React.MutableRefObject<((action: EditorKeyAction) => void) | null>;
}

export function CodeMirrorHost({
  dialect,
  override,
  onChange,
  inputRef,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const lastSeq = useRef(-1);
  const onChangeRef = useRef(onChange);
  const isApplyingOverride = useRef(false);
  onChangeRef.current = onChange;
  const editorCommand = useIdeStore((s) => s.editorCommand);
  const lastCommand = useRef(editorCommand.seq);
  const jumpTarget = useIdeStore((s) => s.jumpTarget);
  const lastJump = useRef(jumpTarget.seq);

  useEffect(() => {
    if (!hostRef.current) return;
    // Mirror the search panel's open state into the store, and hide the virtual
    // keyboard the moment it opens (covers both the menu and the Mod-f shortcut).
    let searchOpen = false;
    const state = EditorState.create({
      doc: override.text,
      extensions: [
        Prec.highest(
          keymap.of([
            { key: 'Enter', run: handleEnter },
            { key: 'Shift-Enter', run: handleShiftEnter },
            { key: 'Mod-Alt-r', run: renumberCurrentLine },
            { key: 'Mod-Shift-r', run: renumberFile },
            { key: 'F9', run: toggleBreakpointAtCursor },
            { key: 'Mod-Shift-o', run: openOutline },
          ]),
        ),
        gutterCompartment.of(
          gutterExt(useIdeStore.getState().showLineNumberGutter),
        ),
        numberingCompartment.of([
          numberingConfig.of({
            auto: useIdeStore.getState().autoLineNumbering,
            increment: useIdeStore.getState().lineNumberIncrement,
            unnumbered: unnumberedFor(dialect),
          }),
          fullCompletion.of(useIdeStore.getState().fullCodeCompletion),
        ]),
        gutterMarkersCompartment.of(
          combinedGutterExt(
            selectActiveBreakpoints(useIdeStore.getState()),
            visibleHeat(),
          ),
        ),
        lintGutterMarkerField,
        debugLineField,
        highlightActiveLine(),
        drawSelection(),
        history(),
        autocompletion({ activateOnTyping: true }),
        EditorView.domEventHandlers({ keydown: acceptCompletionOnPeriod }),
        // Native-mobile seam: soft keyboards commit `.` through beforeinput
        // rather than a `.`-keyed keydown, so intercept the typed text directly.
        EditorView.inputHandler.of((view, _from, _to, text) =>
          text === '.' ? acceptCompletionForPeriod(view) : false,
        ),
        highlightSelectionMatches(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        syntaxHighlighting(basicHighlightStyle),
        dialect.languageSupport(),
        dialectLinter(dialect),
        // Click a token to be offered what the editor can say about it: a
        // variable's usages, matched as the machine would match them rather
        // than as text, or a keyword's entry in this machine's reference.
        clickMenu([
          variableUsagesRow(dialect.id, dialect.keywords),
          referenceRow({
            kinds: BASIC_REFERENCE_KINDS,
            operators: operatorSpellings(dialect),
            spellings: keywordSpellingsFor(dialect.id),
            topic: (word) => referenceTopic(dialect, word),
            open: (topic) => useIdeStore.getState().openDocs(topic),
          }),
        ]),
        variableUsagesFeature,
        // Collapse opaque #BIN machine-code lines into chips, but only for
        // dialects whose tokenizer accepts them - elsewhere the raw text must
        // stay visible so its tokenizer error is.
        ...(dialect.supportsBinaryLines ? [binaryLineExtension()] : []),
        // Draw the machine's display control codes rather than spelling them:
        // a MODE 7 line is mostly attributes, and `{GRAPHICS WHITE}` costs
        // sixteen of its forty columns to say what a chip shows.
        ...(dialect.displayControls
          ? [
              controlChipExtension(dialect.displayControls, (text) =>
                dialect.charset.toMachine(text),
              ),
            ]
          : []),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...completionKeymap,
          ...searchKeymap,
          ...lintKeymap,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !isApplyingOverride.current)
            onChangeRef.current(update.state.doc.toString());
          if (update.focusChanged)
            useIdeStore.getState().setEditorFocused(update.view.hasFocus);
          const open = searchPanelOpen(update.state);
          if (open !== searchOpen) {
            searchOpen = open;
            useIdeStore.getState().setFindReplaceOpen(open);
          }
        }),
        // Tapping/clicking the editor body dismisses the find/replace panel.
        // Returns false so the click still positions the cursor; the panel's own
        // inputs live outside contentDOM, so typing there never triggers this.
        EditorView.domEventHandlers({
          mousedown: (_event, view) => {
            if (searchPanelOpen(view.state)) closeSearchPanel(view);
            return false;
          },
          touchstart: (_event, view) => {
            if (searchPanelOpen(view.state)) closeSearchPanel(view);
            return false;
          },
          // Dropping a file onto the editor opens it (like File → Open for
          // .bas/.txt, or Import for a dialect binary format). Only intercept
          // file drops - a text drag within the editor still uses CodeMirror's
          // own drop handling. `preventDefault` + returning true stops both the
          // browser navigating to the file and CM inserting it as text.
          dragover: (event) => {
            if (!event.dataTransfer?.types.includes('Files')) return false;
            event.preventDefault();
            return true;
          },
          drop: (event) => {
            const file = event.dataTransfer?.files?.[0];
            if (!file) return false;
            event.preventDefault();
            void openDroppedFile(file);
            return true;
          },
        }),
        inputModeCompartment.of(
          inputModeExt(
            shouldSuppressNativeKeyboard(
              useIdeStore.getState().keyboardEnabled,
              useIdeStore.getState().keyboardAutoShow,
            ),
          ),
        ),
        EditorView.theme({
          '&': { height: '100%', fontSize: '14px' },
          '.cm-scroller': {
            fontFamily: 'var(--mono)',
            // Fixed rather than derived from the font: the mono stack starts
            // with the bundled graphics faces (src/styles.css), and letting the
            // row height come from whichever face drew the line would resize a
            // row the moment a block graphic appeared in it.
            lineHeight: '1.3',
          },
        }),
      ],
    });
    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;
    lastSeq.current = override.seq;
    if (inputRef)
      inputRef.current = (action) => applyEditorAction(view, action);
    return () => {
      view.destroy();
      viewRef.current = null;
      if (inputRef) inputRef.current = null;
      useIdeStore.getState().setEditorFocused(false);
    };
    // The editor is rebuilt only when the dialect changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialect]);

  // Raising a dialog, panel or drawer over the editor takes away the completion
  // list and the picked-token menu; the on-screen input overlays don't.
  useRetireEditorPopups(viewRef);

  // Keep the native-OSK suppression in sync: suppress it whenever the virtual
  // keyboard is (or will be) the editor's input surface - the explicit toggle or
  // auto-show. Reconfigure when either of those changes.
  const keyboardOverlay = useIdeStore((s) => s.keyboardEnabled);
  const keyboardAutoShow = useIdeStore((s) => s.keyboardAutoShow);
  const suppressNativeKeyboard = shouldSuppressNativeKeyboard(
    keyboardOverlay,
    keyboardAutoShow,
  );
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: inputModeCompartment.reconfigure(
        inputModeExt(suppressNativeKeyboard),
      ),
    });
  }, [suppressNativeKeyboard]);

  // On mobile, switching away from the app and back makes the browser restore
  // focus to the editor's contenteditable and re-summon the native on-screen
  // keyboard, which then draws *in front of* the virtual keyboard. The
  // `inputmode: 'none'` above suppresses the native keyboard when focus is taken
  // by a tap, but browsers don't reliably re-consult it on this programmatic
  // resume-refocus (notably iOS Safari). The virtual keyboard types straight
  // into the view (see applyEditorAction) and never needs the contenteditable
  // to hold DOM focus, so drop that focus while backgrounding: with no focused
  // editable, the resume has nothing to summon a keyboard for. Mount-once; reads
  // the live flag at event time so it survives keyboard toggles.
  useEffect(() => {
    const onVisibility = () => {
      // The virtual keyboard is in play for the editor when its toggle is on or
      // when auto-show would pop it on focus - both suppress the native OSK, so
      // blur on background in either case.
      const s = useIdeStore.getState();
      if (
        document.visibilityState === 'hidden' &&
        (s.keyboardEnabled || s.keyboardAutoShow)
      ) {
        viewRef.current?.contentDOM.blur();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const showLineNumberGutter = useIdeStore((s) => s.showLineNumberGutter);
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: gutterCompartment.reconfigure(gutterExt(showLineNumberGutter)),
    });
  }, [showLineNumberGutter]);

  // Keep the completion facets in step with the editor settings (the editor
  // isn't rebuilt when they change): auto line-numbering drives how construct
  // blocks are numbered, and full code completion toggles the block constructs.
  const autoLineNumbering = useIdeStore((s) => s.autoLineNumbering);
  const lineNumberIncrement = useIdeStore((s) => s.lineNumberIncrement);
  const fullCodeCompletion = useIdeStore((s) => s.fullCodeCompletion);
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: numberingCompartment.reconfigure([
        numberingConfig.of({
          auto: autoLineNumbering,
          increment: lineNumberIncrement,
          unnumbered: unnumberedFor(dialect),
        }),
        fullCompletion.of(fullCodeCompletion),
      ]),
    });
  }, [autoLineNumbering, lineNumberIncrement, fullCodeCompletion, dialect]);

  // Re-render the combined gutter whenever either of the things it draws from
  // the store changes: the breakpoint set and the profile, both of the buffer on
  // screen, so the markings always belong to the code they mark.
  const breakpoints = useIdeStore(selectActiveBreakpoints);
  const profile = useIdeStore(selectVisibleProfile);
  const heat = useMemo(
    () => lineHeat(lineShares(profile?.lines ?? [])),
    [profile],
  );
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: gutterMarkersCompartment.reconfigure(
        combinedGutterExt(breakpoints, heat),
      ),
    });
  }, [breakpoints, heat]);

  // Highlight (and scroll to) the line the debugger is paused on. Breakpoints
  // and the paused line are tracked by BASIC line number, so map to an editor
  // row here; clear the highlight when there's no paused line, or when the
  // pause belongs to a buffer other than the one on screen.
  const debugLine = useIdeStore(selectVisibleDebugLine);
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const row =
      debugLine === null
        ? null
        : findRowForLineNumber(view.state.doc.toString(), debugLine);
    const effects: StateEffect<unknown>[] = [setDebugRowEffect.of(row)];
    if (row !== null) {
      effects.push(
        EditorView.scrollIntoView(view.state.doc.line(row).from, {
          y: 'center',
        }),
      );
    }
    view.dispatch({ effects });
  }, [debugLine]);

  // Switching the mobile view tab dismisses the find/replace panel.
  const mobileTab = useIdeStore((s) => s.mobileTab);
  useEffect(() => {
    const view = viewRef.current;
    if (view && searchPanelOpen(view.state)) closeSearchPanel(view);
  }, [mobileTab]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || override.seq === lastSeq.current) return;
    lastSeq.current = override.seq;
    if (view.state.doc.toString() !== override.text) {
      isApplyingOverride.current = true;
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: override.text },
      });
      isApplyingOverride.current = false;
    }
  }, [override]);

  // The toolbar's Edit menu bumps editorCommand.seq; run the requested command
  // here where we hold the EditorView.
  useEffect(() => {
    if (editorCommand.seq === lastCommand.current) return;
    lastCommand.current = editorCommand.seq;
    const view = viewRef.current;
    if (view) void runEditorCommand(view, editorCommand.name);
  }, [editorCommand]);

  // The outline dialog bumps jumpTarget.seq to move the cursor to a BASIC line
  // number and scroll it into view. Line numbers aren't 1:1 with editor rows, so
  // scan for the matching row; no-op if it's gone (outline stale after an edit).
  useEffect(() => {
    if (jumpTarget.seq === lastJump.current) return;
    lastJump.current = jumpTarget.seq;
    const view = viewRef.current;
    if (!view) return;
    const row = findRowForLineNumber(
      view.state.doc.toString(),
      jumpTarget.lineNo,
    );
    if (row === null) return;
    const line = view.state.doc.line(row);
    // Scroll the target line to the *top* of the viewport (y: 'start') rather
    // than just bringing it barely into view, so the jump lands the line where
    // a reader expects it. A plain `scrollIntoView: true` leaves the line
    // wherever it first becomes visible (often the bottom edge).
    view.dispatch({
      selection: { anchor: line.from },
      effects: EditorView.scrollIntoView(line.from, { y: 'start' }),
    });
    view.focus();
    if (isMobileViewport()) useIdeStore.getState().setMobileTab('editor');
  }, [jumpTarget]);

  return (
    <div
      className={`${styles.cmHost}${keyboardOverlay ? ` ${styles.vkActive}` : ''}`}
      ref={hostRef}
    />
  );
}
