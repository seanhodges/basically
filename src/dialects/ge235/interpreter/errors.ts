// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The two fault tables Dartmouth BASIC had, and the difference between them is
 * the difference between the two halves of the machine.
 *
 * BASIC was **compiled** here. The compiler read the whole program, listed
 * every fault it could see - one line each, each naming the line it is on - and
 * then refused to run it. The run-time reported one fault, said which line it
 * was on, and stopped there. So a compile fault is plural and a run fault is
 * singular, and nothing in this dialect resumes after either.
 *
 * The wording is ours. The machine's own strings survive only inside an image
 * of the 1965 compiler that states no terms for reuse, so these are written
 * from the fault each one reports rather than copied: the set is the machine's,
 * the phrasing is not. All lower case, because the Teletype had one alphabet
 * and the 1965 listings are lower case throughout for the same reason.
 */

/** A fault the compiler reports before the program runs. */
export type CompileErrorCode =
  | 'DIMENSION_TOO_LARGE'
  | 'ILLEGAL_CONSTANT'
  | 'ILLEGAL_FORMULA'
  | 'ILLEGAL_INSTRUCTION'
  | 'ILLEGAL_NUMBER'
  | 'ILLEGAL_RELATION'
  | 'ILLEGAL_VARIABLE'
  | 'INCORRECT_FORMAT'
  | 'END_NOT_LAST'
  | 'NO_END'
  | 'NO_DATA'
  | 'UNDEFINED_FUNCTION'
  | 'UNDEFINED_NUMBER'
  | 'PROGRAM_TOO_LONG'
  | 'TOO_MUCH_DATA'
  | 'TOO_MANY_LOOPS'
  | 'NEXT_WITHOUT_FOR'
  | 'FOR_WITHOUT_NEXT';

/** A fault the running program reports, after which the run is over. */
export type RunErrorCode =
  | 'OUT_OF_DATA'
  | 'SQR_OF_NEGATIVE'
  | 'LOG_OF_NEGATIVE'
  | 'LOG_OF_ZERO'
  | 'RETURN_BEFORE_GOSUB'
  | 'SUBSCRIPT'
  | 'DIVISION_BY_ZERO'
  | 'OVERFLOW'
  | 'UNDERFLOW'
  | 'ZERO_TO_NEGATIVE_POWER'
  | 'NEGATIVE_TO_POWER'
  | 'GOSUBS_TOO_DEEP'
  | 'INPUT_FORMAT';

export type Ge235ErrorCode = CompileErrorCode | RunErrorCode;

const MESSAGES: Record<Ge235ErrorCode, string> = {
  // Compile time.
  DIMENSION_TOO_LARGE: 'dimension too large',
  ILLEGAL_CONSTANT: 'bad constant',
  ILLEGAL_FORMULA: 'bad formula',
  ILLEGAL_INSTRUCTION: 'bad instruction',
  ILLEGAL_NUMBER: 'bad number',
  ILLEGAL_RELATION: 'bad relation',
  ILLEGAL_VARIABLE: 'bad variable',
  INCORRECT_FORMAT: 'bad format',
  END_NOT_LAST: 'end is not the last line',
  NO_END: 'no end instruction',
  NO_DATA: 'no data to read',
  UNDEFINED_FUNCTION: 'undefined function',
  UNDEFINED_NUMBER: 'undefined line number',
  PROGRAM_TOO_LONG: 'program too long',
  TOO_MUCH_DATA: 'too much data',
  TOO_MANY_LOOPS: 'too many loops',
  NEXT_WITHOUT_FOR: 'next with no matching for',
  FOR_WITHOUT_NEXT: 'for with no next',

  // Run time.
  OUT_OF_DATA: 'no data left to read',
  SQR_OF_NEGATIVE: 'square root of a negative number',
  LOG_OF_NEGATIVE: 'log of a negative number',
  LOG_OF_ZERO: 'log of zero',
  RETURN_BEFORE_GOSUB: 'return with no gosub',
  SUBSCRIPT: 'subscript out of range',
  DIVISION_BY_ZERO: 'division by zero',
  OVERFLOW: 'number too large',
  UNDERFLOW: 'number too small',
  ZERO_TO_NEGATIVE_POWER: 'zero raised to a negative power',
  NEGATIVE_TO_POWER: 'negative number raised to a power',
  GOSUBS_TOO_DEEP: 'gosubs nested too deeply',
  INPUT_FORMAT: 'input is not a number, type it again',
};

/** The text the Teletype printed for a fault, without its line number. */
export function errorMessage(code: Ge235ErrorCode): string {
  return MESSAGES[code];
}

/**
 * A fault the run-time raises. The line is filled in by the interpreter, which
 * knows which line it was executing; the compiler carries its own line on
 * {@link CompileFault} instead, because it reports several at once.
 */
export class BasicError extends Error {
  constructor(
    public readonly code: RunErrorCode,
    public line?: number,
  ) {
    super(MESSAGES[code]);
    this.name = 'BasicError';
  }
}

/**
 * A fault the compiler raises while reading a line. It carries no line of its
 * own: the compiler is walking the program in order and knows which line it is
 * on, so it pairs the code with that line as it collects the fault.
 */
export class CompileError extends Error {
  constructor(public readonly code: CompileErrorCode) {
    super(MESSAGES[code]);
    this.name = 'CompileError';
  }
}

/** One entry in the list the compiler prints before giving up on a program. */
export interface CompileFault {
  code: CompileErrorCode;
  /** The BASIC line the fault is on, or undefined for a whole-program fault. */
  line?: number;
}
