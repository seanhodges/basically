// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROM_IMAGE_SIZE, splitRomImage } from './romImage';
import { sorcerer } from './index';
import {
  CHARGEN_ROM_SIZE,
  MONITOR_SIZE,
  RESERVED_WORDS_BASE,
  ROM_PAC_BASE,
  ROM_PAC_SIZE,
  STANDARD_GRAPHICS_BITMAPS,
} from './addresses';

const rom = new Uint8Array(
  readFileSync(join(__dirname, '../../../public/roms/sorcerer/sorcerer.rom')),
);

describe('the Sorcerer ROM image', () => {
  it('is the three devices the dialect declares, in that order', () => {
    expect(rom.length).toBe(ROM_IMAGE_SIZE);
    expect(sorcerer.romBytes).toBe(ROM_IMAGE_SIZE);
    const { monitor, romPac, charGen } = splitRomImage(rom);
    expect(monitor.length).toBe(MONITOR_SIZE);
    expect(romPac.length).toBe(ROM_PAC_SIZE);
    expect(charGen.length).toBe(CHARGEN_ROM_SIZE);
  });

  /**
   * Each part is identified by something only that part carries, so a split
   * that put the right number of bytes in the wrong place fails here rather
   * than at a blank screen.
   */
  it('puts each part where the rest of the dialect reads it', () => {
    const { monitor, romPac, charGen } = splitRomImage(rom);

    // The Monitor's three initial entry points are jumps: COLD at 0xE000, WARM
    // at 0xE003 and USER at 0xE006. The Technical Manual requires the first,
    // because it is the only instruction executed through the boot mirror.
    expect([monitor[0], monitor[3], monitor[6]]).toEqual([0xc3, 0xc3, 0xc3]);

    // The ROM PAC's own two vectors, which the Monitor tests for a 0xC3 before
    // it will enter a cartridge at all.
    expect(romPac[ROM_PAC_SIZE - 6]).toBe(0xc3);
    expect(romPac[ROM_PAC_SIZE - 3]).toBe(0xc3);

    // The reserved-word table the tokenizer's bytes were read from: entries run
    // back to back in token order with bit 7 set on each first character, so
    // the first four spell END, FOR, NEXT, DATA.
    const table = romPac.subarray(RESERVED_WORDS_BASE - ROM_PAC_BASE);
    const words = [...table.subarray(0, 14)]
      .map((b) => String.fromCharCode(b & 0x7f))
      .join('');
    expect(words).toBe('ENDFORNEXTDATA');

    // The character generator holds ASCII shapes at their ASCII codes, which no
    // other part of the image does.
    const letterA = charGen.subarray(0x41 * 8, 0x41 * 8 + 8);
    expect([...letterA]).toEqual([0x10, 0x28, 0x44, 0x44, 0x7c, 0x44, 0x44, 0]);
  });

  /**
   * The graphics band has no bitmaps of its own in the image: the Monitor
   * carries them and copies them into generator RAM at boot, which is why a
   * program can overwrite them. Pinned here because it is the reason the
   * character-generator part is 1K rather than 2K.
   */
  it('carries the standard graphics set in the Monitor, not the generator', () => {
    const { monitor } = splitRomImage(rom);
    const first = monitor.subarray(
      STANDARD_GRAPHICS_BITMAPS - 0xe000,
      STANDARD_GRAPHICS_BITMAPS - 0xe000 + 8,
    );
    // Code 0x80: a one-pixel rule down the leftmost column of the cell.
    expect([...first]).toEqual([
      0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80,
    ]);
  });

  /**
   * A short image has to split rather than throw, because the machine stays
   * constructible without its ROM so the emulator pane can say so on screen.
   */
  it('splits a truncated image into whatever it has', () => {
    const parts = splitRomImage(rom.subarray(0, MONITOR_SIZE + 4));
    expect(parts.monitor.length).toBe(MONITOR_SIZE);
    expect(parts.romPac.length).toBe(4);
    expect(parts.charGen.length).toBe(0);

    const empty = splitRomImage(new Uint8Array(0));
    expect(empty.monitor.length).toBe(0);
    expect(empty.romPac.length).toBe(0);
    expect(empty.charGen.length).toBe(0);
  });
});
