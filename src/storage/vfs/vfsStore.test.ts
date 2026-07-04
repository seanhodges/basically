import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import {
  closeVfsDbForTests,
  getVfsCollection,
  setVfsStorageForTests,
} from './db';
import { base64ToBytes } from './base64';
import { EmulatorVfs } from './vfsStore';

beforeAll(() => {
  setVfsStorageForTests(getRxStorageMemory());
});

afterAll(async () => {
  await closeVfsDbForTests();
  setVfsStorageForTests(null);
});

const bytes = (...v: number[]) => new Uint8Array(v);

describe('EmulatorVfs (synchronous store)', () => {
  it('saves, loads and deletes by name', () => {
    const vfs = new EmulatorVfs();
    vfs.clear('zxspectrum');
    vfs.save('A', bytes(1, 2, 3));
    expect(vfs.load('A')).toEqual(bytes(1, 2, 3));
    expect(vfs.load('missing')).toBeNull();
    expect(vfs.delete('A')).toBe(true);
    expect(vfs.delete('A')).toBe(false);
    expect(vfs.load('A')).toBeNull();
  });

  it('copies payloads on save and load', () => {
    const vfs = new EmulatorVfs();
    const ram = bytes(1, 2, 3);
    vfs.save('A', ram);
    ram[0] = 99; // machine RAM keeps running after the save
    expect(vfs.load('A')).toEqual(bytes(1, 2, 3));
    const loaded = vfs.load('A')!;
    loaded[0] = 42;
    expect(vfs.load('A')).toEqual(bytes(1, 2, 3));
  });

  it('lists files in insertion order with size, timestamp and kind', () => {
    const vfs = new EmulatorVfs();
    vfs.save('B', bytes(1, 2), { kind: 'code' });
    vfs.save('A', bytes(3));
    const list = vfs.list();
    expect(list.map((f) => f.name)).toEqual(['B', 'A']);
    expect(list[0]).toMatchObject({ size: 2, kind: 'code' });
    expect(list[1]!.size).toBe(1);
    expect(list[1]!.updatedAt).toBeGreaterThan(0);
  });

  it('clear empties the store', () => {
    const vfs = new EmulatorVfs();
    vfs.save('A', bytes(1));
    vfs.clear();
    expect(vfs.list()).toEqual([]);
    expect(vfs.load('A')).toBeNull();
  });

  it('notifies subscribers on save, delete and clear', () => {
    const vfs = new EmulatorVfs();
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
    const vfs = new EmulatorVfs();
    vfs.clear('zxspectrum');
    vfs.save('NUMS', bytes(10, 20, 30), { kind: 'data-num' });
    await vfs.idle();
    const col = await getVfsCollection();
    const doc = await col.findOne('NUMS').exec();
    expect(doc).not.toBeNull();
    expect(base64ToBytes(doc!.dataB64)).toEqual(bytes(10, 20, 30));
    expect(doc!.size).toBe(3);
    expect(doc!.dialectId).toBe('zxspectrum');
    expect(doc!.kind).toBe('data-num');
  });

  it('mirrors deletes', async () => {
    const vfs = new EmulatorVfs();
    vfs.clear('trs80');
    vfs.save('LOG', bytes(1));
    vfs.delete('LOG');
    await vfs.idle();
    const col = await getVfsCollection();
    expect(await col.findOne('LOG').exec()).toBeNull();
  });

  it('clear purges the collection and drops in-flight older writes', async () => {
    const vfs = new EmulatorVfs();
    vfs.clear('trs80');
    vfs.save('OLD', bytes(1));
    vfs.clear(); // enqueued after the save: the save must not survive it
    vfs.save('NEW', bytes(2));
    await vfs.idle();
    const col = await getVfsCollection();
    const docs = await col.find().exec();
    expect(docs.map((d) => d.name)).toEqual(['NEW']);
  });

  it('re-saving a file updates the mirrored document', async () => {
    const vfs = new EmulatorVfs();
    vfs.clear('trs80');
    vfs.save('F', bytes(1));
    vfs.save('F', bytes(9, 9));
    await vfs.idle();
    const col = await getVfsCollection();
    const doc = await col.findOne('F').exec();
    expect(base64ToBytes(doc!.dataB64)).toEqual(bytes(9, 9));
    expect(doc!.size).toBe(2);
  });
});
