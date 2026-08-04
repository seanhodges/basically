// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { Dialect, TokenizeError, TokenizeResult } from '../types';
import { hasFatalErrors } from '../types';
import { altair8800Charset } from './charset';
import { altair8800Keywords } from './keywords';
import { altair8800VariableErrors } from '../../editor/variableLint';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram, detokenizeProgramWithReport } from './detokenizer';
import {
  altair8800CompletionSource,
  altair8800Crunched,
  altair8800LanguageSupport,
} from './language';
import { altair8800AiProfile } from './aiProfile';
import { altair8800BuildTargets } from './targets';
import { altair8800KeyboardLayout } from './keyboardLayout';
import { altair8800Samples } from './samples';
import { Altair8800Machine } from './emulator/altairMachine';
import { DISPLAY_HEIGHT, DISPLAY_WIDTH } from './emulator/terminal';

/**
 * The MITS Altair 8800 (Altair 8K BASIC).
 *
 * **Scaffolding only - this dialect is deliberately NOT registered.** It is
 * absent from `src/dialects/registry.ts` and from `SHARE_VERBS` in
 * `src/player/routes.ts`, which change together in Stage 3 (`routes.test.ts`
 * asserts a strict bijection between them). Leaving it unregistered keeps the
 * app, the e2e suite and every cross-dialect guard test clean while the stages
 * are filled in. See `docs/contributing/dialect-plans/altair8800.md`.
 *
 * The Altair is the odd one out in this project in three ways worth knowing
 * before working on it:
 *
 *  - **No video hardware.** Output is a serial terminal on the 88-2SIO board,
 *    not a memory-mapped screen (`emulator/terminal.ts`).
 *  - **No graphics characters.** Plain ASCII, so no `graphics.ts`, no graphics
 *    palette, and `SEMIGRAPHIC_CODES` should record `null` for it.
 *  - **No ROM, in two senses.** The machine had no firmware - BASIC loaded into
 *    RAM from paper tape - and the 8K BASIC image is Microsoft copyright with
 *    no redistribution grant, so it is user-supplied and does not ship here.
 */
export const altair8800: Dialect = {
  id: 'altair8800',
  name: 'Altair 8800',
  // A new picker group: no other MITS machine ships, so there is no sibling
  // spelling to match.
  manufacturer: 'MITS',
  year: 1975,
  blurb: 'The machine that started it all. Runs Altair 8K BASIC.',

  // 8K BASIC's own "BYTES FREE" banner on the modelled RAM configuration
  // (48K fitted, transcendental functions retained - see addresses.ts).
  programRamBytes: 42628,

  fileExtensions: ['.txt', '.bas'],
  keywords: altair8800Keywords,
  charset: altair8800Charset,
  languageSupport: altair8800LanguageSupport,
  completionSource: altair8800CompletionSource,
  crunched: altair8800Crunched,

  tokenize(source: string): TokenizeResult {
    const { program, errors } = tokenizeProgram(source);
    const image = hasFatalErrors(errors) ? new Uint8Array(0) : program;
    return {
      programBytes: program,
      image,
      errors,
      byteSize: program.length,
    };
  },

  detokenize(image: Uint8Array): string {
    return detokenizeProgram(image);
  },

  detokenizeWithReport(image: Uint8Array) {
    return detokenizeProgramWithReport(image);
  },

  lint(source: string): TokenizeError[] {
    return [
      ...tokenizeProgram(source).errors,
      ...altair8800VariableErrors(source, altair8800Keywords),
    ];
  },

  /**
   * The user-supplied Altair 8K BASIC image. This file intentionally does NOT
   * ship - see the note above - so Stage 3 must handle its absence as a
   * designed state with a "supply your own image" message, rather than letting
   * the pane surface a raw `Failed to fetch ROM (404)`.
   */
  romUrl: `${import.meta.env.BASE_URL}roms/altair8800.rom`,

  // An 80x24 terminal at an 8x16 cell, rather than the classic 256x192.
  displaySize: { width: DISPLAY_WIDTH, height: DISPLAY_HEIGHT },

  // Altair BASIC's PEEK/POKE take decimal addresses.
  addressNotation: 'dec',
  statementSeparator: ':',

  createEmulator(opts) {
    return new Altair8800Machine({ rom: opts.rom, ramKb: opts.ramKb });
  },

  keyboardLayout: altair8800KeyboardLayout,
  samples: altair8800Samples,
  buildTargets: altair8800BuildTargets,
  aiProfile: altair8800AiProfile,
};
