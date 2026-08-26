import { describe, expect, it } from 'vitest';
import {
  CONTENTION_PATTERN,
  ContentionClock,
  ULA_128K,
  ULA_48K,
  contended48K,
  memoryDelay,
  type UlaTiming,
} from './ulaContention';

/** Every T-state of the contended window of display line `line`. */
function windowOf(timing: UlaTiming, line: number): number[] {
  const start = timing.firstContendedT + line * timing.tstatesPerLine;
  return Array.from({ length: timing.contendedTPerLine }, (_, i) => start + i);
}

describe.each([
  ['48K', ULA_48K],
  ['128K', ULA_128K],
])('%s ULA contention', (_name, timing) => {
  it('repeats the delay pattern every eight T-states from the first contended cycle', () => {
    for (let block = 0; block < 16; block++) {
      const base = timing.firstContendedT + block * 8;
      const delays = CONTENTION_PATTERN.map((_, i) =>
        memoryDelay(timing, base + i),
      );
      expect(delays).toEqual([...CONTENTION_PATTERN]);
    }
  });

  it('contends only the fetched part of a display line', () => {
    const start = timing.firstContendedT;
    expect(memoryDelay(timing, start + timing.contendedTPerLine - 1)).toBe(0); // pattern's last slot
    expect(memoryDelay(timing, start + timing.contendedTPerLine - 2)).toBe(0);
    expect(memoryDelay(timing, start + timing.contendedTPerLine - 3)).toBe(1);
    // The border to the right of the line, then the next line's first fetch.
    for (
      let t = start + timing.contendedTPerLine;
      t < start + timing.tstatesPerLine;
      t++
    )
      expect(memoryDelay(timing, t)).toBe(0);
    expect(memoryDelay(timing, start + timing.tstatesPerLine)).toBe(6);
  });

  it('leaves the top border and everything past the last display line free', () => {
    expect(memoryDelay(timing, 0)).toBe(0);
    expect(memoryDelay(timing, timing.firstContendedT - 1)).toBe(0);
    const afterDisplay =
      timing.firstContendedT + timing.displayLines * timing.tstatesPerLine;
    expect(memoryDelay(timing, afterDisplay)).toBe(0);
    expect(memoryDelay(timing, afterDisplay + 1000)).toBe(0);
  });

  /**
   * The property the whole fix rests on: a contended access begun anywhere in
   * an eight-T block finishes its stall at offset 6 or 7 of that block. Raster
   * code touching contended memory once a line is therefore phase-locked to the
   * ULA and cannot drift. If this ever fails, coloured bands start beating
   * against the display again.
   */
  it('quantises every contended access onto the eight-T grid', () => {
    for (const line of [0, 1, 95, timing.displayLines - 1]) {
      const lineStart = timing.firstContendedT + line * timing.tstatesPerLine;
      for (const t of windowOf(timing, line)) {
        const landing = (t + memoryDelay(timing, t) - lineStart) % 8;
        expect([6, 7]).toContain(landing);
      }
    }
  });

  it('contends 128 T-states on each of the 192 display lines', () => {
    let contended = 0;
    const frameEnd =
      timing.firstContendedT + timing.displayLines * timing.tstatesPerLine;
    for (let t = 0; t < frameEnd; t++)
      if (memoryDelay(timing, t) > 0) contended++;
    // Six of every eight slots carry a delay; the last two are free.
    expect(contended).toBe(
      (timing.contendedTPerLine * 6 * timing.displayLines) / 8,
    );
  });
});

describe('display origin', () => {
  // The machines' DISPLAY_START_T is derived from these, so the contention
  // window and the scanline the renderer draws share one clock.
  it('sits one T-state after the ULA takes the bus', () => {
    expect(ULA_48K.firstContendedT + 1).toBe(14336);
    expect(ULA_128K.firstContendedT + 1).toBe(14362);
  });
});

describe('contended48K', () => {
  it('covers only the 16K RAM bank the ULA shares', () => {
    expect(contended48K(0x0000)).toBe(false); // ROM
    expect(contended48K(0x3fff)).toBe(false);
    expect(contended48K(0x4000)).toBe(true); // screen bitmap
    expect(contended48K(0x5800)).toBe(true); // attributes
    expect(contended48K(0x7fff)).toBe(true);
    expect(contended48K(0x8000)).toBe(false); // uncontended RAM
    expect(contended48K(0xffff)).toBe(false);
  });
});

describe('ContentionClock', () => {
  /** A clock parked mid-line, at a known offset within an eight-T block. */
  function atOffset(offset: number): ContentionClock {
    const clock = new ContentionClock(ULA_48K, contended48K);
    clock.at(ULA_48K.firstContendedT + offset);
    return clock;
  }

  it('charges an uncontended access nothing', () => {
    const clock = atOffset(0);
    clock.memory(0x8000);
    clock.opcode(0xc000);
    expect(clock.take()).toBe(0);
  });

  it('charges a contended access the delay for where it believes the CPU is', () => {
    const clock = atOffset(0);
    clock.memory(0x4000);
    expect(clock.take()).toBe(6);
  });

  it('advances a believed M-cycle per access, so two accesses land in different slots', () => {
    const clock = atOffset(0);
    clock.opcode(0x4000); // stalls 6, then 4 T -> offset 10, i.e. slot 2
    clock.memory(0x4000); // stalls 4
    expect(clock.take()).toBe(10);
  });

  it('accumulates across takes and reports the running total', () => {
    const clock = atOffset(0);
    clock.memory(0x4000);
    expect(clock.take()).toBe(6);
    expect(clock.take()).toBe(0); // taking clears what is owed
    clock.at(ULA_48K.firstContendedT);
    clock.memory(0x4000);
    expect(clock.contendedTStates).toBe(12);
    clock.reset();
    expect(clock.contendedTStates).toBe(0);
  });

  it('repositioning keeps delay already owed', () => {
    // The interrupt acknowledgement pushes the return address before the
    // frame's first instruction runs; that push must not be forgotten.
    const clock = atOffset(0);
    clock.memory(0x4000);
    clock.at(ULA_48K.firstContendedT + 64);
    expect(clock.take()).toBe(6);
  });

  /**
   * The four I/O shapes, each walked by hand from a clock parked at offset 0 of
   * an eight-T block (where the delay pattern reads 6,5,4,3,2,1,0,0).
   */
  it.each([
    // C:1 C:3 - stall 6 to offset 6, +1 to 7, stall 0, +3.
    ['contended address, ULA port', 0x40fe, 6],
    // C:1 C:1 C:1 C:1 - stalls of 6, 0, 6, 0 as the position walks 0,7,8,15.
    ['contended address, non-ULA port', 0x40ff, 12],
    // N:1 C:3 - +1 to offset 1, then stall 5.
    ['uncontended address, ULA port', 0x00fe, 5],
    // N:4 - the ULA never sees it and the bus is never shared.
    ['uncontended address, non-ULA port', 0x001f, 0],
  ])('charges an I/O cycle on a %s', (_shape, port, expected) => {
    const clock = atOffset(0);
    clock.io(port);
    expect(clock.take()).toBe(expected);
  });
});
