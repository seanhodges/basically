// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { CHARGEN_ROM_SIZE, MONITOR_SIZE, ROM_PAC_SIZE } from './addresses';

/**
 * The Sorcerer needs three ROMs, and the dialect seam hands a machine one image.
 *
 * They are three different devices on three different chip selects: the 4K
 * Monitor at 0xE000, the 8K Standard BASIC ROM PAC in the cartridge window at
 * 0xC000, and the 1K character generator at 0xF800, which the CPU can read but
 * which exists for the video circuit rather than for the CPU. So they travel
 * concatenated in one `rom: Uint8Array`, the way `pmd85.rom` carries its two
 * halves and `atari.rom` its two.
 *
 * The character generator is the one that is easy to leave out and impossible
 * to do without: nothing else in the machine holds the shapes of codes 0-127,
 * so an image carrying only the Monitor and the PAC boots a machine whose
 * screen is blank whatever is written to it. The graphics band above those
 * codes is not in it - the Monitor copies that set into generator *RAM* out of
 * its own table - which is why this part is 1K rather than 2K.
 *
 * Firmware, then cartridge, then font: the order is not address order, and is
 * chosen so the two parts a user is most likely to want to replace come first
 * and at fixed offsets.
 *
 * The layout is fixed rather than length-derived because both ends need it
 * without negotiation: `fetchRom` rejects a bundled image whose length is not
 * {@link ROM_IMAGE_SIZE}, and a user-supplied image is padded to that size
 * before it ever reaches {@link splitRomImage}.
 */

/** The whole image, sized to its three parts exactly. */
export const ROM_IMAGE_SIZE = MONITOR_SIZE + ROM_PAC_SIZE + CHARGEN_ROM_SIZE;

/**
 * Split a combined image into the three devices that make up a running machine.
 *
 * A short image is tolerated rather than rejected: the machine has to stay
 * constructible on a missing or truncated ROM so the emulator pane can say so
 * on screen instead of throwing, which is how the Altair and the PMD 85 already
 * behave. Every part is a view onto the caller's buffer, never a copy.
 */
export function splitRomImage(rom: Uint8Array): {
  monitor: Uint8Array;
  romPac: Uint8Array;
  charGen: Uint8Array;
} {
  const monitorEnd = Math.min(MONITOR_SIZE, rom.length);
  const pacEnd = Math.min(MONITOR_SIZE + ROM_PAC_SIZE, rom.length);
  return {
    monitor: rom.subarray(0, monitorEnd),
    romPac: rom.subarray(monitorEnd, pacEnd),
    charGen: rom.subarray(pacEnd, Math.min(ROM_IMAGE_SIZE, rom.length)),
  };
}
