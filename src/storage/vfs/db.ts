/**
 * The RxDB database behind the emulator virtual filesystem. One lazy,
 * memoized database with a single `files` collection, persisted to
 * IndexedDB via RxDB's Dexie storage. All rxdb imports are dynamic so the
 * library loads as an async chunk on first VFS use, not in the main bundle.
 *
 * Every browser tab shares the one IndexedDB database, so a row records the
 * tab that wrote it and the row's key is composed from it: two tabs can save a
 * file under the same name without either one's row standing in for the
 * other's, and each tab reads, purges and deletes only its own rows.
 */
import type { RxCollection, RxDatabase, RxJsonSchema, RxStorage } from 'rxdb';

/**
 * What joins the two halves of a row's key. Tab ids are generated from a
 * timestamp and random digits, so they never contain it and the join is
 * unambiguous however a program names its file.
 */
const KEY_SEPARATOR = '|';

/** One stored file as persisted for restore and inspection. */
export interface VfsFileDoc {
  /** The primary key: the tab id and the name joined (see `vfsRowId`). */
  id: string;
  /** The browser tab whose program wrote the file. */
  tabId: string;
  /** Program-supplied filename. */
  name: string;
  /** File bytes, base64-encoded (payloads are small - tens of KB at most). */
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

/** The composed primary key of a row, exactly as RxDB builds it. */
export function vfsRowId(tabId: string, name: string): string {
  return `${tabId}${KEY_SEPARATOR}${name}`;
}

export const vfsFileSchema: RxJsonSchema<VfsFileDoc> = {
  version: 1,
  primaryKey: {
    key: 'id',
    fields: ['tabId', 'name'],
    separator: KEY_SEPARATOR,
  },
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 300 },
    tabId: { type: 'string', maxLength: 64 },
    name: { type: 'string', maxLength: 200 },
    dataB64: { type: 'string' },
    size: { type: 'number' },
    updatedAt: { type: 'number' },
    dialectId: { type: 'string' },
    kind: { type: 'string' },
  },
  required: [
    'id',
    'tabId',
    'name',
    'dataB64',
    'size',
    'updatedAt',
    'dialectId',
  ],
};

/**
 * Version 0 rows are dropped rather than carried forward. They record no tab,
 * so they cannot be attributed to one; they were written while the IDE emptied
 * the collection on every emulator start, so none of them was ever meant to
 * outlive a run; and among them are the files the IDE itself mounted for a
 * program to load, which must never come back as though the program had saved
 * them. Returning null also means no version 0 row is ever rewritten under the
 * new key - RxDB drops it before the write.
 */
const vfsMigrationStrategies = { 1: () => null };

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
  // The collection is past version 0, so RxDB needs the migration plugin to
  // open it at all: an existing database is migrated in place on first open.
  const { RxDBMigrationSchemaPlugin } =
    await import('rxdb/plugins/migration-schema');
  addRxPlugin(RxDBMigrationSchemaPlugin);
  let storage = storageOverride;
  if (!storage) {
    // Real browser path: Dexie/IndexedDB, plus dev-mode checks in dev builds.
    const { getRxStorageDexie } = await import('rxdb/plugins/storage-dexie');
    storage = getRxStorageDexie();
    if (import.meta.env.DEV) {
      const { RxDBDevModePlugin } = await import('rxdb/plugins/dev-mode');
      addRxPlugin(RxDBDevModePlugin);
      // Dev-mode requires a schema-validating storage at the top level; Dexie
      // doesn't validate on its own, so wrap it with the AJV validator.
      const { wrappedValidateAjvStorage } =
        await import('rxdb/plugins/validate-ajv');
      storage = wrappedValidateAjvStorage({ storage });
    }
  }
  const db = await createRxDatabase<VfsCollections>({
    name: 'basically-vfs',
    storage,
    multiInstance: false,
  });
  await db.addCollections({
    files: {
      schema: vfsFileSchema,
      migrationStrategies: vfsMigrationStrategies,
    },
  });
  return db;
}
