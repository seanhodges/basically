import type { MemoryMap } from '../types';

/**
 * BBC Micro Model B memory map for the memory-map viewer, as the machine boots
 * in the IDE (OS 1.20 + BASIC II + DFS, powering on to MODE 7).
 *
 * The 6502 sees a flat 64K space. Below the screen is main RAM: the 6502 zero
 * page and stack, the OS and current-language (BASIC) workspace, the system
 * buffers, then - because the DFS is present - its private workspace at
 * 0x0E00-0x18FF, which pushes PAGE (the start of the BASIC program) up to
 * 0x1900. The BASIC program and its variables run from PAGE to HIMEM (0x7C00 in
 * MODE 7), and the MODE 7 teletext screen occupies the last 1K of RAM. The top
 * 32K is ROM and I/O: the paged (sideways) ROM slot at 0x8000-0xBFFF holds BASIC
 * II, the MOS ROM covers 0xC000-0xFBFF and the vectors at 0xFF00, and the
 * memory-mapped I/O (FRED/JIM/SHEILA) sits at 0xFC00-0xFEFF.
 *
 * PAGE and HIMEM move with the DFS and the current MODE, but this static map
 * uses the IDE's boot state (matching what `loadProgram` reads from PAGE at
 * &18). Regions are contiguous, ascending and cover the whole 0x0000-0xFFFF
 * space; a colocated test enforces that. Leaves sharing a `group` collapse into
 * one band when the viewer is zoomed out. No `udgBase`: BBC BASIC has no ZX-style
 * `USR "letter"` UDG area.
 *
 * Sources:
 *  - *BBC Microcomputer Advanced User Guide* (Bray, Dickens & Holmes), the
 *    memory-map chapter, for the zero page, stack, OS and language workspace,
 *    buffers, paged ROM and vector names.
 *  - Acorn's DFS documentation for the &0E00-&18FF filing-system workspace that
 *    pushes PAGE to &1900.
 *  - `./addresses.ts` and `../../emulator/bbc/addresses.ts` for the addresses.
 */
export const bbcMicroMemoryMap: MemoryMap = {
  addressSpace: 0x10000,
  regions: [
    {
      start: 0x0000,
      end: 0x00ff,
      label: 'Zero page',
      kind: 'system',
      group: 'System workspace',
      note: 'The 6502 zero page: OS, filing-system and BASIC working storage.',
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
      end: 0x03ff,
      label: 'OS workspace',
      kind: 'system',
      group: 'System workspace',
      note: 'Operating-system variables and the interrupt/event vectors.',
    },
    {
      start: 0x0400,
      end: 0x07ff,
      label: 'Language workspace',
      kind: 'system',
      group: 'System workspace',
      note: "BASIC's private workspace, including the integer variables @% and A%-Z%.",
    },
    {
      start: 0x0800,
      end: 0x0dff,
      label: 'Buffers & ROM workspace',
      kind: 'buffer',
      note: 'Sound, printer and serial buffers, soft keys, user-defined characters and paged-ROM workspace.',
    },
    {
      start: 0x0e00,
      end: 0x18ff,
      label: 'DFS workspace',
      kind: 'reserved',
      note: 'Private RAM claimed by the Disc Filing System, which pushes PAGE up to 0x1900.',
    },
    {
      start: 0x1900,
      end: 0x7bff,
      label: 'BASIC program & variables',
      kind: 'program',
      note: 'The BASIC program and its variables, from PAGE up to HIMEM. Where your program lives.',
    },
    {
      start: 0x7c00,
      end: 0x7fff,
      label: 'Screen memory',
      kind: 'screen',
      note: 'The MODE 7 teletext screen (1K). Other display modes reach down as far as 0x3000.',
    },
    {
      start: 0x8000,
      end: 0xbfff,
      label: 'Paged ROM (BASIC)',
      kind: 'rom',
      group: 'ROM',
      note: 'The sideways ROM slot; BASIC II is paged in here. Read-only.',
    },
    {
      start: 0xc000,
      end: 0xfbff,
      label: 'Operating system ROM',
      kind: 'rom',
      group: 'ROM',
      note: 'The Machine Operating System (MOS). Read-only.',
    },
    {
      start: 0xfc00,
      end: 0xfeff,
      label: 'Memory-mapped I/O',
      kind: 'buffer',
      note: 'Hardware registers: FRED (0xFC00), JIM (0xFD00) and SHEILA (0xFE00) - the 6845 CRTC, VIAs, ACIA and more.',
    },
    {
      start: 0xff00,
      end: 0xffff,
      label: 'OS ROM (vectors)',
      kind: 'rom',
      group: 'ROM',
      note: 'The top of the MOS ROM, holding the 6502 hardware vectors. Read-only.',
    },
  ],
};
