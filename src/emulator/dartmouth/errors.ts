// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The two fault tables Dartmouth BASIC had, and the difference between them is
 * the difference between the two halves of the machine.
 *
 * BASIC was **compiled** here. The compiler read the whole program, listed
 * every fault it could see - one line each, each naming the line it is on - and
 * then refused to run it. The run-time reported one fault and said which line
 * it was on. So a compile fault is plural and a run fault is singular.
 *
 * Whether a run fault *stops* the program is a machine fact rather than a
 * language one, and the two machines here differ: the 1965 run-time stopped on
 * every one of its fourteen, while the GE-635's supplies a value for a dozen of
 * them and carries on - a division by zero becomes the largest number the
 * format holds, a square root of a negative one the root of its absolute value.
 * Which faults a machine survives is the profile's `continues` list; this table
 * only says what each fault is.
 *
 * The wording is two different things for the two machines. The 1965 strings
 * survive only inside a compiler image of unstated licence, so the entries they
 * name are written from the fault each one reports rather than copied. The
 * GE-635's are printed in *BASIC, Fourth Edition* section 2.8, and where that
 * manual's spelling differs from the reconstruction below the profile carries
 * the difference as a `messages` override. All lower case either way, because
 * the Teletype had one alphabet and the surviving listings are lower case
 * throughout for the same reason.
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
  | 'NO_NUMERIC_DATA'
  | 'NO_STRING_DATA'
  | 'UNDEFINED_FUNCTION'
  | 'UNDEFINED_NUMBER'
  | 'PROGRAM_TOO_LONG'
  | 'TOO_MUCH_DATA'
  | 'TOO_MANY_LOOPS'
  | 'NEXT_WITHOUT_FOR'
  | 'FOR_WITHOUT_NEXT'
  | 'UNFINISHED_DEF'
  | 'NESTED_DEF'
  | 'WRONG_ARGUMENT_COUNT'
  | 'WRONG_SUBSCRIPT_COUNT'
  | 'ILLEGAL_MAT_TRANSPOSE'
  | 'ILLEGAL_MAT_FUNCTION'
  | 'ILLEGAL_MAT_MULTIPLE'
  | 'MISMATCHED_STRING'
  | 'OUT_OF_ROOM';

/**
 * A fault the running program reports. Whether the run survives it is the
 * machine's to say - see the note above and `DartmouthProfile.continues`.
 */
export type RunErrorCode =
  | 'OUT_OF_DATA'
  | 'SQR_OF_NEGATIVE'
  | 'LOG_OF_NEGATIVE'
  | 'LOG_OF_ZERO'
  | 'EXP_TOO_LARGE'
  | 'RETURN_BEFORE_GOSUB'
  | 'SUBSCRIPT'
  | 'DIVISION_BY_ZERO'
  | 'OVERFLOW'
  | 'UNDERFLOW'
  | 'ZERO_TO_NEGATIVE_POWER'
  | 'NEGATIVE_TO_POWER'
  | 'GOSUBS_TOO_DEEP'
  | 'DIMENSION_ERROR'
  | 'ON_OUT_OF_RANGE'
  | 'INPUT_FORMAT';

export type DartmouthErrorCode = CompileErrorCode | RunErrorCode;

/** What a machine spells differently from the table below. */
export type DartmouthMessages = Partial<Record<DartmouthErrorCode, string>>;

const MESSAGES: Record<DartmouthErrorCode, string> = {
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
  NO_NUMERIC_DATA: 'no numeric data',
  NO_STRING_DATA: 'no string data',
  UNDEFINED_FUNCTION: 'undefined function',
  UNDEFINED_NUMBER: 'undefined line number',
  PROGRAM_TOO_LONG: 'program too long',
  TOO_MUCH_DATA: 'too much data',
  TOO_MANY_LOOPS: 'too many loops',
  NEXT_WITHOUT_FOR: 'next with no matching for',
  FOR_WITHOUT_NEXT: 'for with no next',
  UNFINISHED_DEF: 'unfinished def',
  NESTED_DEF: 'nested def',
  WRONG_ARGUMENT_COUNT: 'incorrect number of arguments',
  WRONG_SUBSCRIPT_COUNT: 'incorrect number of subscripts',
  ILLEGAL_MAT_TRANSPOSE: 'illegal mat transpose',
  ILLEGAL_MAT_FUNCTION: 'illegal mat function',
  ILLEGAL_MAT_MULTIPLE: 'illegal mat multiple',
  MISMATCHED_STRING: 'mismatched string operation',
  OUT_OF_ROOM: 'out of room',

  // Run time.
  OUT_OF_DATA: 'no data left to read',
  SQR_OF_NEGATIVE: 'square root of a negative number',
  LOG_OF_NEGATIVE: 'log of a negative number',
  LOG_OF_ZERO: 'log of zero',
  EXP_TOO_LARGE: 'exp too large',
  RETURN_BEFORE_GOSUB: 'return with no gosub',
  SUBSCRIPT: 'subscript out of range',
  DIVISION_BY_ZERO: 'division by zero',
  OVERFLOW: 'number too large',
  UNDERFLOW: 'number too small',
  ZERO_TO_NEGATIVE_POWER: 'zero raised to a negative power',
  NEGATIVE_TO_POWER: 'negative number raised to a power',
  GOSUBS_TOO_DEEP: 'gosubs nested too deeply',
  DIMENSION_ERROR: 'dimension error',
  ON_OUT_OF_RANGE: 'on evaluated out of range',
  INPUT_FORMAT: 'input is not a number, type it again',
};

/**
 * The text a Teletype printed for a fault, without its line number. `spellings`
 * is the machine's own wording where it differs from the reconstruction.
 */
export function errorMessage(
  code: DartmouthErrorCode,
  spellings: DartmouthMessages = {},
): string {
  return spellings[code] ?? MESSAGES[code];
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
