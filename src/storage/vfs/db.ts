/**
 * The RxDB database behind the emulator virtual filesystem. One lazy,
 * memoized database with a single `files` collection, persisted to
 * IndexedDB via RxDB's Dexie storage. All rxdb imports are dynamic so the
 * library loads as an async chunk on first VFS use, not in the main bundle.
 *
 * Note: every browser tab shares the one IndexedDB database, so a VFS clear
 * in one tab empties another tab's mirror. Emulation is unaffected (the
 * in-memory store in vfsStore.ts is per-tab); only the inspector could
 * briefly show another tab's state. Accepted for now.
 */
import type { RxCollection, RxDatabase, RxJsonSchema, RxStorage } from 'rxdb';

/** One stored file as persisted for inspection. */
export interface VfsFileDoc {
  /** Program-supplied filename; the primary key. */
  name: string;
  /** File bytes, base64-encoded (payloads are small — tens of KB at most). */
  dataB64: string;
  /** Payload size in bytes (pre-encoding). */
  size: number;
  /** Epoch ms of the last save. */
  updatedAt: number;
  /** Dialect that wrote the file, e.g. 'zxspectrum'. */
  dialectId: string;
  /** Dialect-specific tag, e.g. 'code' | 'data-num' | 'data-str' | 'data'. */
  kind?: string;
}

export const vfsFileSchema: RxJsonSchema<VfsFileDoc> = {
  version: 0,
  primaryKey: 'name',
  type: 'object',
  properties: {
    name: { type: 'string', maxLength: 200 },
    dataB64: { type: 'string' },
    size: { type: 'number' },
    updatedAt: { type: 'number' },
    dialectId: { type: 'string' },
    kind: { type: 'string' },
  },
  required: ['name', 'dataB64', 'size', 'updatedAt', 'dialectId'],
};

type VfsCollections = { files: RxCollection<VfsFileDoc> };
type VfsDatabase = RxDatabase<VfsCollections>;

let storageOverride: RxStorage<unknown, unknown> | null = null;
let dbPromise: Promise<VfsDatabase> | null = null;

/**
 * Vitest runs in a node environment with no IndexedDB; tests inject RxDB's
 * in-memory storage here before first use (and reset between suites).
 */
export function setVfsStorageForTests(
  storage: RxStorage<unknown, unknown> | null,
): void {
  storageOverride = storage;
  dbPromise = null;
}

/** Close the memoized database (test isolation only). */
export async function closeVfsDbForTests(): Promise<void> {
  if (!dbPromise) return;
  const db = await dbPromise;
  dbPromise = null;
  await db.close();
}

export async function getVfsCollection(): Promise<RxCollection<VfsFileDoc>> {
  dbPromise ??= open();
  return (await dbPromise).files;
}

async function open(): Promise<VfsDatabase> {
  const { createRxDatabase, addRxPlugin } = await import('rxdb');
  let storage = storageOverride;
  if (!storage) {
    // Real browser path: Dexie/IndexedDB, plus dev-mode checks in dev builds.
    const { getRxStorageDexie } = await import('rxdb/plugins/storage-dexie');
    storage = getRxStorageDexie();
    if (import.meta.env.DEV) {
      const { RxDBDevModePlugin } = await import('rxdb/plugins/dev-mode');
      addRxPlugin(RxDBDevModePlugin);
    }
  }
  const db = await createRxDatabase<VfsCollections>({
    name: 'basically-vfs',
    storage,
    multiInstance: false,
  });
  await db.addCollections({ files: { schema: vfsFileSchema } });
  return db;
}
