import type { MemoryMap } from '../types';

/**
 * Acorn Atom memory map for the memory-map viewer, as the emulated
 * `Atom-Tape-FP` machine boots (kernel + floating-point + BASIC ROMs).
 *
 * The 6502 sees a flat 64K space, but the Atom populates only three runs of it.
 * A bare machine shipped with 2K; a fully expanded one - the most the board
 * takes without an off-board expansion, and what this models - has 12K: 1K of
 * block-zero RAM at 0x0000 (zero page, stack and the OS/BASIC workspace), 5K of
 * internal RAM at 0x2800 (the floating-point ROM's variables, then the BASIC
 * program from TEXT_START up to 0x3BFF), and 6K of video RAM at 0x8000 for the
 * MC6847. Everything between those runs is address space the expansion boards
 * claimed - the teletext VDG RAM, the disc controller, the peripheral window,
 * the DOS file buffers and the off-board extension RAM - and reads as open bus
 * with nothing fitted, the way the VIC-20's unfitted expansion blocks do.
 * Above the video RAM: a 4K paged extension slot at 0xA000, the device I/O
 * block at 0xB000 (the 8255 PPIA keyboard/tape port, the VIA and the bank
 * latch), and the 16K of ROM at 0xC000-0xFFFF (BASIC, floating point and the
 * kernel).
 *
 * Regions are contiguous, ascending and cover the whole 0x0000-0xFFFF space; a
 * colocated test enforces that. Leaves sharing a `group` collapse into one band
 * when the viewer is zoomed out. No `udgBase`: Atom BASIC has no ZX-style
 * `USR "letter"` UDG area.
 *
 * Sources:
 *  - *Acorn Atom Technical Manual* for the memory layout, the video RAM at
 *    #8000 and the I/O and ROM areas.
 *  - *Atom Theory and Practice* for the OS/BASIC workspace description.
 *  - `./addresses.ts` for the fitted-RAM boundaries.
 */
export const atomMemoryMap: MemoryMap = {
  addressSpace: 0x10000,
  regions: [
    {
      start: 0x0000,
      end: 0x00ff,
      label: 'Zero page',
      kind: 'system',
      group: 'Block zero RAM',
      note: 'The 6502 zero page: kernel, BASIC and floating-point working storage.',
    },
    {
      start: 0x0100,
      end: 0x01ff,
      label: '6502 stack',
      kind: 'system',
      group: 'Block zero RAM',
      note: 'The processor stack (subroutine returns and temporary storage).',
    },
    {
      start: 0x0200,
      end: 0x03ff,
      label: 'OS & BASIC workspace',
      kind: 'system',
      group: 'Block zero RAM',
      note: 'Kernel, BASIC and floating-point workspace, including the OS vectors the filing system hangs off. The last of the 1K of block-zero RAM.',
    },
    {
      start: 0x0400,
      end: 0x27ff,
      label: 'Expansion space',
      kind: 'reserved',
      note: 'Where the expansion boards went: teletext VDG RAM, the disc controller, the peripheral window and the DOS file buffers. Open bus on a machine with none of them fitted.',
    },
    {
      start: 0x2800,
      end: 0x28ff,
      label: 'Floating-point variables',
      kind: 'system',
      note: "The floating-point ROM's %A-%Z variables, at the foot of the 5K of internal RAM.",
    },
    {
      start: 0x2900,
      end: 0x3bff,
      label: 'BASIC program & variables',
      kind: 'program',
      note: 'The BASIC program and its variables, from TEXT_START (0x2900) to the top of the internal RAM. Where your program lives - 4,864 bytes of it.',
    },
    {
      start: 0x3c00,
      end: 0x7fff,
      label: 'Off-board extension RAM',
      kind: 'reserved',
      note: 'Address space for an off-board RAM expansion. Open bus on a 12K machine, so BASIC text stops below it rather than running up to the screen.',
    },
    {
      start: 0x8000,
      end: 0x97ff,
      label: 'Video RAM',
      kind: 'screen',
      note: 'The MC6847 VDG display memory, all 6K of it. Text mode uses 0x8000-0x83FF; the graphics modes use more, up to the whole 6K in CLEAR 4.',
    },
    {
      start: 0x9800,
      end: 0x9fff,
      label: 'Unfitted video RAM',
      kind: 'reserved',
      note: 'The VDG can address 8K from 0x8000, but the board holds 6K and no BASIC mode needs more. Open bus.',
    },
    {
      start: 0xa000,
      end: 0xafff,
      label: 'Extension slot',
      kind: 'reserved',
      note: 'A 4K paged ROM/RAM slot (0xA000). RAM by default on this model.',
    },
    {
      start: 0xb000,
      end: 0xbfff,
      label: 'Device I/O',
      kind: 'buffer',
      note: 'Hardware registers: the 8255 PPIA (keyboard/tape), the 6522 VIA and the extension bank latch.',
    },
    {
      start: 0xc000,
      end: 0xefff,
      label: 'Language ROMs',
      kind: 'rom',
      group: 'ROM',
      note: 'The BASIC (0xC000) and floating-point (0xD000) ROMs. Read-only - POKEs here have no effect.',
    },
    {
      start: 0xf000,
      end: 0xffff,
      label: 'Kernel ROM',
      kind: 'rom',
      group: 'ROM',
      note: 'The Atom operating-system (kernel) ROM, holding the 6502 hardware vectors. Read-only.',
    },
  ],
};
