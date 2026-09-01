// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MemoryMap } from '../types';
import { TXTTAB } from './addresses';

/**
 * The 64K CPU address space: the BIOS and MSX BASIC ROMs in slot 0, the RAM
 * the machine fits, and the system variable area the standard puts at the top.
 *
 * The 16KB of video RAM is deliberately absent - it is a second address space
 * the CPU reaches only through VPOKE/VPEEK and the VDP's two ports, so tiling
 * it in here would tell a reader that a POKE can reach the screen.
 *
 * What the map draws is the machine as it runs: slot 0's two ROM pages below
 * 0x8000 and slot 3's RAM above it, which is the configuration the BIOS leaves
 * behind after its slot search and the one every BASIC program sees. The
 * addresses are the CPU's, not a slot's, so the same 0x8000 that reads RAM here
 * would read a cartridge on a machine with one fitted.
 *
 * The boundaries inside the RAM come from the booted ROM's own pointers rather
 * than from a reference table: STKTOP puts the top of the program area at
 * 0xF0A0 and MEMSIZ the top of the string space at 0xF168, leaving the file
 * buffers between there and the HIMEM the BIOS reports.
 */

/** Top of the program area, and the floor of the string space (STKTOP). */
const STRING_SPACE_BASE = 0xf0a0;
/** Top of the string space, and the floor of the file buffers (MEMSIZ). */
const FILE_BUFFER_BASE = 0xf168;
/** Top of the RAM BASIC uses at all: the HIMEM a clean boot reports. */
const SYSTEM_AREA_BASE = 0xf380;
/** The BIOS hook table: 5-byte entries, RET-filled until something claims one. */
const HOOK_BASE = 0xfd9a;
const HOOK_END = 0xffc9;

export const hb10pMemoryMap: MemoryMap = {
  addressSpace: 0x10000,
  regions: [
    {
      start: 0x0000,
      end: 0x3fff,
      label: 'MSX BIOS',
      kind: 'rom',
      group: 'System ROM',
      note: 'The 16K MSX BIOS in page 0 of slot 0: the reset and interrupt entry points, the standard call table every MSX shares, and the slot, VDP, keyboard and cassette drivers underneath it.',
    },
    {
      start: 0x4000,
      end: 0x7fff,
      label: 'MSX BASIC',
      kind: 'rom',
      group: 'System ROM',
      note: 'The 16K MSX BASIC 1.0 interpreter in page 1 of slot 0, including the keyword and error-message tables it prints from.',
    },
    {
      start: TXTTAB - 1,
      end: STRING_SPACE_BASE - 1,
      label: 'Available memory',
      kind: 'program',
      group: 'BASIC RAM',
      note: 'The zero byte the line links terminate against at 0x8000, the BASIC program from 0x8001, its variables and arrays above that, and the free space they grow into. The interpreter’s stack descends into the top of it. Nothing here is the screen: the picture lives in the VDP’s own 16K, which only VPOKE and VPEEK can reach.',
    },
    {
      start: STRING_SPACE_BASE,
      end: FILE_BUFFER_BASE - 1,
      label: 'String space',
      kind: 'program',
      group: 'BASIC RAM',
      note: 'Where string values are kept, filled downwards from the top. 200 bytes on a clean boot; CLEAR resizes it, and moves the stack and the program ceiling with it.',
    },
    {
      start: FILE_BUFFER_BASE,
      end: SYSTEM_AREA_BASE - 1,
      label: 'File buffers',
      kind: 'buffer',
      note: 'The file control block and sector buffer MAXFILES reserves for cassette and disc I/O, between the RAM BASIC uses and the HIMEM it reports. MAXFILES=0 gives most of it back to the program area.',
    },
    {
      start: SYSTEM_AREA_BASE,
      end: 0xf3ad,
      label: 'Slot handling and USR table',
      kind: 'system',
      group: 'System variables',
      note: 'The inter-slot call primitives the BIOS copies into RAM at 0xF380 - they have to live in RAM, because they switch the slot the caller is running from - and the ten USR entry points above them, each pointing at the “Illegal function call” handler until DEF USR sets it.',
    },
    {
      start: 0xf3ae,
      end: HOOK_BASE - 1,
      label: 'BIOS and BASIC work area',
      kind: 'system',
      group: 'System variables',
      note: 'The screen and VDP register mirrors, the keyboard buffer, the device work areas, and the interpreter’s own pointers: CURLIN at 0xF41C, TXTTAB at 0xF676, VARTAB at 0xF6C2 and HIMEM at 0xFC4A.',
    },
    {
      start: HOOK_BASE,
      end: HOOK_END,
      label: 'BIOS hooks',
      kind: 'system',
      group: 'System variables',
      note: 'The standard hook table: 5-byte slots the BIOS calls at fixed points - the keyboard interrupt, the character output, the timer - each holding a RET until a program or a cartridge patches a jump into it. This is how an MSX program extends the BIOS without patching ROM.',
    },
    {
      start: HOOK_END + 1,
      end: 0xffff,
      label: 'Top of memory',
      kind: 'system',
      group: 'System variables',
      note: 'The tail above the hooks, ending at the address the MSX standard reserves for the secondary slot select register. Writing 0xFFFF picks a subslot on an expanded primary slot; this machine expands none, so here it is ordinary RAM.',
    },
  ],
};
