/**
 * The emulator virtual filesystem: where a running program's data file I/O
 * lands when a machine traps it (Spectrum tape CODE/DATA blocks, TRS-80
 * sequential files…). The synchronous in-memory map is the authoritative
 * store - ROM traps fire between CPU instructions and cannot await - and
 * every mutation is mirrored fire-and-forget into RxDB/IndexedDB, which
 * `hydrate` reads back so a file outlives the session that wrote it.
 *
 * Lifetime: a file is kept for the machine that wrote it and served back to
 * that machine's later runs, so a program can read on one run what it saved on
 * an earlier one. Starting a program, resetting the machine and unmounting the
 * pane all keep the files; only the document-lifecycle actions in
 * `src/app/store.ts` discard them - the target-machine switch, the player boot,
 * and every path that replaces the open document - along with the user
 * deleting one. A pause and a stop have never cleared it and still do not.
 *
 * Scope: a file belongs to one machine and one browser tab. The database is
 * shared by every tab of the origin, so the store carries the tab's id (fixed
 * at construction) and its current machine id, and every read, purge and delete
 * is filtered by both.
 *
 * What the IDE mounts for a program to load - the document's memory blocks and
 * imported tape files - is marked `mounted` and never persisted, so it cannot
 * come back as though the program had saved it.
 */
import type { MachineFileEntry, MachineFileStore } from '../../dialects/types';
import { getTabId, refreshTabRegistry } from '../settings';
import { base64ToBytes, bytesToBase64 } from './base64';
import { getVfsCollection, vfsRowId, type VfsFileDoc } from './db';

interface StoredFile {
  data: Uint8Array;
  updatedAt: number;
  kind?: string;
  mounted?: boolean;
}

/**
 * How long a restore waits for the database before the run goes ahead without
 * it. RxDB is a lazily imported chunk, so a first run would otherwise block on
 * that download plus the database open. Memory is authoritative, so a late
 * restore costs a beat - the files appear when it lands, or on the next run -
 * rather than a run.
 */
const HYDRATE_TIMEOUT_MS = 1500;

/** How often a saving tab re-announces itself to the shared tab registry. */
const REGISTRY_REFRESH_MS = 5 * 60 * 1000;

/**
 * A stored row as the store can use it, or null when it cannot be read back -
 * no tab, bytes that will not decode, a length that disagrees with the payload.
 * The caller deletes such a row rather than skipping it: the mirror is only
 * worth its space while it can answer with a file, and a row left in place
 * would be met again on every restore.
 */
function restoredFile(doc: VfsFileDoc): StoredFile | null {
  if (typeof doc.tabId !== 'string' || doc.tabId === '') return null;
  if (typeof doc.name !== 'string' || doc.name === '') return null;
  if (typeof doc.dataB64 !== 'string') return null;
  if (typeof doc.updatedAt !== 'number' || !Number.isFinite(doc.updatedAt)) {
    return null;
  }
  let data: Uint8Array;
  try {
    data = base64ToBytes(doc.dataB64);
  } catch {
    return null;
  }
  if (data.length !== doc.size) return null;
  return {
    data,
    updatedAt: doc.updatedAt,
    ...(doc.kind !== undefined ? { kind: doc.kind } : {}),
  };
}

export class EmulatorVfs implements MachineFileStore {
  private files = new Map<string, StoredFile>();
  private dialectId = '';
  /** The tab that owns these files. Fixed for the store's whole life. */
  private readonly tabId: string;
  /** False in the player: memory only, so a share link stores nothing. */
  private persist = true;
  /** Bumped by clear(); mirror writes from an older generation are dropped. */
  private generation = 0;
  private listeners = new Set<() => void>();
  /** Serializes mirror operations so RxDB sees them in call order. */
  private pending: Promise<void> = Promise.resolve();
  private registryTouchedAt = 0;

  constructor(tabId: string = getTabId()) {
    this.tabId = tabId;
  }

  /**
   * Tag the store with the machine whose files it holds. The one writer of the
   * machine id, called from boot, from `hydrate` and from the store actions
   * that switch machine, so a row is never written under an empty machine id -
   * which a filtered restore could never find again.
   */
  setDialect(id: string): void {
    this.dialectId = id;
  }

  /** Turn persistence off (the player) or on. Off, nothing reads or writes. */
  setPersistence(on: boolean): void {
    this.persist = on;
  }

  save(
    name: string,
    data: Uint8Array,
    meta?: { kind?: string; mounted?: boolean },
  ): void {
    // Copy: machines pass views over live emulator RAM.
    const file: StoredFile = {
      data: data.slice(),
      updatedAt: Date.now(),
      kind: meta?.kind,
      mounted: meta?.mounted,
    };
    this.files.set(name, file);
    this.notify();
    if (file.mounted) {
      // Mounted content is the document going to the machine afresh on every
      // run, so it is never stored. A removal rather than a skipped write: a
      // previous run's row under this name would otherwise survive and be
      // restored as though the program had written it.
      this.mirror(async (col) => {
        const doc = await col.findOne(vfsRowId(this.tabId, name)).exec();
        if (doc) await doc.remove();
      });
      return;
    }
    const doc: VfsFileDoc = {
      id: vfsRowId(this.tabId, name),
      tabId: this.tabId,
      name,
      dataB64: bytesToBase64(file.data),
      size: file.data.length,
      updatedAt: file.updatedAt,
      dialectId: this.dialectId,
      ...(file.kind !== undefined ? { kind: file.kind } : {}),
    };
    this.mirror((col) => col.incrementalUpsert(doc));
  }

  load(name: string): Uint8Array | null {
    const file = this.files.get(name);
    return file ? file.data.slice() : null;
  }

  list(): MachineFileEntry[] {
    return [...this.files.entries()].map(([name, f]) => ({
      name,
      size: f.data.length,
      updatedAt: f.updatedAt,
      ...(f.kind !== undefined ? { kind: f.kind } : {}),
      ...(f.mounted ? { mounted: true } : {}),
    }));
  }

  delete(name: string): boolean {
    const removed = this.files.delete(name);
    if (removed) {
      this.notify();
      this.mirror(async (col) => {
        const doc = await col.findOne(vfsRowId(this.tabId, name)).exec();
        if (doc) await doc.remove();
      });
    }
    return removed;
  }

  /**
   * Empty the VFS (memory, and this tab's rows for the machine being left).
   * Called by every path that replaces the open document and by the
   * target-machine switch - never by the emulator lifecycle, never on a pause,
   * and never on a stop.
   *
   * The purge is scoped rather than a wipe of the collection: another tab's
   * rows are not this store's to discard, and another machine's rows are what
   * switching back to that machine restores.
   */
  clear(nextDialectId?: string): void {
    this.files.clear();
    this.generation++;
    // The rows to purge are the ones this store was holding, so the machine
    // being left is captured before the new one is tagged.
    const leaving = this.dialectId;
    if (nextDialectId !== undefined) this.dialectId = nextDialectId;
    this.notify();
    const gen = this.generation;
    this.pending = this.pending
      .then(async () => {
        if (!this.persist) return;
        const col = await getVfsCollection();
        // A newer clear supersedes this purge; its own purge will run after.
        if (gen !== this.generation) return;
        await col
          .find({ selector: { tabId: this.tabId, dialectId: leaving } })
          .remove();
      })
      .catch((e) => console.warn('VFS clear failed to reach IndexedDB', e));
  }

  /** Drop what the IDE mounted, from memory only - the mirror holds none. */
  clearMounted(): void {
    let dropped = false;
    for (const [name, file] of this.files) {
      if (!file.mounted) continue;
      this.files.delete(name);
      dropped = true;
    }
    if (dropped) this.notify();
  }

  /**
   * Restore this tab's files for `dialectId` into memory, oldest save first,
   * and tag the store with that machine.
   *
   * Queued at the tail of the same chain the mirror writes use, not merely
   * generation-checked: `clear()` bumps the generation synchronously but only
   * queues its purge, so a restore reading the collection directly could still
   * see rows that purge has yet to delete - resurrecting exactly the files the
   * clear discarded. The generation is re-checked before anything is applied,
   * so a clear issued while this is in flight still wins.
   *
   * Never rejects: the run effect turns anything thrown into a machine error,
   * and a blocked or failing IndexedDB (a private window, storage denied) must
   * not read as an emulator failure.
   */
  async hydrate(dialectId: string): Promise<void> {
    this.setDialect(dialectId);
    if (!this.persist) return;
    const gen = this.generation;
    const restore = this.pending
      .then(async () => {
        const col = await getVfsCollection();
        if (gen !== this.generation) return;
        const docs = await col
          .find({ selector: { tabId: this.tabId, dialectId } })
          .exec();
        // Oldest save first: `list()` is documented that way and both the tape
        // deck and the tab strip lean on it, which the primary-key order a
        // query hands back would scramble.
        const rows = [...docs].sort((a, b) => a.updatedAt - b.updatedAt);
        const restored: [string, StoredFile][] = [];
        for (const doc of rows) {
          const file = restoredFile(doc);
          if (file === null) {
            await doc.remove();
            continue;
          }
          restored.push([doc.name, file]);
        }
        if (gen !== this.generation) return;
        let added = false;
        for (const [name, file] of restored) {
          // Memory is authoritative, and is by definition the newer of the two.
          if (this.files.has(name)) continue;
          this.files.set(name, file);
          added = true;
        }
        if (added) this.notify();
      })
      .catch((e) => console.warn('VFS restore failed to reach IndexedDB', e));
    this.pending = restore;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const expiry = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, HYDRATE_TIMEOUT_MS);
    });
    try {
      await Promise.race([restore, expiry]);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Purge the rows of tabs `liveTabIds` does not vouch for. Their keys name a
   * tab that no longer exists, so nothing can ever read them back; this is
   * housekeeping for unreachable rows, not eviction of files a tab still holds.
   */
  reclaim(liveTabIds: readonly string[]): void {
    if (!this.persist) return;
    const live = new Set(liveTabIds);
    this.pending = this.pending
      .then(async () => {
        const col = await getVfsCollection();
        const docs = await col.find().exec();
        for (const doc of docs) {
          if (!live.has(doc.tabId)) await doc.remove();
        }
      })
      .catch((e) => console.warn('VFS reclaim failed to reach IndexedDB', e));
  }

  /** Notify on any change; returns the unsubscribe function. */
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Resolves once all mirror writes enqueued so far have settled (tests). */
  idle(): Promise<void> {
    return this.pending;
  }

  private notify(): void {
    for (const fn of this.listeners) fn();
  }

  /**
   * Queue a fire-and-forget RxDB write. Never awaited by emulator code; a
   * write enqueued before a clear() is dropped when it would land after it.
   */
  private mirror(
    op: (col: Awaited<ReturnType<typeof getVfsCollection>>) => Promise<unknown>,
  ): void {
    if (!this.persist) return;
    this.touchRegistry();
    const gen = this.generation;
    this.pending = this.pending
      .then(async () => {
        const col = await getVfsCollection();
        if (gen !== this.generation) return; // superseded by a clear
        await op(col);
      })
      .catch((e) => console.warn('VFS mirror write failed', e));
  }

  /**
   * Say this tab is still alive, at most once per window. A tab that keeps
   * saving over days must stay vouched for, or another tab's reclaim sweep
   * would delete the rows under it.
   */
  private touchRegistry(): void {
    const now = Date.now();
    if (now - this.registryTouchedAt < REGISTRY_REFRESH_MS) return;
    this.registryTouchedAt = now;
    refreshTabRegistry();
  }
}

/** The app-wide VFS instance handed to every machine via createEmulator. */
export const emulatorVfs = new EmulatorVfs();
