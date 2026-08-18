// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MONITOR_SIZE,
  ROM_IMAGE_SIZE,
  ROM_MODULE_SIZE,
  splitRomImage,
} from './romImage';

describe('pmd85 ROM image', () => {
  it('splits a full image into the Monitor and the module window', () => {
    const rom = new Uint8Array(ROM_IMAGE_SIZE);
    rom[0] = 0xc3; // the Monitor's first byte
    rom[MONITOR_SIZE] = 0xcd; // the byte the PMD 85-2 auto-launches on
    const { monitor, romModule } = splitRomImage(rom);

    expect(monitor).toHaveLength(MONITOR_SIZE);
    expect(romModule).toHaveLength(ROM_MODULE_SIZE);
    expect(monitor[0]).toBe(0xc3);
    expect(romModule[0]).toBe(0xcd);
  });

  it('accounts for every byte of the image, with nothing overlapping', () => {
    expect(MONITOR_SIZE + ROM_MODULE_SIZE).toBe(ROM_IMAGE_SIZE);
  });

  it('views the caller’s buffer rather than copying it', () => {
    const rom = new Uint8Array(ROM_IMAGE_SIZE);
    const { monitor, romModule } = splitRomImage(rom);
    rom[0] = 0x76;
    rom[MONITOR_SIZE] = 0x76;

    expect(monitor[0]).toBe(0x76);
    expect(romModule[0]).toBe(0x76);
  });

  it('stays constructible on a missing or truncated image', () => {
    // The machine must survive an absent ROM well enough to say so on screen,
    // which means the split cannot throw or produce a negative-length view.
    const empty = splitRomImage(new Uint8Array(0));
    expect(empty.monitor).toHaveLength(0);
    expect(empty.romModule).toHaveLength(0);

    const short = splitRomImage(new Uint8Array(0x800));
    expect(short.monitor).toHaveLength(0x800);
    expect(short.romModule).toHaveLength(0);
  });

  /**
   * The shipped image itself, not just the arithmetic over it. It is two chips
   * concatenated (see `public/roms/ATTRIBUTION.md`), and nothing else in the
   * build would notice if the halves were swapped, truncated or padded - the
   * machine would simply fail to boot much later, with no clue why.
   */
  describe('the bundled image', () => {
    const rom = new Uint8Array(
      readFileSync(join(__dirname, '../../../public/roms/pmd85.rom')),
    );

    it('is exactly the size the dialect declares', () => {
      expect(rom).toHaveLength(ROM_IMAGE_SIZE);
    });

    it('opens with Monitor 2 setting its stack pointer', () => {
      // LXI SP,8000h / JMP 8006h - the PMD 85-2 reset vector, executing from
      // the ROM mirrored over 0x0000 before the normal memory map is switched in.
      const { monitor } = splitRomImage(rom);
      expect([...monitor.subarray(0, 6)]).toEqual([
        0x31, 0x00, 0x80, 0xc3, 0x06, 0x80,
      ]);
    });

    it('carries a ROM module the Monitor will auto-launch', () => {
      // The -2 launches the module after reset when its first byte is 0xCD,
      // which is also the 8080 CALL opcode: the module's first instruction is
      // CALL 8C00h, the Monitor's own TRANSFER routine, which copies BASIC-G
      // down into RAM. The auto-launch check and the instruction are the same
      // three bytes doing double duty.
      const { romModule } = splitRomImage(rom);
      expect([...romModule.subarray(0, 3)]).toEqual([0xcd, 0x00, 0x8c]);
    });
  });
});
