/**
 * The emulator virtual filesystem: where a running program's data file I/O
 * lands when a machine traps it (Spectrum tape CODE/DATA blocks, TRS-80
 * sequential files…). The synchronous in-memory map is the authoritative
 * store - ROM traps fire between CPU instructions and cannot await - and
 * every mutation is mirrored fire-and-forget into RxDB/IndexedDB so the
 * inspector dialog can watch the files reactively.
 *
 * Lifetime: the IDE clears the store on every emulator start and stop (and
 * on reset/dialect switch, which end the session just as surely). A pause -
 * breakpoint suspend - does not clear it.
 */
import type { MachineFileEntry, MachineFileStore } from '../../dialects/types';
import { bytesToBase64 } from './base64';
import { getVfsCollection, type VfsFileDoc } from './db';

interface StoredFile {
  data: Uint8Array;
  updatedAt: number;
  kind?: string;
}

export class EmulatorVfs implements MachineFileStore {
  private files = new Map<string, StoredFile>();
  private dialectId = '';
  /** Bumped by clear(); mirror writes from an older generation are dropped. */
  private generation = 0;
  private listeners = new Set<() => void>();
  /** Serializes mirror operations so RxDB sees them in call order. */
  private pending: Promise<void> = Promise.resolve();

  save(name: string, data: Uint8Array, meta?: { kind?: string }): void {
    // Copy: machines pass views over live emulator RAM.
    const file: StoredFile = {
      data: data.slice(),
      updatedAt: Date.now(),
      kind: meta?.kind,
    };
    this.files.set(name, file);
    this.notify();
    const doc: VfsFileDoc = {
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
    }));
  }

  delete(name: string): boolean {
    const removed = this.files.delete(name);
    if (removed) {
      this.notify();
      this.mirror(async (col) => {
        const doc = await col.findOne(name).exec();
        if (doc) await doc.remove();
      });
    }
    return removed;
  }

  /**
   * Empty the VFS (memory and the RxDB mirror). Called on emulator start,
   * stop, reset, dialect switch and pane unmount - never on pause.
   */
  clear(nextDialectId?: string): void {
    this.files.clear();
    this.generation++;
    if (nextDialectId !== undefined) this.dialectId = nextDialectId;
    this.notify();
    const gen = this.generation;
    this.pending = this.pending
      .then(async () => {
        const col = await getVfsCollection();
        // A newer clear supersedes this purge; its own purge will run after.
        if (gen !== this.generation) return;
        await col.find().remove();
      })
      .catch((e) => console.warn('VFS clear failed to reach IndexedDB', e));
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
    const gen = this.generation;
    this.pending = this.pending
      .then(async () => {
        const col = await getVfsCollection();
        if (gen !== this.generation) return; // superseded by a clear
        await op(col);
      })
      .catch((e) => console.warn('VFS mirror write failed', e));
  }
}

/** The app-wide VFS instance handed to every machine via createEmulator. */
export const emulatorVfs = new EmulatorVfs();
