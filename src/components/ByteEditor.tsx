// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The byte editor for one memory block: a data block, or a code block for a CPU
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
  setLength,
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
import type { MemoryBlock } from '../dialects/types';
import { blockBytesBufferKey, bufferHistories } from '../editor/bufferHistory';
import { useRetireEditorPopups } from '../app/useRetireEditorPopups';
import type { EditorKeyAction } from '../keyboard/layoutSchema';
import { HexIcon, TextIcon } from './icons';
import styles from './ByteEditor.module.css';

/** How long a refusal stays on the status strip. */
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

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export function ByteEditor({
  block,
  inputRef,
}: {
  block: MemoryBlock;
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

  // The block as of this render, for the handlers, which are not rebuilt when
  // the prop advances on an upsert echo or a block switch.
  const blockRef = useRef(block);
  blockRef.current = block;
  // The bytes we last committed: when they come back as the prop, that is our
  // own write echoing, not a change from elsewhere.
  const lastWrittenBytes = useRef<Uint8Array | null>(null);
  const prevBytes = useRef(block.bytes);
  const lastBlockId = useRef(block.id);
  const lastHistoryGeneration = useRef(bufferHistories.generation);
  const reseeding = useRef(false);
  const caretRef = useRef<ByteCaret>({ index: 0, nibble: 'high' });
  const fieldRef = useRef<ByteField>('hex');
  const projectionRef = useRef<ByteProjection | null>(null);

  const [refusal, setRefusal] = useState<string | null>(null);
  const [lengthDraft, setLengthDraft] = useState<string | null>(null);
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

  /** Apply one outcome from the pure edit model to the view. */
  const applyOutcome = useCallback(
    (view: EditorView, outcome: ByteEditOutcome, field?: ByteField) => {
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
      address: blockRef.current.address,
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
    (address: number, perRow: number): Extension =>
      lineNumbers({
        formatNumber: (line) => formatWord(address + (line - 1) * perRow),
      }),
    [],
  );

  const buildExtensions = useCallback(
    (): Extension => [
      gutterCompartment.of(
        gutterExtension(blockRef.current.address, bytesPerRowRef.current),
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
        '.cm-content': { caretColor: 'var(--accent, #06c)' },
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

  /** Park this block's state so coming back to it finds its history. */
  const parkState = useCallback((view: EditorView, blockId: string) => {
    const blocks = selectBlocks(useIdeStore.getState());
    if (!blocks.some((b) => b.id === blockId)) return;
    bufferHistories.save(
      blockBytesBufferKey(blockId),
      view.state,
      lastHistoryGeneration.current,
    );
  }, []);

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
          blockRef.current.bytes,
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
    const projection = projectBytes(blockRef.current.bytes, {
      bytesPerRow: bytesPerRowRef.current,
      glyph,
    });
    projectionRef.current = projection;
    const view = new EditorView({
      state: bufferHistories.restore(
        blockBytesBufferKey(blockRef.current.id),
        projection.text,
        buildExtensions(),
      ),
      parent: host,
    });
    viewRef.current = view;
    lastBlockId.current = blockRef.current.id;
    lastHistoryGeneration.current = bufferHistories.generation;
    adoptDocument(view);
    return () => {
      parkState(view, blockRef.current.id);
      view.destroy();
      viewRef.current = null;
      useIdeStore.getState().setEditorFocused(false);
    };
  }, [adoptDocument, buildExtensions, glyph, parkState]);

  // A different block in the same editor: park the outgoing one's state and
  // give the view the incoming one's, resetting the per-block bookkeeping.
  useEffect(() => {
    const view = viewRef.current;
    if (!view || block.id === lastBlockId.current) return;
    const outgoing = lastBlockId.current;
    lastBlockId.current = block.id;
    parkState(view, outgoing);
    lastWrittenBytes.current = null;
    reseeding.current = false;
    prevBytes.current = block.bytes;
    const projection = projectBytes(block.bytes, {
      bytesPerRow: bytesPerRowRef.current,
      glyph,
    });
    projectionRef.current = projection;
    view.setState(
      bufferHistories.restore(
        blockBytesBufferKey(block.id),
        projection.text,
        buildExtensions(),
      ),
    );
    lastHistoryGeneration.current = bufferHistories.generation;
    adoptDocument(view);
  }, [adoptDocument, block, buildExtensions, glyph, parkState]);

  // The block's bytes changed from somewhere else (a file load, a sample, an
  // undo in another surface): drop the projection and rebuild it. Not the
  // user's edit, so not theirs to undo.
  useEffect(() => {
    if (prevBytes.current === block.bytes) return;
    prevBytes.current = block.bytes;
    if (
      lastWrittenBytes.current !== null &&
      (lastWrittenBytes.current === block.bytes ||
        bytesEqual(lastWrittenBytes.current, block.bytes))
    ) {
      return;
    }
    const view = viewRef.current;
    if (!view) return;
    reseeding.current = true;
    project(view, block.bytes, { index: 0, nibble: 'high' }, fieldRef.current, {
      toHistory: false,
    });
    reseeding.current = false;
  }, [block, project]);

  // The row width and the address the gutter counts from are configuration, and
  // a parked state comes back with whatever it was put away with.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: gutterCompartment.reconfigure(
        gutterExtension(block.address, bytesPerRow),
      ),
    });
  }, [block.address, bytesPerRow, gutterCompartment, gutterExtension]);

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

  /** Commit the byte count typed into the status strip. */
  const commitLength = useCallback(() => {
    const view = viewRef.current;
    const draft = lengthDraft;
    setLengthDraft(null);
    if (!view || draft === null) return;
    const value = /^[0-9]+$/.test(draft.trim())
      ? parseInt(draft.trim(), 10)
      : NaN;
    if (!Number.isInteger(value)) {
      flashRefusal('Enter a whole number of bytes.');
      return;
    }
    applyOutcome(view, setLength(targetOf(view), value));
  }, [applyOutcome, flashRefusal, lengthDraft, targetOf]);

  const tabbed = mode !== 'both';
  const length = block.bytes.length;

  return (
    <div className={styles.byteEditor}>
      <div className={styles.statusStrip}>
        <strong>{block.name}</strong> · ORG {formatWord(block.address)} ·{' '}
        <label className={styles.lengthField}>
          <input
            aria-label="Block length in bytes"
            data-testid="byte-length"
            value={lengthDraft ?? String(length)}
            onChange={(e) => setLengthDraft(e.currentTarget.value)}
            onBlur={commitLength}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              else if (e.key === 'Escape') setLengthDraft(null);
            }}
          />
          {length === 1 ? 'byte' : 'bytes'}
        </label>
        <button
          className={styles.action}
          onClick={() => setFillOpen((open) => !open)}
          aria-expanded={fillOpen}
        >
          Fill…
        </button>
        {block.comment !== undefined && (
          <span className={styles.comment}> · {block.comment}</span>
        )}
        {refusal !== null && (
          <span
            className={styles.refusal}
            role="alert"
            data-testid="byte-refusal"
          >
            {refusal}
          </span>
        )}
      </div>
      {fillOpen && (
        <FillRow
          block={block}
          onCancel={() => setFillOpen(false)}
          onFill={(from, to, value) => {
            const view = viewRef.current;
            if (!view) return;
            setFillOpen(false);
            applyOutcome(view, fillRange(targetOf(view), from, to, value));
          }}
        />
      )}
      {tabbed && (
        <div className={styles.viewTabs} role="tablist" aria-label="Byte views">
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
  block: MemoryBlock;
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
