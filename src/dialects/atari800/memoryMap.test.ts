// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { MemoryMap, MemoryRegionKind } from '../types';
import { atari800 } from './index';
import { atari400 } from '../atari400/index';
import { AtariMachine } from '../../emulator/atari/atariMachine';

/**
 * The two machines' memory maps, against the machines themselves.
 *
 * The shape checks below duplicate what `src/dialects/memoryMap.test.ts` walks
 * the registry for, and are here because neither dialect is registered yet:
 * without them the maps would go unchecked until the machines ship. What is
 * only here is the half the registry battery cannot do - booting the ROM and
 * asking the OS where it actually put the screen, which is the only thing that
 * says these addresses describe this machine rather than a plausible Atari.
 */

const ROM = new Uint8Array(readFileSync('public/roms/atari.rom'));

/** Frames the OS needs to size the RAM, open the screen and start BASIC. */
const BOOT_FRAMES = 400;

/** Where the OS records what it did at power-on. */
const RAMTOP = 0x006a; // top of fitted RAM, in pages
const MEMTOP = 0x02e5; // last byte below the display list
const MEMLO = 0x02e7; // first byte above the OS's own workspace
const SDLSTL = 0x0230; // the display list ANTIC is running
const SAVMSC = 0x0058; // top-left of the screen

const MACHINES = [
  { id: '800', dialect: atari800, model: '800' },
  { id: '400', dialect: atari400, model: '400' },
] as const;

/** The one region of `kind`, which every map here has exactly one of. */
function region(map: MemoryMap, kind: MemoryRegionKind) {
  const found = map.regions.filter((r) => r.kind === kind);
  expect(found).toHaveLength(1);
  return found[0]!;
}

describe.each(MACHINES.map((m) => [m.id, m] as const))(
  'the Atari %s memory map',
  (id, { dialect, model }) => {
    const map = dialect.memoryMap!;

    it('tiles the whole address space with contiguous ascending regions', () => {
      expect(map.addressSpace).toBe(0x10000);
      expect(map.regions[0]!.start).toBe(0);
      expect(map.regions[map.regions.length - 1]!.end).toBe(
        map.addressSpace - 1,
      );
      for (let i = 1; i < map.regions.length; i++) {
        const r = map.regions[i]!;
        expect(
          r.end,
          `${id} "${r.label}" ends at or after it starts`,
        ).toBeGreaterThanOrEqual(r.start);
        expect(
          r.start,
          `${id} "${r.label}" follows "${map.regions[i - 1]!.label}"`,
        ).toBe(map.regions[i - 1]!.end + 1);
      }
    });

    it('starts the program region where a memory block may not go', () => {
      // The rule the registry battery will apply once these machines ship: the
      // map's program area and the block linter's have to be the same address,
      // or a block judged safe by one lands in the program according to the
      // other.
      expect(region(map, 'program').start).toBe(
        dialect.memoryBlocks!.programArea(0).start,
      );
    });

    it('describes the memory the machine reports at its prompt', () => {
      const m = new AtariMachine({ model, rom: ROM });
      for (let frame = 0; frame < BOOT_FRAMES; frame++) m.runFrame();
      const word = (a: number) => m.peek(a) | (m.peek(a + 1) << 8);
      const program = region(map, 'program');
      const screen = region(map, 'screen');
      const displayList = map.regions.find((r) => r.label === 'Display list')!;

      // Everything the OS sized or laid out, against what the map says it is.
      expect(m.peek(RAMTOP) << 8, `${id} top of fitted RAM`).toBe(
        screen.end + 1,
      );
      expect(word(MEMLO), `${id} first byte above the OS's workspace`).toBe(
        program.start - 0x100,
      );
      expect(word(SDLSTL), `${id} display list`).toBe(displayList.start);
      expect(word(SAVMSC), `${id} screen memory`).toBe(screen.start);
      expect(word(MEMTOP), `${id} last byte BASIC may use`).toBe(program.end);
      m.dispose();
    });
  },
);

describe('the pair of Atari memory maps', () => {
  it('differs only in where the RAM stops', () => {
    const labels = (map: MemoryMap) => map.regions.map((r) => r.label);
    // The 400's map carries one region the 800's does not: the empty sockets
    // between the 16K it was sold with and the cartridge. Everything else is
    // the same machine described twice.
    expect(
      labels(atari400.memoryMap!).filter((l) => l !== 'Unfitted RAM'),
    ).toEqual(labels(atari800.memoryMap!));
    expect(labels(atari800.memoryMap!)).not.toContain('Unfitted RAM');
    expect(region(atari400.memoryMap!, 'program').end).toBeLessThan(
      region(atari800.memoryMap!, 'program').end,
    );
  });
});
