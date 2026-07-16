import type { MemoryMap } from '../types';

/**
 * BBC Master 128 memory map for the memory-map viewer, as the machine boots in
 * the IDE (MOS 3.20 + BASIC IV, powering on to MODE 7).
 *
 * The layout mirrors the Model B's, with two differences that matter to BASIC:
 * the Master's filing systems live in private RAM (ANDY/HAZEL) rather than main
 * memory, so PAGE stays at 0x0E00 - the program area starts lower than on a
 * DFS-equipped Model B - and the paged ROM at 0x8000 holds BASIC IV. The 6502
 * still sees a flat 64K space: main RAM below the MODE 7 screen (0x7C00), the
 * paged ROM slot at 0x8000-0xBFFF, the MOS ROM at 0xC000-0xFBFF and 0xFF00, and
 * memory-mapped I/O at 0xFC00-0xFEFF.
 *
 * PAGE and HIMEM move with the current MODE, but this static map uses the IDE's
 * boot state (matching what `loadProgram` reads from PAGE at &18). Regions are
 * contiguous, ascending and cover the whole 0x0000-0xFFFF space; a colocated
 * test enforces that. Leaves sharing a `group` collapse into one band when the
 * viewer is zoomed out. No `udgBase`: BBC BASIC has no ZX-style `USR "letter"`
 * UDG area.
 */
export const bbcMasterMemoryMap: MemoryMap = {
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
      end: 0x7bff,
      label: 'BASIC program & variables',
      kind: 'program',
      note: 'The BASIC program and its variables, from PAGE (0x0E00) up to HIMEM. Where your program lives.',
    },
    {
      start: 0x7c00,
      end: 0x7fff,
      label: 'Screen memory',
      kind: 'screen',
      note: 'The MODE 7 teletext screen (1K); on the Master it is normally the shadow copy. Other modes reach down to 0x3000.',
    },
    {
      start: 0x8000,
      end: 0xbfff,
      label: 'Paged ROM (BASIC IV)',
      kind: 'rom',
      group: 'ROM',
      note: 'The sideways slot; BASIC IV is paged in here. Can also page in 4K of private ANDY RAM. Read-only as seen by BASIC.',
    },
    {
      start: 0xc000,
      end: 0xfbff,
      label: 'Operating system ROM',
      kind: 'rom',
      group: 'ROM',
      note: 'The MOS 3.20 ROM. The 0xC000-0xDFFF part can page in private HAZEL RAM for the filing system. Read-only as seen by BASIC.',
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
