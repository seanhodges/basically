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

/**
 * What the GE-235 supplies to the shared Dartmouth interpreter: the vocabulary
 * of 8 February 1965, the 6-bit BCD set the tape and the Teletype spoke, and
 * the sizes of the tables the run-time allocated in a core store of 8192 words.
 *
 * The figures below are read off `BA-1`, the compiler and run-time source, and
 * each says which span of it produced it. `memoryMap.test.ts` checks two of
 * them against the drawn memory map, so a number that drifts from the map
 * fails.
 *
 * What this file does not declare, it references. The control codes are slots
 * in `charset.ts`'s own code table, and `MAX_LINES` and `MAX_LINE_NUMBER` are
 * the compiler's bounds on a tape, which the tokenizer enforces when one is
 * punched. Both carry their citations where they are declared; restating either
 * here would give one figure two homes to drift between.
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

export const GE235_PROFILE: DartmouthProfile = {
  keywords: ge235Keywords,

  charset: {
    mapping: ge235Charset,
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

  limits: {
    maxLines: MAX_LINES,
    maxLineNumber: MAX_LINE_NUMBER,
    maxLoopDepth: MAX_LOOP_DEPTH,
    maxGosubDepth: MAX_GOSUB_DEPTH,
    maxDataConstants: MAX_DATA_CONSTANTS,
  },
};
