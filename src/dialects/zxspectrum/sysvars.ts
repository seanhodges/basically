/**
 * ZX Spectrum system variable addresses (48K BASIC), plus the fixed ROM
 * addresses the machine traps. Shared by the 48K and 128K dialects - the 128's
 * BASIC runs in the same 48 BASIC ROM, so it uses these unchanged.
 *
 * Only the handful the variable watcher, the block linter and the tape traps
 * need are defined here.
 */

/** VARS: 16-bit LE pointer to the start of the BASIC variables area. */
export const VARS = 0x5c4b;
/** E_LINE: 16-bit LE pointer just past the variables area (upper bound). */
export const E_LINE = 0x5c59;
/** ERR_NR: last report code minus one (0xFF = "0 OK"). See reports.ts. */
export const ERR_NR = 0x5c3a;
/** PPC: line number of the statement being / last executed. */
export const PPC = 0x5c45;
/** PROG: 16-bit LE pointer to the start of the BASIC program. */
export const PROG = 0x5c53;
/** STKEND: 16-bit LE pointer past the calculator stack - top of used memory. */
export const STKEND = 0x5c65;
/** RAMTOP: 16-bit LE address of the last byte of BASIC's RAM. */
export const RAMTOP = 0x5cb2;

/**
 * Where the BASIC program starts on a freshly booted 48K machine (23755): just
 * above the system variables and the channel information block. This is the
 * value PROG holds at the READY prompt, and where the memory map's program
 * region begins.
 */
export const PROG_BASE = 0x5ccb;

/** ROM tape-loader entry (LD-BYTES); trapped for flash loading. */
export const ROM_LD_BYTES = 0x0556;
/** ROM tape-saver entry (SA-BYTES); trapped for VFS data saves. */
export const ROM_SA_BYTES = 0x04c2;
/** ROM "R Tape loading error" report entry (RST 8, code 0x1A). */
export const ROM_REPORT_R = 0x0806;

/**
 * The main loop's `HALT`, reached only when the `CALL $1B8A` (LINE-RUN) above
 * it returns - which for a typed `RUN` is when the program stops. Every way a
 * program ends comes back through it exactly once (falling off the end, STOP,
 * an error, BREAK), and nothing that is still running does, including a program
 * waiting at an `INPUT` prompt.
 *
 * Not once per frame, despite being where the editor waits: the loop reaches it
 * once per completed command line and spends the wait elsewhere. That is also
 * the trap - the command lines a load types (`LOAD ""`, and the `CLEAR` a
 * document with a low memory block needs) each pass through it - so the run
 * latch is armed after those, immediately before `RUN` is typed, rather than by
 * counting hits.
 */
export const ROM_PROGRAM_END = 0x1303;
