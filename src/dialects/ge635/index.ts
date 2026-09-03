// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

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
 * Not implemented yet: this folder is scaffolding, and the dialect is not
 * registered.
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

  tokenize(source: string): TokenizeResult {
    const { program, image, errors } = tokenizeProgram(source);
    return { programBytes: program, image, errors, byteSize: program.length };
  },

  detokenize(image: Uint8Array): string {
    return detokenizeProgram(image);
  },

  lint(source: string): TokenizeError[] {
    return tokenizeProgram(source).errors;
  },

  // No romUrl: the interpreter backend needs no ROM image.

  // A 72-column teletype window, as the GE-235's.
  displaySize: { width: 576, height: 384 },

  addressNotation: 'dec',

  // One statement to a line, so there is no separator to name. Confirm against
  // the fourth edition before relying on it.
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
