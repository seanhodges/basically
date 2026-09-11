// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { hasFatalErrors } from '../types';
import type { Dialect, TokenizeError, TokenizeResult } from '../types';
import { ge635Charset } from './charset';
import { ge635Keywords, ge635Operators } from './keywords';
import {
  ge635CompletionSource,
  ge635Crunched,
  ge635LanguageSupport,
} from './language';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram } from './detokenizer';
import { ge635VariableErrors } from '../../editor/variableLint';
import { ge635AiProfile } from './aiProfile';
import { ge635BuildTargets } from './targets';
import { ge635KeyboardLayout } from './keyboardLayout';
import { ge635Samples } from './samples';
import { Ge635InterpreterMachine } from './machine';

/**
 * The GE-635 running Dartmouth BASIC's fourth edition - the machine the
 * Dartmouth Time-Sharing System moved to in 1966, and the BASIC that first had
 * strings, matrices and multi-line functions.
 *
 * **Where the facts here come from, and how they differ from the GE-235's.**
 * The GE-235 in this registry is built from the surviving February 1965
 * compiler listings and cites them - a jump table, a precedence table, an
 * allocation heading. No such listing survives for this machine: the Dartmouth
 * archive holds the first phase of the time-sharing system only. So every fact
 * in this dialect is read off *BASIC, Fourth Edition* (John G. Kemeny and
 * Thomas E. Kurtz, Dartmouth College Computation Center, 1 January 1968), and
 * its comments cite that manual by section. They say "the manual specifies",
 * never "the compiler decodes", because nobody here has read this machine's
 * compiler. Where the manual is silent - the internal floating-point layout is
 * the notable case - this dialect says so rather than supplying a plausible
 * number.
 *
 * The manual names its own machine, in the section on the language's limits:
 * "the current implementation on a GE-635 time-sharing system".
 *
 * The language and the machine are written; the keyboard, the samples and the
 * build targets still throw. The dialect is not registered, so nothing offers
 * it until they answer.
 */
export const ge635: Dialect = {
  id: 'ge635',
  name: 'GE-635',
  manufacturer: 'General Electric',
  year: 1966,
  blurb: 'Placeholder. Runs Dartmouth BASIC 4th edition.',
  basicDialect: 'Dartmouth BASIC 4th edition',
  basicFamily: 'Dartmouth BASIC',

  // The reference page is named for the language, and this machine shares it
  // with the GE-235 - the page documents Dartmouth BASIC, which both ran.
  docsReference: 'dartmouth',

  // The machine measures a program's space in thirty-six-bit words rather than
  // bytes, so there is no byte figure to report here.
  programRamBytes: 0,

  fileExtensions: ['.txt', '.bas'],
  keywords: ge635Keywords,
  operators: ge635Operators,
  charset: ge635Charset,
  crunched: ge635Crunched,
  languageSupport: ge635LanguageSupport,
  completionSource: ge635CompletionSource,

  /**
   * There is nothing to tokenize: the machine compiled its source at RUN, so
   * the "program bytes" are the source itself, punched as ASCII onto a paper
   * tape. The tape carries no terminator - see `tokenizer.ts` - so the image
   * is those same bytes.
   */
  tokenize(source: string): TokenizeResult {
    const { program, image, errors } = tokenizeProgram(source);
    return {
      programBytes: program,
      image: hasFatalErrors(errors) ? new Uint8Array(0) : image,
      errors,
      byteSize: program.length,
    };
  },

  detokenize(image: Uint8Array): string {
    return detokenizeProgram(image);
  },

  lint(source: string): TokenizeError[] {
    return [
      ...tokenizeProgram(source).errors,
      ...ge635VariableErrors(source, ge635Keywords),
    ];
  },

  // No romUrl: the interpreter backend needs no ROM image.

  // A 75-column teletype window, three columns wider than the GE-235's: section
  // 2.1 numbers the positions on a line "from 0 through 74", which is also
  // exactly the five fifteen-character print zones the same section describes.
  displaySize: { width: 600, height: 384 },

  addressNotation: 'dec',

  // One statement to a line, so there is no separator to name. The manual's
  // statement summaries (1.7) each give one form per line and it names no
  // separator anywhere, as the February 1965 language has none.
  statementSeparator: null,

  debuggable: false,

  createEmulator() {
    return new Ge635InterpreterMachine();
  },

  keyboardLayout: ge635KeyboardLayout,
  samples: ge635Samples,
  buildTargets: ge635BuildTargets,
  aiProfile: ge635AiProfile,
};
