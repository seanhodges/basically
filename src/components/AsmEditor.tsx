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
 * Mounted with `key={block.id}` by the Workspace, so switching blocks swaps
 * in a fresh editor (per-block undo history is not preserved; document text
 * is, via `asmSource`).
 */

import { useEffect, useRef } from 'react';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import {
  defaultHighlightStyle,
  syntaxHighlighting,
} from '@codemirror/language';
import type { Diagnostic } from '@codemirror/lint';
import { lintKeymap, setDiagnostics } from '@codemirror/lint';
import { EditorState } from '@codemirror/state';
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import { useIdeStore } from '../app/store';
import { asmLanguage } from '../asm/language';
import { formatWord } from '../asm/format';
import type { AsmEngine, AsmError } from '../asm/types';
import type { MemoryBlock } from '../dialects/types';
import { basicHighlightStyle } from '../editor/basicLanguage';
import styles from './AsmEditor.module.css';

/** How long after the last keystroke the source re-assembles. */
const ASSEMBLE_DEBOUNCE_MS = 500;

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
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
  // Latest block for the debounced callback (the prop advances on each
  // upsert echo; the editor instance itself is keyed by block.id).
  const blockRef = useRef(block);
  blockRef.current = block;
  // The bytes array we last wrote through upsertBlock: when it comes back as
  // the prop, that's our own write echoing, not an external change.
  const lastWrittenBytes = useRef<Uint8Array | null>(null);
  const prevBytes = useRef(block.bytes);
  const debounceRef = useRef<number | null>(null);
  const reseeding = useRef(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // On clean assembly the block's bytes update (and the text is kept as
    // asmSource); on errors only the text and diagnostics update. Never
    // called just for opening the tab, so viewing a block can't dirty the
    // document - see seedDiagnostics below.
    const runAssemble = (view: EditorView) => {
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
    };

    // Mount-time diagnostics only: no upsert, so a pristine look at a block
    // leaves the document clean.
    const seedDiagnostics = (view: EditorView) => {
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
    };

    const initial =
      blockRef.current.asmSource ??
      engine
        .disassembleReachable(blockRef.current.bytes, blockRef.current.address)
        .map((l) => l.text)
        .join('\n');

    const state = EditorState.create({
      doc: initial,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        drawSelection(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap, ...lintKeymap]),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        syntaxHighlighting(basicHighlightStyle),
        asmLanguage(engine),
        EditorView.updateListener.of((update) => {
          // Mirror the selection into the store so F1 / the Docs button can
          // open this CPU's assembly reference seeded to the selected mnemonic
          // (see referenceTopicFor). Matches CodeMirrorHost's BASIC editor.
          if (update.selectionSet || update.docChanged) {
            const sel = update.state.selection.main;
            useIdeStore
              .getState()
              .setEditorSelection(
                sel.empty ? '' : update.state.sliceDoc(sel.from, sel.to),
              );
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
    });
    const view = new EditorView({ state, parent: host });
    viewRef.current = view;
    seedDiagnostics(view);

    return () => {
      // Flush a pending assemble so a fast tab switch doesn't drop the last
      // keystrokes.
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
        runAssemble(view);
      }
      view.destroy();
      viewRef.current = null;
    };
    // The component remounts per block (key={block.id}); the engine is fixed
    // per dialect, so this runs once per opened block tab.
  }, [engine]);

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
    // Prefer the block's saved assembly source (kept in sync with its bytes)
    // so a data section survives; only fall back to disassembly when there is
    // none - matching the mount-time seeding above.
    const text =
      block.asmSource ??
      engine
        .disassembleReachable(block.bytes, block.address)
        .map((l) => l.text)
        .join('\n');
    reseeding.current = true;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: text },
    });
    view.dispatch(setDiagnostics(view.state, []));
    reseeding.current = false;
    useIdeStore.getState().setBlockAsmError(block.id, false);
  }, [block, engine]);

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
