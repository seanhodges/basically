// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Per-buffer editor state, so every buffer behind the editor pane's tab strip
 * keeps its own document, selection and undo/redo stacks across tab switches.
 *
 * The cache holds *serialized* states rather than live `EditorState`s. A live
 * state carries the configuration it was built with, and both editors configure
 * `Compartment`s from store state that changes while a buffer is parked (the
 * line-number gutter, the numbering/completion settings, the breakpoint and heat
 * markers, the native-keyboard suppression). Those are reconfigured by effects
 * that dispatch to the view holding the state, so a parked state would come back
 * with whatever configuration it was put away with and nothing would correct it.
 *
 * `toJSON`/`fromJSON` with `historyField` is CodeMirror's own multi-document
 * recipe: the document, the selection and the history come back, while the
 * extensions are rebuilt from current state by the caller. Transient view state
 * no serialized field covers - an open find panel, a folded range - resets on a
 * switch.
 */

import { historyField } from '@codemirror/commands';
import { EditorState, type Extension } from '@codemirror/state';

/** The fields serialized alongside the document and selection. */
const HISTORY_FIELDS = { history: historyField };

/** One buffer's serialized state, as `EditorState.toJSON` produces it. */
type Snapshot = unknown;

/** A fresh state for `text` with no history to undo into. */
export function freshBufferState(
  text: string,
  extensions: Extension,
): EditorState {
  return EditorState.create({ doc: text, extensions });
}

/**
 * The snapshots of every buffer that is not currently in a view, keyed by
 * {@link basicBufferKey} / {@link blockBufferKey}.
 *
 * Module state rather than store state: a serialized `EditorState` is editor
 * plumbing, not part of the document, and nothing outside the two editors reads
 * it. The store drops entries as buffers are replaced or discarded (see
 * `dropBufferHistory` / `clearBufferHistories` in `src/app/store.ts`).
 */
class BufferHistories {
  private snapshots = new Map<string, Snapshot>();
  /**
   * Bumped by {@link clear}. A view that is showing a buffer while the whole
   * document is replaced has no snapshot to come back through, so it reads this
   * to tell a replacement apart from an edit and start a clean history rather
   * than letting undo reach back across it.
   */
  private cleared = 0;

  get generation(): number {
    return this.cleared;
  }

  /**
   * Put `state` away under `key`, replacing any snapshot already there.
   *
   * `generation` is the {@link generation} the state being parked was installed
   * under: a view is unmounted or swapped *after* the store has replaced the
   * document, so without it a state put away on the way out would outlive the
   * document it belongs to and be handed to whatever next claims the same key.
   */
  save(key: string, state: EditorState, generation = this.cleared): void {
    if (generation !== this.cleared) return;
    this.snapshots.set(key, state.toJSON(HISTORY_FIELDS));
  }

  /**
   * The state to put in a view for `key`: the snapshot saved for it, or a fresh
   * state for `text` when there is none. A snapshot that cannot be restored
   * costs the buffer its history, never its contents - `fromJSON` throws on a
   * malformed snapshot, and a switch that fails is a switch that loses a buffer.
   */
  restore(key: string, text: string, extensions: Extension): EditorState {
    const snapshot = this.snapshots.get(key);
    if (snapshot === undefined) return freshBufferState(text, extensions);
    this.snapshots.delete(key);
    try {
      return EditorState.fromJSON(snapshot, { extensions }, HISTORY_FIELDS);
    } catch {
      return freshBufferState(text, extensions);
    }
  }

  /** Forget one buffer's history - its contents have been replaced, or it is gone. */
  drop(key: string): void {
    this.snapshots.delete(key);
  }

  /** Forget every buffer's history: a different document is being loaded. */
  clear(): void {
    this.snapshots.clear();
    this.cleared++;
  }

  /** Whether a snapshot is held for `key` (tests; the editors just restore). */
  has(key: string): boolean {
    return this.snapshots.has(key);
  }
}

export const bufferHistories = new BufferHistories();

/** Key for a BASIC buffer: a scratch buffer by id, or the program for `null`. */
export function basicBufferKey(bufferId: string | null): string {
  return bufferId === null ? 'basic:program' : `basic:${bufferId}`;
}

/** Key for the assembly buffer of one memory block. */
export function blockBufferKey(blockId: string): string {
  return `block:${blockId}`;
}
