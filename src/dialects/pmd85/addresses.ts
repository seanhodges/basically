// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * BASIC-G's fixed addresses, declared once for the whole dialect so a layout
 * fact has exactly one definition to change.
 *
 * Every value here was read out of the interpreter image this project ships -
 * the second half of `public/roms/pmd85/pmd85.rom`, BASIC-G V2.0 - rather than
 * assumed from the family resemblance. The image is not addressable memory: a
 * 12-byte header (`CALL 8C00h` plus the Monitor TRANSFER routine's source
 * offset, length and destination) is followed by the interpreter body, which
 * the Monitor copies to 0x0000. So a body offset and a run-time address are the
 * same number once {@link IMAGE_BODY_OFFSET} is subtracted, and either can be
 * checked with a hex editor.
 *
 * BASIC-G is a Microsoft 8K BASIC derivative - its RST 1/2/3 vectors are
 * SYNCHR, CHRGET and the HL:DE compare, its reserved-word table has the
 * high-bit-on-first-character shape, and its statement dispatch is the familiar
 * token-0x80 index - so the addresses below have Microsoft names where the
 * interpreter is doing a Microsoft job.
 *
 * The two Monitor windows at the foot of this file are the exception to that
 * description: they are the address decoder's, not BASIC-G's. They live here
 * because two modules need them and neither may import the other - the decoder
 * in `emulator/memory.ts` answers on them, and `memoryMap.ts` draws them, and
 * the memory map is imported by the docs site, which must not reach an emulator
 * core (`src/components/machinePickerBoundary.test.ts` holds that line).
 */

/**
 * Where the ROM module's interpreter body starts, past the transfer header.
 * The header's own three bytes `CD 00 8C` are simultaneously the `0xCD` the
 * PMD 85-2 Monitor tests before auto-launching a module and the `CALL 8C00h`
 * that copies the body down - one thing, not two (see `romImage.ts`).
 */
export const IMAGE_BODY_OFFSET = 0x0c;

/** Where the Monitor copies the interpreter to, and where BASIC-G starts. */
export const BASIC_BASE = 0x0000;

/** Length of the interpreter body once copied down: 0x0000-0x23F3. */
export const BASIC_BODY_BYTES = 0x23f4;

/**
 * The reserved-word table (see `keywords.ts`): each entry is its spelling with
 * bit 7 set on the *first* character, entries run back to back in token order
 * from 0x80, and a lone 0x80 byte at {@link RESERVED_WORDS_END} terminates the
 * list. Recorded here because it is where `keywords.ts` came from, and the one
 * place a future reader can re-derive that table.
 *
 * The crunch routine loads this address minus one and pre-increments, which is
 * also where the token numbering comes from: it starts its counter at 0x7F and
 * bumps it once per entry, so the first word (END) is 0x80.
 */
export const RESERVED_WORDS_BASE = 0x1995;
/** The 0x80 end marker just past the last reserved word (DEG). */
export const RESERVED_WORDS_END = 0x1b15;

/**
 * TXTTAB, at 0x003F: pointer to the first byte of the tokenized program. Unlike
 * the Sinclair machines there is no load address in a file header - the program
 * area is plain RAM, and this word is what says where it begins.
 */
export const TXTTAB = 0x003f;

/**
 * Where the tokenized program text starts, and therefore what the absolute
 * next-line links in a built image are computed against (see `basicImage.ts`).
 *
 * It sits directly above the interpreter, which is why the number is not round:
 * the body ends at 0x23F3, the byte at 0x2400 is the zero the cold start writes
 * below the program, and the first line record begins at 0x2401.
 */
export const PROGRAM_BASE = 0x2401;

/**
 * CURLIN, at 0x5E04: the number of the line BASIC-G is executing, and
 * {@link DIRECT_MODE} when it is not executing one at all.
 *
 * The Microsoft convention, and the machine's own answer to "is a program
 * running" - the interpreter writes it as it moves from line to line and puts
 * the direct-mode marker back on every route to the prompt, whether the program
 * ran off its end, hit END or STOP, raised an error, or was broken into with
 * the STOP key. Read off a running machine rather than out of the image: the
 * word holding 100 while `100 GOTO 100` loops, and 0xFFFF the moment it is
 * stopped, is what identifies it.
 */
export const CURLIN = 0x5e04;

/** The line number CURLIN holds when BASIC-G is at its prompt. */
export const DIRECT_MODE = 0xffff;

/** VARTAB: end of the program text, and start of the simple variables. */
export const VARTAB = 0x5e7a;

/** ARYTAB: end of the simple variables, and start of the arrays. */
export const ARYTAB = 0x5e7c;

/** STREND: end of the arrays. */
export const STREND = 0x5e7e;

/**
 * Top of the stack BASIC-G sets up for itself (0x003D). Program text,
 * variables and arrays grow up from {@link PROGRAM_BASE} towards it, so the
 * two together bound what a program has to live in.
 */
export const STACK_TOP = 0x5dff;

/** BASIC-G's own workspace, immediately above the stack: 0x5E00-0x5FFF. */
export const WORKSPACE_BASE = 0x5e00;

/**
 * String space, which grows *down* from 0x6F00 (0x0041) to 0x5FFF (0x003B) -
 * above the workspace and below the ROM-command area, rather than at the top of
 * memory the way most Microsoft BASICs put it.
 */
export const STRING_TOP = 0x6f00;
export const STRING_LIMIT = 0x5fff;

/** The lowest address a string can be placed at: one above {@link STRING_LIMIT}. */
export const STRING_BASE = STRING_LIMIT + 1;

/**
 * FRETOP, at 0x5E69: the bottom of the string data currently allocated, and so
 * the moving half of the string pool's account. It holds {@link STRING_TOP}
 * when no string exists, walks down as strings are made, and jumps back up
 * when the interpreter collects.
 *
 * Read out of the shipped interpreter rather than assumed from the Microsoft
 * family, whose FRETOP sits next to STREND and is seeded from a MEMSIZ this
 * ROM does not have. Two sequences in the module body name it:
 * `2A 41 00 22 69 5E` - `LD HL,(0041)` then `LD (5E69),HL`, the cold start and
 * `CLEAR` seeding it from the 0x6F00 bound - and `2A 3B 00 EB 2A 69 5E`,
 * `LD HL,(003B)` then `LD HL,(5E69)`, the subtraction that measures what is
 * left against the 0x5FFF bound.
 */
export const FRETOP = 0x5e69;

/** Where the `ROM` statement copies a ROM-module block to, and calls. */
export const ROM_COMMAND_BASE = 0x7000;

/**
 * Where the `CODE` statement assembles the hex machine code it is given, and
 * calls. A short scratch area - the Monitor's own line-edit buffer starts at
 * 0x7F82 - so anything longer belongs in a memory block of its own.
 */
export const USER_CODE_BASE = 0x7f00;

/**
 * Highest line number BASIC-G accepts. Its line-number scanner rejects a digit
 * that would take the running value past 32767 with `Syntax err`, which is a
 * real difference from the 65529 of the Microsoft 8K BASICs it descends from.
 */
export const MAX_LINE_NUMBER = 32767;

/**
 * Where the Monitor answers on the bus, once the machine has left its startup
 * configuration: its own window at 0x8000 and the mirror at 0xA000. One chip
 * seen twice - the decoder ignores A13 - and {@link MONITOR_SIZE} in
 * `romImage.ts` is how wide each window is.
 */
export const MONITOR_BASE = 0x8000;
export const MONITOR_MIRROR_BASE = 0xa000;
