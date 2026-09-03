// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { hasFatalErrors } from '../types';
import type { Dialect, TokenizeError, TokenizeResult } from '../types';
import { ge235Charset } from './charset';
import { ge235Keywords, ge235Operators } from './keywords';
import {
  ge235CompletionSource,
  ge235Crunched,
  ge235LanguageSupport,
} from './language';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram } from './detokenizer';
import { ge235VariableErrors } from '../../editor/variableLint';
import { ge235AiProfile } from './aiProfile';
import { ge235BuildTargets } from './targets';
import { ge235KeyboardLayout } from './keyboardLayout';
import { ge235Samples } from './samples';
import { Ge235InterpreterMachine } from './interpreter/machine';
import { ge235MemoryMap } from './memoryMap';

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
 * Registering it moved the project's own era boundary: the year bound in
 * `registry.test.ts` used to start at 1975, and a 1964 mainframe sits well
 * below the microcomputer.
 */
export const ge235: Dialect = {
  id: 'ge235',
  name: 'GE-235',
  manufacturer: 'General Electric',
  // The machine, not the language: the GE-235 reached Dartmouth in 1964 and
  // compiled the February 1965 BASIC this folder implements.
  year: 1964,
  blurb: 'The machine BASIC was born on. Runs Dartmouth BASIC.',
  basicDialect: 'Dartmouth BASIC',

  /**
   * The reference page is named for the language, not for this machine: what it
   * documents is Dartmouth BASIC, which several machines ran and which every
   * other BASIC here descends from. `basicFamily` is left off because
   * `basicDialect` is already the family name - this is the only machine in the
   * registry that runs it.
   */
  docsReference: 'dartmouth',

  // The figure this field wants is the space a program actually gets, and the
  // machine measures that in twenty-bit words rather than bytes - `memoryMap.ts`
  // holds the layout. The interpreter decides what a program may hold.
  programRamBytes: 0,

  fileExtensions: ['.txt', '.bas'],
  keywords: ge235Keywords,
  operators: ge235Operators,
  charset: ge235Charset,
  crunched: ge235Crunched,
  languageSupport: ge235LanguageSupport,
  completionSource: ge235CompletionSource,

  /**
   * There is nothing to tokenize: the machine compiled its source at RUN, so
   * the "program bytes" are the source itself, punched as 6-bit BCD onto a
   * paper tape. `programBytes` is the line records; `image` adds the
   * end-of-message code that closes the tape.
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
      ...ge235VariableErrors(source, ge235Keywords),
    ];
  },

  // No romUrl: the interpreter backend needs no ROM image.

  // A 72-column teletype window, not the classic 256x192.
  displaySize: { width: 576, height: 384 },

  /**
   * The machine's core store, in twenty-bit words rather than bytes - the one
   * map here that is not byte-addressed.
   */
  memoryMap: ge235MemoryMap,

  /**
   * The viewer opens on plain word numbers. The machine's own listings are
   * octal throughout, but nothing in this BASIC takes an address - there is no
   * PEEK, no POKE and no USR - so the notation is a reading aid for the map
   * rather than something a program has to be written in, and the map's notes
   * carry the octal where it is worth having.
   */
  addressNotation: 'dec',

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

  /**
   * One export, the paper tape the Teletype's punch produced. No `audio`,
   * because the machine had no tape interface to model, and no `binaryImports`,
   * because the tape is text and opens through `fileExtensions`.
   */
  buildTargets: ge235BuildTargets,
  aiProfile: ge235AiProfile,
};
