// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MemoryMap } from '../types';
import {
  BASIC_BASE,
  BASIC_TOP,
  DEFAULT_HIMEM,
  DEFAULT_LOMEM,
  KBD,
  MONITOR_BASE,
  RAM_TOP,
} from './addresses';

/**
 * The 64K space as an Apple I fills it, which is mostly to say how little of it
 * is fitted.
 *
 * Four kilobytes of RAM sit at the bottom, one page of I/O at `$D010`, the
 * jumpered block Integer BASIC loads into at `$E000`, and the monitor PROM in
 * the last page. Everything between `$1000` and `$CFFF` is simply not there:
 * the board decodes it, nothing answers, and a read returns the last thing on
 * the bus - which this emulator reports as `$FF`.
 *
 *   $0000-$00FF  Zero page: the monitor's scratch and Integer BASIC's pointers
 *   $0100-$01FF  The 6502 hardware stack
 *   $0200-$027F  The monitor's input buffer, where a typed line is assembled
 *   $0280-$07FF  Free RAM below LOMEM - where a machine-code block goes
 *   $0800-$0FFF  The BASIC workspace: variables up from LOMEM, program down
 *                from HIMEM - which is the top of the fitted RAM, so a stock
 *                machine has nothing above it to raise HIMEM into
 *   $1000-$BFFF  Not fitted
 *   $C000-$C0FF  The cassette interface's decode window (with an ACI fitted)
 *   $C100-$CFFF  The ACI's own PROM, and the rest of the expansion space
 *   $D010-$D013  The 6821 PIA: keyboard and display
 *   $E000-$EFFF  Integer BASIC
 *   $F000-$FEFF  Not fitted
 *   $FF00-$FFFF  WozMon, and the reset vector at $FFFC that points into it
 *
 * The PIA is the one region whose bounds are not the chip's own: the board hands
 * the 6821 its page select and A4 alone, so the four registers repeat every 16
 * bytes across the whole of `$D000-$DFFF`. The map names the four addresses the
 * manual gives and calls the rest of the page what it is - the same chip, seen
 * again.
 *
 * Regions are contiguous, ascending and cover the whole space; the shared
 * `memoryMap.test.ts` enforces that. There is no screen region because there is
 * no screen memory: the display is a shift register the CPU can only push
 * characters into one at a time. No `udgBase`, there being no user-defined
 * graphics - nor any graphics at all.
 */
export const apple1MemoryMap: MemoryMap = {
  addressSpace: 0x10000,
  regions: [
    {
      start: 0x0000,
      end: 0x00ff,
      label: 'Zero page',
      kind: 'system',
      group: 'System area',
      note: "The monitor's scratch and Integer BASIC's pointers: LOMEM ($4A), HIMEM ($4C), PP ($CA), PV ($CC) and the line pointer PLINE ($DC).",
    },
    {
      start: 0x0100,
      end: 0x01ff,
      label: 'Processor stack',
      kind: 'system',
      group: 'System area',
      note: 'The 6502 hardware stack (page 1). Integer BASIC nests GOSUB eight deep on it.',
    },
    {
      start: 0x0200,
      end: 0x027f,
      label: 'Input buffer',
      kind: 'buffer',
      group: 'System area',
      note: 'Where the monitor assembles a typed line, and where Integer BASIC crunches it to tokens before storing it. The 255-byte line limit comes from the token cursor into this buffer.',
    },
    {
      start: 0x0280,
      end: DEFAULT_LOMEM - 1,
      label: 'Free RAM',
      kind: 'reserved',
      note: 'On-board RAM below LOMEM. BASIC never touches it, which makes it the place a machine-code block goes.',
    },
    {
      start: DEFAULT_LOMEM,
      end: DEFAULT_HIMEM - 1,
      label: 'BASIC workspace',
      kind: 'program',
      note: 'Variables grow up from LOMEM (2048/$0800) and the program grows down from HIMEM (4096/$1000). The two meet in the middle, and a program that closes the gap answers *** MEM FULL ERR.',
    },
    {
      start: RAM_TOP + 1,
      end: 0xbfff,
      label: 'Not fitted',
      kind: 'reserved',
      note: 'Decoded but empty on a stock machine: nothing drives the bus here, and a read returns $FF.',
    },
    {
      start: 0xc000,
      end: 0xc0ff,
      label: 'Cassette interface',
      kind: 'reserved',
      group: 'Expansion',
      note: "The ACI card's decode window: $C081 reads the tape input, $C000 toggles the output flip-flop.",
    },
    {
      start: 0xc100,
      end: 0xcfff,
      label: 'Expansion PROM',
      kind: 'reserved',
      group: 'Expansion',
      note: "The ACI's 256-byte PROM at $C100, started from the monitor with C100R, and the rest of the expansion space above it.",
    },
    {
      start: 0xd000,
      end: KBD - 1,
      label: 'PIA (mirrored)',
      kind: 'system',
      group: 'I/O',
      note: 'The board decodes only the page and A4, so the four PIA registers repeat every 16 bytes through this whole page.',
    },
    {
      start: KBD,
      end: KBD + 3,
      label: '6821 PIA',
      kind: 'system',
      group: 'I/O',
      note: 'Keyboard data ($D010, ASCII with bit 7 set) and control ($D011, bit 7 = a key is waiting); display data ($D012, bit 7 = busy) and control ($D013).',
    },
    {
      start: KBD + 4,
      end: 0xdfff,
      label: 'PIA (mirrored)',
      kind: 'system',
      group: 'I/O',
      note: 'The same four registers again, for the rest of the page.',
    },
    {
      start: BASIC_BASE,
      end: BASIC_TOP,
      label: 'Integer BASIC',
      kind: 'rom',
      note: "Woz's interpreter. RAM on the real machine - it arrived on tape and a program really can overwrite it - but it is loaded from the supplied image here and treated as the machine's firmware.",
    },
    {
      start: BASIC_TOP + 1,
      end: MONITOR_BASE - 1,
      label: 'Not fitted',
      kind: 'reserved',
      note: 'Empty: the monitor is only one page long and sits at the very top.',
    },
    {
      start: MONITOR_BASE,
      end: 0xffff,
      label: 'WozMon',
      kind: 'rom',
      note: 'The 256-byte monitor PROM, and the reset vector at $FFFC that points into it. Without it the machine cannot start.',
    },
  ],
};
