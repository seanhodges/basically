import { describe, expect, it } from 'vitest';
import { BadLineClock, CYCLES_PER_BAD_LINE } from './badLines';

const CYCLES_PER_LINE = 63;
const LINES_PER_FRAME = 312;

/**
 * A stand-in for the VIC-II's register read, answering $D011/$D012 from a raster
 * line the harness advances itself. The real chip is driven by the same cycle
 * loop as the clock; here the harness plays that part so the rule can be tested
 * without booting a machine.
 */
function fakeVic(opts: { yscroll?: number; displayEnabled?: boolean } = {}) {
  const yscroll = opts.yscroll ?? 3;
  const displayEnabled = opts.displayEnabled ?? true;
  let raster = 0;
  return {
    setRaster: (line: number) => {
      raster = line;
    },
    read: (address: number): number => {
      if (address === 0xd012) return raster & 0xff;
      if (address === 0xd011) {
        return (
          ((raster & 0x100) >> 1) | (displayEnabled ? 0x10 : 0) | (yscroll & 7)
        );
      }
      throw new Error(`unexpected VIC register read: $${address.toString(16)}`);
    },
  };
}

/** Run a whole frame, returning the cycles stalled on each raster line. */
function stallsPerLine(
  opts: { yscroll?: number; displayEnabled?: boolean } = {},
): number[] {
  const vic = fakeVic(opts);
  const clock = new BadLineClock();
  const perLine: number[] = [];
  for (let line = 0; line < LINES_PER_FRAME; line++) {
    vic.setRaster(line);
    let stalled = 0;
    for (let cycle = 0; cycle < CYCLES_PER_LINE; cycle++) {
      if (clock.tick(vic.read)) stalled++;
    }
    perLine.push(stalled);
  }
  return perLine;
}

describe('the VIC-II taking the bus on bad lines', () => {
  it('takes a thousand cycles from the CPU in a frame', () => {
    const perLine = stallsPerLine();
    const bad = perLine.filter((cycles) => cycles > 0);
    expect(bad).toHaveLength(25);
    expect(perLine.reduce((a, b) => a + b, 0)).toBe(1000);
  });

  it('takes forty contiguous cycles, over the character fetch', () => {
    const vic = fakeVic({ yscroll: 3 });
    const clock = new BadLineClock();
    // Reach line 51, the first bad line at the default scroll, from a cold
    // start: the clock only latches display-enable when it sees line 48.
    for (let line = 0; line <= 50; line++) {
      vic.setRaster(line);
      for (let cycle = 0; cycle < CYCLES_PER_LINE; cycle++)
        clock.tick(vic.read);
    }
    vic.setRaster(51);
    const stunned: number[] = [];
    for (let cycle = 0; cycle < CYCLES_PER_LINE; cycle++) {
      if (clock.tick(vic.read)) stunned.push(cycle);
    }
    expect(stunned).toHaveLength(CYCLES_PER_BAD_LINE);
    expect(stunned[0]).toBe(15);
    expect(stunned.at(-1)).toBe(54);
    // Contiguous: no gap anywhere in the window.
    expect(stunned).toEqual(
      Array.from({ length: CYCLES_PER_BAD_LINE }, (_, i) => 15 + i),
    );
  });

  it('is on every eighth line of the display window', () => {
    const lines = stallsPerLine({ yscroll: 3 })
      .map((cycles, line) => (cycles > 0 ? line : -1))
      .filter((line) => line >= 0);
    expect(lines[0]).toBe(51);
    expect(lines.at(-1)).toBe(243);
    expect(lines.every((line) => (line - 3) % 8 === 0)).toBe(true);
  });

  it('moves with the vertical scroll register', () => {
    const firstFor = (yscroll: number) =>
      stallsPerLine({ yscroll }).findIndex((cycles) => cycles > 0);
    // $30 is the first line that can be bad, so scroll 0 starts there and each
    // step moves the whole set one line down.
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(firstFor)).toEqual([
      48, 49, 50, 51, 52, 53, 54, 55,
    ]);
    for (let yscroll = 0; yscroll < 8; yscroll++) {
      expect(
        stallsPerLine({ yscroll }).filter((cycles) => cycles > 0),
      ).toHaveLength(25);
    }
  });

  it('includes the first and last lines the chip fetches on', () => {
    // Scroll 0 puts a bad line exactly on $30, scroll 7 exactly on $F7.
    expect(stallsPerLine({ yscroll: 0 })[0x30]).toBe(CYCLES_PER_BAD_LINE);
    expect(stallsPerLine({ yscroll: 7 })[0xf7]).toBe(CYCLES_PER_BAD_LINE);
    // And nothing outside the window, at any scroll.
    for (let yscroll = 0; yscroll < 8; yscroll++) {
      const perLine = stallsPerLine({ yscroll });
      const outside = perLine.filter(
        (cycles, line) => (line < 0x30 || line > 0xf7) && cycles > 0,
      );
      expect(outside).toEqual([]);
    }
  });

  it('takes nothing while the display is disabled', () => {
    const perLine = stallsPerLine({ displayEnabled: false });
    expect(perLine.reduce((a, b) => a + b, 0)).toBe(0);
  });

  it('counts what it took, and forgets it on reset', () => {
    const vic = fakeVic();
    const clock = new BadLineClock();
    for (let line = 0; line < LINES_PER_FRAME; line++) {
      vic.setRaster(line);
      for (let cycle = 0; cycle < CYCLES_PER_LINE; cycle++)
        clock.tick(vic.read);
    }
    expect(clock.stalledCycles).toBe(1000);
    clock.reset();
    expect(clock.stalledCycles).toBe(0);
  });
});
