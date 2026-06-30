import { useEffect, useRef } from 'react';
import {
  Compartment,
  EditorState,
  Prec,
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
  history,
  historyKeymap,
  indentWithTab,
  insertNewlineAndIndent,
  redo,
  undo,
} from '@codemirror/commands';
import {
  autocompletion,
  completionKeymap,
  completionStatus,
} from '@codemirror/autocomplete';
import { lintGutter, lintKeymap } from '@codemirror/lint';
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
import { numberingConfig, fullCompletion } from '../editor/completions';
import { useIdeStore } from '../app/store';
import type { EditorCommandName } from '../app/store';
import {
  insertNumberedLineBelow,
  parseLines,
  renumberLine,
  MIN_LINE_NO,
  MAX_LINE_NO,
} from '../editor/lineNumbering';
import { findRowForLineNumber } from '../editor/programOutline';
import { isMobileViewport } from '../app/useMediaQuery';
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
  if (sel.head !== line.to) return false; // only at end of line — else split normally

  const physical = state.doc.toString().split('\n');
  const result = insertNumberedLineBelow(
    physical,
    line.number - 1,
    lineNumberIncrement,
  );
  if (!result) return false; // nothing to number — fall back to default newline
  replaceDoc(view, result.lines, result.cursorLine);
  return true;
}

/** Renumber the line under the cursor, prompting for the new number and fixing references. */
function renumberCurrentLine(view: EditorView): boolean {
  const { state } = view;
  const line = state.doc.lineAt(state.selection.main.head);
  const m = /^\s*(\d+)\s?/.exec(line.text);
  if (!m) return false; // no line number here
  const oldNo = parseInt(m[1]!, 10);

  const input = window.prompt(`Renumber line ${oldNo} to:`, String(oldNo));
  if (input === null) return true; // cancelled — but the key was ours
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

  const newLines = renumberLine(docText, oldNo, newNo).split('\n');
  const ci = newLines.findIndex((l) =>
    new RegExp(`^\\s*${newNo}(\\s|$)`).test(l),
  );
  replaceDoc(view, newLines, ci < 0 ? newLines.length - 1 : ci);
  view.focus();
  return true;
}

/** Run an Edit-menu command against the editor. */
function runEditorCommand(view: EditorView, name: EditorCommandName): void {
  switch (name) {
    case 'undo':
      undo(view);
      break;
    case 'redo':
      redo(view);
      break;
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
  }
  // The find/replace panel manages its own focus; everything else returns to the editor.
  if (name !== 'find' && name !== 'closeFind') view.focus();
}

const gutterCompartment = new Compartment();
const numberingCompartment = new Compartment();

function gutterExt(show: boolean) {
  return show ? [lineNumbers(), highlightActiveLineGutter()] : [];
}

/** Leading line number of an editor row, or null when the row has none. */
function rowLineNumber(text: string): number | null {
  const m = /^\s*(\d+)/.exec(text);
  return m ? parseInt(m[1]!, 10) : null;
}

const breakpointCompartment = new Compartment();

/** A red dot rendered in the breakpoint gutter for a breakpointed line. */
class BreakpointMarker extends GutterMarker {
  toDOM() {
    const span = document.createElement('span');
    span.textContent = '●';
    span.className = styles.breakpointDot!;
    return span;
  }
}
const bpMarker = new BreakpointMarker();

/**
 * The clickable breakpoint gutter. Reads the live breakpoint set (kept by BASIC
 * line number, so dots track edits/renumbering) and toggles on a gutter click.
 * Reconfigured via {@link breakpointCompartment} when the set changes.
 */
function breakpointGutterExt(breakpoints: ReadonlySet<number>) {
  return gutter({
    class: 'cm-breakpoint-gutter',
    lineMarker(view, line) {
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

/** Suppresses the native on-screen keyboard while the virtual keyboard is on
    (the editor stays focusable and physical keyboards are unaffected). */
const inputModeCompartment = new Compartment();

function inputModeExt(virtualKeyboard: boolean) {
  return EditorView.contentAttributes.of(
    virtualKeyboard ? { inputmode: 'none' } : {},
  );
}

/** Apply one virtual-keyboard action to the editor. */
function applyEditorAction(view: EditorView, action: EditorKeyAction): void {
  if ('insert' in action) {
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
            { key: 'Enter', run: autoNumberOnEnter },
            { key: 'Mod-Alt-r', run: renumberCurrentLine },
          ]),
        ),
        gutterCompartment.of(
          gutterExt(useIdeStore.getState().showLineNumberGutter),
        ),
        numberingCompartment.of([
          numberingConfig.of({
            auto: useIdeStore.getState().autoLineNumbering,
            increment: useIdeStore.getState().lineNumberIncrement,
          }),
          fullCompletion.of(useIdeStore.getState().fullCodeCompletion),
        ]),
        breakpointCompartment.of(
          breakpointGutterExt(useIdeStore.getState().breakpoints),
        ),
        debugLineField,
        highlightActiveLine(),
        drawSelection(),
        history(),
        autocompletion({ activateOnTyping: true }),
        highlightSelectionMatches(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        syntaxHighlighting(basicHighlightStyle),
        dialect.languageSupport(),
        dialectLinter(dialect),
        lintGutter(),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...completionKeymap,
          ...searchKeymap,
          ...lintKeymap,
          indentWithTab,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !isApplyingOverride.current)
            onChangeRef.current(update.state.doc.toString());
          if (update.focusChanged)
            useIdeStore.getState().setEditorFocused(update.view.hasFocus);
          if (update.selectionSet || update.docChanged) {
            const sel = update.state.selection.main;
            useIdeStore
              .getState()
              .setEditorSelection(
                sel.empty ? '' : update.state.sliceDoc(sel.from, sel.to),
              );
          }
          const open = searchPanelOpen(update.state);
          if (open !== searchOpen) {
            searchOpen = open;
            const store = useIdeStore.getState();
            store.setFindReplaceOpen(open);
            if (open) store.setBottomOverlay('none');
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
        }),
        inputModeCompartment.of(
          inputModeExt(useIdeStore.getState().bottomOverlay === 'keyboard'),
        ),
        EditorView.theme({
          '&': { height: '100%', fontSize: '14px' },
          '.cm-scroller': {
            fontFamily: "'IBM Plex Mono', 'Fira Mono', monospace",
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

  // Keep the native-OSK suppression in sync with the on-screen keyboard overlay.
  const keyboardOverlay = useIdeStore((s) => s.bottomOverlay === 'keyboard');
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: inputModeCompartment.reconfigure(inputModeExt(keyboardOverlay)),
    });
  }, [keyboardOverlay]);

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
        }),
        fullCompletion.of(fullCodeCompletion),
      ]),
    });
  }, [autoLineNumbering, lineNumberIncrement, fullCodeCompletion]);

  // Re-render the breakpoint gutter whenever the breakpoint set changes.
  const breakpoints = useIdeStore((s) => s.breakpoints);
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: breakpointCompartment.reconfigure(
        breakpointGutterExt(breakpoints),
      ),
    });
  }, [breakpoints]);

  // Highlight (and scroll to) the line the debugger is paused on. Breakpoints
  // and the paused line are tracked by BASIC line number, so map to an editor
  // row here; clear the highlight when there's no paused line.
  const debugLine = useIdeStore((s) => s.debugLine);
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

  return <div className={styles.cmHost} ref={hostRef} />;
}
