// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MemoryMap } from '../types';

/**
 * The GE-235's core store, as the memory-map viewer draws it.
 *
 * **Every address here is a word, not a byte.** The machine's store is twenty
 * bits wide and is addressed a word at a time - three characters pack into one
 * word - so `addressSpace` counts words and so does every boundary below. That
 * is the one thing to hold in mind reading this file: a "location" is 20 bits,
 * and a number takes two of them.
 *
 * The other machines here address bytes, and the difference is not cosmetic:
 * the same span looks eight times smaller and every figure in a note is a word
 * count.
 *
 * Two more things make this map unlike the rest:
 *
 *  - **The machine is shared.** The store below is one time-sharing user's view
 *    of it. The executive is resident at the bottom, and everything from
 *    {@link USER_AREA} up is the "6K area" - the 6,080 words swapped to disk
 *    when the next user's turn comes.
 *  - **There is no ROM, no screen and no hardware buffer worth the name.** Core
 *    store is writable throughout, the terminal is a teletype on a serial
 *    channel rather than display memory, and the only buffers in the map are
 *    the executive's own.
 *
 * The boundaries are the compiler's own allocation, which opens `BA-1` under
 * the heading "primary memory allocation" and is quoted here in the octal the
 * listing writes it in. Where a boundary is the end of a run of `bss`
 * reservations rather than a `loc` directive, the reservations are named and
 * summed below rather than the answer being written out - a plausible-looking
 * address would be drawn as confidently as a correct one.
 *
 * Three figures fall out of that arithmetic and are checked against the running
 * interpreter in `memoryMap.test.ts`: 240 lines (the line table, two words a
 * line), 128 `DATA` constants (the data region, two words a number), and 162
 * nested `GOSUB`s (the words between the run-time's working storage and the
 * generated constants, one word a return).
 */

/**
 * Words of core one instruction can address: the machine's address field is
 * thirteen bits, and the listing calls the top of it "top of lower memory".
 *
 * The store is twice this. The second bank holds whichever language processor
 * the executive has read in - the BASIC compiler itself is assembled to run
 * there, from `0o20000` up - and a running program cannot reach it without the
 * bank bit, which is why the run-time subroutines it does need are copied down
 * into {@link RUNTIME_WORK}. It is not mapped because none of it belongs to the
 * user: the executive swaps it for another system between one user and the
 * next.
 */
export const CORE_WORDS = 0o20000;

/** The executive's constants, entry points and trap words (`org 128`). */
const EXEC_VECTORS = 0o200;

/** Where the executive keeps its teletype and disk buffers. */
const EXEC_BUFFERS = 0o600;

/**
 * `work` - where the executive copies BASIC's constants and run-time
 * subroutines before a program runs.
 */
export const RUNTIME_WORK = 0o1400;

/** Words copied into {@link RUNTIME_WORK}, which fills it exactly. */
const RUNTIME_WORK_WORDS = 1280;

/** The save area: one 64-word disk record, shared with the executive. */
export const SAVE_AREA = 0o4000;

/** The foot of the 6K area, which is everything from here to the top. */
export const USER_AREA = 0o4100;

/** `f`, the table of compiled line addresses: two words to a line. */
export const LINE_TABLE_WORDS = 480;

/** `n`, the table the compiler builds `FOR` loops in: three words to a loop. */
const LOOP_TABLE_WORDS = 42;

/** `d`, the run-time's `DATA` region: two words to a number. */
export const DATA_REGION_WORDS = 256;

/** Sum a table of word reservations. */
const words = (table: Record<string, number>) =>
  Object.values(table).reduce((total, n) => total + n, 0);

/**
 * The compiler's buffers, in the order it reserves them from {@link USER_AREA}.
 * The run-time lays its own storage over the same words: an 860-word output
 * buffer, the `FOR` stack, the expression stack, and the return stack that
 * fills whatever is left below {@link COMMON_TABLES}.
 */
const COMPILE_WORKSPACE = {
  errorMessages: 400,
  workingStorage: 72,
  temporaries: 24,
  lineBuffer: 80,
  lineTable: LINE_TABLE_WORDS,
  arithBuffer: 150,
  arithWorking: 50,
  loopTable: LOOP_TABLE_WORDS,
};

/** `exl` - the first word the compiler and the run-time share. */
export const COMMON_TABLES = USER_AREA + words(COMPILE_WORKSPACE);

/**
 * The run-time's own storage, laid over the same words from {@link USER_AREA}
 * once the compiler has finished with them.
 */
const RUNTIME_STORAGE = {
  outputBuffer: 860,
  loopStack: 104,
  expressionStack: 100,
  standardRoutines: 22,
  workingStorage: 50,
};

/**
 * `rst` - the GOSUB return stack, one word to a return. It is not reserved: it
 * is whatever the run-time's storage leaves below {@link COMMON_TABLES}, which
 * is what fixes how deep GOSUB may nest.
 */
export const RETURN_STACK_WORDS =
  COMMON_TABLES - (USER_AREA + words(RUNTIME_STORAGE));

/**
 * The tables both halves read, in the order they are reserved. The 22 unused
 * words are the compiler's own padding, there to bring {@link DATA_REGION} to a
 * multiple of 64 so it lands on a disk record boundary.
 */
const COMMON_TABLE_WORDS = {
  generatedConstants: 150,
  goTable: 80,
  communication: 42,
  padding: 22,
  fileControl: 4,
  dataPointers: 4,
  dataRegion: DATA_REGION_WORDS,
  diskParity: 1,
  dataRecordPointer: 1,
  functionTable: 28,
  dimensionTable: 54,
};

/** `d` - the foot of the `DATA` region. */
export const DATA_REGION =
  COMMON_TABLES +
  COMMON_TABLE_WORDS.generatedConstants +
  COMMON_TABLE_WORDS.goTable +
  COMMON_TABLE_WORDS.communication +
  COMMON_TABLE_WORDS.padding +
  COMMON_TABLE_WORDS.fileControl +
  COMMON_TABLE_WORDS.dataPointers;

/** `p` - where the compiler starts writing the object program. */
export const PROGRAM_AREA = COMMON_TABLES + words(COMMON_TABLE_WORDS);

/**
 * `vartab` - the symbol table, one slot for every name the language can spell.
 * The compiler hands variable storage out downwards from the top of it, which
 * is why the listing calls the table "destroyed at run time".
 */
export const SYMBOL_TABLE = 0o17326;

export const ge235MemoryMap: MemoryMap = {
  addressSpace: CORE_WORDS,
  regions: [
    {
      start: 0,
      end: EXEC_VECTORS - 1,
      label: 'Index registers',
      kind: 'system',
      group: 'Time-sharing executive',
      note: 'The machine keeps its index registers in core, four words to a group, with the executive’s own working storage above them.',
    },
    {
      start: EXEC_VECTORS,
      end: EXEC_BUFFERS - 1,
      label: 'Executive vectors',
      kind: 'system',
      group: 'Time-sharing executive',
      note: 'Interrupt and arithmetic-unit trap words and the executive’s entry points. BASIC writes its own overflow and underflow branches into words 133 and 134 as it starts, so a number too large to hold reaches its message rather than the executive’s.',
    },
    {
      start: EXEC_BUFFERS,
      end: RUNTIME_WORK - 1,
      label: 'Executive buffers',
      kind: 'buffer',
      group: 'Time-sharing executive',
      note: 'Teletype output and disk buffers, shared by everyone signed on - the only hardware buffers the machine has. The terminal is a serial channel rather than display memory, so none of this is a screen.',
    },
    {
      start: RUNTIME_WORK,
      end: SAVE_AREA - 1,
      label: 'BASIC run-time',
      kind: 'system',
      note: `${RUNTIME_WORK_WORDS} words of constants and run-time subroutines, copied down from the system image before a program runs. They live here rather than beside the rest of BASIC because a compiled program can only address one bank of core.`,
    },
    {
      start: SAVE_AREA,
      end: USER_AREA - 1,
      label: 'Save area',
      kind: 'system',
      note: 'One 64-word disk record: the clock, the output pointer, the program’s length and the registers. Written out when a user is swapped off the machine mid-program, and read back to resume.',
    },
    {
      start: USER_AREA,
      end: COMMON_TABLES - 1,
      label: 'Compiler workspace',
      kind: 'system',
      group: 'Compiler and run-time workspace',
      note: `Error buffer, line buffer, and the ${LINE_TABLE_WORDS}-word table of compiled line addresses that fixes the ${LINE_TABLE_WORDS / 2}-line limit. The run-time reuses the same words for the teletype output buffer, the FOR stack and the GOSUB return stack.`,
    },
    {
      start: COMMON_TABLES,
      end: PROGRAM_AREA - 1,
      label: 'Shared tables',
      kind: 'system',
      group: 'Compiler and run-time workspace',
      note: `What the compiler fills in and the run-time reads: generated constants, the branch table, the ${DATA_REGION_WORDS}-word DATA region holding ${DATA_REGION_WORDS / 2} constants, the DEF FN transfer table and the dimension table.`,
    },
    {
      start: PROGRAM_AREA,
      end: SYMBOL_TABLE - 1,
      label: 'Object program',
      kind: 'program',
      group: 'User program area',
      note: 'Compiled code grows up from here while the source text sits at the top of the area waiting to be read. Variables grow down to meet it, and when they do the compilation stops with "program too long".',
    },
    {
      start: SYMBOL_TABLE,
      end: CORE_WORDS - 1,
      label: 'Variables and symbol table',
      kind: 'program',
      group: 'User program area',
      note: 'One symbol-table slot for every name the language can spell, and above it the first variables: each number is two words, handed out downwards from the top of core. The table is only needed while the program compiles, so variable storage is free to grow down over it.',
    },
  ],
  // No udgBase: no character generator and no graphics, so nothing to point at.
};
