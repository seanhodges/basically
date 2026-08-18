// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

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
});
