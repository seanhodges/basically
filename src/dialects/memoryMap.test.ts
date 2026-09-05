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
 * program region. The Microsoft 6502 ROMs store a zero link byte at the foot of
 * BASIC RAM and begin the first line record after it, so the region legitimately
 * starts one byte below TXTTAB - the three Commodores each at their own base,
 * and Applesoft at $0800/$0801. Any other dialect must match exactly.
 */
const LINK_BYTE_OFFSET: Record<string, number> = {
  commodore64: 1,
  pet: 1,
  vic20: 1,
  apple2plus: 1,
};

/**
 * Machines offered as BASIC only, which ship no memory blocks and so have no
 * program base for the map to agree with.
 *
 * Named rather than inferred from the absence, which is what "this machine
 * cannot place code at an address" and "nobody wired the blocks up" look like
 * from the outside. The GE-235's BASIC has no PEEK, no POKE, no USR and no
 * assembler: a compiled program there cannot name an address at all.
 */
const NO_CODE_AT_AN_ADDRESS = new Set(['ge235']);

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

  /**
   * Every byte-addressed machine here spans the same 64K, and the porting guide
   * draws two of their maps against one shared address scale so that a position
   * in one pane is the same address in the other.
   *
   * The GE-235 is the machine that made that claim need a boundary. Its store
   * is 8,192 twenty-bit *words*, so its unit is not a byte and its column is a
   * different length. The guide still draws it correctly - both panes are drawn
   * at the same pixels per unit, so a shorter column is a shorter column - but
   * a line across the two panes is no longer one address on both machines, and
   * a reader must not take it for one.
   *
   * So the assertion is not "every machine is the same" but "every
   * byte-addressed machine is". A map that counts something else says so on
   * `addressUnit`, which is what the comparison labels its pane with; a
   * byte-addressed one that drifts off 64K still fails here by name.
   */
  it('spans the same address space on every byte-addressed machine, which the side-by-side comparison assumes', () => {
    const spaces = new Map<number, string[]>();
    const otherUnit: Dialect[] = [];
    for (const d of mapped) {
      if ((d.memoryMap!.addressUnit ?? 'byte') !== 'byte') {
        otherUnit.push(d);
        continue;
      }
      const space = d.memoryMap!.addressSpace;
      spaces.set(space, [...(spaces.get(space) ?? []), d.id]);
    }
    expect(
      [...spaces].map(
        ([space, ids]) => `0x${space.toString(16)}: ${ids.join(', ')}`,
      ),
    ).toHaveLength(1);
    // And declaring another unit is not a way out of the check: a map that
    // claims one has to genuinely span something else, or it belongs above.
    for (const d of otherUnit) {
      expect(
        [...spaces.keys()],
        `${d.id} spans what every byte-addressed machine does, so its unit changes nothing`,
      ).not.toContain(d.memoryMap!.addressSpace);
    }
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

    it('uses at most one screen region, so the colour means one thing', () => {
      // A machine has one display bitmap or none. The ZX80 and ZX81 have none:
      // their display file lives inside program RAM and moves as the program
      // grows, so there is no fixed region to draw - and the porting-facts
      // cross-check depends on that staying true.
      const screens = regions.filter((r) => r.kind === 'screen');
      expect(
        screens.length,
        `${id} screen regions: ${screens.map((r) => r.label).join(', ')}`,
      ).toBeLessThanOrEqual(1);
    });

    it('only uses the attributes colour for per-cell colour memory', () => {
      // `attributes` means colour memory paired with a screen. If a map has an
      // attributes region but no screen, the kind has been borrowed for
      // something else and the colour has stopped meaning the same thing here as
      // it does on every other machine.
      const hasAttributes = regions.some((r) => r.kind === 'attributes');
      if (!hasAttributes) return;
      expect(
        regions.some((r) => r.kind === 'screen'),
        `${id} has an attributes region but no screen region`,
      ).toBe(true);
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
      // A machine offered as BASIC only has no memory blocks and so no base to
      // agree with. The exemption still asserts something rather than skipping:
      // that this dialect genuinely cannot place code at an address.
      if (NO_CODE_AT_AN_ADDRESS.has(id)) {
        expect(
          dialect.memoryBlocks,
          `${id} ships memory blocks after all, so it has a base to agree with`,
        ).toBeUndefined();
        expect(
          base,
          `${id} reaches a program base from somewhere`,
        ).toBeUndefined();
        return;
      }
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
