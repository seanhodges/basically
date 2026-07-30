/**
 * Cross-dialect invariants for the memory-map viewer's region tables and the
 * block linter's ranges, checked against every registered dialect rather than
 * per machine.
 *
 * This file imports only the registry on purpose: it walks whatever
 * `src/dialects/registry.ts` exports, so a dialect added later inherits these
 * checks without anyone remembering to wire them up. Assertions that need a
 * machine-specific constant (a screen base from an emulator module, a sysvar
 * symbol) belong in that dialect's own `memoryMap.test.ts` - putting them here
 * would give this file a hand-maintained per-machine import list and lose the
 * property that makes it useful.
 *
 * Two things are deliberately NOT asserted, because both are false today for
 * good reasons:
 *
 *  - "reserved ranges avoid the program region" - the BBC Micro reserves
 *    0x3000-0x7FFF, overlapping its own program area, because the MODE 0-2
 *    screen floor reaches down there and a static linter cannot know the MODE.
 *  - "valid ranges avoid ROM regions" - the C64 validates blocks across both
 *    ROM regions, because they are RAM underneath and a block can bank them in.
 */
import { describe, it, expect } from 'vitest';
import { dialects } from './registry';
import type { Dialect } from './types';

const mapped = dialects.filter((d) => d.memoryMap);
const blocked = dialects.filter((d) => d.memoryBlocks);

/**
 * Machines whose BASIC text pointer sits one byte above the start of the map's
 * program region. The Commodore ROMs store a zero link byte at the foot of BASIC
 * RAM and begin the first line record after it, so the region legitimately
 * starts one byte below TXTTAB. Any other dialect must match exactly.
 */
const LINK_BYTE_OFFSET: Record<string, number> = {
  commodore64: 1,
  pet: 1,
  vic20: 1,
};

/**
 * Where the dialect says its BASIC program begins. `programArea()` is documented
 * as inert for the listing-based Sinclair dialects (their blocks live inside the
 * listing), so those are read from `listing.base` instead.
 */
function programBase(d: Dialect): number | undefined {
  const mb = d.memoryBlocks;
  if (!mb) return undefined;
  return mb.inListing ? mb.listing?.base : mb.programArea(0).start;
}

describe('every dialect that ships a memory map', () => {
  it('has at least one mapped dialect to check', () => {
    expect(mapped.length).toBeGreaterThan(0);
  });
});

describe.each(mapped.map((d) => [d.id, d] as const))(
  'memory map: %s',
  (id, dialect) => {
    const map = dialect.memoryMap!;
    const { addressSpace, regions } = map;

    it('tiles the whole address space with contiguous ascending regions', () => {
      expect(regions.length).toBeGreaterThan(0);
      expect(regions[0]!.start, `${id} first region starts at 0`).toBe(0);
      expect(
        regions[regions.length - 1]!.end,
        `${id} last region ends at the top of memory`,
      ).toBe(addressSpace - 1);
      for (let i = 0; i < regions.length; i++) {
        const r = regions[i]!;
        expect(
          r.end,
          `${id} region "${r.label}" ends at or after it starts`,
        ).toBeGreaterThanOrEqual(r.start);
        if (i > 0) {
          expect(
            r.start,
            `${id} region "${r.label}" begins one byte after the previous one ends`,
          ).toBe(regions[i - 1]!.end + 1);
        }
      }
    });

    it('keeps its program area in one contiguous run', () => {
      // The viewer derives its POKE/load base from the FIRST `program` region,
      // so a machine may split the area into several leaves (the Spectrum 128
      // exposes bank 5, RAM bank 2 and the paged window as three) as long as
      // they stay adjacent - the lowest is then the base, and the band collapses
      // cleanly. A gap would mean the derived base no longer bounds the area.
      const first = regions.findIndex((r) => r.kind === 'program');
      const last = regions.map((r) => r.kind).lastIndexOf('program');
      expect(first, `${id} has a program region`).toBeGreaterThanOrEqual(0);
      for (let i = first; i <= last; i++) {
        expect(
          regions[i]!.kind,
          `${id} region "${regions[i]!.label}" interrupts the program area`,
        ).toBe('program');
      }
    });

    it('keeps any UDG base inside RAM', () => {
      const { udgBase } = map;
      if (udgBase === undefined) return;
      expect(
        udgBase,
        `${id} udgBase is a valid address`,
      ).toBeGreaterThanOrEqual(0);
      expect(udgBase, `${id} udgBase is within the address space`).toBeLessThan(
        addressSpace,
      );
      // The POKE resolver turns `POKE USR "a"` into a write at this address, so
      // it has to land somewhere writable.
      const host = regions.find((r) => udgBase >= r.start && udgBase <= r.end);
      expect(host, `${id} udgBase falls inside a region`).toBeDefined();
      expect(host!.kind, `${id} udgBase is not in ROM`).not.toBe('rom');
    });

    it('groups collapse unambiguously', () => {
      // A band takes its label from the first leaf's `group` and swallows every
      // following leaf whose `group` matches that label. A group may legitimately
      // appear in more than one run - the BBC machines split "ROM" around the
      // memory-mapped I/O window, which is what the hardware does - and that
      // simply renders as two bands of the same name. What must not happen is an
      // UNGROUPED leaf carrying the same label as the next leaf's group: that
      // one would silently swallow a band it has nothing to do with.
      for (let i = 0; i < regions.length - 1; i++) {
        const r = regions[i]!;
        const next = regions[i + 1]!;
        if (r.group === undefined && next.group !== undefined) {
          expect(
            r.label,
            `${id} ungrouped region "${r.label}" would be swallowed by the next region's group`,
          ).not.toBe(next.group);
        }
      }
    });

    it('starts the program region where the dialect says the program begins', () => {
      const base = programBase(dialect);
      // Asserted rather than skipped: a dialect that ships a map but no
      // reachable program base would otherwise pass this check by doing nothing.
      expect(
        base,
        `${id} exposes a program base through memoryBlocks`,
      ).toBeDefined();
      const program = regions.find((r) => r.kind === 'program')!;
      const offset = LINK_BYTE_OFFSET[id] ?? 0;
      expect(
        base,
        `${id} program base vs memory-map program region start`,
      ).toBe(program.start + offset);
    });
  },
);

describe.each(blocked.map((d) => [d.id, d] as const))(
  'memory blocks: %s',
  (id, dialect) => {
    const mb = dialect.memoryBlocks!;
    // Only meaningful for dialects that also declare an address space; the
    // listing-based dialects have inert ranges (see MemoryBlocksSupport).
    const addressSpace = dialect.memoryMap?.addressSpace;

    it('keeps every declared range inside the address space', () => {
      if (addressSpace === undefined || mb.inListing) return;
      for (const r of [...mb.validRanges, ...mb.reservedRanges]) {
        expect(r.start, `${id} range start`).toBeGreaterThanOrEqual(0);
        expect(r.end, `${id} range end`).toBeLessThan(addressSpace);
        expect(r.end, `${id} range is ascending`).toBeGreaterThanOrEqual(
          r.start,
        );
      }
    });

    it('suggests a default block address inside a valid range', () => {
      if (mb.inListing) return;
      const inRange = mb.validRanges.some(
        (r) => mb.defaultAddress >= r.start && mb.defaultAddress <= r.end,
      );
      expect(
        inRange,
        `${id} defaultAddress ${mb.defaultAddress} is inside a valid range`,
      ).toBe(true);
    });
  },
);
