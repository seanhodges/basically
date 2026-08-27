// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Project the machine's file store to the data blocks the editor shows: one
 * per file a running program saved, its bytes unwrapped out of whatever
 * container the machine stored them in.
 *
 * A projection rather than a second collection. The file store is already
 * authoritative - keyed by the file's own name, notifying on change - so
 * mirroring it into the app store would duplicate the bytes and leave two
 * copies to drift apart. This follows `selectBlocks`, which derives the
 * listing dialects' blocks from `source` and memoizes them rather than
 * mirroring them into state.
 *
 * Nothing here awaits: the store is synchronous because ROM traps fire between
 * CPU instructions. And nothing here marks the document dirty - files are
 * program output, not part of the document - so running a program still leaves
 * the document clean.
 */

import { useCallback, useSyncExternalStore } from 'react';
import type {
  DataBlock,
  Dialect,
  MachineFileEntry,
  UnwrappedFile,
} from '../dialects/types';
import { emulatorVfs } from '../storage/vfs/vfsStore';
import { useIdeStore } from './store';

/** How a machine's stored bytes split; absent means the bytes are the file. */
export type UnwrapStoredFile = (bytes: Uint8Array) => UnwrappedFile;

/** No files - a shared empty array, so an idle session re-renders nothing. */
const NO_BLOCKS: readonly DataBlock[] = [];

/**
 * Data blocks for a set of file-store entries, oldest save first - the order
 * the store lists them in, so a tab keeps its place as the program writes more.
 * `read` hands back a file's stored bytes by name (the store's own `load`); an
 * entry whose bytes have gone between the listing and the read is dropped
 * rather than shown as an empty file.
 */
export function projectDataBlocks(
  entries: readonly MachineFileEntry[],
  read: (name: string) => Uint8Array | null,
  unwrap?: UnwrapStoredFile,
): readonly DataBlock[] {
  if (entries.length === 0) return NO_BLOCKS;
  const blocks: DataBlock[] = [];
  for (const entry of entries) {
    const stored = read(entry.name);
    if (stored === null) continue;
    blocks.push({
      name: entry.name,
      bytes: unwrap ? unwrap(stored).payload : stored,
      ...(entry.kind !== undefined ? { kind: entry.kind } : {}),
      updatedAt: entry.updatedAt,
    });
  }
  return blocks.length === 0 ? NO_BLOCKS : blocks;
}

/**
 * A cheap fingerprint of the store's listing: what has to change before the
 * projection is worth redoing. Name, size and save time together cover every
 * mutation the store can make - a rewrite of the same file bumps `updatedAt`,
 * which `save` stamps on every call.
 */
function snapshotKey(entries: readonly MachineFileEntry[]): string {
  return entries.map((e) => `${e.name} ${e.size} ${e.updatedAt}`).join('\n');
}

let cache: {
  key: string;
  dialectId: string;
  blocks: readonly DataBlock[];
} | null = null;

/**
 * The data blocks for the current store contents, memoized on the snapshot and
 * the machine: an unchanged store hands back the same array, which is what lets
 * React bail out of a re-render, and a machine change re-unwraps under the new
 * dialect's rules.
 */
export function selectDataBlocks(dialect: Dialect): readonly DataBlock[] {
  const entries = emulatorVfs.list();
  const key = snapshotKey(entries);
  if (cache && cache.key === key && cache.dialectId === dialect.id) {
    return cache.blocks;
  }
  const blocks = projectDataBlocks(
    entries,
    (name) => emulatorVfs.load(name),
    dialect.unwrapStoredFile?.bind(dialect),
  );
  cache = { key, dialectId: dialect.id, blocks };
  return blocks;
}

/** Drop the memo, so one test's store does not answer the next one's. */
export function resetDataBlockCacheForTests(): void {
  cache = null;
}

/**
 * How long the tabs lag the program's writes. Long enough that a program
 * saving every frame wakes React a handful of times a second rather than
 * fifty, short enough that a single save looks immediate.
 */
const THROTTLE_MS = 250;

/**
 * Wake React on a change to the file store, at most once per throttle window.
 * The throttle is on the notification rather than the snapshot: a burst of
 * writes wakes once at the end of the window, and the snapshot React then reads
 * is the latest, so the tab shows the file settling rather than every
 * intermediate write.
 *
 * Module-level so its identity is stable across renders, as
 * `useSyncExternalStore` requires.
 */
function subscribeThrottled(onStoreChange: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const unsubscribe = emulatorVfs.subscribe(() => {
    if (timer !== null) return; // a wake is already pending
    timer = setTimeout(() => {
      timer = null;
      onStoreChange();
    }, THROTTLE_MS);
  });
  return () => {
    unsubscribe();
    if (timer !== null) clearTimeout(timer);
  };
}

/** Subscribe to the files the running program has saved. */
export function useDataBlocks(): readonly DataBlock[] {
  const dialect = useIdeStore((s) => s.dialect);
  const snapshot = useCallback(() => selectDataBlocks(dialect), [dialect]);
  return useSyncExternalStore(subscribeThrottled, snapshot, () => NO_BLOCKS);
}
