// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The Atari 400/800 addresses both dialects are written against.
 *
 * The two machines are one design with different amounts of RAM fitted, so
 * everything here is shared except {@link ATARI_800_RAM_TOP} and its 400
 * counterpart - which is the whole hardware difference a BASIC program can see.
 */

/** Zero-page pointers Atari BASIC keeps its memory layout in, `$80`-`$8D`. */
export const BASIC_POINTERS = {
  /** Start of BASIC's own memory: a 256-byte buffer it parses a line into. */
  LOMEM: 0x80,
  /** Start of the variable name table. */
  VNTP: 0x82,
  /** One past the variable name table; a zero byte sits here. */
  VNTD: 0x84,
  /** Start of the variable value table, 8 bytes an entry. */
  VVTP: 0x86,
  /** Start of the statement table - the tokenized program. */
  STMTAB: 0x88,
  /** The immediate-mode line, which sits just past the program. */
  STMCUR: 0x8a,
  /** String and array space, and the end of everything BASIC holds. */
  STARP: 0x8c,
} as const;

/**
 * Where the BASIC cartridge sits. It is also the ceiling on usable RAM: a 48K
 * 800 has RAM behind `$A000`, but with the cartridge fitted nothing can reach
 * it, which is why a 48K machine reports far less free than 48K.
 */
export const BASIC_CARTRIDGE_BASE = 0xa000;

/** Bytes of the cartridge, `$A000`-`$BFFF`. */
export const BASIC_CARTRIDGE_BYTES = 0x2000;

/** Where the OS ROM starts, `$D800`-`$FFFF`. */
export const OS_ROM_BASE = 0xd800;

/** Bytes of the OS ROM. */
export const OS_ROM_BYTES = 0x2800;

/**
 * Bytes of the bundled ROM image: the OS followed by the BASIC cartridge, in
 * that order (see `scripts/build-atari-rom.mts`). Two chips in one file because
 * the emulator seam carries one image per machine.
 */
export const ATARI_ROM_BYTES = OS_ROM_BYTES + BASIC_CARTRIDGE_BYTES;

/** The hardware registers, `$D000`-`$D7FF`: GTIA, POKEY, PIA and ANTIC. */
export const HARDWARE_BASE = 0xd000;

/** Top of usable RAM on a 48K Atari 800 with the BASIC cartridge fitted. */
export const ATARI_800_RAM_TOP = BASIC_CARTRIDGE_BASE;

/** Top of usable RAM on a 16K Atari 400. */
export const ATARI_400_RAM_TOP = 0x4000;

/**
 * Where BASIC's workspace begins: the OS keeps the pages below for its own
 * variables and the cassette buffer, and BASIC's 256-byte token buffer follows.
 */
export const BASIC_WORKSPACE_BASE = 0x0800;

/**
 * Bytes the GRAPHICS 0 screen and its display list take off the top of RAM.
 * Every other mode takes a different amount, which is why the figure this feeds
 * is an estimate rather than a promise.
 */
export const GRAPHICS_0_DISPLAY_BYTES = 992;

/** Free bytes a BASIC program starts with on a machine whose RAM ends at `top`. */
export function programRamBytes(top: number): number {
  return top - BASIC_WORKSPACE_BASE - GRAPHICS_0_DISPLAY_BYTES;
}
