// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { CharsetMapping, KeywordInfo } from '../../dialects/types';

/**
 * What one Dartmouth machine supplies to the shared interpreter.
 *
 * The runtime in this folder is the language's, not a machine's: the same
 * executor, evaluator, paper roll and keyboard served every BASIC that ran
 * under the Dartmouth Time-Sharing System. What separated one from the next was
 * the vocabulary the compiler decoded, the character set the tape and the
 * Teletype spoke, and the sizes of the tables the run-time allocated. A profile
 * is those three things and nothing else, so a machine is added by writing one
 * rather than by editing anything here.
 *
 * Every figure a profile carries is a fact about a particular machine, read off
 * that machine's own listing. The interface below says what each governs and in
 * what units; the *why that number* belongs beside the value, in the dialect
 * that declares it.
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

  /** The sizes of the run-time's own tables, in the units each names. */
  readonly limits: DartmouthLimits;
}

/**
 * A machine's character set, as one replaceable unit.
 *
 * It is a bundle rather than loose members because it is replaced wholesale:
 * two machines that differ here differ in every one of these at once - the
 * mapping, the codes and the two per-code helpers all describe the same
 * encoding, and mixing halves of two of them would decode nothing.
 *
 * A code is assumed to fit six bits: both the tape reader and the paper roll
 * mask what they are handed to `0o77` before looking at it. That is the one
 * machine fact this interface does not yet carry, and a machine whose codes are
 * wider - ASCII rather than 6-bit BCD - needs it lifted here first.
 */
export interface DartmouthCharset {
  /** Editor text <-> machine codes, the same mapping a listing is written in. */
  readonly mapping: CharsetMapping;

  /** Ends a line on the tape, and returns the carriage without feeding paper. */
  readonly cr: number;
  /** Advances the paper without returning the carriage. */
  readonly lf: number;
  /** Rings the terminal's bell; prints nothing. */
  readonly bell: number;
  /** Tabs, where the machine has tab stops set; prints nothing. */
  readonly tab: number;
  /** Tape framing between records; prints nothing. */
  readonly fill: number;
  /** Ends the whole tape: nothing after it is program. */
  readonly eom: number;
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
 * The run-time's table sizes.
 *
 * Each is a hard edge rather than a suggestion: reaching one is a fault the
 * machine printed and stopped on, and the whole point of stating them per
 * machine is that a program written for a larger one must fail here in the same
 * place the hardware failed. A limit set too high silently accepts programs the
 * machine refused; set too low it rejects programs it ran.
 */
export interface DartmouthLimits {
  /** Lines a program may have. The line past it is the one that faults. */
  readonly maxLines: number;
  /** The largest line number the compiler will read, inclusive. */
  readonly maxLineNumber: number;
  /** `FOR` loops that may be open at once, counted at compile time. */
  readonly maxLoopDepth: number;
  /** `GOSUB`s that may be outstanding at once, counted as the run goes. */
  readonly maxGosubDepth: number;
  /** `DATA` constants the whole program may declare, counted before the run. */
  readonly maxDataConstants: number;
}
