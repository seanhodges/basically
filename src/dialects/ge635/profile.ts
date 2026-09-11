// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { DartmouthProfile } from '../../emulator/dartmouth/profile';
import {
  ge635Charset,
  plainChar,
  parseChar,
  BELL,
  CR,
  LF,
  SPACE,
} from './charset';
import { ge635Keywords } from './keywords';
import { MAX_LINE_NUMBER } from './tokenizer';
import {
  elapsedLine,
  formatNumber,
  GE635_EXP_LIMIT,
  GE635_MAX,
  GE635_MIN,
} from './values';

/**
 * What the GE-635 supplies to the shared Dartmouth interpreter.
 *
 * Every figure here is read off *BASIC, Fourth Edition* (Kemeny and Kurtz,
 * Dartmouth College Computation Center, 1 January 1968) and cites the section
 * that states it. No compiler listing survives for this machine, so nothing
 * below is an implementation detail: where the manual gives a rule this states
 * it, and where the manual is silent this says so and leaves the field out. A
 * limit nobody can cite is worse than no limit, because it rejects programs the
 * machine ran.
 *
 * That is why {@link DartmouthLimits} is nearly empty here where the GE-235's
 * is full. Section 2.8 names `FORS NESTED TOO DEEPLY`, `GOSUB NESTED TOO
 * DEEPLY` and `TOO MANY CONSTANTS` as faults the machine could report, and
 * gives a number for none of them - the constants entry comes closest, at
 * section 2.9's "only 100 constants may occur in the program", but the same
 * sentence exempts "certain simple constants - such as small integers" without
 * saying which, so the figure cannot be enforced as stated. What section 2.9
 * does give outright is the whole-program budget, and that is below.
 */

/**
 * Words of user space the whole program has to fit inside. Section 2.9: "let
 * C = no. of characters in program, M = no. of components in all vectors and
 * matrices, S = no. of strings; then C/4 + M + S < 8000 is a requirement." Four
 * characters to a thirty-six-bit word. The machine's answer for a program that
 * fails it is `OUT OF ROOM`, and `C` is what the terminal's `LENGTH` command
 * reports.
 */
const MAX_PROGRAM_WORDS = 8000;

/**
 * The teletype line, which is three columns wider than the GE-235's. Section
 * 2.1, on `TAB`: "the positions on a line are numbered from 0 through 74, and
 * 75 is assumed to be the position 0 again." The same section divides that line
 * into "five zones of fifteen spaces each" - which is exactly the 75, where the
 * GE-235's five zones overhang its 72-column paper.
 */
export const GE635_COLUMNS = 75;

export const GE635_PROFILE: DartmouthProfile = {
  keywords: ge635Keywords,

  charset: {
    mapping: ge635Charset,
    // Seven bits: section 2.7's code table runs "from 0 through 127", so this
    // machine's codes are ASCII and a six-bit frame would lose half of each.
    codeMask: 0x7f,
    cr: CR,
    lf: LF,
    bell: BELL,
    // No tab, fill or end-of-message code: section 2.7 lists five "additional
    // symbols useful on output" and names none of the three. The GE-235 has all
    // three off its compiler listing; here the silence is left standing rather
    // than filled with a plausible ASCII byte.
    space: SPACE,
    plainChar,
    parseChar,
  },

  numbers: {
    max: GE635_MAX,
    min: GE635_MIN,
    expLimit: GE635_EXP_LIMIT,
    format: formatNumber,
  },

  printer: {
    columns: GE635_COLUMNS,
    zoneWidth: 15,
    zones: 5,
    // A comma moves to the next zone and nothing else: no word alignment is
    // described, and none is needed on a line the zones divide exactly.
    zoneAlign: 1,
    // No break column. Section 2.1's printed run of `PRINT 2↑N;` breaks each
    // line where the next value would have passed column 75 rather than at any
    // fixed column, so the break belongs to the item - see the interpreter's
    // printValue, which is where this null is read.
    semicolonBreak: null,
  },

  /**
   * The fourth edition's rules, each the *later* reading of something the
   * February 1965 language did differently:
   *
   *  - **strings** (2.7): string variables and vectors, strings in `DATA`,
   *    `INPUT` and comparisons, and the second `DATA` block that goes with them.
   *  - **chained assignment** (1.7.1): "more generally several variables may be
   *    assigned the same value by a single LET statement", as `50 LET X = Y3 =
   *    A(3,1) = 1`.
   *  - **the apostrophe remark** (2.5): "place an ' (apostrophe) at the end of
   *    the line, followed by a remark."
   *  - **`INT` floors** (2.2): "it gives the greatest integer not greater than
   *    x. Thus INT(2.35) = 2, INT(-2.35) = -3" - where the 1965 run-time walks
   *    toward zero from both sides, so `INT(X+.5)` rounds here and trims there.
   *  - **`RND` is bare** (2.2): "the form of RND does not require an argument",
   *    and the manual's own examples read `INT(10*RND)`.
   *  - **the loop tests on entry** (1.7.7): "if you write 50 FOR Z = 2 TO -2,
   *    without a negative step size, the body of the loop will not be
   *    performed."
   *  - **a whole exponent is multiplied out** (2.8): "(-3)↑3 is correctly
   *    computed to give -27", where only a fractional one falls back to the
   *    absolute value.
   *  - **`DEF` takes any number of parameters** (2.2): "each function defined
   *    may have zero, one, two, or more variables", and may run over several
   *    lines to an `FNEND`.
   */
  language: {
    strings: true,
    chainedAssignment: true,
    apostropheRemark: true,
    integerPart: 'floor',
    rndArgument: 'none',
    loopTest: 'entry',
    powerOfNegative: 'integer-exponent',
    functionParameters: 'any',
  },

  limits: {
    maxLineNumber: MAX_LINE_NUMBER,
    maxProgramWords: MAX_PROGRAM_WORDS,
  },

  /**
   * The faults this machine prints and then carries on past, which is section
   * 2.8's own division of its run-time table. Each of these says what the
   * computer "supplies" and that it "continues running the program"; the four
   * that are not here - out of data, subscript, return before gosub, gosub
   * nested too deeply, a dimension inconsistency and an `ON` out of range -
   * each say instead that "the program stops".
   *
   * This is the largest behavioural difference between the two machines in this
   * family. A fourth-edition program can divide by zero, take the root of a
   * negative number and overflow its format, and still reach its `END` with the
   * faults printed above the answers.
   */
  continues: [
    'DIVISION_BY_ZERO',
    'ZERO_TO_NEGATIVE_POWER',
    'NEGATIVE_TO_POWER',
    'OVERFLOW',
    'UNDERFLOW',
    'EXP_TOO_LARGE',
    'LOG_OF_NEGATIVE',
    'LOG_OF_ZERO',
    'SQR_OF_NEGATIVE',
  ],

  /**
   * Where section 2.8's printed wording differs from the reconstruction the
   * GE-235 is written against. These are the manual's own strings, which is a
   * thing this dialect can say and its sibling cannot.
   */
  messages: {
    SUBSCRIPT: 'subscript error',
    GOSUBS_TOO_DEEP: 'gosub nested too deeply',
    OUT_OF_DATA: 'out of data',
    NEGATIVE_TO_POWER: 'absolute value raised to power',
    ZERO_TO_NEGATIVE_POWER: 'zero to a negative power',
    OVERFLOW: 'overflow',
    UNDERFLOW: 'underflow',
    INPUT_FORMAT: 'input data not in correct format - retype it',
    ILLEGAL_INSTRUCTION: 'illegal instruction',
    ILLEGAL_FORMULA: 'illegal formula',
    ILLEGAL_VARIABLE: 'illegal variable',
    ILLEGAL_CONSTANT: 'illegal constant',
    ILLEGAL_RELATION: 'illegal relation',
    ILLEGAL_NUMBER: 'illegal line number',
    INCORRECT_FORMAT: 'illegal format',
    END_NOT_LAST: 'end is not last',
    NO_END: 'no end instruction',
    UNDEFINED_FUNCTION: 'undefined function fn',
    UNDEFINED_NUMBER: 'undefined line number',
    NEXT_WITHOUT_FOR: 'next without for',
    FOR_WITHOUT_NEXT: 'for without next',
    TOO_MANY_LOOPS: 'fors nested too deeply',
    DIMENSION_TOO_LARGE: 'dimension too large',
  },

  elapsedLine,
};
