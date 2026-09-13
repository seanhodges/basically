import { describe, expect, it } from 'vitest';
import {
  ADDRESSES_PER_CELL,
  createActivityTap,
  SAMPLE_EVERY_FRAMES,
  type ActivitySink,
  type MapActivity,
} from './activityTap';
import {
  MemoryActivityBuffer,
  READ_BIT,
  WRITE_BIT,
} from '../../emulator/memoryActivityBuffer';

/**
 * Sampling what a run touches, without the machine.
 *
 * The tap is handed a recorder, a drain and an encoder, so what it does with
 * them is testable from nothing: no boot, no ROM and no frames. What a real
 * machine's buffer does under it is pinned beside that buffer, and that no
 * machine's measurements move for being mapped is pinned where the machine is.
 */

function recordingSink(
  free = () => true,
  watching = () => true,
): ActivitySink & { sent: MapActivity[] } {
  const sent: MapActivity[] = [];
  return { sent, watching, free, send: (a) => sent.push(a) };
}

/** A machine's side of the seam, over the buffer every machine with one owns. */
function stubMachine(size = 256) {
  const buffer = new MemoryActivityBuffer(size);
  const counts = { armed: 0, disarmed: 0, drained: 0 };
  return {
    buffer,
    counts,
    addressSpace: size,
    record: (enabled: boolean) => {
      if (enabled) counts.armed++;
      else counts.disarmed++;
      buffer.enabled = enabled;
      if (!enabled) buffer.clear();
    },
    drain: (recycle?: Uint8Array | null) =>
      buffer.enabled ? (counts.drained++, buffer.drain(recycle)) : null,
    /** What the machine does on its hot path, when it is recording. */
    touch: (address: number, bits: number) => {
      if (buffer.enabled) buffer.hits[address]! |= bits;
    },
  };
}

/** The cells as the tap reduced them, before whatever the encoder does. */
function cellsOf(sink: { sent: MapActivity[] }): Uint8Array[] {
  return sink.sent.map((a) => a.cells);
}

/** An encoder that keeps the cells as they are, so a test can read them. */
function plainEncoder() {
  return (cells: Uint8Array, addressesPerCell: number): MapActivity => ({
    addressesPerCell,
    cells: Uint8Array.from(cells),
  });
}

describe('sampling what a run touches', () => {
  it('records nothing while nobody is watching', () => {
    const machine = stubMachine();
    const sink = recordingSink(
      () => true,
      () => false,
    );
    const tap = createActivityTap({
      sink,
      ...machine,
      encode: plainEncoder(),
    });
    for (let i = 0; i < 20; i++) tap.frame();
    expect(machine.counts.armed).toBe(0);
    expect(machine.buffer.enabled).toBe(false);
    expect(sink.sent).toEqual([]);
  });

  it('arms the machine once something is watching, and disarms when it stops', () => {
    const machine = stubMachine();
    let watching = false;
    const sink = recordingSink(
      () => true,
      () => watching,
    );
    const tap = createActivityTap({
      sink,
      ...machine,
      encode: plainEncoder(),
    });
    tap.frame();
    expect(machine.buffer.enabled).toBe(false);
    watching = true;
    tap.frame();
    expect(machine.buffer.enabled).toBe(true);
    expect(machine.counts.armed).toBe(1);
    watching = false;
    tap.frame();
    expect(machine.buffer.enabled).toBe(false);
    expect(machine.counts.disarmed).toBe(1);
  });

  it('reduces a drain to cells, keeping reads apart from writes', () => {
    const machine = stubMachine(64);
    const sink = recordingSink();
    const tap = createActivityTap({
      sink,
      ...machine,
      cellSize: 16,
      encode: plainEncoder(),
    });
    // Arm, then touch, then sample: the first frame arms and drains an empty
    // buffer, which is the machine reporting that it has touched nothing yet.
    tap.frame();
    machine.touch(3, READ_BIT);
    machine.touch(20, WRITE_BIT);
    machine.touch(21, READ_BIT);
    tap.settle();
    const cells = cellsOf(sink).at(-1)!;
    expect(cells.length).toBe(4);
    expect([...cells]).toEqual([READ_BIT, READ_BIT | WRITE_BIT, 0, 0]);
  });

  it('sixteen addresses to a cell, so a 64K machine reduces to four thousand', () => {
    // Fine enough that no column a map is drawn in can distinguish anything
    // the reduction throws away, and small enough to cross a thread per frame.
    expect(ADDRESSES_PER_CELL).toBe(16);
    expect(Math.ceil(0x10000 / ADDRESSES_PER_CELL)).toBe(4096);
  });

  it('takes the first frame and then every Nth', () => {
    const machine = stubMachine();
    const sink = recordingSink();
    const tap = createActivityTap({
      sink,
      ...machine,
      every: 4,
      encode: plainEncoder(),
    });
    for (let i = 0; i < 12; i++) tap.frame();
    expect(sink.sent.length).toBe(3);
    expect(machine.counts.drained).toBe(3);
  });

  it('samples ten times a second of machine time by default', () => {
    expect(SAMPLE_EVERY_FRAMES).toBe(5);
  });

  it("a skipped sample's addresses turn up in the next one", () => {
    // The property that makes this tap simpler than the display's: a drain
    // that does not happen widens the next drain's window rather than losing
    // anything, so nothing a program touched is ever missed.
    const machine = stubMachine(64);
    let free = true;
    const sink = recordingSink(() => free);
    const tap = createActivityTap({
      sink,
      ...machine,
      every: 1,
      cellSize: 16,
      encode: plainEncoder(),
    });
    tap.frame();
    free = false;
    machine.touch(3, READ_BIT);
    tap.frame();
    expect(sink.sent.length).toBe(1);
    free = true;
    machine.touch(40, WRITE_BIT);
    tap.frame();
    const cells = cellsOf(sink).at(-1)!;
    expect([...cells]).toEqual([READ_BIT, 0, WRITE_BIT, 0]);
  });

  it('hands the drained buffer back as the next fill target', () => {
    const machine = stubMachine(64);
    const sink = recordingSink();
    const seen: (Uint8Array | null | undefined)[] = [];
    const tap = createActivityTap({
      sink,
      ...machine,
      every: 1,
      drain: (recycle) => {
        seen.push(recycle);
        return machine.drain(recycle);
      },
      encode: plainEncoder(),
    });
    tap.frame();
    tap.frame();
    tap.frame();
    // Nothing to recycle on the first drain; a buffer on every one after it,
    // and never the one the machine is filling now.
    expect(seen[0]).toBeNull();
    expect(seen[1]).toBeInstanceOf(Uint8Array);
    expect(seen[2]).toBeInstanceOf(Uint8Array);
    expect(seen[1]).not.toBe(seen[2]);
  });

  it('accumulates what it cost, so a mapped run can subtract it', () => {
    const machine = stubMachine();
    const sink = recordingSink();
    const tap = createActivityTap({
      sink,
      ...machine,
      every: 1,
      encode: plainEncoder(),
    });
    expect(tap.costMs).toBe(0);
    for (let i = 0; i < 5; i++) tap.frame();
    expect(tap.costMs).toBeGreaterThan(0);
  });

  it('reports a machine that cannot tap its bus as one', () => {
    const sink = recordingSink();
    const tap = createActivityTap({
      sink,
      addressSpace: 256,
      encode: plainEncoder(),
    });
    expect(tap.taps).toBe(false);
    tap.frame();
    tap.settle();
    // Not an empty picture: nothing is sent at all, and the map says which of
    // the two it is looking at from `taps` rather than from silence.
    expect(sink.sent).toEqual([]);
  });

  it('skips a sample the encoder says is the last one over again', () => {
    const machine = stubMachine(64);
    const sink = recordingSink();
    let calls = 0;
    const tap = createActivityTap({
      sink,
      ...machine,
      every: 1,
      encode: (cells, addressesPerCell) =>
        calls++ % 2 === 0
          ? { addressesPerCell, cells: Uint8Array.from(cells) }
          : null,
    });
    for (let i = 0; i < 4; i++) tap.frame();
    expect(sink.sent.length).toBe(2);
  });
});
