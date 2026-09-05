// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MemoryMap } from '../types';
import {
  BASIC_BASE,
  PROGRAM_BASE,
  RAM_TOP,
  RESERVED_WORDS_BASE,
  RESERVED_WORDS_END,
} from './addresses';

/**
 * The Altair's memory map for the memory-map viewer.
 *
 * Every boundary below is one of the constants in `addresses.ts`, which were
 * read off the 8K BASIC object tape rather than assumed - a plausible-looking
 * guess here would be drawn by the viewer as confidently as a correct one, so
 * nothing is in this map that could not be pointed at in the image.
 *
 * What makes this map unlike the others here:
 *
 *  - **No `rom` region.** The base Altair had no firmware; BASIC was loaded
 *    into RAM from paper tape and ran from 0x0000 upwards (see
 *    `emulator/memory.ts`). The space it occupies is therefore `system`, not
 *    `rom`: it is genuinely writable, and a stray POKE really does corrupt the
 *    interpreter.
 *  - **No `screen` or `attributes` region.** There is no video hardware to have
 *    display memory. Per the {@link import('../types').MemoryRegionKind} docs
 *    the honest answer is to omit those kinds rather than invent a region for
 *    them, so a colour keeps meaning the same thing here as on every other
 *    machine.
 *
 * One arithmetic oddity worth spelling out, because it reads like a mistake:
 * the program area starts at 0x1939, which is *inside* the footprint of the
 * 8,192-byte image - program text overwrites the image's last 1,735 bytes. That
 * is where TXTTAB points on a booted machine, and it is why the interpreter
 * band below stops at 0x1938 rather than at 0x1FFF.
 *
 * The map describes the 48K configuration `addresses.ts` documents and
 * `index.ts`'s `programRamBytes` is quoted from, which is the machine
 * `emulator/memory.ts` fits: RAM up to {@link RAM_TOP}, then an empty
 * backplane. That empty top is not decoration - 8K BASIC's cold start sizes
 * memory by writing to each location and reading it back until one fails, so it
 * needs somewhere for the walk to stop.
 */
export const altair8800MemoryMap: MemoryMap = {
  addressSpace: 0x10000,
  regions: [
    {
      start: BASIC_BASE,
      end: RESERVED_WORDS_BASE - 1,
      label: 'Interpreter entry',
      kind: 'system',
      group: 'Altair 8K BASIC',
      note: 'Where the paper tape loads and execution starts (address 0). Plain writable RAM, like the rest of the interpreter.',
    },
    {
      start: RESERVED_WORDS_BASE,
      end: RESERVED_WORDS_END,
      label: 'Reserved-word table',
      kind: 'system',
      group: 'Altair 8K BASIC',
      note: "BASIC's 70 keywords from 115, each spelled with bit 7 set on its first character - the table this dialect's token bytes were read from.",
    },
    {
      start: RESERVED_WORDS_END + 1,
      end: PROGRAM_BASE - 1,
      label: 'Interpreter & workspace',
      kind: 'system',
      group: 'Altair 8K BASIC',
      note: 'The rest of the interpreter, and the workspace holding its pointers: TXTTAB at 470, VARTAB/ARYTAB/STREND at 587-592.',
    },
    {
      start: PROGRAM_BASE,
      end: RAM_TOP,
      label: 'BASIC program & variables',
      kind: 'program',
      note: 'Program text from 6457, then variables, arrays and string space up to the top of the fitted memory boards - the 42628 BYTES FREE the sign-on reports.',
    },
    {
      start: RAM_TOP + 1,
      end: 0xffff,
      label: 'Unfitted memory',
      kind: 'reserved',
      note: 'No memory board in those S-100 slots: writes vanish and reads float high. This is what BASIC hits when it sizes RAM at cold start.',
    },
  ],
  // No udgBase: no character generator, so no `USR "letter"` graphics area.
};
