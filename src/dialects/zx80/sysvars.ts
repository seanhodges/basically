/**
 * ZX80 system variable addresses.
 *
 * The ZX80's 40-byte system variable block occupies 0x4000-0x4027; user memory
 * (program, then VARS, then the edit line, then the display file at the top)
 * begins at 0x4028. A .O file (and tape SAVE) is a straight RAM dump from
 * 0x4000 up to the end of the display file.
 *
 * The pointer offsets below were confirmed by booting the real ROM and reading
 * back the populated system variables (see emulator/zx80Machine.test.ts):
 * on an empty machine VARS=0x4028 (its 0x80 end-marker), E_LINE=0x4029 and
 * D_FILE=0x402b.
 */
export const SYSVARS_BASE = 0x4000;
/** Bytes of system variables stored before user memory. */
export const SYSVARS_LENGTH = 0x28;
/** First byte of user memory: the BASIC program area. */
export const PROGRAM_BASE = 0x4028;

export const ERR_NR = 0x4000;
export const FLAGS = 0x4001;
export const PPC = 0x4002; // line number of line being executed
export const SV_4004 = 0x4004; // editor pointer (mirrors E_LINE on an empty machine)
export const VARS = 0x4008; // start of the variables area
export const E_LINE = 0x400a; // start of the edit / work line
export const D_FILE = 0x400c; // start of the display file (top of memory)
export const DF_END = 0x400e; // end-of-display pointer (recomputed by the lister)
export const DF_EA = 0x4010; // working display pointer (recomputed by the lister)

/**
 * ROM entry points used by the flash loader (see emulator/zx80Machine.ts),
 * mapped from a disassembly of the real 4K ROM and confirmed on the live
 * machine:
 *  - LOAD's tape-read loop polls `IN A,(0xFE)` at 0x020C while waiting for the
 *    leader tone; that is the safe point to drop the image in.
 *  - 0x0283 is where a real tape LOAD hands control back: it rebuilds the edit
 *    line and display file from the freshly loaded system variables, then
 *    drops into the main editor loop.
 */
export const ROM_LOAD_TRAP = 0x020c;
export const ROM_POST_LOAD = 0x0283;
