import { describe, expect, it } from 'vitest';
import type { MachineFileEntry, MachineFileStore } from '../../dialects/types';
import { AtomDiskDrive, type Bus } from './diskDrive';

const OPEN_INPUT = true; // OSFIND entry carry: set = input (FIN)
const OPEN_OUTPUT = false; //                    clear = output (FOUT)

const FN_BUF = 0x0400; // where tests park the filename bytes
const ZP_PTR = 0x0070; // zero-page cell holding the 2-byte pointer to FN_BUF

/** Map-backed MachineFileStore, same shape as bbc/diskDrive.test.ts. */
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
  /**
   * Stage a `#0D`-terminated filename at FN_BUF, point the zero-page cell
   * ZP_PTR at it, then call OSFIND with X = ZP_PTR and the given open mode.
   */
  function open(drive: AtomDiskDrive, carrySet: boolean, name: string) {
    const chars = [...name].map((c) => c.charCodeAt(0));
    chars.forEach((b, i) => (mem[FN_BUF + i] = b));
    mem[FN_BUF + chars.length] = 0x0d; // CR-terminated
    mem[ZP_PTR] = FN_BUF & 0xff;
    mem[ZP_PTR + 1] = FN_BUF >> 8;
    return drive.open(bus, carrySet, ZP_PTR);
  }
  return { bus, open };
}

function bytes(store: ReturnType<typeof fakeStore>, name: string): number[] {
  return [...(store.files.get(name)?.data ?? [])];
}

describe('AtomDiskDrive', () => {
  it('writes a file: FOUT creates it, each BPUT writes through to the store', () => {
    const s = fakeStore();
    const drive = new AtomDiskDrive(s.store);
    const { open } = fakeBus();

    const opened = open(drive, OPEN_OUTPUT, 'DATA');
    expect(opened.handled).toBe(true);
    const handle = (opened as { a: number }).a;
    expect(handle).toBeGreaterThan(0);
    // FOUT truncates up front: the file exists and is empty before any BPUT.
    expect(bytes(s, 'DATA')).toEqual([]);
    expect(s.files.get('DATA')!.kind).toBe('data');

    // There is no SHUT on the tape ROM, so each BPUT must be visible in the
    // store immediately.
    expect(drive.bput(handle, 0x41)).toEqual({ handled: true, carry: false });
    expect(bytes(s, 'DATA')).toEqual([0x41]);
    expect(drive.bput(handle, 0x42)).toEqual({ handled: true, carry: false });
    expect(bytes(s, 'DATA')).toEqual([0x41, 0x42]);
  });

  it('reads a file back: FIN -> BGET yields bytes then EOF on carry', () => {
    const s = fakeStore();
    s.store.save('DATA', Uint8Array.from([0x41, 0x42]), { kind: 'data' });
    const drive = new AtomDiskDrive(s.store);
    const { open } = fakeBus();

    const opened = open(drive, OPEN_INPUT, 'DATA');
    const handle = (opened as { a: number }).a;
    expect(handle).toBeGreaterThan(0);

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
    // Past the end: carry set signals EOF.
    expect(drive.bget(handle)).toEqual({ handled: true, a: 0, carry: true });
  });

  it('FIN on a missing file returns handle 0 (BASIC sees the file absent)', () => {
    const s = fakeStore();
    const drive = new AtomDiskDrive(s.store);
    const { open } = fakeBus();

    expect(open(drive, OPEN_INPUT, 'NOPE')).toEqual({
      handled: true,
      a: 0,
      carry: false,
    });
  });

  it('FOUT truncates an existing file up front', () => {
    const s = fakeStore();
    s.store.save('DATA', Uint8Array.from([0x99, 0x99, 0x99]), { kind: 'data' });
    const drive = new AtomDiskDrive(s.store);
    const { open } = fakeBus();

    const handle = (open(drive, OPEN_OUTPUT, 'DATA') as { a: number }).a;
    expect(bytes(s, 'DATA')).toEqual([]); // truncated by the open, before any BPUT
    drive.bput(handle, 0x01);
    expect(bytes(s, 'DATA')).toEqual([0x01]);
  });

  it('gives distinct handles to concurrently open files', () => {
    const s = fakeStore();
    const drive = new AtomDiskDrive(s.store);
    const { open } = fakeBus();

    const a = (open(drive, OPEN_OUTPUT, 'ONE') as { a: number }).a;
    const b = (open(drive, OPEN_OUTPUT, 'TWO') as { a: number }).a;
    expect(a).not.toBe(b);
  });

  it('closeAll() forgets handles (reset/reload path); writes already persisted', () => {
    const s = fakeStore();
    const drive = new AtomDiskDrive(s.store);
    const { open } = fakeBus();

    const handle = (open(drive, OPEN_OUTPUT, 'DATA') as { a: number }).a;
    drive.bput(handle, 0x41);
    // The byte is already in the store (write-through); closeAll just drops the
    // handle so a later BPUT/BGET on it is no longer ours.
    expect(bytes(s, 'DATA')).toEqual([0x41]);
    drive.closeAll();
    expect(drive.bget(handle)).toEqual({ handled: false });
    expect(drive.bput(handle, 0x42)).toEqual({ handled: false });
  });

  it('operations on an unknown handle are not ours', () => {
    const s = fakeStore();
    const drive = new AtomDiskDrive(s.store);
    expect(drive.bget(9)).toEqual({ handled: false });
    expect(drive.bput(9, 0)).toEqual({ handled: false });
  });
});
