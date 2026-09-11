// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { CharsetMapping, KeywordInfo } from '../../dialects/types';
import type { DartmouthMessages, RunErrorCode } from './errors';

/**
 * What one Dartmouth machine supplies to the shared interpreter.
 *
 * The runtime in this folder is the language's, not a machine's: the same
 * executor, evaluator, paper roll and keyboard served every BASIC that ran
 * under the Dartmouth Time-Sharing System. What separated one from the next was
 * the vocabulary the compiler decoded, the character set the tape and the
 * Teletype spoke, the sizes of the tables the run-time allocated, and - between
 * two editions of the language three years apart - a handful of rules the
 * executor itself follows. A profile is those things and nothing else, so a
 * machine is added by writing one rather than by editing anything here.
 *
 * Every figure a profile carries is a fact about a particular machine, read off
 * that machine's own evidence. The interface below says what each governs and
 * in what units; the *why that number* belongs beside the value, in the dialect
 * that declares it.
 *
 * A word on what is **not** here. Most of what the fourth edition added over
 * the 1965 language gates itself through {@link keywords}: the executor has
 * cases for `MAT`, `ON`, `CHANGE`, `RESTORE`, `RANDOMIZE` and `FNEND`, but a
 * machine whose vocabulary lacks the word never lexes one, so the statement is
 * unreachable there and needs no switch. Only rules that change how a word both
 * machines *have* behaves - what `INT` does with a negative number, whether
 * `FOR` tests on the way in - reach {@link DartmouthLanguage}.
 */
export interface DartmouthProfile {
  /**
   * The whole vocabulary, which is also the whole statement set: the lexer
   * matches these greedily wherever a letter starts, and a word that is not
   * here is read as a variable name instead. Adding a spelling the executor has
   * no case for turns a program that used to be an illegal instruction into one
   * that is still an illegal instruction, but later - at the line, not the
   * compile.
   */
  readonly keywords: readonly KeywordInfo[];

  /** The codes the tape carries and the Teletype prints. */
  readonly charset: DartmouthCharset;

  /** The arithmetic format: what it can hold, and how it printed. */
  readonly numbers: DartmouthNumbers;

  /** How wide the paper is, and how `PRINT` lays a line out on it. */
  readonly printer: DartmouthPrinter;

  /** The rules the executor follows that differ between the two editions. */
  readonly language: DartmouthLanguage;

  /** The sizes of the run-time's own tables, in the units each names. */
  readonly limits: DartmouthLimits;

  /**
   * Run faults this machine prints and then carries on past, having supplied a
   * value for the computation that failed. Every other run fault stops the
   * program. The 1965 machine's list is empty; the GE-635's is most of the
   * arithmetic table (section 2.8), which is why a fourth-edition program can
   * divide by zero and still reach its `END`.
   */
  readonly continues: readonly RunErrorCode[];

  /** Where this machine's own wording for a fault differs from the default. */
  readonly messages?: DartmouthMessages;

  /**
   * The line the time-sharing executive closed a run with, given the processor
   * seconds it used. Time-sharing charged for the machine and said what it had
   * charged for, so a program that printed nothing still left a mark on the
   * paper - but the two systems said it differently.
   */
  elapsedLine(seconds: number): string;
}

/**
 * A machine's character set, as one replaceable unit.
 *
 * It is a bundle rather than loose members because it is replaced wholesale:
 * two machines that differ here differ in every one of these at once - the
 * mapping, the codes, the width and the two per-code helpers all describe the
 * same encoding, and mixing halves of two of them would decode nothing.
 */
export interface DartmouthCharset {
  /** Editor text <-> machine codes, the same mapping a listing is written in. */
  readonly mapping: CharsetMapping;

  /**
   * How wide a code is, as the mask the tape reader and the paper roll apply to
   * everything handed to them. Six bits (`0o77`) for a machine speaking the
   * GE-235's BCD; seven (`0x7f`) for one speaking ASCII. It is the first thing
   * a new machine has to get right: a set masked to six bits loses the top half
   * of every ASCII code, so `A` and `!` become the same character.
   */
  readonly codeMask: number;

  /** Ends a line on the tape, and returns the carriage without feeding paper. */
  readonly cr: number;
  /** Advances the paper without returning the carriage. */
  readonly lf: number;
  /** Rings the terminal's bell; prints nothing. */
  readonly bell: number;
  /** Tabs, where the machine has tab stops set; prints nothing. */
  readonly tab?: number;
  /** Tape framing between records; prints nothing. */
  readonly fill?: number;
  /** Ends the whole tape: nothing after it is program. */
  readonly eom?: number;
  /** Blank paper, which is what an untouched cell of the roll holds. */
  readonly space: number;

  /**
   * The character one code prints as, or undefined for a code with no glyph -
   * which the paper roll passes over rather than striking.
   */
  plainChar(code: number): string | undefined;

  /**
   * Read one editor unit at `i`, returning the code it encodes and how many
   * source characters it took. Throws `CharsetError` for text this machine
   * cannot say, which the terminal treats as nothing typed rather than as a
   * fault.
   */
  parseChar(text: string, i: number): { code: number; length: number };
}

/**
 * The machine's floating-point format, as far as a program can observe it.
 *
 * Deliberately the *observable* format and not the layout: one of these two
 * machines has a surviving listing to read the word apart from and the other
 * has only a manual that never describes it, so what a profile states is the
 * pair of magnitudes a program can reach and the shape the formatter printed.
 */
export interface DartmouthNumbers {
  /** Largest magnitude the format holds. Past it the computation overflows. */
  readonly max: number;
  /** Smallest non-zero magnitude. Below it the computation underflows. */
  readonly min: number;
  /**
   * The argument past which the exponential is reported as too large in its own
   * right, where the machine's fault table names that case. Left out, an `EXP`
   * that runs off the top of the format is an ordinary overflow instead.
   */
  readonly expLimit?: number;
  /** One number as the Teletype printed it, including the field's spacing. */
  format(n: number): string;
}

/**
 * How `PRINT` lays a line out, which is a mechanism rather than a preference:
 * the zone width and the count of zones are the run-time's own table, and the
 * line they have to fit is the Teletype's.
 */
export interface DartmouthPrinter {
  /** Columns on one line of paper - what a carriage return returns to 0. */
  readonly columns: number;
  /** Width of one `,` zone, in columns. */
  readonly zoneWidth: number;
  /** How many zones fit on a line; there is no zone past the last. */
  readonly zones: number;
  /**
   * Column multiple a `,` pads to before it starts counting zones. 1 where the
   * run-time counts characters; wider where it counts the line in whole words.
   */
  readonly zoneAlign: number;
  /**
   * Column at which `;` gives up and starts a new line rather than run off the
   * end of the paper, or null for a machine that instead breaks *before* an
   * item too wide for what is left of the line.
   */
  readonly semicolonBreak: number | null;
}

/**
 * The executor rules that differ between the machines - each one a case where
 * both vocabularies have the word and the two run-times do different things
 * with it.
 */
export interface DartmouthLanguage {
  /**
   * String values: string variables and vectors, strings in `DATA`, `INPUT`
   * and comparisons, and the second `DATA` block that goes with them. Off, a
   * quoted literal is only ever something `PRINT` prints.
   */
  readonly strings: boolean;

  /** `LET X = Y = A(3,1) = 1`, assigning one value to several variables. */
  readonly chainedAssignment: boolean;

  /** An apostrophe starting a remark that runs to the end of the line. */
  readonly apostropheRemark: boolean;

  /**
   * What `INT` does either side of zero: `floor` takes the greatest integer not
   * above the argument, `truncate` walks toward zero from both sides. The
   * difference shows in `INT(X+.5)`, which rounds under one rule and trims
   * under the other.
   */
  readonly integerPart: 'floor' | 'truncate';

  /** Whether `RND` is written with parentheses and an argument, or bare. */
  readonly rndArgument: 'required' | 'none';

  /**
   * Where a `FOR` loop decides whether to run its body: `entry` tests before
   * the first pass, so a loop whose limit is already behind its start runs no
   * times; `exit` tests at the `NEXT`, so it runs once.
   */
  readonly loopTest: 'entry' | 'exit';

  /**
   * What raising a negative number to a power does. `fault` is a run-time that
   * reaches every power through a logarithm and has none for a negative base;
   * `integer-exponent` is one that multiplies a whole exponent out first and so
   * gets `(-3)↑3` right, falling back to the absolute value only for the rest.
   */
  readonly powerOfNegative: 'integer-exponent' | 'fault';

  /** Whether a `DEF` may take any number of parameters, or exactly one. */
  readonly functionParameters: 'one' | 'any';
}

/**
 * The run-time's table sizes.
 *
 * Each is a hard edge rather than a suggestion: reaching one is a fault the
 * machine printed and stopped on, and the whole point of stating them per
 * machine is that a program written for a larger one must fail here in the same
 * place the hardware failed. A limit set too high silently accepts programs the
 * machine refused; set too low it rejects programs it ran.
 *
 * Every field is optional for the same reason: a limit nobody can cite is worse
 * than no limit at all, so a machine whose evidence gives no figure leaves the
 * field out and the run-time stops checking it.
 */
export interface DartmouthLimits {
  /** Lines a program may have. The line past it is the one that faults. */
  readonly maxLines?: number;
  /** The largest line number the compiler will read, inclusive. */
  readonly maxLineNumber: number;
  /** `FOR` loops that may be open at once, counted at compile time. */
  readonly maxLoopDepth?: number;
  /** `GOSUB`s that may be outstanding at once, counted as the run goes. */
  readonly maxGosubDepth?: number;
  /** `DATA` constants the whole program may declare, counted before the run. */
  readonly maxDataConstants?: number;
  /**
   * Words of user space a program and its data must fit between them, against
   * the machine's own rule for what a program costs. Reaching it is `OUT OF
   * ROOM`, which is a compile-time refusal rather than a fault in a line.
   */
  readonly maxProgramWords?: number;
}
