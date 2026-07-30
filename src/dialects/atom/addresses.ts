/**
 * The Acorn Atom's fixed hardware addresses, declared once for the whole
 * dialect. The block linter, the `.atm`/disc file formats, the cassette codec
 * and the machine all import from here rather than repeating a literal.
 *
 * The Atom addresses memory in hex with a `#` prefix, which is how these read
 * in the machine's own documentation: text from `#2900`, the VDG screen at
 * `#8000`.
 */

/**
 * Start of the BASIC program text (`#2900`). The `.atm` header stores this as
 * both the load and the execution address, so it is baked into the file format
 * as well as into where the machine puts the program.
 */
export const TEXT_START = 0x2900;

/**
 * Base of the VDG video RAM (`#8000`), which is also the ceiling of the RAM
 * contiguously available to BASIC text on the emulated `Atom-Tape-FP` model -
 * confirmed by write-probing the booted machine.
 */
export const VIDEO_BASE = 0x8000;

/** Last byte of contiguous BASIC RAM: the byte below {@link VIDEO_BASE}. */
export const RAM_END = VIDEO_BASE - 1;
