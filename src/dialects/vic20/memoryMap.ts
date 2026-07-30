import type { MemoryMap } from '../types';

/**
 * Commodore VIC-20 memory map for the memory-map viewer.
 *
 * The unexpanded PAL VIC-20 (5 KB RAM, BASIC V2) sees a fixed 64K address space
 * with ROM baked in - there is no banking, unlike the C64. This map describes
 * that layout as the CPU sees it at the READY prompt, which is what a BASIC
 * program runs against:
 *
 *   $0000-$03FF  Zero page, processor stack and KERNAL/BASIC workspace
 *   $0400-$0FFF  +3K RAM expansion block (unfitted - open bus)
 *   $1000-$1DFF  BASIC RAM: the program text (from $1001), then variables,
 *                arrays and the string heap - the 3583 bytes FRE reports
 *   $1E00-$1FFF  Screen matrix (22x23 = 506 cells + slack)
 *   $2000-$7FFF  8/16K RAM expansion blocks 1-3 (unfitted - open bus)
 *   $8000-$8FFF  Character generator ROM
 *   $9000-$93FF  I/O: VIC-I (6561) registers, VIA #1 and VIA #2
 *   $9400-$97FF  Colour RAM (one nibble per screen cell)
 *   $9800-$BFFF  I/O-2/3 and cartridge expansion (open bus)
 *   $C000-$DFFF  BASIC V2 ROM
 *   $E000-$FFFF  KERNAL ROM
 *
 * The three system leaves ($0000-$03FF) collapse into one "System area" band,
 * and the VIC/VIA I/O plus the colour RAM ($9000-$97FF) into one "I/O area"
 * band, when the viewer is zoomed out. Colour RAM is the VIC-20's per-cell
 * attribute area, so it carries the `attributes` colour when zoomed in.
 *
 * Regions are contiguous, ascending and cover the whole $0000-$FFFF space; a
 * colocated test enforces that. The VIC-20 has no `USR "letter"` user-defined-
 * graphics area, so `udgBase` is omitted.
 *
 * Sources:
 *  - *VIC-20 Programmer's Reference Guide*, the memory-map appendix, for the
 *    unexpanded layout, the expansion blocks and the colour RAM.
 *  - `./addresses.ts` and `../../emulator/vic20/memory.ts` for the addresses.
 */
export const vic20MemoryMap: MemoryMap = {
  addressSpace: 0x10000,
  regions: [
    {
      start: 0x0000,
      end: 0x00ff,
      label: 'Zero page',
      kind: 'system',
      group: 'System area',
      note: 'Page zero: the BASIC and KERNAL working pointers (TXTTAB, CURLIN and the rest).',
    },
    {
      start: 0x0100,
      end: 0x01ff,
      label: 'Processor stack',
      kind: 'system',
      group: 'System area',
      note: 'The 6502 hardware stack (page 1).',
    },
    {
      start: 0x0200,
      end: 0x03ff,
      label: 'System workspace',
      kind: 'system',
      group: 'System area',
      note: 'KERNAL and BASIC workspace: the input buffer, tape buffer and system vectors below the program area.',
    },
    {
      start: 0x0400,
      end: 0x0fff,
      label: '+3K expansion',
      kind: 'reserved',
      note: 'The 3K RAM expansion block. Open bus on an unexpanded machine, so BASIC leaves it out of the program area.',
    },
    {
      start: 0x1000,
      end: 0x1dff,
      label: 'BASIC program & variables',
      kind: 'program',
      note: 'BASIC RAM: the program text (from $1001) then variables, arrays and the string heap - the 3583 bytes FRE reports.',
    },
    {
      start: 0x1e00,
      end: 0x1fff,
      label: 'Screen memory',
      kind: 'screen',
      note: 'The 22x23 video matrix from 7680/$1E00: one screen code per cell.',
    },
    {
      start: 0x2000,
      end: 0x7fff,
      label: 'Block expansion',
      kind: 'reserved',
      note: 'The 8/16K RAM expansion blocks 1-3. Open bus on an unexpanded machine.',
    },
    {
      start: 0x8000,
      end: 0x8fff,
      label: 'Character ROM',
      kind: 'rom',
      note: 'The 4K character generator ROM (901460-03): the built-in glyph shapes.',
    },
    {
      start: 0x9000,
      end: 0x93ff,
      label: 'VIC-I & VIAs',
      kind: 'buffer',
      group: 'I/O area',
      note: 'The video chip (VIC-I 6561 from 36864/$9000, border/screen colour at $900F) and the two 6522 VIAs (keyboard, joystick, timers, the system IRQ).',
    },
    {
      start: 0x9400,
      end: 0x97ff,
      label: 'Colour RAM',
      kind: 'attributes',
      group: 'I/O area',
      note: "The VIC-20's per-cell colour (attribute) memory; the $1E00 screen pairs with the nibbles from 38400/$9600.",
    },
    {
      start: 0x9800,
      end: 0xbfff,
      label: 'I/O & cartridge',
      kind: 'reserved',
      note: 'The I/O-2/I/O-3 expansion areas and cartridge blocks. Open bus with nothing plugged in.',
    },
    {
      start: 0xc000,
      end: 0xdfff,
      label: 'BASIC ROM',
      kind: 'rom',
      note: 'The 8K BASIC V2 interpreter ROM (901486-01).',
    },
    {
      start: 0xe000,
      end: 0xffff,
      label: 'KERNAL ROM',
      kind: 'rom',
      note: 'The 8K KERNAL operating-system ROM (PAL 901486-07).',
    },
  ],
};
