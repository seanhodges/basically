import type { MemoryMap } from '../types';

/**
 * Acorn Atom memory map for the memory-map viewer, as the emulated
 * `Atom-Tape-FP` machine boots (kernel + floating-point + BASIC ROMs).
 *
 * The 6502 sees a flat 64K space. Main RAM runs from 0x0000 up to the video
 * memory: the zero page and stack, then the OS/BASIC/floating-point workspace,
 * then the BASIC program text from 0x2900 (TEXT_START) up to the MC6847 screen
 * at 0x8000 (RAM_TOP) - see the constants in the Atom machine adapter. The VDG
 * screen occupies 0x8000-0x9FFF (text uses the first 1K; graphics modes use
 * more). Above that: a 4K paged extension slot at 0xA000, the device I/O block
 * at 0xB000 (the 8255 PPIA keyboard/tape port, the VIA and the bank latch), and
 * the 16K of ROM at 0xC000-0xFFFF (BASIC, floating point and the kernel).
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
 *  - `./addresses.ts` for the text start and video base.
 */
export const atomMemoryMap: MemoryMap = {
  addressSpace: 0x10000,
  regions: [
    {
      start: 0x0000,
      end: 0x00ff,
      label: 'Zero page',
      kind: 'system',
      group: 'System workspace',
      note: 'The 6502 zero page: kernel, BASIC and floating-point working storage.',
    },
    {
      start: 0x0100,
      end: 0x01ff,
      label: '6502 stack',
      kind: 'system',
      group: 'System workspace',
      note: 'The processor stack (subroutine returns and temporary storage).',
    },
    {
      start: 0x0200,
      end: 0x28ff,
      label: 'OS & BASIC workspace',
      kind: 'system',
      group: 'System workspace',
      note: 'Kernel, BASIC and floating-point workspace below the program. BASIC text begins at 0x2900.',
    },
    {
      start: 0x2900,
      end: 0x7fff,
      label: 'BASIC program & variables',
      kind: 'program',
      note: 'The BASIC program and its variables, from TEXT_START (0x2900) up to the screen at 0x8000. Where your program lives.',
    },
    {
      start: 0x8000,
      end: 0x9fff,
      label: 'Video RAM',
      kind: 'screen',
      note: 'The MC6847 VDG display memory. Text mode uses 0x8000-0x83FF; graphics modes use more of this 8K.',
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
