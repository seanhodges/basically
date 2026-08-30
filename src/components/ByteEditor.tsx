// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The byte editor for one block: a memory block, or a code block for a CPU
 * the IDE has no assembler for. A third slim CodeMirror instance, next to
 * `AsmEditor` and the BASIC `CodeMirrorHost`, used as a rendering, caret and
 * scrolling engine over a document that is a *projection of the block's bytes*
 * (`src/app/byteProjection.ts`) rather than as a text editor.
 *
 * A change filter closes the document to everything but this surface's own
 * dispatch, and a keydown handler interprets what was typed as an overwrite:
 * hex digits in the hex view, machine characters in the character view. Both
 * views are two columns of one line, so a change shows in both without any
 * synchronising, and undo reverses both together because they were never
 * separate.
 *
 * The bytes are read back out of the document's hex field rather than kept
 * beside it, which is what lets undo be CodeMirror's own `history()`: parking a
 * buffer serializes the history, and a serialized history keeps its document
 * changes but drops any state effects riding with them.
 *
 * One editor serves every block, as `AsmEditor` does: switching blocks swaps the
 * view's whole state for the incoming block's, so each keeps its own document,
 * selection and undo history for as long as it exists.
 *
 * It also shows a file a running program saved, read-only. Such a file has no
 * address - so the gutter counts offsets from its first byte - is neither kept
 * with the document nor returned to the machine, and therefore has nothing an
 * edit could change and no history to park.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { history, historyKeymap, redo, undo } from '@codemirror/commands';
import {
  Annotation,
  Compartment,
  EditorState,
  RangeSetBuilder,
  StateEffect,
  StateField,
  Transaction,
  type Extension,
} from '@codemirror/state';
import {
  Decoration,
  EditorView,
  drawSelection,
  highlightActiveLine,
  keymap,
  lineNumbers,
  type DecorationSet,
} from '@codemirror/view';
import { selectBlocks, useIdeStore } from '../app/store';
import { formatWord } from '../asm/format';
import { parseAddressInput } from '../app/blockEdit';
import {
  applyCharacter,
  applyHexDigit,
  fillRange,
  isHexDigit,
  listingByteRefusal,
  maxBlockLength,
  parseByteValue,
  truncateLast,
  type ByteCaret,
  type ByteEditOutcome,
  type ByteTarget,
} from '../app/byteEdit';
import {
  byteOffset,
  bytesPerRowFor,
  caretAt,
  constrainField,
  hexCellRanges,
  hiddenRanges,
  parseBytes,
  projectBytes,
  type ByteField,
  type ByteProjection,
  type ByteViewMode,
} from '../app/byteProjection';
import {
  MOBILE_QUERY,
  LANDSCAPE_MOBILE_QUERY,
  useMediaQuery,
} from '../app/useMediaQuery';
import type { Block, DataBlock } from '../dialects/types';
import {
  blockBytesBufferKey,
  bufferHistories,
  freshBufferState,
} from '../editor/bufferHistory';
import { useRetireEditorPopups } from '../app/useRetireEditorPopups';
import type { EditorKeyAction } from '../keyboard/layoutSchema';
import { BlockBar } from './BlockBar';
import { HexIcon, TextIcon } from './icons';
import styles from './ByteEditor.module.css';

/** How long a refusal stays on the bar. */
const REFUSAL_MS = 2500;

/** Columns the address gutter and the editor's own padding take from a row. */
const CHROME_COLUMNS = 9;

/** Width of one monospace column at the editor's 14px font, near enough. */
const COLUMN_PX = 8.5;

/** Our own dispatches carry the caret they mean, nibble included. */
const caretAnnotation = Annotation.define<ByteCaret>();

/**
 * Rebuild the decorations without touching the document. Switching between the
 * two views changes what is hidden but not a byte, and the projection is the
 * same text either way, so there is no document change to hang it off.
 */
const refreshViews = StateEffect.define<void>();

/**
 * What this surface needs of whatever it is showing. A block sits at an address
 * in the machine's memory and is edited; a file a program saved has no address,
 * counts from its own first byte, and is only read.
 */
interface ByteSubject {
  /** Which thing is in the view, so a switch can be told from an echo. */
  id: string;
  /** Where a parked edit history lives, or null where there is none. */
  historyKey: string | null;
  bytes: Uint8Array;
  /** What the gutter counts from: an address, or zero for a file's offsets. */
  base: number;
  /** True where the gutter reads as offsets into a file, not as addresses. */
  offsets: boolean;
  readOnly: boolean;
  entry?: number;
  comment?: string;
}

function byteSubject(block: Block | DataBlock): ByteSubject {
  if ('address' in block) {
    return {
      id: block.id,
      historyKey: blockBytesBufferKey(block.id),
      bytes: block.bytes,
      base: block.address,
      offsets: false,
      readOnly: false,
      ...(block.entry !== undefined ? { entry: block.entry } : {}),
      ...(block.comment !== undefined ? { comment: block.comment } : {}),
    };
  }
  return {
    // Files are keyed by name, as the store that holds them is.
    id: `data:${block.name}`,
    historyKey: null,
    bytes: block.bytes,
    base: 0,
    offsets: true,
    readOnly: true,
  };
}

/** A file's offset gutter: distance from its first byte, not an address. */
function formatOffset(offset: number): string {
  return `+${offset.toString(16).toUpperCase().padStart(4, '0')}`;
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export function ByteEditor({
  block,
  inputRef,
}: {
  /** A document block, edited; or a file a program saved, shown read-only. */
  block: Block | DataBlock;
  /**
   * The on-screen keyboard's handle into whichever editor is on screen. This
   * surface claims it while it is mounted: the BASIC editor stays mounted but
   * hidden behind a block tab, so its applier would otherwise take the keys.
   */
  inputRef?: React.MutableRefObject<((action: EditorKeyAction) => void) | null>;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const dialect = useIdeStore((s) => s.dialect);
  const byteViewTab = useIdeStore((s) => s.byteViewTab);
  const setByteViewTab = useIdeStore((s) => s.setByteViewTab);
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const landscape = useMediaQuery(LANDSCAPE_MOBILE_QUERY);

  // The thing on screen as of this render, for the handlers, which are not
  // rebuilt when the prop advances on an upsert echo or a tab switch.
  const subject = byteSubject(block);
  const subjectRef = useRef(subject);
  subjectRef.current = subject;
  // The document block being edited, or null while a file is on screen: a file
  // is not part of the document and has nowhere for a write to go.
  const blockRef = useRef<Block | null>(null);
  blockRef.current = 'address' in block ? block : null;
  // The subject the view is currently holding, so a switch parks the outgoing
  // one's history rather than the incoming one's.
  const heldRef = useRef(subject);
  // The bytes we last committed: when they come back as the prop, that is our
  // own write echoing, not a change from elsewhere.
  const lastWrittenBytes = useRef<Uint8Array | null>(null);
  const prevBytes = useRef(subject.bytes);
  const lastHistoryGeneration = useRef(bufferHistories.generation);
  const reseeding = useRef(false);
  const caretRef = useRef<ByteCaret>({ index: 0, nibble: 'high' });
  const fieldRef = useRef<ByteField>('hex');
  const projectionRef = useRef<ByteProjection | null>(null);

  const [refusal, setRefusal] = useState<string | null>(null);
  const [fillOpen, setFillOpen] = useState(false);

  /** How many bytes a row holds, stepped from the width the surface has. */
  const [bytesPerRow, setBytesPerRow] = useState(16);
  // Both views where there is room; where there is not they become tabs, at the
  // same breakpoint the workspace uses to decide its own tabbed layout.
  const mode: ByteViewMode = isMobile || landscape ? byteViewTab : 'both';
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const bytesPerRowRef = useRef(bytesPerRow);
  bytesPerRowRef.current = bytesPerRow;

  const glyph = useMemo(
    () => (code: number) => dialect.charset.glyph(code),
    [dialect],
  );

  const refusalTimer = useRef<number | null>(null);
  const flashRefusal = useCallback((message: string) => {
    setRefusal(message);
    if (refusalTimer.current !== null) {
      window.clearTimeout(refusalTimer.current);
    }
    refusalTimer.current = window.setTimeout(() => {
      refusalTimer.current = null;
      setRefusal(null);
    }, REFUSAL_MS);
  }, []);
  useEffect(
    () => () => {
      if (refusalTimer.current !== null) {
        window.clearTimeout(refusalTimer.current);
      }
    },
    [],
  );

  /** The block's bytes as the document currently holds them. */
  const docBytes = useCallback(
    (view: EditorView) =>
      parseBytes(view.state.doc.toString(), bytesPerRowRef.current),
    [],
  );

  /**
   * Re-project `bytes` into the document and put the caret on `caret`. Used for
   * every write: the document is derived from the bytes, so it is rebuilt
   * rather than patched, and CodeMirror reduces an unchanged stretch to nothing.
   */
  const project = useCallback(
    (
      view: EditorView,
      bytes: Uint8Array,
      caret: ByteCaret,
      field: ByteField,
      { toHistory = true }: { toHistory?: boolean } = {},
    ) => {
      const projection = projectBytes(bytes, {
        bytesPerRow: bytesPerRowRef.current,
        glyph,
      });
      projectionRef.current = projection;
      caretRef.current = caret;
      fieldRef.current = field;
      const offset = byteOffset(
        projection,
        caret.index,
        constrainField(field, modeRef.current),
      );
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: projection.text,
        },
        selection: { anchor: offset },
        scrollIntoView: true,
        annotations: [
          caretAnnotation.of(caret),
          ...(toHistory ? [] : [Transaction.addToHistory.of(false)]),
        ],
      });
    },
    [glyph],
  );

  /** The layout of the listing record backing a block, on the machines that use one. */
  const listingLayout = dialect.memoryBlocks?.inListing
    ? dialect.memoryBlocks.listing
    : undefined;
  const listingLayoutRef = useRef(listingLayout);
  listingLayoutRef.current = listingLayout;

  /**
   * Apply one outcome from the pure edit model to the view. Every write goes
   * through here, which is where a file a program saved is dropped: it is
   * neither kept with the document nor returned to the machine, so an edit to
   * one would change nothing that outlives the tab. Nothing is said about it -
   * the bar marks the file read-only for as long as it is open, which is a
   * state rather than an answer to a keystroke.
   */
  const applyOutcome = useCallback(
    (view: EditorView, outcome: ByteEditOutcome, field?: ByteField) => {
      if (subjectRef.current.readOnly) return;
      if (!outcome.ok) {
        flashRefusal(outcome.message);
        return;
      }
      const refused = listingByteRefusal(
        outcome.edit.bytes,
        listingLayoutRef.current,
      );
      if (refused !== null) {
        flashRefusal(refused);
        return;
      }
      project(
        view,
        outcome.edit.bytes,
        outcome.edit.caret,
        field ?? fieldRef.current,
      );
    },
    [flashRefusal, project],
  );

  /** The block as the pure edit model wants it. */
  const targetOf = useCallback(
    (view: EditorView): ByteTarget => ({
      bytes: docBytes(view),
      address: subjectRef.current.base,
    }),
    [docBytes],
  );

  /**
   * Follow a selection this surface did not place - a click, or an undo, which
   * dispatches with `filter: false` and so never reaches the snapping filter.
   * A caret that moved is a caret on a fresh byte, so hex entry starts again at
   * the high nibble.
   */
  const syncCaret = useCallback(
    (state: EditorState, transactions: readonly Transaction[]) => {
      if (transactions.some((tr) => tr.annotation(caretAnnotation))) return;
      const projection = projectionRef.current;
      if (!projection) return;
      const { index, field } = caretAt(projection, state.selection.main.head);
      caretRef.current = { index, nibble: 'high' };
      fieldRef.current = constrainField(field, modeRef.current);
    },
    [],
  );

  /** Put the caret on `index` in `field` without changing a byte. */
  const moveCaret = useCallback(
    (view: EditorView, index: number, field: ByteField) => {
      const projection = projectionRef.current;
      if (!projection) return;
      const caret: ByteCaret = {
        index: Math.max(0, Math.min(projection.length, index)),
        nibble: 'high',
      };
      caretRef.current = caret;
      fieldRef.current = field;
      view.dispatch({
        selection: {
          anchor: byteOffset(
            projection,
            caret.index,
            constrainField(field, modeRef.current),
          ),
        },
        scrollIntoView: true,
        annotations: caretAnnotation.of(caret),
      });
    },
    [],
  );

  /**
   * One keystroke, from the physical keyboard or the on-screen one. The hex view
   * takes hex digits and ignores anything else; the character view takes a
   * character and encodes it through the machine's own character set.
   */
  const typeCharacter = useCallback(
    (view: EditorView, text: string) => {
      const field = constrainField(fieldRef.current, modeRef.current);
      if (field === 'hex') {
        if (!isHexDigit(text)) return;
        applyOutcome(
          view,
          applyHexDigit(targetOf(view), caretRef.current, text),
          'hex',
        );
        return;
      }
      applyOutcome(
        view,
        applyCharacter(
          targetOf(view),
          caretRef.current.index,
          text,
          dialect.charset,
        ),
        'chars',
      );
    },
    [applyOutcome, dialect, targetOf],
  );

  /** One editing key, shared by the physical and the on-screen keyboards. */
  const runEditorAction = useCallback(
    (view: EditorView, action: EditorKeyAction) => {
      const projection = projectionRef.current;
      if (!projection) return;
      const { index } = caretRef.current;
      const field = constrainField(fieldRef.current, modeRef.current);
      const perRow = projection.bytesPerRow;
      if ('insert' in action) {
        for (const ch of action.insert) typeCharacter(view, ch);
        return;
      }
      switch (action.action) {
        case 'backspace':
          // Backspace past the end shortens the block; anywhere else it only
          // steps back, since nothing is removed from a block's interior.
          if (index === projection.length && projection.length > 0) {
            applyOutcome(view, truncateLast(targetOf(view)));
          } else {
            moveCaret(view, index - 1, field);
          }
          break;
        case 'delete':
          // Delete on the last byte shortens the block. There is nothing for it
          // to do in the middle: bytes are overwritten there, never removed.
          if (index === projection.length - 1) {
            applyOutcome(view, truncateLast(targetOf(view)));
          }
          break;
        case 'left':
          moveCaret(view, index - 1, field);
          break;
        case 'right':
          moveCaret(view, index + 1, field);
          break;
        case 'up':
          moveCaret(view, index - perRow, field);
          break;
        case 'down':
          moveCaret(view, index + perRow, field);
          break;
        case 'newline':
          moveCaret(view, index + perRow, field);
          break;
      }
    },
    [applyOutcome, moveCaret, targetOf, typeCharacter],
  );

  /**
   * Every key the surface acts on. Nothing reaches the document any other way,
   * and a key with no meaning here is swallowed rather than left to CodeMirror.
   * A key held with Ctrl, Cmd or Alt falls through, so undo and redo keep their
   * shortcuts.
   */
  const onKeyDown = useCallback(
    (event: KeyboardEvent, view: EditorView): boolean => {
      if (event.ctrlKey || event.metaKey || event.altKey) return false;
      const projection = projectionRef.current;
      if (!projection) return false;
      const { index } = caretRef.current;
      const perRow = projection.bytesPerRow;
      const field = constrainField(fieldRef.current, modeRef.current);
      const rowStart = Math.floor(index / perRow) * perRow;
      switch (event.key) {
        case 'ArrowLeft':
          runEditorAction(view, { action: 'left' });
          return true;
        case 'ArrowRight':
          runEditorAction(view, { action: 'right' });
          return true;
        case 'ArrowUp':
          runEditorAction(view, { action: 'up' });
          return true;
        case 'ArrowDown':
          runEditorAction(view, { action: 'down' });
          return true;
        case 'Home':
          moveCaret(view, rowStart, field);
          return true;
        case 'End':
          moveCaret(
            view,
            Math.min(projection.length, rowStart + perRow - 1),
            field,
          );
          return true;
        case 'Tab':
          // The two views are one document, so Tab crosses between them rather
          // than indenting anything.
          if (modeRef.current === 'both') {
            moveCaret(view, index, field === 'hex' ? 'chars' : 'hex');
            return true;
          }
          return false;
        case 'Backspace':
          runEditorAction(view, { action: 'backspace' });
          return true;
        case 'Delete':
          runEditorAction(view, { action: 'delete' });
          return true;
        default:
          if (event.key.length !== 1) return false;
          typeCharacter(view, event.key);
          return true;
      }
    },
    [moveCaret, runEditorAction, typeCharacter],
  );

  /**
   * Push the bytes into the document's block. A block carried inside the BASIC
   * listing is written back through its `#BIN` line, exactly as the assembly
   * editor chooses between the two.
   */
  const commitBytes = useCallback((bytes: Uint8Array) => {
    const current = blockRef.current;
    if (current === null) return; // a file has nowhere to write back to
    if (bytesEqual(bytes, current.bytes)) return;
    const store = useIdeStore.getState();
    lastWrittenBytes.current = bytes;
    if (store.dialect.memoryBlocks?.inListing) {
      store.commitListingBlockBytes(current.id, bytes);
    } else {
      store.upsertBlock({ ...current, bytes });
    }
  }, []);

  /** Decorations and atomic ranges for the projection the document now holds. */
  const decorationField = useMemo(() => {
    const build = (state: EditorState): DecorationSet => {
      const projection = projectionRef.current;
      const builder = new RangeSetBuilder<Decoration>();
      if (!projection || projection.text !== state.doc.toString()) {
        return builder.finish();
      }
      // The hex pairs are marked so the caret treats each as one unit, and the
      // field that is not on screen is replaced by nothing - which makes it
      // atomic too, so the caret cannot wander into it. The two sets never
      // overlap: a hidden hex field has no pairs to mark.
      const mode = modeRef.current;
      const ranges = [
        ...hiddenRanges(projection, mode).map((r) => ({ ...r, hide: true })),
        ...(mode === 'chars'
          ? []
          : hexCellRanges(projection).map((r) => ({ ...r, hide: false }))),
      ].sort((a, b) => a.from - b.from);
      for (const range of ranges) {
        builder.add(
          range.from,
          range.to,
          range.hide
            ? Decoration.replace({})
            : Decoration.mark({ class: 'cm-byteCell' }),
        );
      }
      return builder.finish();
    };
    return StateField.define<DecorationSet>({
      create: build,
      update: (value, tr) =>
        tr.docChanged || tr.effects.some((e) => e.is(refreshViews))
          ? build(tr.state)
          : value,
      provide: (f) => [
        EditorView.decorations.from(f),
        EditorView.atomicRanges.of((view) => view.state.field(f)),
      ],
    });
  }, []);

  /** The address gutter: machine addresses, as every other address reads. */
  const gutterCompartment = useRef(new Compartment()).current;

  const gutterExtension = useCallback(
    (base: number, perRow: number, offsets: boolean): Extension =>
      lineNumbers({
        formatNumber: (line) => {
          const at = base + (line - 1) * perRow;
          return offsets ? formatOffset(at) : formatWord(at);
        },
      }),
    [],
  );

  const buildExtensions = useCallback(
    (): Extension => [
      gutterCompartment.of(
        gutterExtension(
          subjectRef.current.base,
          bytesPerRowRef.current,
          subjectRef.current.offsets,
        ),
      ),
      decorationField,
      highlightActiveLine(),
      drawSelection(),
      // Every write replaces the whole document, so CodeMirror's adjacency test
      // is always true and consecutive edits would be joined into one undo
      // step. Each byte edit is its own step instead.
      history({ joinToEvent: () => false }),
      // The surface's own dispatch is the only writer: every other change - a
      // typed character, a paste, a drop - is refused here. Deliberately not
      // `EditorState.readOnly`, which would also refuse undo and redo; those
      // dispatch with `filter: false` and so pass straight through this.
      EditorState.changeFilter.of(
        (tr) => tr.annotation(caretAnnotation) !== undefined,
      ),
      // A surface that takes no ordinary text input does not raise a phone's own
      // keyboard; the app's on-screen one is the input surface here.
      EditorView.contentAttributes.of({ inputmode: 'none' }),
      keymap.of(historyKeymap),
      EditorView.domEventHandlers({
        keydown: (event, view) => {
          if (onKeyDown(event, view)) {
            event.preventDefault();
            return true;
          }
          return false;
        },
      }),
      // A click lands wherever it lands; the caret belongs on a byte.
      EditorState.transactionFilter.of((tr) => {
        if (!tr.selection || tr.docChanged) return tr;
        if (tr.annotation(caretAnnotation) !== undefined) return tr;
        const projection = projectionRef.current;
        if (!projection) return tr;
        const { index, field } = caretAt(projection, tr.newSelection.main.head);
        const settled = constrainField(field, modeRef.current);
        caretRef.current = { index, nibble: 'high' };
        fieldRef.current = settled;
        return {
          ...tr,
          selection: { anchor: byteOffset(projection, index, settled) },
        };
      }),
      EditorView.updateListener.of((update) => {
        if (update.focusChanged) {
          useIdeStore.getState().setEditorFocused(update.view.hasFocus);
        }
        if (!update.docChanged || reseeding.current) {
          if (update.selectionSet) syncCaret(update.state, update.transactions);
          return;
        }
        // Undo and redo change the document without going through the write
        // path above, so the commit is driven from the document, not from the
        // edit that produced it.
        const bytes = parseBytes(
          update.state.doc.toString(),
          bytesPerRowRef.current,
        );
        projectionRef.current = projectBytes(bytes, {
          bytesPerRow: bytesPerRowRef.current,
          glyph,
        });
        syncCaret(update.state, update.transactions);
        commitBytes(bytes);
      }),
      EditorView.theme({
        '&': { height: '100%', fontSize: '14px' },
        '.cm-scroller': {
          fontFamily: 'var(--mono)',
          // See CodeMirrorHost: pinned so a graphics character cannot change
          // the height of the row it lands in.
          lineHeight: '1.3',
        },
        // Hex and character bytes carry no syntax highlighting to give them a
        // colour, so without this they inherit the app's --text (light, for
        // the dark theme) onto this surface's paper-white background - see the
        // same fix for .cm-tooltip in styles.css.
        '.cm-content': { caretColor: 'var(--accent, #06c)', color: '#000' },
        '.cm-gutters': { color: '#000' },
      }),
    ],
    [
      commitBytes,
      decorationField,
      glyph,
      gutterCompartment,
      gutterExtension,
      onKeyDown,
      syncCaret,
    ],
  );

  /**
   * Park this block's state so coming back to it finds its history. A file a
   * program saved has none to park: it is read-only, so there is nothing to
   * undo.
   */
  const parkState = useCallback((view: EditorView, of: ByteSubject) => {
    if (of.historyKey === null) return;
    const blocks = selectBlocks(useIdeStore.getState());
    if (!blocks.some((b) => b.id === of.id)) return;
    bufferHistories.save(
      of.historyKey,
      view.state,
      lastHistoryGeneration.current,
    );
  }, []);

  /** The state to give the view for `of`: its parked history, or a fresh one. */
  const restoreState = useCallback(
    (of: ByteSubject, text: string, extensions: Extension): EditorState =>
      of.historyKey === null
        ? freshBufferState(text, extensions)
        : bufferHistories.restore(of.historyKey, text, extensions),
    [],
  );

  /**
   * Take up whatever document the view was just given. A restored buffer brings
   * its own, together with the caret it was parked with; one projected at a row
   * width that no longer applies (the window was resized while the block was
   * parked) is rebuilt from the block instead, and starts at its first byte.
   */
  const adoptDocument = useCallback(
    (view: EditorView) => {
      const text = view.state.doc.toString();
      const projection = projectBytes(
        parseBytes(text, bytesPerRowRef.current),
        { bytesPerRow: bytesPerRowRef.current, glyph },
      );
      projectionRef.current = projection;
      if (projection.text !== text) {
        reseeding.current = true;
        project(
          view,
          subjectRef.current.bytes,
          { index: 0, nibble: 'high' },
          'hex',
          {
            toHistory: false,
          },
        );
        reseeding.current = false;
        return;
      }
      const { index, field } = caretAt(
        projection,
        view.state.selection.main.head,
      );
      caretRef.current = { index, nibble: 'high' };
      fieldRef.current = constrainField(field, modeRef.current);
    },
    [glyph, project],
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const projection = projectBytes(subjectRef.current.bytes, {
      bytesPerRow: bytesPerRowRef.current,
      glyph,
    });
    projectionRef.current = projection;
    const view = new EditorView({
      state: restoreState(
        subjectRef.current,
        projection.text,
        buildExtensions(),
      ),
      parent: host,
    });
    viewRef.current = view;
    heldRef.current = subjectRef.current;
    lastHistoryGeneration.current = bufferHistories.generation;
    adoptDocument(view);
    return () => {
      parkState(view, subjectRef.current);
      view.destroy();
      viewRef.current = null;
      useIdeStore.getState().setEditorFocused(false);
    };
  }, [adoptDocument, buildExtensions, glyph, parkState, restoreState]);

  // A different block in the same editor: park the outgoing one's state and
  // give the view the incoming one's, resetting the per-block bookkeeping.
  useEffect(() => {
    const view = viewRef.current;
    if (!view || subject.id === heldRef.current.id) return;
    const outgoing = heldRef.current;
    heldRef.current = subject;
    parkState(view, outgoing);
    lastWrittenBytes.current = null;
    reseeding.current = false;
    prevBytes.current = subject.bytes;
    const projection = projectBytes(subject.bytes, {
      bytesPerRow: bytesPerRowRef.current,
      glyph,
    });
    projectionRef.current = projection;
    view.setState(restoreState(subject, projection.text, buildExtensions()));
    lastHistoryGeneration.current = bufferHistories.generation;
    adoptDocument(view);
  }, [adoptDocument, subject, buildExtensions, glyph, parkState, restoreState]);

  // The bytes changed from somewhere else (a file load, a size set in the
  // block's settings, a sample, an undo in another surface - or, for a file,
  // the program writing it again): drop the projection and rebuild it. Not the
  // user's edit, so not theirs to undo.
  useEffect(() => {
    if (prevBytes.current === subject.bytes) return;
    prevBytes.current = subject.bytes;
    if (
      lastWrittenBytes.current !== null &&
      (lastWrittenBytes.current === subject.bytes ||
        bytesEqual(lastWrittenBytes.current, subject.bytes))
    ) {
      return;
    }
    const view = viewRef.current;
    if (!view) return;
    const projection = projectBytes(subject.bytes, {
      bytesPerRow: bytesPerRowRef.current,
      glyph,
    });
    if (projection.text !== view.state.doc.toString()) {
      // A reseed that rewrites the document leaves this buffer's history
      // describing text that is no longer there, and an undo would then splice
      // a stretch of the old projection into the current one. The change came
      // from outside this editor, so there is nothing here to take back: the
      // history goes with the document it described. A whole new state is what
      // discards it - a `history()` field keeps its value when the extension is
      // merely reconfigured away.
      projectionRef.current = projection;
      view.setState(freshBufferState(projection.text, buildExtensions()));
      adoptDocument(view);
      return;
    }
    // The same bytes laid out the same way - a block that only moved reads its
    // new addresses off the gutter - so the document, and the history that
    // describes it, stand.
    reseeding.current = true;
    project(
      view,
      subject.bytes,
      { index: 0, nibble: 'high' },
      fieldRef.current,
      { toHistory: false },
    );
    reseeding.current = false;
  }, [subject.bytes, adoptDocument, buildExtensions, glyph, project]);

  // The row width and what the gutter counts from are configuration, and a
  // parked state comes back with whatever it was put away with.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: gutterCompartment.reconfigure(
        gutterExtension(subject.base, bytesPerRow, subject.offsets),
      ),
    });
  }, [
    subject.base,
    subject.offsets,
    bytesPerRow,
    gutterCompartment,
    gutterExtension,
  ]);

  // A row width or view change re-projects: same bytes, different layout, and
  // the caret stays on the byte it was on.
  const lastLayout = useRef(`${bytesPerRow}:${mode}`);
  useEffect(() => {
    const view = viewRef.current;
    const layout = `${bytesPerRow}:${mode}`;
    if (!view || layout === lastLayout.current) return;
    lastLayout.current = layout;
    reseeding.current = true;
    const bytes = parseBytes(
      view.state.doc.toString(),
      projectionRef.current?.bytesPerRow ?? bytesPerRow,
    );
    project(view, bytes, caretRef.current, fieldRef.current, {
      toHistory: false,
    });
    reseeding.current = false;
    view.dispatch({ effects: refreshViews.of() });
  }, [bytesPerRow, mode, project]);

  // Step the row width with the room the surface actually has.
  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const columns = host.clientWidth / COLUMN_PX - CHROME_COLUMNS;
      setBytesPerRow(bytesPerRowFor(columns, modeRef.current));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, [mode]);

  // The on-screen keyboard types into this surface while it is showing.
  useEffect(() => {
    if (!inputRef) return;
    const previous = inputRef.current;
    inputRef.current = (action) => {
      const view = viewRef.current;
      if (view) runEditorAction(view, action);
    };
    return () => {
      inputRef.current = previous;
    };
  }, [inputRef, runEditorAction]);

  // Raising a dialog, panel or drawer over the editor takes away the
  // picked-token menu; the on-screen input overlays don't.
  useRetireEditorPopups(viewRef);

  // The Edit menu's undo/redo act on the buffer on screen, which is this one.
  const editorCommand = useIdeStore((s) => s.editorCommand);
  const lastCommand = useRef(editorCommand.seq);
  useEffect(() => {
    if (editorCommand.seq === lastCommand.current) return;
    lastCommand.current = editorCommand.seq;
    const view = viewRef.current;
    if (!view) return;
    if (editorCommand.name === 'undo') undo(view);
    else if (editorCommand.name === 'redo') redo(view);
  }, [editorCommand]);

  const tabbed = mode !== 'both';
  const length = subject.bytes.length;
  const editableBlock = 'address' in block ? block : null;

  return (
    <div className={styles.byteEditor}>
      <BlockBar
        address={editableBlock === null ? undefined : subject.base}
        byteCount={length}
        entry={subject.entry}
        comment={subject.comment}
        readOnly={subject.readOnly}
        refusal={refusal}
      >
        {editableBlock !== null && (
          <button
            className={styles.action}
            onClick={() => setFillOpen((open) => !open)}
            aria-expanded={fillOpen}
          >
            Fill…
          </button>
        )}
        {tabbed && (
          <div
            className={styles.viewTabs}
            role="tablist"
            aria-label="Byte views"
          >
            <button
              role="tab"
              aria-selected={byteViewTab === 'hex'}
              className={byteViewTab === 'hex' ? 'active' : ''}
              onClick={() => setByteViewTab('hex')}
            >
              <HexIcon />
              Hex
            </button>
            <button
              role="tab"
              aria-selected={byteViewTab === 'chars'}
              className={byteViewTab === 'chars' ? 'active' : ''}
              onClick={() => setByteViewTab('chars')}
            >
              <TextIcon />
              Text
            </button>
          </div>
        )}
      </BlockBar>
      {fillOpen && editableBlock !== null && (
        <FillRow
          block={editableBlock}
          onCancel={() => setFillOpen(false)}
          onFill={(from, to, value) => {
            const view = viewRef.current;
            if (!view) return;
            setFillOpen(false);
            applyOutcome(view, fillRange(targetOf(view), from, to, value));
          }}
        />
      )}
      <div
        className={styles.editorHost}
        data-testid="byte-editor"
        data-mode={mode}
        ref={hostRef}
      />
    </div>
  );
}

/** The fill form: an address range and a byte value, all typed. */
function FillRow({
  block,
  onFill,
  onCancel,
}: {
  block: Block;
  onFill: (from: number, to: number, value: number) => void;
  onCancel: () => void;
}) {
  const end = block.address + Math.max(0, block.bytes.length - 1);
  const [from, setFrom] = useState(formatWord(block.address));
  const [to, setTo] = useState(formatWord(end));
  const [value, setValue] = useState('$00');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const start = parseAddressInput(from);
    const finish = parseAddressInput(to);
    const byte = parseByteValue(value);
    if (start === null || finish === null) {
      setError('Enter addresses like $9000 or 36864.');
      return;
    }
    if (byte === null) {
      setError('Enter a byte value between $00 and $FF.');
      return;
    }
    onFill(start, finish, byte);
  };

  return (
    <div className={styles.fillRow}>
      <label>
        From
        <input
          aria-label="Fill from address"
          value={from}
          onChange={(e) => setFrom(e.currentTarget.value)}
        />
      </label>
      <label>
        To
        <input
          aria-label="Fill to address"
          value={to}
          onChange={(e) => setTo(e.currentTarget.value)}
        />
      </label>
      <label>
        With
        <input
          aria-label="Fill byte value"
          value={value}
          onChange={(e) => setValue(e.currentTarget.value)}
        />
      </label>
      <button onClick={submit}>Fill</button>
      <button onClick={onCancel}>Cancel</button>
      {error !== null && <span className={styles.refusal}>{error}</span>}
      <span className={styles.hint}>
        Fills within this block only (up to {formatWord(end)}; a block can hold{' '}
        {maxBlockLength(block.address)} bytes at this address).
      </span>
    </div>
  );
}
