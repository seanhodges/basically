import { describe, expect, it } from 'vitest';
import type { MachineFileEntry, MachineFileStore } from '../../dialects/types';
import { BbcDiskDrive, type Bus } from './diskDrive';

const FIND_OPEN_INPUT = 0x40;
const FIND_OPEN_OUTPUT = 0x80;
const FIND_OPEN_UPDATE = 0xc0;
const ARGS_READ_PTR = 0x00;
const ARGS_WRITE_PTR = 0x01;
const ARGS_READ_EXT = 0x02;
const ARGS_ENSURE_WRITTEN = 0xff;

const FN_BUF = 0x0200; // where tests park the filename bytes
const ARG_BLOCK = 0x0070; // a zero-page address for the 4-byte OSARGS block

/** Map-backed MachineFileStore, same shape as commodore/diskDrive.test.ts. */
function fakeStore() {
  const files = new Map<string, { data: Uint8Array; kind?: string }>();
  const store: MachineFileStore = {
    save: (name, data, meta) =>
      void files.set(name, { data: data.slice(), kind: meta?.kind }),
    load: (name) => files.get(name)?.data.slice() ?? null,
    list: (): MachineFileEntry[] =>
      [...files.entries()].map(([name, f]) => ({
        name,
        size: f.data.length,
        updatedAt: 1,
        kind: f.kind,
      })),
    delete: (name) => files.delete(name),
  };
  return { store, files };
}

/** A flat 64K memory as the Bus, with a helper to stage a filename + open. */
function fakeBus() {
  const mem = new Uint8Array(0x10000);
  const bus: Bus = {
    read: (a) => mem[a & 0xffff]!,
    write: (a, v) => void (mem[a & 0xffff] = v & 0xff),
  };
  function setName(name: string): void {
    const bytes = [...name].map((c) => c.charCodeAt(0));
    bytes.forEach((b, i) => (mem[FN_BUF + i] = b));
    mem[FN_BUF + bytes.length] = 0x0d; // CR-terminated
  }
  /** Stage a filename at FN_BUF, then call OSFIND with X/Y pointing at it. */
  function open(drive: BbcDiskDrive, a: number, name: string) {
    setName(name);
    return drive.open(bus, a, FN_BUF & 0xff, FN_BUF >> 8);
  }
  return { bus, mem, open };
}

function bytes(store: ReturnType<typeof fakeStore>, name: string): number[] {
  return [...(store.files.get(name)?.data ?? [])];
}

describe('BbcDiskDrive', () => {
  it('writes a file: OPENOUT -> BPUT# x2 -> CLOSE# flushes to the store', () => {
    const s = fakeStore();
    const drive = new BbcDiskDrive(s.store);
    const { open } = fakeBus();

    const opened = open(drive, FIND_OPEN_OUTPUT, 'DATA');
    expect(opened.handled).toBe(true);
    const handle = (opened as { a: number }).a;
    expect(handle).toBeGreaterThan(0);

    expect(drive.bput(handle, 0x41)).toEqual({ handled: true, carry: false });
    expect(drive.bput(handle, 0x42)).toEqual({ handled: true, carry: false });
    expect(drive.open(fakeBus().bus, 0x00, 0, handle)).toEqual({
      handled: true,
      carry: false,
    });

    expect(bytes(s, 'DATA')).toEqual([0x41, 0x42]);
    expect(s.files.get('DATA')!.kind).toBe('data');
  });

  it('reads a file back: OPENIN -> BGET# yields bytes then EOF on carry', () => {
    const s = fakeStore();
    s.store.save('DATA', Uint8Array.from([0x41, 0x42]), { kind: 'data' });
    const drive = new BbcDiskDrive(s.store);
    const { open } = fakeBus();

    const opened = open(drive, FIND_OPEN_INPUT, 'DATA');
    const handle = (opened as { a: number }).a;
    expect(handle).toBeGreaterThan(0);

    // The final valid byte returns normally, carry clear (documented MOS
    // convention: carry only set on an actual past-the-end attempt).
    expect(drive.bget(handle)).toEqual({
      handled: true,
      a: 0x41,
      carry: false,
    });
    expect(drive.bget(handle)).toEqual({
      handled: true,
      a: 0x42,
      carry: false,
    });
    expect(drive.bget(handle)).toEqual({ handled: true, a: 0, carry: true });
  });

  it('eof() (OSBYTE &7F, the real implementation behind EOF#) reports status by channel', () => {
    const s = fakeStore();
    s.store.save('DATA', Uint8Array.from([0x41]), { kind: 'data' });
    const drive = new BbcDiskDrive(s.store);
    const { open } = fakeBus();
    const opened = open(drive, FIND_OPEN_INPUT, 'DATA');
    const handle = (opened as { a: number }).a;

    expect(drive.eof(handle)).toEqual({ handled: true, x: 0x00, carry: false });
    drive.bget(handle);
    expect(drive.eof(handle)).toEqual({ handled: true, x: 0xff, carry: false });
    // An unknown channel is not ours to answer for.
    expect(drive.eof(999)).toEqual({ handled: false });
  });

  it('opening a missing file for input returns handle 0, not an error', () => {
    const s = fakeStore();
    const drive = new BbcDiskDrive(s.store);
    const { open } = fakeBus();
    expect(open(drive, FIND_OPEN_INPUT, 'GHOST')).toEqual({
      handled: true,
      a: 0,
      carry: false,
    });
  });

  it('OPENUP seeds the buffer from an existing file, with PTR# starting at 0', () => {
    const s = fakeStore();
    s.store.save('LOG', Uint8Array.from([0x31, 0x32]), { kind: 'data' }); // "12"
    const drive = new BbcDiskDrive(s.store);
    const { open } = fakeBus();
    const opened = open(drive, FIND_OPEN_UPDATE, 'LOG');
    const handle = (opened as { a: number }).a;
    // A BPUT# right after OPENUP overwrites from the start (real DFS random-
    // access semantics — matches OPENOUT's ptr=0 start, unlike an "append" mode).
    drive.bput(handle, 0x39); // "9"
    drive.open(fakeBus().bus, 0x00, 0, handle); // CLOSE#
    expect(bytes(s, 'LOG')).toEqual([0x39, 0x32]);
  });

  it('OPENUP lets a program BGET# back what a previous PRINT#/BPUT# wrote — regression for the empty-INPUT# bug', () => {
    const s = fakeStore();
    const drive = new BbcDiskDrive(s.store);
    const { open } = fakeBus();

    const out = open(drive, FIND_OPEN_OUTPUT, 'DATA') as { a: number };
    for (const b of [0x41, 0x42, 0x43]) drive.bput(out.a, b);
    drive.open(fakeBus().bus, 0x00, 0, out.a); // CLOSE#

    const up = open(drive, FIND_OPEN_UPDATE, 'DATA') as { a: number };
    expect(drive.bget(up.a)).toEqual({ handled: true, a: 0x41, carry: false });
    expect(drive.bget(up.a)).toEqual({ handled: true, a: 0x42, carry: false });
    expect(drive.bget(up.a)).toEqual({ handled: true, a: 0x43, carry: false });
    expect(drive.eof(up.a)).toEqual({ handled: true, x: 0xff, carry: false });
  });

  it('appending after OPENUP requires seeking PTR# to EXT# first', () => {
    const s = fakeStore();
    s.store.save('LOG', Uint8Array.from([0x31]), { kind: 'data' });
    const drive = new BbcDiskDrive(s.store);
    const { bus, mem, open } = fakeBus();
    const opened = open(drive, FIND_OPEN_UPDATE, 'LOG') as { a: number };

    drive.args(bus, ARGS_READ_EXT, ARG_BLOCK, opened.a);
    drive.args(bus, ARGS_WRITE_PTR, ARG_BLOCK, opened.a); // PTR# := EXT#
    expect(mem[ARG_BLOCK]).toBe(1);
    drive.bput(opened.a, 0x32);
    drive.open(fakeBus().bus, 0x00, 0, opened.a);
    expect(bytes(s, 'LOG')).toEqual([0x31, 0x32]);
  });

  it('OPENOUT always starts empty, even over an existing file', () => {
    const s = fakeStore();
    s.store.save('LOG', Uint8Array.from([0x39, 0x39]), { kind: 'data' });
    const drive = new BbcDiskDrive(s.store);
    const { open } = fakeBus();
    const opened = open(drive, FIND_OPEN_OUTPUT, 'LOG');
    const handle = (opened as { a: number }).a;
    drive.bput(handle, 0x41);
    drive.open(fakeBus().bus, 0x00, 0, handle);
    expect(bytes(s, 'LOG')).toEqual([0x41]);
  });

  it('OSARGS round-trips PTR#/EXT# through the zero-page argument block', () => {
    const s = fakeStore();
    const drive = new BbcDiskDrive(s.store);
    const { bus, mem, open } = fakeBus();
    const opened = open(drive, FIND_OPEN_OUTPUT, 'DATA');
    const handle = (opened as { a: number }).a;
    drive.bput(handle, 0x41);
    drive.bput(handle, 0x42);
    drive.bput(handle, 0x43);

    // Read PTR# (should be 3 after three BPUT#s).
    expect(drive.args(bus, ARGS_READ_PTR, ARG_BLOCK, handle)).toEqual({
      handled: true,
      carry: false,
    });
    expect(mem[ARG_BLOCK]).toBe(3);
    expect(mem[ARG_BLOCK + 1]).toBe(0);

    // Read EXT# (file size so far, also 3).
    drive.args(bus, ARGS_READ_EXT, ARG_BLOCK, handle);
    expect(mem[ARG_BLOCK]).toBe(3);

    // Seek PTR# back to 1 and overwrite the second byte.
    mem[ARG_BLOCK] = 1;
    mem[ARG_BLOCK + 1] = 0;
    mem[ARG_BLOCK + 2] = 0;
    mem[ARG_BLOCK + 3] = 0;
    drive.args(bus, ARGS_WRITE_PTR, ARG_BLOCK, handle);
    drive.bput(handle, 0x5a);
    drive.open(fakeBus().bus, 0x00, 0, handle);
    expect(bytes(s, 'DATA')).toEqual([0x41, 0x5a, 0x43]);
  });

  it('OSARGS ensure-written (Y=0) flushes every open channel without closing them', () => {
    const s = fakeStore();
    const drive = new BbcDiskDrive(s.store);
    const { bus, open } = fakeBus();
    const opened = open(drive, FIND_OPEN_OUTPUT, 'DATA');
    const handle = (opened as { a: number }).a;
    drive.bput(handle, 0x41);

    expect(drive.args(bus, ARGS_ENSURE_WRITTEN, 0, 0)).toEqual({
      handled: true,
      carry: false,
    });
    expect(bytes(s, 'DATA')).toEqual([0x41]);
    // Still open — a further write is appended, not lost.
    drive.bput(handle, 0x42);
    drive.open(fakeBus().bus, 0x00, 0, handle);
    expect(bytes(s, 'DATA')).toEqual([0x41, 0x42]);
  });

  it('CLOSE#0 closes every open channel, flushing writes', () => {
    const s = fakeStore();
    const drive = new BbcDiskDrive(s.store);
    const { open } = fakeBus();
    const a = open(drive, FIND_OPEN_OUTPUT, 'A') as { a: number };
    const b = open(drive, FIND_OPEN_OUTPUT, 'B') as { a: number };
    drive.bput(a.a, 0x41);
    drive.bput(b.a, 0x42);

    expect(drive.open(fakeBus().bus, 0x00, 0, 0)).toEqual({
      handled: true,
      carry: false,
    });
    expect(bytes(s, 'A')).toEqual([0x41]);
    expect(bytes(s, 'B')).toEqual([0x42]);
    // Both handles are now invalid.
    expect(drive.bget(a.a)).toEqual({ handled: false });
    expect(drive.bget(b.a)).toEqual({ handled: false });
  });

  it('filename mapping strips drive/directory qualifiers, keeping the leaf name', () => {
    const s = fakeStore();
    const drive = new BbcDiskDrive(s.store);
    const { open } = fakeBus();
    for (const name of [':0.$.DATA', '$.DATA', 'DATA']) {
      const opened = open(drive, FIND_OPEN_OUTPUT, name) as { a: number };
      drive.bput(opened.a, 0x58);
      drive.open(fakeBus().bus, 0x00, 0, opened.a);
    }
    // Each OPENOUT truncates, so only the last write survives — but all
    // three names resolved to the same VFS key, proving the mapping worked.
    expect(s.files.size).toBe(1);
    expect(bytes(s, 'DATA')).toEqual([0x58]);
  });

  it('opening the same name twice for write yields two independent channels', () => {
    const s = fakeStore();
    const drive = new BbcDiskDrive(s.store);
    const { open } = fakeBus();
    const first = open(drive, FIND_OPEN_OUTPUT, 'DATA') as { a: number };
    const second = open(drive, FIND_OPEN_OUTPUT, 'DATA') as { a: number };
    expect(second.a).not.toBe(first.a);
    drive.bput(first.a, 0x31);
    drive.bput(second.a, 0x32);
    drive.open(fakeBus().bus, 0x00, 0, first.a);
    // The later close wins, since both channels target the same VFS key.
    expect(bytes(s, 'DATA')).toEqual([0x31]);
    drive.open(fakeBus().bus, 0x00, 0, second.a);
    expect(bytes(s, 'DATA')).toEqual([0x32]);
  });

  it('closeAll(true) flushes open writes; closeAll(false) discards them', () => {
    const s1 = fakeStore();
    const d1 = new BbcDiskDrive(s1.store);
    const b1 = fakeBus();
    const h1 = b1.open(d1, FIND_OPEN_OUTPUT, 'KEEP') as { a: number };
    d1.bput(h1.a, 0x59);
    d1.closeAll(true);
    expect(s1.files.has('KEEP')).toBe(true);

    const s2 = fakeStore();
    const d2 = new BbcDiskDrive(s2.store);
    const b2 = fakeBus();
    const h2 = b2.open(d2, FIND_OPEN_OUTPUT, 'DROP') as { a: number };
    d2.bput(h2.a, 0x59);
    d2.closeAll(false);
    expect(s2.files.has('DROP')).toBe(false);
  });

  it('reading/writing an unknown channel handle passes through untouched', () => {
    const s = fakeStore();
    const drive = new BbcDiskDrive(s.store);
    const { bus } = fakeBus();
    expect(drive.bget(999)).toEqual({ handled: false });
    expect(drive.bput(999, 0x41)).toEqual({ handled: false });
    expect(drive.args(bus, ARGS_READ_PTR, ARG_BLOCK, 999)).toEqual({
      handled: false,
    });
  });
});
