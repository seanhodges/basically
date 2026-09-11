// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MemoryMap } from '../types';
import {
  BASIC_CONTROL_BASE,
  BASIC_CONTROL_END,
  BASIC_MEMORY_TOP,
  CHARGEN_RAM_BASE,
  CHARGEN_ROM_BASE,
  MONITOR_BASE,
  MONITOR_RAM_TAIL_BYTES,
  MONITOR_WORKAREA_BASE,
  PROGRAM_BASE,
  RAM_BASE,
  RAM_FITTED_BYTES,
  ROM_PAC_BASE,
  SCREEN_BASE,
} from './addresses';

/** First byte of the Monitor's RAM tail, at the very top of fitted RAM. */
const MONITOR_TAIL_BASE = RAM_BASE + RAM_FITTED_BYTES - MONITOR_RAM_TAIL_BYTES;

/**
 * The Sorcerer's memory map for the memory-map viewer.
 *
 * Every boundary is a constant from `addresses.ts`, and each of those says
 * which reading fixed it - the Technical Manual for the hardware windows, the
 * ROM PAC's own instructions and the booted machine for the interpreter's. What
 * that buys is worth stating, because a wrong map is drawn as confidently as a
 * right one: nothing here is a round number someone liked the look of.
 *
 * Three things about this machine's map are not what a reader of the other maps
 * here would expect:
 *
 *  - **The address space opens in RAM and the firmware is at the top.** There
 *    is no ROM at address zero to boot from; the Monitor is mirrored over the
 *    bottom 4K for exactly one instruction and then gone (see
 *    `src/emulator/sorcerer/memory.ts`), so the map draws what is underneath
 *    the mirror, which is the RAM that is there for the rest of the session.
 *  - **BASIC's RAM ends a page below the top of the fitted 32K**, not at it.
 *    The ROM PAC's cold start hands the Monitor the top 256 bytes for its
 *    workarea and its stack, which is why {@link BASIC_MEMORY_TOP} is 0x7EFF
 *    and not 0x7FFF.
 *  - **The character generator is half ROM and half RAM**, and the two halves
 *    are drawn as such: the shapes of codes 0-127 cannot be changed and the
 *    shapes of codes 128-255 are ordinary RAM a program may poke.
 *
 * There is no `udgBase`: that field is for machines whose BASIC reaches a
 * user-definable character through `USR "letter"`, and on this machine `USR` is
 * the Z80 machine-code call. A program redefines a character by poking the
 * generator RAM directly, at an address it works out itself.
 */
export const sorcererMemoryMap: MemoryMap = {
  addressSpace: 0x10000,
  regions: [
    {
      start: RAM_BASE,
      end: BASIC_CONTROL_BASE - 1,
      label: 'Low RAM',
      kind: 'system',
      group: 'BASIC workspace',
      note: 'Plain RAM neither ROM uses: zero from the Monitor’s memory sizing to the Ready prompt. The Monitor is mirrored over it out of reset, for the one jump the CPU fetches through the mirror.',
    },
    {
      start: BASIC_CONTROL_BASE,
      end: BASIC_CONTROL_END,
      label: 'BASIC control area',
      kind: 'system',
      group: 'BASIC workspace',
      note: 'The interpreter’s documented pointer block, copied here from the ROM PAC at cold start. CURLIN at 0x0147 and TXTTAB at 0x0149; STKTOP, the string pool’s floor and the stack’s top, at 0x0145.',
    },
    {
      start: BASIC_CONTROL_END + 1,
      end: PROGRAM_BASE - 1,
      label: 'Interpreter workspace',
      kind: 'system',
      group: 'BASIC workspace',
      note: 'The rest of the interpreter’s scratch, above the documented area: MEMSIZ at 0x0192, FRETOP at 0x01A6, and VARTAB/ARYTAB/STREND at 0x01B7-0x01BC.',
    },
    {
      start: PROGRAM_BASE,
      end: BASIC_MEMORY_TOP,
      label: 'BASIC program & variables',
      kind: 'program',
      note: 'Program text from 0x01D5, then the variables and arrays above it. The stack and the string pool come down from the top of the same span - 50 bytes of strings by default, which CLEAR n resizes - so the two ends grow towards each other.',
    },
    {
      start: BASIC_MEMORY_TOP + 1,
      end: MONITOR_TAIL_BASE - 1,
      label: 'Monitor stack',
      kind: 'system',
      group: 'Monitor RAM',
      note: 'Headroom for the Monitor’s own stack, which grows down from the workarea above. BASIC never uses it: its cold start sets MEMSIZ a whole page below the top of RAM to leave this page alone.',
    },
    {
      start: MONITOR_TAIL_BASE,
      end: RAM_BASE + RAM_FITTED_BYTES - 1,
      label: 'Monitor workarea',
      kind: 'system',
      group: 'Monitor RAM',
      note: 'The Monitor’s variables, at the top of whatever RAM it found: the cassette baud rate and control-port shadow among them. Live whenever a Monitor routine runs, which tape I/O is.',
    },
    {
      start: RAM_BASE + RAM_FITTED_BYTES,
      end: ROM_PAC_BASE - 1,
      label: 'Unfitted memory',
      kind: 'reserved',
      note: 'Nothing on the bus in the 32K machine this dialect models - where the second 16K went. Writes vanish and reads float high, which is what the Monitor’s cold start walks up to find the top of RAM.',
    },
    {
      start: ROM_PAC_BASE,
      end: MONITOR_BASE - 1,
      label: 'ROM PAC',
      kind: 'rom',
      note: 'The cartridge window, here holding the 8K Exidy Standard BASIC PAC. The Monitor enters whatever it finds at 0xDFFD, which is why the machine comes up in BASIC without being asked.',
    },
    {
      start: MONITOR_BASE,
      end: MONITOR_WORKAREA_BASE - 1,
      label: 'Monitor ROM',
      kind: 'rom',
      note: 'The 4K on-board firmware: the memory sizing, the screen and keyboard routines, the tape routines, and the command monitor BYE drops into.',
    },
    {
      start: MONITOR_WORKAREA_BASE,
      end: SCREEN_BASE - 1,
      label: 'Monitor system variables',
      kind: 'system',
      note: 'The fixed workarea below the screen, distinct from the Monitor’s RAM tail. Its first word is the top of RAM the cold start found - 0x7FFF on this machine.',
    },
    {
      start: SCREEN_BASE,
      end: CHARGEN_ROM_BASE - 1,
      label: 'Screen RAM',
      kind: 'screen',
      note: '64 columns by 30 rows of character codes, one byte each, scanned straight by the video circuit. No attributes: the display is monochrome, so a cell holds a code and nothing else.',
    },
    {
      start: CHARGEN_ROM_BASE,
      end: CHARGEN_RAM_BASE - 1,
      label: 'Generator ROM (codes 0-127)',
      kind: 'rom',
      group: 'Character generator',
      note: 'Eight bytes of bitmap per code for the fixed graphics below 32 and the ASCII set above it. Read by the video circuit, never by the CPU as code - and unchangeable, which is what makes the band above it interesting.',
    },
    {
      start: CHARGEN_RAM_BASE,
      end: 0xffff,
      label: 'Generator RAM (codes 128-255)',
      kind: 'system',
      group: 'Character generator',
      note: 'Bitmaps in ordinary RAM. The Monitor copies the standard graphics set into the lower half at boot, so codes 128-191 have shapes only by convention; 192-255 are left as found, for a program to define.',
    },
  ],
};
