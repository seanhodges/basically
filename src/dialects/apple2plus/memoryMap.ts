// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MemoryMap } from '../types';
import {
  HIRES_PAGE1,
  HIRES_PAGE2,
  IO_BASE,
  IO_TOP,
  RAM_TOP,
  ROM_TOP,
  TEXT_PAGE1,
  TEXT_PAGE2,
} from '../apple2/addresses';
import { BASIC_BASE, BASIC_TOP, MONITOR_BASE } from './addresses';

/**
 * The 64K space as an Apple II Plus fills it: 48K of RAM, one page of wires,
 * and 12K of firmware above them.
 *
 *   $0000-$00FF  Zero page: the monitor's scratch and Applesoft's pointers
 *   $0100-$01FF  The 6502 hardware stack
 *   $0200-$02FF  The monitor's input buffer, where a typed line is assembled
 *   $0300-$03FF  Page 3: free RAM, with the Autostart Monitor's vectors on top
 *   $0400-$07FF  Text and lo-res page 1 - the screen the machine comes up on
 *   $0800-$BFFF  The BASIC workspace: program up from $0801, strings down
 *                from MEMSIZ
 *   $C000-$C0FF  The I/O page, which is switches rather than memory
 *   $C100-$CFFF  Peripheral card ROM space, empty on this machine
 *   $D000-$FFFF  The ROM window: Applesoft in five sockets, then the monitor
 *
 * The board is the sibling Apple II's and its bounds are imported from
 * `../apple2/addresses` rather than restated, so the two maps cannot disagree
 * about the hardware. What they disagree about correctly is the firmware: this
 * window is one 10K interpreter and a different monitor, with no Programmer's
 * Aid socket and nothing unpopulated.
 *
 * ### Why the hi-res pages are `program` even though HGR draws there
 *
 * The sibling's Integer BASIC cannot reach hi-res at all, so calling its pages
 * workspace costs nothing. Applesoft can: `HGR` draws in page 1 and `HGR2` in
 * page 2, and those 16K really are screen memory whenever a listing uses them.
 *
 * They are still the workspace, and that is the honest answer rather than the
 * convenient one. The cold start puts the program at `$0801` and `MEMSIZ` at
 * `$C000` and reserves nothing in between, so a program of six kilobytes has
 * already grown into page 1 and `HGR` will erase what it grew into - which is
 * why an Applesoft listing that draws types `HIMEM: 8192` first. Colouring
 * those pages `screen` would claim for the display memory that a stock program
 * is using, and would say the collision cannot happen. They are named as
 * sub-regions of the workspace instead, with the trap in the note.
 *
 * The viewer's own contract says the same thing from the other side: it takes
 * the program's base from the first `program` region and needs that run
 * uninterrupted, and it colours one screen region per machine. Text page 1 is
 * that region here, being the one page whose purpose is fixed. Text page 2 goes
 * the same way as the hi-res pages and for the same reason, with the program
 * sitting in the middle of it from `$0801`.
 *
 * The workspace begins at `$0800` rather than at `TXTTAB`, which is the byte
 * below the program holding the zero link the interpreter reads a line record
 * behind - the same arrangement as the Commodore ROMs, and the reason
 * `src/dialects/memoryMap.test.ts` grants this machine the same one-byte
 * offset between the region and the program base.
 *
 * Regions are contiguous, ascending and cover the whole space, which
 * `memoryMap.test.ts` alongside enforces. No `udgBase` - the character
 * generator is a mask ROM on the video side of the board and nothing in the
 * address space reaches it, so there are no user-defined graphics to point at.
 */
export const apple2plusMemoryMap: MemoryMap = {
  addressSpace: 0x10000,
  regions: [
    {
      start: 0x0000,
      end: 0x00ff,
      label: 'Zero page',
      kind: 'system',
      group: 'System area',
      note: "The monitor's scratch and Applesoft's pointers: TXTTAB ($67), VARTAB ($69), ARYTAB ($6B), STREND ($6D), FRETOP ($6F), MEMSIZ ($73) and the executing line CURLIN ($75).",
    },
    {
      start: 0x0100,
      end: 0x01ff,
      label: 'Processor stack',
      kind: 'system',
      group: 'System area',
      note: 'The 6502 hardware stack (page 1). Applesoft nests FOR and GOSUB on it too, and ?OUT OF MEMORY ERROR is what running out of it says.',
    },
    {
      start: 0x0200,
      end: 0x02ff,
      label: 'Input buffer',
      kind: 'buffer',
      group: 'System area',
      note: "Where the monitor's GETLN assembles a typed line before Applesoft tokenizes it. 239 characters of it are kept and anything past that is dropped.",
    },
    {
      start: 0x0300,
      end: 0x03ef,
      label: 'Free RAM',
      kind: 'reserved',
      group: 'Page 3',
      note: 'The one page neither the firmware nor the workspace claims, which makes it where a machine-code block goes.',
    },
    {
      start: 0x03f0,
      end: 0x03ff,
      label: 'Firmware vectors',
      kind: 'system',
      group: 'Page 3',
      note: "The Autostart Monitor's state: the BRK vector ($03F0), the RESET re-entry SOFTEV ($03F2) and its check byte PWREDUP ($03F4), Applesoft's & vector ($03F5), the monitor's CTRL-Y ($03F8), NMI ($03FB) and IRQ ($03FE). A block across SOFTEV turns RESET from 'back to the listing' into 'lose it'.",
    },
    {
      start: TEXT_PAGE1,
      end: TEXT_PAGE2 - 1,
      label: 'Text and lo-res page 1',
      kind: 'screen',
      note: 'The screen the machine comes up on, and the same bytes twice over: 40x24 characters in TEXT, and 40x48 stacked colour nibbles in GR. Rows are interleaved - row r starts at $400 + 128*(r mod 8) + 40*(r div 8) - and the 8 bytes past each row are scratch the video counter skips.',
    },
    {
      start: TEXT_PAGE2,
      end: HIRES_PAGE1 - 1,
      label: 'Program and variables',
      kind: 'program',
      group: 'BASIC workspace',
      note: 'The tokenized program starts at 2049/$0801 and never moves, with a zero link byte below it at $0800; the scalars follow it at VARTAB, then the arrays at ARYTAB. Text page 2 is the first kilobyte of this - selectable with POKE -16299,0, and on a stock machine a picture of the program itself.',
    },
    {
      start: HIRES_PAGE1,
      end: HIRES_PAGE2 - 1,
      label: 'Hi-res page 1',
      kind: 'program',
      group: 'BASIC workspace',
      note: 'Where HGR draws: 8K of raster, 280x192 at 7 pixels a byte. Nothing reserves it, so a program past about 6K has grown into the page HGR is about to clear - which is what HIMEM: 8192 before HGR is for.',
    },
    {
      start: HIRES_PAGE2,
      end: 0x5fff,
      label: 'Hi-res page 2',
      kind: 'program',
      group: 'BASIC workspace',
      note: 'Where HGR2 draws, on the same terms as page 1 and with HIMEM: 16384 as the corresponding protection.',
    },
    {
      start: 0x6000,
      end: RAM_TOP,
      label: 'String space',
      kind: 'program',
      group: 'BASIC workspace',
      note: 'Strings are built downwards from MEMSIZ (49152/$C000, the top of the fitted RAM) rather than beside the variables, so the top of memory holds the oldest survivor and FRE(0) is the gap in the middle. It collects garbage only when it has to, which is the pause a string-heavy program takes.',
    },
    {
      start: IO_BASE,
      end: 0xc00f,
      label: 'Keyboard data',
      kind: 'buffer',
      group: 'I/O',
      note: 'PEEK(-16384) reads the last key with bit 7 set while it is still waiting. Reading does not clear it - the strobe below does.',
    },
    {
      start: 0xc010,
      end: 0xc01f,
      label: 'Keyboard strobe',
      kind: 'buffer',
      group: 'I/O',
      note: 'Any access clears bit 7 of the latch, which is what POKE -16368,0 is for. Reading here throws the switch exactly as writing does.',
    },
    {
      start: 0xc020,
      end: 0xc02f,
      label: 'Cassette output',
      kind: 'buffer',
      group: 'I/O',
      note: 'Toggles the tape output flip-flop. Driven a cycle at a time by the monitor and by SAVE; not modelled by this emulator.',
    },
    {
      start: 0xc030,
      end: 0xc03f,
      label: 'Speaker',
      kind: 'buffer',
      group: 'I/O',
      note: 'Any access moves the cone one way. The machine has no tone generator: every sound it makes is a program toggling this at the rate it wants to hear.',
    },
    {
      start: 0xc040,
      end: 0xc04f,
      label: 'Utility strobe',
      kind: 'buffer',
      group: 'I/O',
      note: 'Pulses pin 5 of the game connector for half a microsecond. Nothing on a stock machine listens.',
    },
    {
      start: 0xc050,
      end: 0xc05f,
      label: 'Display switches',
      kind: 'buffer',
      group: 'I/O',
      note: 'Four flip-flops in address pairs: $C050/$C051 graphics or text, $C052/$C053 full screen or mixed, $C054/$C055 page 1 or 2, $C056/$C057 lo-res or hi-res. HGR, TEXT and GR are Applesoft throwing these; the four above them are the annunciator outputs.',
    },
    {
      start: 0xc060,
      end: 0xc06f,
      label: 'Game connector inputs',
      kind: 'buffer',
      group: 'I/O',
      note: 'Bit 7 of a read: the cassette input at $C060, the three pushbuttons at $C061-$C063, and the four paddle one-shots at $C064-$C067, each of which holds bit 7 high for as long as its paddle is turned.',
    },
    {
      start: 0xc070,
      end: 0xc07f,
      label: 'Paddle trigger',
      kind: 'buffer',
      group: 'I/O',
      note: 'Any access restarts all four one-shots at once, which is the timing PDL( counts out. There is no other way to read a paddle.',
    },
    {
      start: 0xc080,
      end: 0xc0ff,
      label: 'Slot device select',
      kind: 'buffer',
      group: 'I/O',
      note: 'Sixteen addresses per expansion slot, $C080 + 16*slot, wired straight to the card. Nothing answers on a machine with empty slots.',
    },
    {
      start: 0xc100,
      end: 0xc7ff,
      label: 'Slot ROM',
      kind: 'reserved',
      group: 'Expansion',
      note: 'One page of firmware per slot at $C100 + 256*slot, held on the card itself. Empty here, and an unfitted address reads as the floating bus.',
    },
    {
      start: 0xc800,
      end: IO_TOP,
      label: 'Expansion ROM',
      kind: 'reserved',
      group: 'Expansion',
      note: 'The 2K window a card with more firmware than one page switches itself into. Empty on a machine with no cards, and where a language card would put its own 4K bank.',
    },
    {
      start: BASIC_BASE,
      end: BASIC_TOP,
      label: 'Applesoft BASIC',
      kind: 'rom',
      group: 'ROM window',
      note: "Microsoft's 6502 BASIC as Apple shipped it, 10K across five sockets with no gap and no Programmer's Aid beside it. Its cold start is $E000 and its warm start $E003, which is a JMP to the command loop at $D43C.",
    },
    {
      start: MONITOR_BASE,
      end: 0xfff9,
      label: 'Autostart Monitor',
      kind: 'rom',
      group: 'ROM window',
      note: 'The monitor that starts BASIC by itself: RESET re-enters Applesoft with the listing intact rather than stopping at the * prompt the Apple II offers. It reaches the * prompt from CALL -151 instead.',
    },
    {
      start: 0xfffa,
      end: ROM_TOP,
      label: '6502 vectors',
      kind: 'rom',
      group: 'ROM window',
      note: 'NMI ($FFFA) hands on to page 3 and IRQ/BRK ($FFFE) to the monitor at $FA40. RESET ($FFFC) is $FA62, the autostart entry - the sibling Apple II points it at $FF59 instead, and that one word is the difference between the two machines.',
    },
  ],
};
