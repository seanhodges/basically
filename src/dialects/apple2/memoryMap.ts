// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MemoryMap } from '../types';
import {
  BASIC_BASE,
  BASIC_TOP,
  DEFAULT_LOMEM,
  HIRES_PAGE1,
  HIRES_PAGE2,
  IO_BASE,
  MONITOR_BASE,
  PROGRAMMERS_AID_BASE,
  RAM_TOP,
  ROM_TOP,
  TEXT_PAGE1,
  TEXT_PAGE2,
} from './addresses';

/**
 * The 64K space as an Apple II fills it: 48K of RAM, one page of wires, and the
 * ROM window above them.
 *
 *   $0000-$00FF  Zero page: the monitor's scratch and Integer BASIC's pointers
 *   $0100-$01FF  The 6502 hardware stack
 *   $0200-$02FF  The monitor's input buffer, where a typed line is assembled
 *   $0300-$03FF  Page 3: free RAM, with the firmware's three vectors at the top
 *   $0400-$07FF  Text and lo-res page 1 - the screen the machine comes up on
 *   $0800-$BFFF  The BASIC workspace, all of it: variables up from LOMEM,
 *                program down from HIMEM
 *   $C000-$C0FF  The I/O page, which is switches rather than memory
 *   $C100-$CFFF  Peripheral card ROM space, empty on this machine
 *   $D000-$FFFF  The four ROM sockets, one of them unpopulated
 *
 * ### Why the display pages are `program` and not `screen`
 *
 * Only text page 1 gets the screen colour, and it is the one page whose purpose
 * is fixed. Everything from `$0800` up is inside the stock workspace - the cold
 * start sets `LOMEM:2048` and `HIMEM:49152`, so a program and its variables may
 * legitimately occupy text page 2 and both hi-res pages, and on a machine with
 * Integer BASIC fitted they usually do: this interpreter has no `HGR` and
 * reaches hi-res only through `CALL`, so its 8K sits under the program unless
 * the listing lowers `HIMEM:` to clear it. Colouring those pages `screen` would
 * claim RAM for the display that the running program is actually using, and
 * would break the workspace into pieces the viewer draws as unrelated bands.
 * They are named as sub-regions of the workspace instead, which is what the
 * hardware makes them: memory the video counter *can* be pointed at.
 *
 * Regions are contiguous, ascending and cover the whole space, which
 * `memoryMap.test.ts` alongside enforces. No `udgBase` - the character
 * generator is a mask ROM on the video side of the board and nothing in the
 * address space reaches it, so there are no user-defined graphics to point at.
 */
export const apple2MemoryMap: MemoryMap = {
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
      note: 'The 6502 hardware stack (page 1). Integer BASIC nests GOSUB sixteen deep on it, and answers *** 16 GOSUBS ERR on the seventeenth.',
    },
    {
      start: 0x0200,
      end: 0x02ff,
      label: 'Input buffer',
      kind: 'buffer',
      group: 'System area',
      note: 'Where the monitor assembles a typed line and Integer BASIC crunches it to tokens, reading from one end and writing tokens from the other. The 255-byte line limit is on the sum of the two.',
    },
    {
      start: 0x0300,
      end: 0x03f7,
      label: 'Free RAM',
      kind: 'reserved',
      group: 'Page 3',
      note: 'The one page neither the firmware nor the workspace claims, which makes it where a machine-code block goes.',
    },
    {
      start: 0x03f8,
      end: 0x03ff,
      label: 'Firmware vectors',
      kind: 'system',
      group: 'Page 3',
      note: "The monitor's CTRL-Y jump ($03F8), the NMI vector ($03FB, where $FFFA points) and the interrupt vector ($03FE). Read but never written, so a block may sit here as long as it raises none of the three.",
    },
    {
      start: TEXT_PAGE1,
      end: TEXT_PAGE2 - 1,
      label: 'Text and lo-res page 1',
      kind: 'screen',
      note: 'The screen the machine comes up on, and the same bytes twice over: 40x24 characters in TEXT, and 40x48 stacked colour nibbles in GR. Rows are interleaved - row r starts at $400 + 128*(r mod 8) + 40*(r div 8) - and the 8 bytes past each row are scratch the video counter skips.',
    },
    {
      start: DEFAULT_LOMEM,
      end: HIRES_PAGE1 - 1,
      label: 'Workspace (low)',
      kind: 'program',
      group: 'BASIC workspace',
      note: 'Variables grow up from LOMEM (2048/$0800), which is where the cold start puts it. Text page 2 is the first kilobyte of it: selectable with POKE -16299,0, and the workspace unless the listing raises LOMEM: past it.',
    },
    {
      start: HIRES_PAGE1,
      end: HIRES_PAGE2 - 1,
      label: 'Hi-res page 1',
      kind: 'program',
      group: 'BASIC workspace',
      note: '8K the video counter can be pointed at, 280x192 at 7 pixels a byte. Integer BASIC has no HGR and never draws here, so it is workspace until a listing lowers HIMEM: to clear it for a CALLed routine.',
    },
    {
      start: HIRES_PAGE2,
      end: 0x5fff,
      label: 'Hi-res page 2',
      kind: 'program',
      group: 'BASIC workspace',
      note: 'The second hi-res raster, selected by POKE -16297,0. Workspace on the same terms as page 1.',
    },
    {
      start: 0x6000,
      end: RAM_TOP,
      label: 'Workspace (high)',
      kind: 'program',
      group: 'BASIC workspace',
      note: 'The program grows DOWN from HIMEM (49152/$C000, the top of the fitted RAM), so the last line typed sits lowest and the top of memory holds the first. It meets the variables in the middle, and *** MEM FULL ERR is the two touching.',
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
      note: 'Four flip-flops in address pairs: $C050/$C051 graphics or text, $C052/$C053 full screen or mixed, $C054/$C055 page 1 or 2, $C056/$C057 lo-res or hi-res. The four above them are the annunciator outputs.',
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
      end: 0xcfff,
      label: 'Expansion ROM',
      kind: 'reserved',
      group: 'Expansion',
      note: 'The 2K window a card with more firmware than one page switches itself into. Empty on a machine with no cards.',
    },
    {
      start: PROGRAMMERS_AID_BASE,
      end: 0xd7ff,
      label: "Programmer's Aid #1",
      kind: 'rom',
      group: 'ROM window',
      note: "Apple's own 2K add-on: renumber, append, tape verify, hi-res graphics routines and a music generator, all reached with CALL.",
    },
    {
      start: 0xd800,
      end: BASIC_BASE - 1,
      label: 'Empty socket',
      kind: 'reserved',
      group: 'ROM window',
      note: "Unpopulated with Programmer's Aid #1 fitted, that ROM being 2K in a 4K socket. Reads as $FF.",
    },
    {
      start: BASIC_BASE,
      end: BASIC_TOP,
      label: 'Integer BASIC',
      kind: 'rom',
      group: 'ROM window',
      note: "Wozniak's interpreter, in ROM on this machine rather than loaded from tape as it was on the Apple I. Started from the monitor with E000G.",
    },
    {
      start: MONITOR_BASE,
      end: 0xfff9,
      label: 'Monitor',
      kind: 'rom',
      group: 'ROM window',
      note: 'The original (non-Autostart) monitor: RESET lands at its * prompt rather than restarting anything, so a runaway program is escaped with RESET and BASIC re-entered with E2B3G, listing intact.',
    },
    {
      start: 0xfffa,
      end: ROM_TOP,
      label: '6502 vectors',
      kind: 'rom',
      group: 'ROM window',
      note: 'NMI ($FFFA) and IRQ/BRK ($FFFE) both hand on to page 3; RESET ($FFFC) is $FF59, the monitor entry that makes this an Apple II rather than a II Plus.',
    },
  ],
};
