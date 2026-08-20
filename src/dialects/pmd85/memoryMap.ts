// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MemoryMap } from '../types';
import {
  BASIC_BASE,
  BASIC_BODY_BYTES,
  PROGRAM_BASE,
  RESERVED_WORDS_BASE,
  RESERVED_WORDS_END,
  STACK_TOP,
  STRING_LIMIT,
  STRING_TOP,
  USER_CODE_BASE,
  WORKSPACE_BASE,
} from './addresses';
import { MONITOR_BASE, MONITOR_MIRROR_BASE } from './emulator/memory';
import { VIDEO_RAM_BASE } from './emulator/display';
import { MONITOR_SIZE } from './romImage';

/**
 * The PMD 85-2's memory map, in the configuration the machine spends its life
 * in - the one it switches to on its first I/O write (see `emulator/memory.ts`
 * for the startup mirrors it leaves behind).
 *
 * Two things about this map are unlike every other machine here, and both are
 * consequences of BASIC-G living in a ROM module the CPU cannot address:
 *
 *  - **The interpreter is in RAM, at address zero.** The Monitor copies it down
 *    before it runs, so the whole of it is writable and a stray POKE really can
 *    corrupt it - the Altair's situation, arrived at from the opposite
 *    direction. It is `system` rather than `rom` for exactly that reason.
 *  - **String space is not at the top of memory.** Most Microsoft BASICs put
 *    the string pool above the arrays and let the two grow towards each other;
 *    BASIC-G gives strings a region of their own above its workspace, which is
 *    why the program area has a hard ceiling at {@link STACK_TOP} rather than a
 *    moving one.
 *
 * Every boundary is a constant from `addresses.ts` or from the emulator's own
 * decoder, both of which were read off the shipped images. The two 4K holes
 * either side of the Monitor are the decoder's, not an omission: nothing drives
 * the bus there and reads float high.
 */
export const pmd85MemoryMap: MemoryMap = {
  addressSpace: 0x10000,
  regions: [
    {
      start: BASIC_BASE,
      end: RESERVED_WORDS_BASE - 1,
      label: 'Interpreter & pointers',
      kind: 'system',
      group: 'BASIC-G V2.0',
      note: 'Where the Monitor copies BASIC-G to, and where it runs. Its own pointers live down here too: TXTTAB at 3Fh, the stack top at 3Dh, the string bounds at 3Bh and 41h.',
    },
    {
      start: RESERVED_WORDS_BASE,
      end: RESERVED_WORDS_END,
      label: 'Reserved-word table',
      kind: 'system',
      group: 'BASIC-G V2.0',
      note: "BASIC-G's 106 keywords, each spelled with bit 7 set on its first character - the table this dialect's token bytes were read from.",
    },
    {
      start: RESERVED_WORDS_END + 1,
      end: PROGRAM_BASE - 1,
      label: 'Interpreter',
      kind: 'system',
      group: 'BASIC-G V2.0',
      note: `The rest of the 9K interpreter, which ends at ${(BASIC_BASE + BASIC_BODY_BYTES - 1).toString(16).toUpperCase()}h, plus the zero byte the cold start writes below the program.`,
    },
    {
      start: PROGRAM_BASE,
      end: STACK_TOP,
      label: 'BASIC program & variables',
      kind: 'program',
      note: 'Program text from 2401h, then the variables and arrays, growing up towards the stack BASIC-G sets at 5DFFh. Strings are not in here - they have their own region above.',
    },
    {
      start: WORKSPACE_BASE,
      end: STRING_LIMIT,
      label: 'Interpreter workspace',
      kind: 'system',
      note: "BASIC-G's own scratch: the line being executed at 5E04h, and the VARTAB/ARYTAB/STREND pointers at 5E7Ah-5E7Fh.",
    },
    {
      start: STRING_LIMIT + 1,
      end: STRING_TOP - 1,
      label: 'String space',
      kind: 'system',
      note: 'String data, growing DOWN from 6F00h towards 6000h - a region of its own rather than the top-of-memory pool the other Microsoft BASICs use.',
    },
    {
      start: STRING_TOP,
      end: USER_CODE_BASE - 1,
      label: 'Free RAM',
      kind: 'reserved',
      note: 'RAM BASIC-G never claims, and the best home for a machine-code block. The ROM statement copies a module block to 7000h and calls it there.',
    },
    {
      start: USER_CODE_BASE,
      end: MONITOR_BASE - 1,
      label: 'CODE scratch & line buffer',
      kind: 'buffer',
      note: "Where the CODE statement assembles the hex it is given and calls it, and above it the Monitor's own line-edit buffer from 7F82h.",
    },
    {
      start: MONITOR_BASE,
      end: MONITOR_BASE + MONITOR_SIZE - 1,
      label: 'Monitor 2',
      kind: 'rom',
      note: 'The 4K firmware: reset, the screen driver, the character generator at 8600h/88C0h, the key-code tables at 82D0h and the TRANSFER routine that copied BASIC-G down.',
    },
    {
      start: MONITOR_BASE + MONITOR_SIZE,
      end: MONITOR_MIRROR_BASE - 1,
      label: 'Unmapped',
      kind: 'reserved',
      note: 'Nothing drives the bus here: the decoder leaves a 4K hole either side of the Monitor, and a read floats high.',
    },
    {
      start: MONITOR_MIRROR_BASE,
      end: MONITOR_MIRROR_BASE + MONITOR_SIZE - 1,
      label: 'Monitor 2 mirror',
      kind: 'rom',
      note: 'The same ROM answering a second time - the decoder ignores A13, so 8000h and A000h are one chip.',
    },
    {
      start: MONITOR_MIRROR_BASE + MONITOR_SIZE,
      end: VIDEO_RAM_BASE - 1,
      label: 'Unmapped',
      kind: 'reserved',
      note: 'The second hole in the decoder, and the last address space before video RAM.',
    },
    {
      start: VIDEO_RAM_BASE,
      end: 0xffff,
      label: 'Video RAM',
      kind: 'screen',
      note: 'One 64-byte scanline stride per line, of which the low 48 bytes are displayed as six pixels each. The 16 bytes above them are ordinary RAM, and the Monitor keeps its variables in the tails of the first eight lines.',
    },
  ],
  // No udgBase: the character generator is in ROM and there is no user-defined
  // graphics area to POKE.
};
