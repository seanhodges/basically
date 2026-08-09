/**
 * The Acorn Atom's fixed hardware addresses, declared once for the whole
 * dialect. The block linter, the `.atm`/disc file formats, the cassette codec
 * and the machine all import from here rather than repeating a literal.
 *
 * The Atom addresses memory in hex with a `#` prefix, which is how these read
 * in the machine's own documentation: text from `#2900`, the VDG screen at
 * `#8000`.
 *
 * The figures describe a fully expanded Atom - 12K of RAM, the most the board
 * takes without an off-board expansion: 1K of block-zero RAM at `#0000`, 5K of
 * internal RAM at `#2800-#3BFF`, and 6K of video RAM at `#8000-#97FF`. The
 * *Acorn Atom Technical Manual*'s memory map labels `#2800` floating-point
 * variables and `#2900` onwards the text space, and marks `#3C00` upwards as
 * off-board extension RAM - which is why BASIC text stops at `#3BFF` and not at
 * the screen.
 */

/**
 * First address above the 1K of block-zero RAM (`#0400`): the zero page, the
 * 6502 stack and the OS/BASIC workspace, the only RAM a bare Atom shipped with
 * besides the 1K of video.
 */
export const BLOCK_ZERO_TOP = 0x0400;

/**
 * Base of the 5K of internal RAM (`#2800`). The floating-point ROM keeps its
 * `%A`-`%Z` variables in this first page; BASIC text starts on the next one.
 */
export const FP_VARS_BASE = 0x2800;

/**
 * Start of the BASIC program text (`#2900`). The `.atm` header stores this as
 * both the load and the execution address, so it is baked into the file format
 * as well as into where the machine puts the program.
 */
export const TEXT_START = 0x2900;

/**
 * First address above the internal RAM (`#3C00`): the ceiling BASIC text and
 * its variables grow towards. Everything from here to the screen is the
 * off-board extension RAM an unexpanded Atom does not have.
 */
export const TEXT_TOP = 0x3c00;

/** Last byte of BASIC RAM: the byte below {@link TEXT_TOP}. */
export const RAM_END = TEXT_TOP - 1;

/** Base of the VDG video RAM (`#8000`). */
export const VIDEO_BASE = 0x8000;

/**
 * First address above the fitted video RAM (`#9800`). The VDG can address 8K
 * from {@link VIDEO_BASE}, but the board holds 6K, which is all the highest
 * BASIC mode (`CLEAR 4`, 256x192) needs.
 */
export const VIDEO_TOP = 0x9800;

/** Base of the 4K paged extension ROM/RAM slot (`#A000`), above the video RAM. */
export const EXTENSION_SLOT_BASE = 0xa000;
