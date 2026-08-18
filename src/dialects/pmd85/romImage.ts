// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The PMD 85 needs two ROMs, and the dialect seam hands a machine one image.
 *
 * The Monitor is ordinary 4K firmware at 0x8000. BASIC-G is not firmware at all:
 * it sits in a replaceable ROM Module that the CPU cannot address, read a byte
 * at a time through an 8255 and copied into RAM before it runs. Two different
 * devices, one `rom: Uint8Array` to carry them - so they travel concatenated,
 * Monitor first, exactly as `zxspectrum128.rom` carries its two 16K halves.
 *
 * The layout is fixed rather than length-derived because both ends need it
 * without negotiation: `fetchRom` rejects a bundled image whose length is not
 * {@link ROM_IMAGE_SIZE}, and a user-supplied image is padded to that size
 * before it ever reaches {@link splitRomImage}.
 */

/** The Monitor occupies 0x8000-0x8FFF on the real machine, and 4K here. */
export const MONITOR_SIZE = 0x1000;

/**
 * The whole image: the 4K Monitor followed by the module's 12K window.
 *
 * BASIC-G itself is around 9-10K, so the window has room to spare; the slack is
 * padding, not a second ROM. The module is addressed by offset from its own
 * base, so trailing padding is simply never read.
 */
export const ROM_IMAGE_SIZE = 0x4000;

/** The ROM Module's share of the image - what is left after the Monitor. */
export const ROM_MODULE_SIZE = ROM_IMAGE_SIZE - MONITOR_SIZE;

/**
 * Split a combined image into the two devices that run it.
 *
 * A short image is tolerated rather than rejected: the machine has to stay
 * constructible on a missing or truncated ROM so the emulator pane can say so
 * on screen instead of throwing, which is how the Altair already behaves. Both
 * halves are views onto the caller's buffer, never copies.
 */
export function splitRomImage(rom: Uint8Array): {
  monitor: Uint8Array;
  romModule: Uint8Array;
} {
  return {
    monitor: rom.subarray(0, Math.min(MONITOR_SIZE, rom.length)),
    romModule: rom.subarray(Math.min(MONITOR_SIZE, rom.length)),
  };
}
