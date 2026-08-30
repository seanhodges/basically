// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The Altair 8800's fixed addresses and I/O ports, declared once for the whole
 * dialect, so a layout fact has exactly one definition to change.
 *
 * Every value here was read off the machine rather than assumed, because a
 * plausible-looking guess in this file would propagate silently into the memory
 * map, the linter and the emulator. The source is the MITS 8K BASIC paper-tape
 * image itself - the 8192-byte object tape that signs on as
 *
 *     ALTAIR BASIC REV. 4.0
 *     [EIGHT-K VERSION]
 *     COPYRIGHT 1976 BY MITS INC.
 *
 * (md5 97eead711723295e9ce4f52b300002cf, the image the SIMH AltairZ80 software
 * collection distributes as `8kbas.bin`). That is the image bundled at
 * `public/roms/altair8800.rom`, and the md5 above is what to check a
 * replacement against: another Altair BASIC boots, but nothing below is
 * promised of it. Offsets are into that image, which loads at 0x0000, so an
 * image offset and a run-time address are the same number and either can be
 * checked with a hex editor.
 *
 * Note the machine's unusual shape: Altair BASIC is **not** a ROM. The base
 * Altair had no firmware at all, and BASIC was loaded into RAM from paper tape
 * or cassette, running from 0x0000 upwards. So {@link BASIC_BASE} is where the
 * interpreter image is *copied to*, not a mapped ROM region, and everything the
 * interpreter keeps in its own workspace ({@link TXTTAB} and friends) is plain
 * writable RAM that a stray POKE can corrupt.
 */

/** Where the 8K BASIC image is loaded, and where execution starts. */
export const BASIC_BASE = 0x0000;

/** Length of the 8K BASIC object tape, in bytes. */
export const BASIC_IMAGE_SIZE = 0x2000;

/**
 * The interpreter's reserved-word table (see `keywords.ts`): each entry is its
 * spelling with bit 7 set on the *first* character, entries run back to back in
 * token order from 0x80, and a lone 0x80 byte at {@link RESERVED_WORDS_END}
 * terminates the list. Recorded here because it is where `keywords.ts` came
 * from, and the one place a future reader can re-derive that table.
 */
export const RESERVED_WORDS_BASE = 0x0073;
/** The 0x80 end marker just past the last reserved word (MID$). */
export const RESERVED_WORDS_END = 0x015a;

/**
 * TXTTAB: pointer to the first byte of the tokenized program. Confirmed by
 * booting the image and observing that this word holds {@link PROGRAM_BASE} and
 * that the first line record typed at the console lands there.
 */
export const TXTTAB = 0x01d6;

/**
 * VARTAB: pointer to the end of the program text, which is also the start of
 * the simple-variable table. Confirmed by entering a program and watching this
 * word track the byte just past the program's 0x0000 end-of-program link.
 */
export const VARTAB = 0x024b;

/** ARYTAB: end of the simple variables / start of the array table. */
export const ARYTAB = 0x024d;

/** STREND: end of the arrays; free string space starts here. */
export const STREND = 0x024f;

/**
 * Where the tokenized program text starts, and therefore what the absolute
 * next-line links in a built image are computed against (see `basicImage.ts`).
 *
 * 0x1939 is where 8K BASIC 4.0 puts TXTTAB once the cold-start dialogue is
 * answered `Y` to `WANT SIN-COS-TAN-ATN?`, which is the configuration this
 * dialect models. The address does *not* depend on the answers to `MEMORY SIZE?`
 * or `TERMINAL WIDTH?` - it was checked at 16K, 32K, 48K and 64K and did not
 * move - but it *does* depend on the trig answer, because declining the
 * transcendental functions lets the program text start lower down, on top of
 * them (see {@link PROGRAM_BASE_NO_TRIG}).
 */
export const PROGRAM_BASE = 0x1939;

/**
 * TXTTAB when the cold-start dialogue is answered `N` to
 * `WANT SIN-COS-TAN-ATN?` - 194 bytes lower, the space SIN/COS/TAN/ATN occupy.
 * Not the modelled configuration; declared so the difference is documented
 * rather than rediscovered, and so an image built for one answer is never
 * quietly loaded under the other.
 */
export const PROGRAM_BASE_NO_TRIG = 0x1877;

/**
 * Top of installed RAM for the modelled machine: 48K, 0x0000-0xBFFF.
 *
 * This is a configuration choice, not a hardware constant - an Altair had
 * whatever its owner had bought S-100 memory boards for. 48K is chosen because
 * BASIC's cold start sizes memory by writing and reading back until a location
 * fails, so the machine needs *some* unpopulated top of memory for that walk to
 * terminate, and leaving the top 16K empty matches how a real machine reserved
 * high addresses for PROM and I/O boards. In this configuration 8K BASIC 4.0
 * reports 42628 BYTES FREE, which is where `index.ts`'s `programRamBytes` comes
 * from.
 */
export const RAM_TOP = 0xbfff;

/**
 * What 8K BASIC 4.0 reports as `BYTES FREE` in its sign-on banner on the
 * modelled machine (48K fitted, transcendental functions retained), read off a
 * booted console. `index.ts` quotes it as the dialect's `programRamBytes`.
 */
export const COLD_START_BYTES_FREE = 42628;

/**
 * The address BASIC counts its free space *down to*, and therefore the ceiling
 * `readMemoryStats()` measures against.
 *
 * Not a number anyone typed: it follows from the banner above. A cold-started
 * machine has an empty program - a bare 0x0000 end-of-program link at TXTTAB -
 * so STREND sits at {@link PROGRAM_BASE} + 2 (the same arithmetic
 * `basicImage.ts` does for a loaded program), and BASIC called the space above
 * it {@link COLD_START_BYTES_FREE} bytes.
 *
 * That lands 65 bytes below the top of fitted RAM, which is BASIC keeping its
 * 50-byte default string pool - the one `CLEAR n` resizes - at the top of
 * memory, plus a handful of bytes above that it does not offer to a program.
 */
export const BASIC_FREE_TOP = PROGRAM_BASE + 2 + COLD_START_BYTES_FREE;

/**
 * Front-panel sense-switch port. 8K BASIC reads it once at cold start and
 * patches its own console driver with the port numbers of the board the high
 * nibble selects; 0 selects the 88-2SIO. {@link SENSE_SWITCHES_2SIO} is the
 * value to return.
 */
export const SENSE_SWITCH_PORT = 0xff;

/**
 * What {@link SENSE_SWITCH_PORT} must read for BASIC to drive the 88-2SIO: high
 * nibble 0 (the board select), low nibble 8 (the terminal options SIMH's own
 * `8kbas` boot script sets with `d sr 8`).
 */
export const SENSE_SWITCHES_2SIO = 0x08;

/**
 * 88-2SIO status port. After the sense-switch patch, BASIC's character-out
 * routine at 0x0547 and its character-in routine at 0x0556 both poll this port.
 */
export const SIO_STATUS_PORT = 0x10;

/** 88-2SIO data port: character in / character out. */
export const SIO_DATA_PORT = 0x11;

/**
 * Status bit 0, RDRF: a character is waiting to be read. **Active high** -
 * BASIC's input routine reads `IN 10 / ANI 01 / JZ back`, so it spins while the
 * bit is *clear*. (The flags are active-low on the 88-SIO form the *unpatched*
 * image carries - `ANI 01 / JNZ back` on port 0x00 - but not on the 6850 ACIA
 * of the 88-2SIO board BASIC patches itself to use. Worth stating explicitly
 * either way: get the polarity backwards and the machine boots and then ignores
 * every keystroke.)
 */
export const SIO_RX_READY = 0x01;

/**
 * Status bit 1, TDRE: the transmitter will accept a character. Active high, the
 * same way round as {@link SIO_RX_READY} (`IN 10 / ANI 02 / JZ back`).
 */
export const SIO_TX_READY = 0x02;

/**
 * How many characters BASIC's console line buffer holds. Typing past it gets a
 * bell and nothing else, so a longer line cannot be entered at the keyboard -
 * but it is purely an editor limit: a longer line injected straight into the
 * program text tokenizes, lists and runs normally, which is why the tokenizer
 * does not enforce it.
 */
export const CONSOLE_LINE_BYTES = 72;
