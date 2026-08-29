import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import {
  closeVfsDbForTests,
  getVfsCollection,
  setVfsStorageForTests,
  vfsRowId,
  type VfsFileDoc,
} from './db';
import { base64ToBytes, bytesToBase64 } from './base64';
import { EmulatorVfs } from './vfsStore';

beforeAll(() => {
  // The store reads this tab's id and the shared tab registry (sessionStorage
  // and localStorage); the test environment is `node`, so stub both.
  const stub = () => {
    const store = new Map<string, string>();
    return {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    } as Storage;
  };
  (globalThis as { localStorage?: Storage }).localStorage = stub();
  (globalThis as { sessionStorage?: Storage }).sessionStorage = stub();
  setVfsStorageForTests(getRxStorageMemory());
});

afterAll(async () => {
  await closeVfsDbForTests();
  setVfsStorageForTests(null);
});

const bytes = (...v: number[]) => new Uint8Array(v);

/**
 * A store with its own tab id, so one test's rows are never another's - the
 * collection is shared by every store, exactly as it is by every browser tab.
 */
let tabs = 0;
function newVfs(dialectId = 'zxspectrum'): EmulatorVfs {
  const vfs = new EmulatorVfs(`tab${++tabs}`);
  vfs.setDialect(dialectId);
  return vfs;
}

describe('EmulatorVfs (synchronous store)', () => {
  it('saves, loads and deletes by name', () => {
    const vfs = newVfs();
    vfs.save('A', bytes(1, 2, 3));
    expect(vfs.load('A')).toEqual(bytes(1, 2, 3));
    expect(vfs.load('missing')).toBeNull();
    expect(vfs.delete('A')).toBe(true);
    expect(vfs.delete('A')).toBe(false);
    expect(vfs.load('A')).toBeNull();
  });

  it('round-trips the mounted mark, and a plain save clears it', () => {
    const vfs = newVfs();
    vfs.save('engine', bytes(0xc9), { kind: 'code', mounted: true });
    vfs.save('SCORES', bytes(1));
    expect(vfs.list().map((f) => [f.name, f.mounted])).toEqual([
      ['engine', true],
      // Absent rather than false, like `kind`: no mark means the program wrote
      // it, which is the ordinary case.
      ['SCORES', undefined],
    ]);
    // A program saving over a mounted name is writing output, so the mark goes.
    vfs.save('engine', bytes(1, 2));
    expect(vfs.list()[0]!.mounted).toBeUndefined();
  });

  it('copies payloads on save and load', () => {
    const vfs = newVfs();
    const ram = bytes(1, 2, 3);
    vfs.save('A', ram);
    ram[0] = 99; // machine RAM keeps running after the save
    expect(vfs.load('A')).toEqual(bytes(1, 2, 3));
    const loaded = vfs.load('A')!;
    loaded[0] = 42;
    expect(vfs.load('A')).toEqual(bytes(1, 2, 3));
  });

  it('lists files in insertion order with size, timestamp and kind', () => {
    const vfs = newVfs();
    vfs.save('B', bytes(1, 2), { kind: 'code' });
    vfs.save('A', bytes(3));
    const list = vfs.list();
    expect(list.map((f) => f.name)).toEqual(['B', 'A']);
    expect(list[0]).toMatchObject({ size: 2, kind: 'code' });
    expect(list[1]!.size).toBe(1);
    expect(list[1]!.updatedAt).toBeGreaterThan(0);
  });

  // The store never drops a file on its own: what a program saved is kept for
  // the machine that wrote it and served back to later runs, and only an
  // explicit clear ends it. The clear points are the store's document-replacing
  // actions and the machine switch (`src/app/store.test.ts`); the emulator
  // lifecycle - start, reset, pane unmount - is not among them, and neither is
  // a stop or a breakpoint pause.
  it('holds a file until something clears it', () => {
    const vfs = newVfs();
    vfs.save('SCORES', bytes(1, 2, 3));
    // Everything else a session does to the store leaves it standing: a later
    // save under another name, a delete of that one, a read, a subscription.
    vfs.save('LOG', bytes(9));
    vfs.delete('LOG');
    vfs.subscribe(() => {});
    expect(vfs.load('SCORES')).toEqual(bytes(1, 2, 3));
    vfs.clear();
    expect(vfs.load('SCORES')).toBeNull();
  });

  it('clear empties the store', () => {
    const vfs = newVfs();
    vfs.save('A', bytes(1));
    vfs.clear();
    expect(vfs.list()).toEqual([]);
    expect(vfs.load('A')).toBeNull();
  });

  it('clearMounted drops what the IDE mounted and leaves the rest', () => {
    const vfs = newVfs();
    vfs.save('engine', bytes(0xc9), { kind: 'code', mounted: true });
    vfs.save('SCORES', bytes(1, 2));
    vfs.clearMounted();
    expect(vfs.list().map((f) => f.name)).toEqual(['SCORES']);
    expect(vfs.load('engine')).toBeNull();
  });

  it('notifies subscribers on save, delete and clear', () => {
    const vfs = newVfs();
    let calls = 0;
    const unsubscribe = vfs.subscribe(() => calls++);
    vfs.save('A', bytes(1));
    vfs.delete('A');
    vfs.clear();
    expect(calls).toBe(3);
    unsubscribe();
    vfs.save('B', bytes(2));
    expect(calls).toBe(3);
  });
});

describe('EmulatorVfs (RxDB mirror)', () => {
  it('mirrors saves into the collection', async () => {
    const vfs = newVfs();
    vfs.save('NUMS', bytes(10, 20, 30), { kind: 'data-num' });
    await vfs.idle();
    const col = await getVfsCollection();
    const doc = await col.findOne(vfsRowId(`tab${tabs}`, 'NUMS')).exec();
    expect(doc).not.toBeNull();
    expect(base64ToBytes(doc!.dataB64)).toEqual(bytes(10, 20, 30));
    expect(doc!.size).toBe(3);
    expect(doc!.dialectId).toBe('zxspectrum');
    expect(doc!.kind).toBe('data-num');
  });

  it('mirrors deletes', async () => {
    const vfs = newVfs('trs80');
    const tab = `tab${tabs}`;
    vfs.save('LOG', bytes(1));
    vfs.delete('LOG');
    await vfs.idle();
    const col = await getVfsCollection();
    expect(await col.findOne(vfsRowId(tab, 'LOG')).exec()).toBeNull();
  });

  it('clear purges this tab and machine, and drops in-flight older writes', async () => {
    const vfs = newVfs('trs80');
    const tab = `tab${tabs}`;
    vfs.save('OLD', bytes(1));
    vfs.clear(); // enqueued after the save: the save must not survive it
    vfs.save('NEW', bytes(2));
    await vfs.idle();
    const col = await getVfsCollection();
    const docs = await col.find({ selector: { tabId: tab } }).exec();
    expect(docs.map((d) => d.name)).toEqual(['NEW']);
  });

  it('re-saving a file updates the mirrored document', async () => {
    const vfs = newVfs('trs80');
    const tab = `tab${tabs}`;
    vfs.save('F', bytes(1));
    vfs.save('F', bytes(9, 9));
    await vfs.idle();
    const col = await getVfsCollection();
    const doc = await col.findOne(vfsRowId(tab, 'F')).exec();
    expect(base64ToBytes(doc!.dataB64)).toEqual(bytes(9, 9));
    expect(doc!.size).toBe(2);
  });

  it('a mounted save stores nothing and removes the row under that name', async () => {
    const vfs = newVfs();
    const tab = `tab${tabs}`;
    vfs.save('engine', bytes(1, 2, 3)); // a previous run's program output
    await vfs.idle();
    // The IDE mounts the document's own block under the same name.
    vfs.save('engine', bytes(0xc9), { kind: 'code', mounted: true });
    await vfs.idle();
    const col = await getVfsCollection();
    expect(await col.findOne(vfsRowId(tab, 'engine')).exec()).toBeNull();
  });
});

describe('EmulatorVfs (restore)', () => {
  /** A saving session, then a fresh store for the same tab and machine. */
  async function savedThenReopened(
    tabId: string,
    dialectId: string,
    save: (vfs: EmulatorVfs) => void,
  ): Promise<EmulatorVfs> {
    const first = new EmulatorVfs(tabId);
    first.setDialect(dialectId);
    save(first);
    await first.idle();
    return new EmulatorVfs(tabId);
  }

  it('restores this machine’s files, oldest save first', async () => {
    const next = await savedThenReopened('reload', 'zxspectrum', (vfs) => {
      vfs.save('FIRST', bytes(1));
      vfs.save('SECOND', bytes(2, 2));
    });
    await next.hydrate('zxspectrum');
    expect(next.list().map((f) => f.name)).toEqual(['FIRST', 'SECOND']);
    expect(next.load('SECOND')).toEqual(bytes(2, 2));
  });

  it('keeps the in-memory file when a restored name collides', async () => {
    const next = await savedThenReopened('collide', 'zxspectrum', (vfs) => {
      vfs.save('SCORES', bytes(1));
    });
    // This run has already written SCORES: memory is the newer of the two.
    next.setDialect('zxspectrum');
    next.save('SCORES', bytes(9, 9));
    await next.hydrate('zxspectrum');
    expect(next.load('SCORES')).toEqual(bytes(9, 9));
  });

  it('restores only the machine asked for', async () => {
    const first = new EmulatorVfs('permachine');
    first.setDialect('zxspectrum');
    first.save('SPECCY', bytes(1));
    first.setDialect('trs80');
    first.save('TANDY', bytes(2));
    await first.idle();
    const next = new EmulatorVfs('permachine');
    await next.hydrate('trs80');
    expect(next.list().map((f) => f.name)).toEqual(['TANDY']);
  });

  // The composite primary key is what this proves: a row keyed by the file
  // name alone would let one tab's save stand in for the other's.
  it('keeps two tabs’ files apart, and a clear in one spares the other', async () => {
    const a = new EmulatorVfs('tab-a');
    a.setDialect('zxspectrum');
    a.save('SCORES', bytes(1));
    const b = new EmulatorVfs('tab-b');
    b.setDialect('zxspectrum');
    b.save('SCORES', bytes(2, 2));
    await Promise.all([a.idle(), b.idle()]);

    a.clear();
    await a.idle();

    const reopenedA = new EmulatorVfs('tab-a');
    await reopenedA.hydrate('zxspectrum');
    expect(reopenedA.list()).toEqual([]);

    const reopenedB = new EmulatorVfs('tab-b');
    await reopenedB.hydrate('zxspectrum');
    expect(reopenedB.load('SCORES')).toEqual(bytes(2, 2));
  });

  it('purges the rows of tabs the registry no longer vouches for', async () => {
    const live = new EmulatorVfs('tab-live');
    live.setDialect('zxspectrum');
    live.save('KEEP', bytes(1));
    const gone = new EmulatorVfs('tab-gone');
    gone.setDialect('zxspectrum');
    gone.save('SWEPT', bytes(2));
    await Promise.all([live.idle(), gone.idle()]);

    live.reclaim(['tab-live']);
    await live.idle();

    const col = await getVfsCollection();
    const names = async (tabId: string) =>
      (await col.find({ selector: { tabId } }).exec()).map((d) => d.name);
    expect(await names('tab-live')).toEqual(['KEEP']);
    expect(await names('tab-gone')).toEqual([]);
  });

  it('deletes a row it cannot read back, and restores the rest', async () => {
    const col = await getVfsCollection();
    const row = (name: string, dataB64: string, size: number): VfsFileDoc => ({
      id: vfsRowId('tab-bad', name),
      tabId: 'tab-bad',
      name,
      dataB64,
      size,
      updatedAt: Date.now(),
      dialectId: 'zxspectrum',
    });
    await col.insert(row('GOOD', bytesToBase64(bytes(7)), 1));
    await col.insert(row('UNDECODABLE', '!!!!', 3));
    // A partial write: the payload disagrees with the length recorded with it.
    await col.insert(row('TRUNCATED', bytesToBase64(bytes(1, 2)), 5));

    const vfs = new EmulatorVfs('tab-bad');
    await vfs.hydrate('zxspectrum');
    await vfs.idle();

    expect(vfs.list().map((f) => f.name)).toEqual(['GOOD']);
    // Gone from the collection, so the next restore cannot meet them again.
    const left = await col.find({ selector: { tabId: 'tab-bad' } }).exec();
    expect(left.map((d) => d.name)).toEqual(['GOOD']);
  });

  it('a clear issued while a restore is in flight wins', async () => {
    const next = await savedThenReopened('inflight', 'zxspectrum', (vfs) => {
      vfs.save('SCORES', bytes(1));
    });
    const restoring = next.hydrate('zxspectrum');
    next.clear('zxspectrum'); // the user opened a different program
    await restoring;
    await next.idle();
    expect(next.list()).toEqual([]);
  });

  it('a restore after a clear finds the purge has already landed', async () => {
    const vfs = new EmulatorVfs('afterclear');
    vfs.setDialect('zxspectrum');
    vfs.save('SCORES', bytes(1));
    vfs.clear('zxspectrum'); // queued: the purge has not run yet
    await vfs.hydrate('zxspectrum');
    expect(vfs.list()).toEqual([]);
  });

  it('resolves rather than rejects when the collection cannot be opened', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Close the working database first: RxDB refuses a second one of the same
    // name, and this test is about the open itself failing.
    await closeVfsDbForTests();
    setVfsStorageForTests({ broken: true } as never);
    try {
      const vfs = new EmulatorVfs('nodb');
      await expect(vfs.hydrate('zxspectrum')).resolves.toBeUndefined();
      expect(vfs.list()).toEqual([]);
    } finally {
      warn.mockRestore();
      setVfsStorageForTests(getRxStorageMemory());
    }
  });

  it('memory-only mode neither reads nor writes the database', async () => {
    // What the player does: the same singleton, storing nothing.
    const player = new EmulatorVfs('tab-player');
    player.setPersistence(false);
    player.setDialect('zxspectrum');
    player.save('SHARED', bytes(1));
    await player.idle();
    expect(player.load('SHARED')).toEqual(bytes(1));

    const col = await getVfsCollection();
    expect(
      await col.find({ selector: { tabId: 'tab-player' } }).exec(),
    ).toEqual([]);

    // And a restore in that mode brings nothing back, even where rows exist.
    const writer = new EmulatorVfs('tab-player-rows');
    writer.setDialect('zxspectrum');
    writer.save('OWNED', bytes(2));
    await writer.idle();
    const reader = new EmulatorVfs('tab-player-rows');
    reader.setPersistence(false);
    await reader.hydrate('zxspectrum');
    expect(reader.list()).toEqual([]);
  });
});
