/** SAM BASIC's system variables, by name and address. */
export const SAMCOUPE_SYSVARS: Record<string, number> = {};

/**
 * The system variables and ROM entry points the emulator itself reads.
 *
 * Addresses are in the Z80's window, where the ROM's own `vars.asm` puts them.
 * The whole block lives in physical page 0 - the ROM runs with LMPR's page
 * field at 0x1F, which puts page 0 in section B - so the emulator reads them
 * off that page rather than through whatever the program has paged in.
 */

/** Line the interpreter is executing. 0xFFFF while it runs the edit line. */
export const PPC = 0x5c45;
/** Statement within that line. */
export const SUBPPC = 0x5c47;
/** Pointer to the character set, biased so glyph `c` is at CHARS + c*8. */
export const CHARS = 0x5c36;
/** Last runtime report code; 0 is "OK". */
export const ERRNR = 0x5c3a;
/** Screen mode, 0-3 for MODE 1-4. */
export const MODE = 0x5a40;
/** Paper for the two 24K modes, as matching nibbles or double bits. */
export const M23PAPP = 0x5a48;
/** Character cell size: scanlines then columns. Nine by eight after a reset. */
export const CSIZE = 0x5a36;
/** Lower-window bounds, in text rows. */
export const LWTOP = 0x5a3e;
export const LWBOT = 0x5a3f;
/** Scanlines the lower window is pushed down by, so the rows fit the screen. */
export const LSOFF = 0x5a5d;
/**
 * The four three-byte page-form pointers that bound the BASIC area, each a 16K
 * page followed by the address it appears at in the 0x8000-0xBFFF window: the
 * start of the program, its end, the end of the numeric variable area after it,
 * and the end of the area after that. The tape header records the last three as
 * offsets from `PROG`, and the loader rebuilds the whole area from them.
 */
export const PROG = 0x5a9f;
export const NVARS = 0x5a87;
export const NUMEND = 0x5a84;
export const SAVARS = 0x5a81;

/** Physical RAM top page: 0x0F on a 256K machine, 0x1F on a 512K one. */
export const PRAMTP = 0x5cb4;

/**
 * ROM addresses the emulator traps or watches. Each is the ROM's own entry
 * point, found in the v3.0 image and pinned by `samMachine.test.ts` against the
 * instructions that must be there - a replacement ROM that moves them fails the
 * check rather than silently loading nothing.
 */

/** `SABYTES` in tapex.asm: save CDE bytes from HL, type in A. */
export const ROM_SA_BYTES = 0xe608;
/** `LDBYTES` in tapex.asm: load CDE bytes to HL, expected type in A. */
export const ROM_LD_BYTES = 0xe60e;
/**
 * `MAINELP` in mainlp.asm: the top of the editor loop, reached whenever the
 * interpreter is back at the prompt - after a boot, after a program ends, and
 * after a syntax error is reported. Nothing else runs it.
 */
export const ROM_MAIN_LOOP = 0x0e8a;
/**
 * `WTFK` in mainlp.asm: the loop the boot sits in after printing its sign-on,
 * waiting for a keypress before it will hand the machine over to BASIC. A real
 * SAM needs that key pressed; so does this one.
 */
export const ROM_SIGN_ON_WAIT = 0x0fa2;
