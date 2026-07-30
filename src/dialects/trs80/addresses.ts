/**
 * The TRS-80's fixed hardware addresses, declared once for the whole dialect.
 *
 * Every other module - the tokenizer, the block linter, the cassette and disk
 * file formats, the machine and its memory - imports from here rather than
 * repeating a literal, so a layout fact has exactly one definition to change.
 *
 * The Model I/III layout these describe:
 *
 *   0x0000-0x2FFF  12K Level II BASIC ROM
 *   0x3000-0x37FF  memory-mapped I/O page (disk/printer; open bus otherwise)
 *   0x3800-0x3BFF  keyboard matrix (read-only)
 *   0x3C00-0x3FFF  1K video RAM (64x16 character map)
 *   0x4000-...     RAM (the original shipped 4K/16K; the IDE gives it 16K+)
 */

/** End of the 12K Level II BASIC ROM; RAM-side addressing starts above it. */
export const ROM_SIZE = 0x3000;

/** First byte of the memory-mapped I/O page (disk and printer latches). */
export const IO_BASE = 0x3000;

/** First byte of the keyboard matrix; reads decode the row from the address. */
export const KEYBOARD_BASE = 0x3800;

/** Last byte of the keyboard matrix. */
export const KEYBOARD_END = 0x3bff;

/** First byte of the 1K video RAM: a 64x16 character map, one byte per cell. */
export const VIDEO_BASE = 0x3c00;

/** Size of the video RAM in bytes (64 columns x 16 rows). */
export const VIDEO_SIZE = 0x0400;

/** First byte of user RAM, immediately above the video page. */
export const RAM_BASE = 0x4000;

/**
 * Last byte of RAM on the 16K model. The dialect validates memory blocks
 * against the smallest configuration a program is likely to meet rather than
 * the most generous; 32K reaches 0xBFFF and 48K 0xFFFF.
 */
export const RAM_END_16K = 0x7fff;

/**
 * Where Level II BASIC stores the tokenized program (TXTTAB). Line records run
 * from here with absolute forward links, so this address is baked into the
 * program image itself and not merely into where it is loaded.
 */
export const PROG_START = 0x42e9;
