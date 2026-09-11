// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { DartmouthProfile } from '../../emulator/dartmouth/profile';
import {
  ge235Charset,
  plainChar,
  parseChar,
  BELL,
  CR,
  EOM,
  FILL,
  LF,
  SPACE,
  TAB,
} from './charset';
import { ge235Keywords } from './keywords';
import { MAX_LINES, MAX_LINE_NUMBER } from './tokenizer';
import { elapsedLine, formatNumber, GE235_MAX, GE235_MIN } from './values';

/**
 * What the GE-235 supplies to the shared Dartmouth interpreter: the vocabulary
 * of 8 February 1965, the 6-bit BCD set the tape and the Teletype spoke, the
 * sizes of the tables the run-time allocated in a core store of 8192 words, and
 * the handful of executor rules the fourth edition later changed.
 *
 * The figures below are read off `BA-1`, the compiler and run-time source, and
 * each says which span of it produced it. `memoryMap.test.ts` checks two of
 * them against the drawn memory map, so a number that drifts from the map
 * fails.
 *
 * What this file does not declare, it references. The control codes are slots
 * in `charset.ts`'s own code table, `MAX_LINES` and `MAX_LINE_NUMBER` are the
 * compiler's bounds on a tape, and the arithmetic format is `values.ts`. Each
 * carries its citation where it is declared; restating any of them here would
 * give one figure two homes to drift between.
 */

/**
 * How deep `FOR` loops may nest. The compiler builds its loop table three words
 * to a loop in a 42-word area and gives up on the fourteenth.
 */
const MAX_LOOP_DEPTH = 13;

/**
 * How deep `GOSUB` may nest. The run-time's return stack is the gap between the
 * end of its working storage and the start of the generated constants, one word
 * to a return.
 */
export const MAX_GOSUB_DEPTH = 162;

/**
 * How many `DATA` constants a program may carry. The run-time's data region is
 * 256 words and a number is two of them.
 */
export const MAX_DATA_CONSTANTS = 128;

/**
 * The Teletype Model 33's own line, which is the paper this machine printed on.
 * The run-time lays that line out in five fifteen-character zones - wider than
 * the paper between them, which is why a fifth-zone item can reach the margin.
 */
export const GE235_COLUMNS = 72;

/** The run-time counts a line in three-character words, and tabs to one. */
const WORD = 3;

/**
 * Column at which `;` gives up and starts a new line rather than run off the
 * end of the paper: the run-time compares the line against 22 whole words.
 */
const SEMICOLON_BREAK = 22 * WORD;

export const GE235_PROFILE: DartmouthProfile = {
  keywords: ge235Keywords,

  charset: {
    mapping: ge235Charset,
    // Six bits: every code in this machine's set fits the BCD frame the tape
    // reader and the paper roll punch and print.
    codeMask: 0o77,
    cr: CR,
    lf: LF,
    bell: BELL,
    tab: TAB,
    fill: FILL,
    eom: EOM,
    space: SPACE,
    plainChar,
    parseChar,
  },

  numbers: {
    max: GE235_MAX,
    min: GE235_MIN,
    format: formatNumber,
  },

  printer: {
    columns: GE235_COLUMNS,
    zoneWidth: 15,
    zones: 5,
    zoneAlign: WORD,
    semicolonBreak: SEMICOLON_BREAK,
  },

  /**
   * The February 1965 language, which is the whole of what the executor may do
   * here. Every one of these is the *earlier* reading of a rule the fourth
   * edition later changed, and each is the compiler's or the run-time's own
   * behaviour rather than an omission: there are no strings at all, `LET` binds
   * one variable, no apostrophe starts a remark, `INT` walks toward zero from
   * both sides, `RND` is written with the parentheses the compiler required,
   * a `FOR` decides at its `NEXT`, a power of a negative number has no
   * logarithm and says so, and a `DEF` binds exactly one parameter.
   */
  language: {
    strings: false,
    chainedAssignment: false,
    apostropheRemark: false,
    integerPart: 'truncate',
    rndArgument: 'required',
    loopTest: 'exit',
    powerOfNegative: 'fault',
    functionParameters: 'one',
  },

  limits: {
    maxLines: MAX_LINES,
    maxLineNumber: MAX_LINE_NUMBER,
    maxLoopDepth: MAX_LOOP_DEPTH,
    maxGosubDepth: MAX_GOSUB_DEPTH,
    maxDataConstants: MAX_DATA_CONSTANTS,
  },

  // Every fault in this run-time's message table is marked as terminating the
  // run, so there is nothing this machine prints and carries on past.
  continues: [],

  elapsedLine,
};
