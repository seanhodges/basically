// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { Dialect, TokenizeError, TokenizeResult } from '../types';
import { ge235Charset } from './charset';
import { ge235Keywords } from './keywords';
import { ge235CompletionSource, ge235LanguageSupport } from './language';
import { ge235AiProfile } from './aiProfile';
import { ge235BuildTargets } from './targets';
import { ge235KeyboardLayout } from './keyboardLayout';
import { ge235Samples } from './samples';
import { Ge235InterpreterMachine } from './interpreter/machine';

/**
 * The GE-235 running Dartmouth BASIC as of February 1965 - the ancestor of
 * every other BASIC in this registry.
 *
 * Three things make it unlike the rest, and each has a precedent here:
 *
 *  - **No video hardware.** Output went to a Teletype Model 33 ASR on a paper
 *    roll, so there is no screen memory and nothing can be redrawn - the
 *    Altair's terminal is the model.
 *  - **No ROM.** No GE-2xx CPU core exists to vendor, and the surviving 1965
 *    compiler is a memory image whose licensing is unstated, so the backend is
 *    a clean-room interpreter as the TRS-80's is.
 *  - **No assembly.** The machine is offered as BASIC only, so there are no
 *    memory blocks and no binary directives.
 *
 * Registering this machine also moves the project's own era boundary:
 * `registry.test.ts` bounds every dialect's year to 1975-1995, and a 1965
 * mainframe sits outside it.
 */
export const ge235: Dialect = {
  id: 'ge235',
  name: 'GE-235',
  manufacturer: 'General Electric',
  year: 1965,
  blurb: 'The machine BASIC was born on. Runs Dartmouth BASIC.',
  basicDialect: 'Dartmouth BASIC',

  // The machine had 8192 twenty-bit words of core; the figure this field wants
  // is the space a program actually gets, which the interpreter decides.
  programRamBytes: 0,

  fileExtensions: ['.txt', '.bas'],
  keywords: ge235Keywords,
  charset: ge235Charset,
  languageSupport: ge235LanguageSupport,
  completionSource: ge235CompletionSource,

  tokenize(_source: string): TokenizeResult {
    throw new Error('ge235: not implemented');
  },

  detokenize(_image: Uint8Array): string {
    throw new Error('ge235: not implemented');
  },

  lint(_source: string): TokenizeError[] {
    throw new Error('ge235: not implemented');
  },

  // No romUrl: the interpreter backend needs no ROM image.

  // A 72-column teletype window, not the classic 256x192.
  displaySize: { width: 576, height: 384 },

  // No addressNotation: the field is 'hex' | 'dec', and this machine is octal
  // throughout - every address in its manuals and in its own listings. Widening
  // that union touches every consumer of the field, so the choice is open.

  // Dartmouth BASIC put one statement on a line, so there is no separator to
  // name. The compiler source is what settles this.
  statementSeparator: null,

  // No step debugger and no variable watcher yet. Both are crosschecked rather
  // than required, so the flag simply has to match what the machine implements.
  debuggable: false,

  createEmulator() {
    return new Ge235InterpreterMachine();
  },

  keyboardLayout: ge235KeyboardLayout,
  samples: ge235Samples,
  buildTargets: ge235BuildTargets,
  aiProfile: ge235AiProfile,
};
