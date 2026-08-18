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

/** Monitor 2, which occupies 0x8000-0x8FFF on the real machine. */
export const MONITOR_SIZE = 0x1000;

/** BASIC-G V2.0, the 9K ROM Module a PMD 85-2 shipped with. */
export const ROM_MODULE_SIZE = 0x2400;

/**
 * The whole image, sized to its two parts exactly rather than rounded up to a
 * power of two: padding a shipped binary out to 16K would put 3K of 0xFF on
 * disk and overstate what the machine actually carries.
 *
 * The 4K + 9K concatenation is not an invention of this project. The Didaktik
 * Alfa - a licensed PMD 85 clone - shipped its OS and BASIC as exactly this
 * layout in a single 13K image, which is how `didalfa.rom` is distributed.
 */
export const ROM_IMAGE_SIZE = MONITOR_SIZE + ROM_MODULE_SIZE;

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
