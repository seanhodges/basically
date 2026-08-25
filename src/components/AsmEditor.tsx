// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The assembly editor for one `kind: 'code'` memory block: a second, slim
 * CodeMirror instance (deliberately not `CodeMirrorHost`, which is all
 * BASIC-specific concerns). The block's bytes are disassembled into editable
 * source; edits re-assemble on a debounce and, when clean, replace the
 * block's bytes through `upsertBlock`. Errors surface as inline diagnostics
 * and leave the bytes untouched - the text still persists via
 * `MemoryBlock.asmSource` so broken work-in-progress survives tab switches
 * and reloads.
 *
 * One editor serves every block: switching blocks swaps the view's whole state
 * for the incoming block's, so each block keeps its own document, selection and
 * undo history for as long as it exists. Per-block bookkeeping - the pending
 * assemble, the last bytes written, the reseed guard - is reset by the swap,
 * which is what remounting used to do.
 */

import { useCallback, useEffect, useRef } from 'react';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import {
  defaultHighlightStyle,
  syntaxHighlighting,
} from '@codemirror/language';
import type { Diagnostic } from '@codemirror/lint';
import { lintKeymap, setDiagnostics } from '@codemirror/lint';
import {
  closeSearchPanel,
  highlightSelectionMatches,
  search,
  searchKeymap,
  searchPanelOpen,
} from '@codemirror/search';
import { EditorState, Transaction, type Extension } from '@codemirror/state';
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import { selectBlocks, useIdeStore } from '../app/store';
import { asmLanguage } from '../asm/language';
import { formatWord } from '../asm/format';
import type { AsmEngine, AsmError } from '../asm/types';
import type { MemoryBlock } from '../dialects/types';
import { basicHighlightStyle } from '../editor/basicLanguage';
import { blockBufferKey, bufferHistories } from '../editor/bufferHistory';
import { runViewEditorCommand } from '../editor/editorCommands';
import { clickMenu } from '../editor/clickMenu';
import { ASM_REFERENCE_KINDS, referenceRow } from '../editor/referenceRow';
import { asmReferenceTopic } from '../app/docsTopic';
import { useRetireEditorPopups } from '../app/useRetireEditorPopups';
import styles from './AsmEditor.module.css';

/** No operator has a row on an assembly page, so no operator run is cut back. */
const NO_OPERATORS: ReadonlySet<string> = new Set();

/** How long after the last keystroke the source re-assembles. */
const ASSEMBLE_DEBOUNCE_MS = 500;

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * The source a block's editor starts from: the source saved alongside its bytes
 * (so labels, comments and data sections survive), else a fresh disassembly.
 */
function blockSource(block: MemoryBlock, engine: AsmEngine): string {
  return (
    block.asmSource ??
    engine
      .disassembleReachable(block.bytes, block.address)
      .map((l) => l.text)
      .join('\n')
  );
}

/** Map assembler errors onto the document, clamped like `dialectLinter`. */
function toDiagnostics(state: EditorState, errors: AsmError[]): Diagnostic[] {
  const doc = state.doc;
  const diagnostics: Diagnostic[] = [];
  for (const err of errors) {
    if (err.line < 1 || err.line > doc.lines) continue;
    const line = doc.line(err.line);
    const from = Math.min(line.from + (err.column ?? 0), line.to);
    const to =
      err.endColumn != null
        ? Math.min(line.from + err.endColumn, line.to)
        : line.to;
    diagnostics.push({
      from,
      to: Math.max(from, to),
      severity: 'error',
      message: err.message,
    });
  }
  return diagnostics;
}

export function AsmEditor({
  block,
  engine,
}: {
  block: MemoryBlock;
  engine: AsmEngine;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  // Latest block for the debounced callback (the prop advances on each upsert
  // echo, and on every block switch).
  const blockRef = useRef(block);
  blockRef.current = block;
  // The bytes array we last wrote through upsertBlock: when it comes back as
  // the prop, that's our own write echoing, not an external change.
  const lastWrittenBytes = useRef<Uint8Array | null>(null);
  const prevBytes = useRef(block.bytes);
  const debounceRef = useRef<number | null>(null);
  const reseeding = useRef(false);
  // The block whose state the view is holding, so a change of prop can be told
  // from the upsert echoes that arrive on the same one.
  const lastBlockId = useRef(block.id);
  // The history-cache generation the view's state was installed under, so a
  // state parked on the way out cannot outlive the document it belongs to.
  const lastHistoryGeneration = useRef(bufferHistories.generation);
  const searchOpen = useRef(false);
  const editorCommand = useIdeStore((s) => s.editorCommand);
  const lastCommand = useRef(editorCommand.seq);

  // On clean assembly the block's bytes update (and the text is kept as
  // asmSource); on errors only the text and diagnostics update. Never called
  // just for opening the tab, so viewing a block can't dirty the document -
  // see seedDiagnostics below.
  const runAssemble = useCallback(
    (view: EditorView) => {
      const text = view.state.doc.toString();
      const current = blockRef.current;
      const result = engine.assemble(text, current.address);
      const store = useIdeStore.getState();
      // Listing-backed blocks (ZX80/ZX81) hold their bytes inside the BASIC
      // `#BIN` line, not in `blocks`, so a clean assembly rewrites that source
      // line rather than upserting a block; there is no per-block `asmSource`
      // slot in source, so the editor text is the working copy for the session.
      const inListing = !!store.dialect.memoryBlocks?.inListing;
      if (result.ok) {
        view.dispatch(setDiagnostics(view.state, []));
        const changed = !bytesEqual(result.bytes, current.bytes);
        if (inListing) {
          // Rewrite the `#BIN` bytes and stash the source text (DB data,
          // labels, comments) so a reload restores it instead of
          // re-disassembling. Mark our own write so the reseed effect below
          // doesn't clobber the editor when the derived block echoes back.
          lastWrittenBytes.current = result.bytes;
          store.commitListingBlockBytes(current.id, result.bytes, text);
        } else {
          if (changed) lastWrittenBytes.current = result.bytes;
          if (changed || current.asmSource !== text) {
            store.upsertBlock({
              ...current,
              bytes: changed ? result.bytes : current.bytes,
              asmSource: text,
            });
          }
        }
        store.setBlockAsmError(current.id, false);
      } else {
        view.dispatch(
          setDiagnostics(view.state, toDiagnostics(view.state, result.errors)),
        );
        if (!inListing && current.asmSource !== text) {
          store.upsertBlock({ ...current, asmSource: text });
        }
        store.setBlockAsmError(current.id, true);
      }
    },
    [engine],
  );

  // Diagnostics for a block as it is opened: no upsert, so a pristine look at
  // a block leaves the document clean.
  const seedDiagnostics = useCallback(
    (view: EditorView) => {
      const current = blockRef.current;
      const result = engine.assemble(
        view.state.doc.toString(),
        current.address,
      );
      if (!result.ok) {
        view.dispatch(
          setDiagnostics(view.state, toDiagnostics(view.state, result.errors)),
        );
      }
      useIdeStore.getState().setBlockAsmError(current.id, !result.ok);
    },
    [engine],
  );

  /**
   * Park the view's state under `blockId`, so coming back to that block finds
   * its document, selection and history. A block that has just been deleted has
   * nothing to come back to, and its id is free for another block to take.
   */
  const parkState = useCallback((view: EditorView, blockId: string) => {
    const blocks = selectBlocks(useIdeStore.getState());
    if (!blocks.some((b) => b.id === blockId)) return;
    bufferHistories.save(
      blockBufferKey(blockId),
      view.state,
      lastHistoryGeneration.current,
    );
  }, []);

  /** Assemble now what the debounce is still holding, if anything. */
  const flushPending = useCallback(
    (view: EditorView) => {
      if (debounceRef.current === null) return;
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
      runAssemble(view);
    },
    [runAssemble],
  );

  /**
   * The view's extensions. Built for the first mount and again for every block
   * the view is given afterwards, so a restored block is configured for the
   * machine and settings of the moment it comes back.
   */
  const buildExtensions = useCallback(
    (): Extension => [
      lineNumbers(),
      highlightActiveLine(),
      drawSelection(),
      history(),
      search(),
      highlightSelectionMatches(),
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        ...searchKeymap,
        ...lintKeymap,
      ]),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      syntaxHighlighting(basicHighlightStyle),
      asmLanguage(engine),
      // Click an instruction or directive to be offered this processor's
      // reference. The menu's completion guard reads that extension optionally,
      // so it degrades to "not active" here, where it isn't mounted - don't add
      // it to make the menu work.
      clickMenu([
        referenceRow({
          kinds: ASM_REFERENCE_KINDS,
          operators: NO_OPERATORS,
          topic: (word) => asmReferenceTopic(engine.cpu, word),
          open: (topic) => useIdeStore.getState().openDocs(topic),
        }),
      ]),
      EditorView.updateListener.of((update) => {
        const open = searchPanelOpen(update.state);
        if (open !== searchOpen.current) {
          searchOpen.current = open;
          useIdeStore.getState().setFindReplaceOpen(open);
        }
        if (!update.docChanged || reseeding.current) return;
        if (debounceRef.current !== null) {
          window.clearTimeout(debounceRef.current);
        }
        debounceRef.current = window.setTimeout(() => {
          debounceRef.current = null;
          if (viewRef.current) runAssemble(viewRef.current);
        }, ASSEMBLE_DEBOUNCE_MS);
      }),
      EditorView.theme({
        '&': { height: '100%', fontSize: '14px' },
        '.cm-scroller': {
          fontFamily: 'var(--mono)',
          // See CodeMirrorHost: pinned so a graphics character cannot change
          // the height of the row it lands in.
          lineHeight: '1.3',
        },
      }),
    ],
    [engine, runAssemble],
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const view = new EditorView({
      state: bufferHistories.restore(
        blockBufferKey(blockRef.current.id),
        blockSource(blockRef.current, engine),
        buildExtensions(),
      ),
      parent: host,
    });
    viewRef.current = view;
    lastBlockId.current = blockRef.current.id;
    lastHistoryGeneration.current = bufferHistories.generation;
    seedDiagnostics(view);

    return () => {
      // Flush a pending assemble so a fast tab switch doesn't drop the last
      // keystrokes, and park the history so coming back to this block finds it.
      flushPending(view);
      parkState(view, blockRef.current.id);
      view.destroy();
      viewRef.current = null;
      if (searchOpen.current) {
        searchOpen.current = false;
        useIdeStore.getState().setFindReplaceOpen(false);
      }
    };
    // The engine is fixed per dialect, so this runs once per opened block tab -
    // switching between blocks swaps the view's state instead (below).
  }, [engine, buildExtensions, flushPending, parkState, seedDiagnostics]);

  // A different block in the same editor: park the outgoing one's state and
  // give the view the incoming one's, resetting the per-block bookkeeping that
  // a remount used to reset.
  useEffect(() => {
    const view = viewRef.current;
    if (!view || block.id === lastBlockId.current) return;
    const outgoing = lastBlockId.current;
    lastBlockId.current = block.id;
    flushPending(view);
    parkState(view, outgoing);
    lastWrittenBytes.current = null;
    reseeding.current = false;
    prevBytes.current = block.bytes;
    view.setState(
      bufferHistories.restore(
        blockBufferKey(block.id),
        blockSource(block, engine),
        buildExtensions(),
      ),
    );
    lastHistoryGeneration.current = bufferHistories.generation;
    seedDiagnostics(view);
    // The find panel belonged to the block that was showing, and is not part of
    // the state that comes back.
    if (searchOpen.current) {
      searchOpen.current = false;
      useIdeStore.getState().setFindReplaceOpen(false);
    }
  }, [
    block,
    engine,
    buildExtensions,
    flushPending,
    parkState,
    seedDiagnostics,
  ]);

  // Raising a dialog, panel or drawer over the editor takes away the
  // picked-token menu; the on-screen input overlays don't.
  useRetireEditorPopups(viewRef);

  // The Edit menu acts on the buffer on screen, which is this one whenever this
  // editor is mounted - `CodeMirrorHost` stands down while a block is showing.
  useEffect(() => {
    if (editorCommand.seq === lastCommand.current) return;
    lastCommand.current = editorCommand.seq;
    const view = viewRef.current;
    if (view) void runViewEditorCommand(view, editorCommand.name);
  }, [editorCommand]);

  // Defensive: if the block's bytes change identity while this tab is open
  // and it wasn't our own write echoing back (today every external write
  // path also resets the active tab), drop the text and re-seed from a fresh
  // disassembly of the new bytes.
  useEffect(() => {
    if (prevBytes.current === block.bytes) return;
    prevBytes.current = block.bytes;
    // Our own commit echoing back. Fixed-address blocks store the exact array we
    // wrote (identity match); listing-backed blocks re-derive a fresh array from
    // source, so compare by value too - otherwise every keystroke's write-back
    // would reseed the editor from a disassembly and wipe the user's text.
    if (
      lastWrittenBytes.current !== null &&
      (lastWrittenBytes.current === block.bytes ||
        bytesEqual(lastWrittenBytes.current, block.bytes))
    ) {
      return;
    }
    const view = viewRef.current;
    if (!view) return;
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    reseeding.current = true;
    // Not the user's edit, so not theirs to undo: undoing it would leave source
    // that no longer describes the block's bytes, which the editor would then
    // assemble back over them.
    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: blockSource(block, engine),
      },
      annotations: Transaction.addToHistory.of(false),
    });
    view.dispatch(setDiagnostics(view.state, []));
    reseeding.current = false;
    useIdeStore.getState().setBlockAsmError(block.id, false);
  }, [block, engine]);

  // Switching the mobile view tab dismisses the find/replace panel, as it does
  // for the BASIC editor.
  const mobileTab = useIdeStore((s) => s.mobileTab);
  useEffect(() => {
    const view = viewRef.current;
    if (view && searchPanelOpen(view.state)) closeSearchPanel(view);
  }, [mobileTab]);

  return (
    <div className={styles.asmEditor}>
      <div className={styles.statusStrip}>
        <strong>{block.name}</strong> · ORG {formatWord(block.address)} ·{' '}
        {block.bytes.length} {block.bytes.length === 1 ? 'byte' : 'bytes'}
        {block.entry !== undefined && <> · entry {formatWord(block.entry)}</>}
        {block.comment !== undefined && (
          <span className={styles.comment}> · {block.comment}</span>
        )}
      </div>
      <div className={styles.editorHost} ref={hostRef} />
    </div>
  );
}
