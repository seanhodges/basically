/**
 * The Commodore 64's fixed hardware addresses, declared once for the whole dialect.
 * The tokenizer, detokenizer, export targets, cassette codec, block linter and
 * machine all import from here.
 *
 * Two values describe the start of BASIC and they differ by one byte, which is
 * a real distinction rather than an off-by-one:
 *
 *  - {@link BASIC_RAM_BASE} is where BASIC's RAM begins, and where the memory
 *    map's program region starts.
 *  - {@link PROGRAM_BASE} is TXTTAB, where the first line record begins. The
 *    ROM keeps a zero link byte at the foot of BASIC RAM and starts the program
 *    after it, so TXTTAB is always one byte above the RAM base.
 *
 * A `.prg` file stores {@link PROGRAM_BASE} as its two-byte load address, so
 * the distinction is visible in the file format too.
 */

/** First byte of BASIC RAM (2048/$0800). */
export const BASIC_RAM_BASE = 0x0800;

/**
 * TXTTAB: where the tokenized BASIC program starts (2049/$0801) -
 * one byte above {@link BASIC_RAM_BASE}, past the ROM's zero link byte.
 *
 * Note: the vendored viciious core hardcodes this value twice in
 * `src/emulator/c64/viciious/tools/loadPrg.js`. That file is third-party and
 * stays untouched, so those two copies are outside this module's reach - a
 * change here has to be mirrored there by hand.
 */
export const PROGRAM_BASE = BASIC_RAM_BASE + 1;

/** Base of the default 1000-character video matrix (1024/$0400). */
export const SCREEN_BASE = 0x0400;

/** Base of the per-cell colour (attribute) RAM (55296/$D800). */
export const COLOUR_RAM_BASE = 0xd800;
