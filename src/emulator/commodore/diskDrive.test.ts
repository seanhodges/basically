import { describe, expect, it } from 'vitest';
import type { MachineFileEntry, MachineFileStore } from '../../dialects/types';
import { CbmDiskDrive, type Bus } from './diskDrive';
import {
  KERNAL_IO_BASIC_4,
  KERNAL_IO_V2,
  type CbmKernalIo,
} from './basicPointers';

// The cells the cases below read back, taken from the layout itself rather than
// restated: a mirrored copy would keep passing after the drive was pointed
// somewhere else. The cells a call is staged in are reached through the layout
// `fakeBus` is given.
const { status: STATUS, dfltn: DFLTN, dflto: DFLTO } = KERNAL_IO_V2;

const FN_BUF = 0x0200; // where tests park the filename bytes

/** Map-backed MachineFileStore, same shape as seqfiles.test.ts. */
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

/**
 * A flat 64K memory as the Bus, with helpers to stage a KERNAL call. Takes the
 * layout so a case can stage the call at one ROM's addresses and watch the
 * drive answer at those, and only those.
 */
function fakeBus(zp: CbmKernalIo = KERNAL_IO_V2) {
  const mem = new Uint8Array(0x10000);
  const bus: Bus = {
    read: (a) => mem[a & 0xffff]!,
    write: (a, v) => void (mem[a & 0xffff] = v & 0xff),
  };
  function setName(name: string): void {
    const bytes = [...name].map((c) => c.charCodeAt(0));
    mem[zp.fnlen] = bytes.length;
    mem[zp.fnadr] = FN_BUF & 0xff;
    mem[zp.fnadr + 1] = FN_BUF >> 8;
    bytes.forEach((b, i) => (mem[FN_BUF + i] = b));
  }
  /** Stage the cells OPEN reads (SETLFS+SETNAM on a V2 machine), then call it. */
  function open(
    drive: CbmDiskDrive,
    lf: number,
    device: number,
    secondary: number,
    name: string,
  ) {
    mem[zp.la] = lf;
    mem[zp.fa] = device;
    mem[zp.sa] = secondary;
    setName(name);
    return drive.open(bus);
  }
  return { bus, mem, open };
}

function bytes(store: ReturnType<typeof fakeStore>, name: string): number[] {
  return [...(store.files.get(name)?.data ?? [])];
}

describe('CbmDiskDrive', () => {
  it('writes a file: OPEN,S,W → CHKOUT → CHROUT → CLOSE flushes to the store', () => {
    const s = fakeStore();
    const drive = new CbmDiskDrive(s.store, KERNAL_IO_V2);
    const { bus, mem, open } = fakeBus();

    expect(open(drive, 2, 8, 2, 'DATA,S,W')).toEqual({
      handled: true,
      carry: 0,
    });
    expect(drive.chkout(2, bus)).toEqual({ handled: true, carry: 0 });
    expect(mem[DFLTO]).toBe(8);
    for (const b of [0x48, 0x49]) drive.chrout(b, bus); // "HI"
    drive.chrout(0x0d, bus); // CR
    expect(drive.close(2, bus)).toEqual({ handled: true, carry: 0 });

    expect(bytes(s, 'DATA')).toEqual([0x48, 0x49, 0x0d]);
    expect(s.files.get('DATA')!.kind).toBe('data');
  });

  it('reads a file back: OPEN,S,R → CHKIN → CHRIN yields bytes then EOF', () => {
    const s = fakeStore();
    s.store.save('DATA', Uint8Array.from([0x41, 0x42]), { kind: 'data' });
    const drive = new CbmDiskDrive(s.store, KERNAL_IO_V2);
    const { bus, mem, open } = fakeBus();

    open(drive, 2, 8, 2, 'DATA,S,R');
    expect(drive.chkin(2, bus)).toEqual({ handled: true, carry: 0 });
    expect(mem[DFLTN]).toBe(8);

    expect(drive.chrin(bus)).toEqual({ handled: true, a: 0x41, carry: 0 });
    expect(mem[STATUS]).toBe(0); // not EOF yet
    expect(drive.chrin(bus)).toEqual({ handled: true, a: 0x42, carry: 0 });
    expect(mem[STATUS]).toBe(0x40); // EOF flagged with the final byte
    // Reading past the end yields 0 and keeps EOF set.
    expect(drive.chrin(bus)).toEqual({ handled: true, a: 0, carry: 0 });
    expect(mem[STATUS]).toBe(0x40);
  });

  it('round-trips a full write then read of the same store', () => {
    const s = fakeStore();
    const drive = new CbmDiskDrive(s.store, KERNAL_IO_V2);
    const { bus, open } = fakeBus();
    open(drive, 1, 8, 2, 'MSG,S,W');
    drive.chkout(1, bus);
    for (const b of [0x4f, 0x4b, 0x0d]) drive.chrout(b, bus); // "OK\r"
    drive.close(1, bus);

    open(drive, 1, 9, 3, 'MSG,S,R'); // a different unit shares the namespace
    drive.chkin(1, bus);
    const out: number[] = [];
    for (let i = 0; i < 3; i++) {
      const r = drive.chrin(bus);
      if (r.handled) out.push(r.a!);
    }
    expect(out).toEqual([0x4f, 0x4b, 0x0d]);
  });

  it('passes non-disk devices (screen/keyboard/tape) through untouched', () => {
    const s = fakeStore();
    const drive = new CbmDiskDrive(s.store, KERNAL_IO_V2);
    const { bus, open } = fakeBus();
    // Tape (device 1) OPEN is not ours.
    expect(open(drive, 1, 1, 0, 'X')).toEqual({ handled: false });
    // CHROUT/CHRIN with the default screen/keyboard devices pass through.
    bus.write(DFLTO, 3);
    expect(drive.chrout(0x41, bus)).toEqual({ handled: false });
    bus.write(DFLTN, 0);
    expect(drive.chrin(bus)).toEqual({ handled: false });
  });

  it('reports wrong-direction CHKIN/CHKOUT with carry set', () => {
    const s = fakeStore();
    s.store.save('R', Uint8Array.from([1]), { kind: 'data' });
    const drive = new CbmDiskDrive(s.store, KERNAL_IO_V2);
    const { bus, open } = fakeBus();

    open(drive, 2, 8, 2, 'W,S,W');
    expect(drive.chkin(2, bus)).toEqual({ handled: true, a: 6, carry: 1 });
    open(drive, 3, 8, 3, 'R,S,R');
    expect(drive.chkout(3, bus)).toEqual({ handled: true, a: 7, carry: 1 });
  });

  it('rejects a re-opened logical file with KERNAL error 2', () => {
    const s = fakeStore();
    const drive = new CbmDiskDrive(s.store, KERNAL_IO_V2);
    const { open } = fakeBus();
    expect(open(drive, 2, 8, 2, 'A,S,W')).toEqual({ handled: true, carry: 0 });
    expect(open(drive, 2, 8, 2, 'B,S,W')).toEqual({
      handled: true,
      a: 2,
      carry: 1,
    });
  });

  it('opens a missing file for read and hits EOF immediately', () => {
    const s = fakeStore();
    const drive = new CbmDiskDrive(s.store, KERNAL_IO_V2);
    const { bus, mem, open } = fakeBus();
    expect(open(drive, 2, 8, 2, 'GHOST,S,R')).toEqual({
      handled: true,
      carry: 0,
    });
    drive.chkin(2, bus);
    expect(drive.chrin(bus)).toEqual({ handled: true, a: 0, carry: 0 });
    expect(mem[STATUS]).toBe(0x40);
  });

  it('CLRCHN restores default channels only while a channel is current', () => {
    const s = fakeStore();
    const drive = new CbmDiskDrive(s.store, KERNAL_IO_V2);
    const { bus, mem, open } = fakeBus();
    // No current channel → not handled (real CLRCHN runs).
    expect(drive.clrchn(bus)).toEqual({ handled: false });

    open(drive, 2, 8, 2, 'D,S,W');
    drive.chkout(2, bus);
    expect(mem[DFLTO]).toBe(8);
    expect(drive.clrchn(bus)).toEqual({ handled: true, carry: 0 });
    expect(mem[DFLTN]).toBe(0);
    expect(mem[DFLTO]).toBe(3);
    // The channel stays open across CLRCHN; CHKOUT can re-select it.
    expect(drive.chkout(2, bus)).toEqual({ handled: true, carry: 0 });
  });

  it('append mode ("A") seeds the buffer with the existing file', () => {
    const s = fakeStore();
    s.store.save('LOG', Uint8Array.from([0x31]), { kind: 'data' }); // "1"
    const drive = new CbmDiskDrive(s.store, KERNAL_IO_V2);
    const { bus, open } = fakeBus();
    open(drive, 2, 8, 2, 'LOG,S,A');
    drive.chkout(2, bus);
    drive.chrout(0x32, bus); // "2"
    drive.close(2, bus);
    expect(bytes(s, 'LOG')).toEqual([0x31, 0x32]);
  });

  it('strips an "@" overwrite flag and a drive prefix from the name', () => {
    const s = fakeStore();
    const drive = new CbmDiskDrive(s.store, KERNAL_IO_V2);
    const { bus, open } = fakeBus();
    open(drive, 2, 8, 2, '@0:SAVE,S,W');
    drive.chkout(2, bus);
    drive.chrout(0x58, bus);
    drive.close(2, bus);
    expect(s.files.has('SAVE')).toBe(true);
  });

  it('closeAll(true) flushes open writes; closeAll(false) discards them', () => {
    const s1 = fakeStore();
    const d1 = new CbmDiskDrive(s1.store, KERNAL_IO_V2);
    const b1 = fakeBus();
    b1.open(d1, 2, 8, 2, 'KEEP,S,W');
    d1.chkout(2, b1.bus);
    d1.chrout(0x59, b1.bus);
    d1.closeAll(true);
    expect(s1.files.has('KEEP')).toBe(true);

    const s2 = fakeStore();
    const d2 = new CbmDiskDrive(s2.store, KERNAL_IO_V2);
    const b2 = fakeBus();
    b2.open(d2, 2, 8, 2, 'DROP,S,W');
    d2.chkout(2, b2.bus);
    d2.chrout(0x59, b2.bus);
    d2.closeAll(false);
    expect(s2.files.has('DROP')).toBe(false);
  });

  // Every cell moved between BASIC V2 and BASIC 4.0, so a drive still reading
  // the V2 addresses would find a device number of zero and pass the call
  // through - which looks, from the store, exactly like a machine with no
  // traps at all. Asserting the V2 cells stay untouched is what separates
  // "reads the layout it was given" from "happens to read something".
  it('answers through the layout it was given, and not the other one', () => {
    const s = fakeStore();
    const drive = new CbmDiskDrive(s.store, KERNAL_IO_BASIC_4);
    const { bus, mem, open } = fakeBus(KERNAL_IO_BASIC_4);

    expect(open(drive, 2, 8, 2, 'DATA,S,W')).toEqual({
      handled: true,
      carry: 0,
    });
    drive.chkout(2, bus);
    expect(mem[KERNAL_IO_BASIC_4.dflto]).toBe(8);
    expect(mem[KERNAL_IO_V2.dflto]).toBe(0);
    for (const b of [0x48, 0x49]) drive.chrout(b, bus);
    drive.close(2, bus);
    expect(bytes(s, 'DATA')).toEqual([0x48, 0x49]);

    open(drive, 3, 8, 2, 'DATA,S,R');
    drive.chkin(3, bus);
    expect(mem[KERNAL_IO_BASIC_4.dfltn]).toBe(8);
    expect(mem[KERNAL_IO_V2.dfltn]).toBe(0);
    expect(drive.chrin(bus)).toEqual({ handled: true, a: 0x48, carry: 0 });
    expect(drive.chrin(bus)).toEqual({ handled: true, a: 0x49, carry: 0 });
    expect(mem[KERNAL_IO_BASIC_4.status]).toBe(0x40);
    expect(mem[KERNAL_IO_V2.status]).toBe(0);
  });
});
