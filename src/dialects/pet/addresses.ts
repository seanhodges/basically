/**
 * The Commodore PET's fixed hardware addresses, declared once for the whole dialect.
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

/** First byte of BASIC RAM (1024/$0400). */
export const BASIC_RAM_BASE = 0x0400;

/**
 * TXTTAB: where the tokenized BASIC program starts (1025/$0401) -
 * one byte above {@link BASIC_RAM_BASE}, past the ROM's zero link byte.
 */
export const PROGRAM_BASE = BASIC_RAM_BASE + 1;

/** Base of the 1000-character screen matrix (32768/$8000). */
export const SCREEN_BASE = 0x8000;
