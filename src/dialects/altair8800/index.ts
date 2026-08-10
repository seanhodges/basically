// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { Dialect, TokenizeError, TokenizeResult } from '../types';
import { hasFatalErrors } from '../types';
import { altair8800Charset } from './charset';
import { altair8800Keywords, altair8800Operators } from './keywords';
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
import {
  CASSETTE_SAMPLE_RATE,
  buildCassetteSamples,
} from './audio/cassetteEncoder';
import { decodeCassette } from './audio/cassetteDecoder';
import { altair8800KeyboardLayout } from './keyboardLayout';
import { altair8800Samples } from './samples';
import { BASIC_IMAGE_SIZE, COLD_START_BYTES_FREE } from './addresses';
import { altair8800MemoryMap } from './memoryMap';
import { altair8800MemoryBlocks } from './memoryBlocks';
import { Altair8800Machine } from './emulator/altairMachine';
import { DISPLAY_HEIGHT, DISPLAY_WIDTH } from './emulator/terminal';

/**
 * The MITS Altair 8800 (Altair 8K BASIC).
 *
 * The Altair is the odd one out in this project in three ways worth knowing
 * before working on it:
 *
 *  - **No video hardware.** Output is a serial terminal on the 88-2SIO board,
 *    not a memory-mapped screen (`emulator/terminal.ts`).
 *  - **No graphics characters.** Plain ASCII, so no `graphics.ts`, no graphics
 *    palette, and `SEMIGRAPHIC_CODES` records `[]` for it.
 *  - **No ROM, in two senses.** The machine had no firmware - BASIC loaded into
 *    RAM from paper tape - and the 8K BASIC image is Microsoft copyright with
 *    no redistribution grant, so it is user-supplied and does not ship here.
 *    That is what `romBundled: false` below says, and what turns the missing
 *    file into an offer to supply one rather than a fetch error.
 */
export const altair8800: Dialect = {
  id: 'altair8800',
  name: 'Altair 8800',
  // A new picker group: no other MITS machine ships, so there is no sibling
  // spelling to match.
  manufacturer: 'MITS',
  year: 1975,
  blurb: 'The microcomputer that started it all. Runs Altair 8K BASIC.',

  // 8K BASIC's own "BYTES FREE" banner on the modelled RAM configuration
  // (48K fitted, transcendental functions retained - see addresses.ts).
  programRamBytes: COLD_START_BYTES_FREE,

  fileExtensions: ['.txt', '.bas'],
  keywords: altair8800Keywords,
  operators: altair8800Operators,
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
   * ship - see the note above - so its absence is a designed state, carried by
   * `romBundled: false` below into a "supply your own image" message rather
   * than a raw `Failed to fetch ROM (404)` in the emulator pane.
   */
  romUrl: `${import.meta.env.BASE_URL}roms/altair8800.rom`,

  /**
   * The machine runs whatever image it is handed, and nothing is handed to it
   * by default: `romBundled: false` is what turns the missing file from a 404
   * into the "supply your own image" offer in Settings ▸ Emulator. The size is
   * the ROM area a supplied image is fitted to, not one it has to match.
   */
  romBytes: BASIC_IMAGE_SIZE,
  romBundled: false,

  // An 80x24 terminal at an 8x16 cell, rather than the classic 256x192.
  displaySize: { width: DISPLAY_WIDTH, height: DISPLAY_HEIGHT },

  // Altair BASIC's PEEK/POKE take decimal addresses.
  addressNotation: 'dec',
  statementSeparator: ':',

  memoryMap: altair8800MemoryMap,

  /**
   * Machine-code blocks are assembled as Z80 because there is no `'8080'` in
   * the union and 8080 assembly is a strict subset of Z80 assembly - see
   * `memoryBlocks.ts`, which also explains why nothing is merely `reserved`.
   */
  memoryBlocks: altair8800MemoryBlocks,

  /**
   * The machine's RAM size is not taken from `opts.ramKb`: an S-100 backplane
   * held whatever memory boards its owner bought, so this dialect commits to
   * the one 48K configuration `addresses.ts` documents, which is what
   * `programRamBytes` and the memory map describe. See `emulator/memory.ts`.
   */
  createEmulator(opts) {
    return new Altair8800Machine({ rom: opts.rom });
  },

  keyboardLayout: altair8800KeyboardLayout,
  samples: altair8800Samples,
  buildTargets: altair8800BuildTargets,

  /**
   * The `CSAVE` image is the machine's only binary program file (`.bin`
   * because there is no documented extension to claim - see `targets.ts`). A
   * paper tape is plain text and opens through `fileExtensions` instead.
   */
  binaryImports: [{ extension: '.bin', label: 'Import CSAVE image…' }],

  /**
   * The 88-ACR cassette board. Not a Kansas City Standard modem - 2400 Hz mark
   * against 1850 Hz space at 300 baud, 8N1 - see `audio/cassetteEncoder.ts`.
   *
   * The instructions name the ACR's own commands and spell out the thing that
   * otherwise catches people out: a program's name on tape is a *single
   * character*, so `CSAVE"HELLO"` and `CSAVE"H"` write the same tape, and
   * `CLOAD` has to be given that one letter back.
   */
  audio: {
    sampleRate: CASSETTE_SAMPLE_RATE,
    buildSamples: (source, programName, robust) =>
      buildCassetteSamples(source, programName, robust),
    loadInstructions:
      'On the Altair type CLOAD"A" (the name is a single character - use the ' +
      'first letter of the program name) and press RETURN, then start ' +
      'playback; BASIC returns to OK when the program has loaded, then type RUN.',
    decodeSamples: (samples, sampleRate) => {
      const { programName, data } = decodeCassette(samples, sampleRate);
      return { programName, source: detokenizeProgram(data) };
    },
    saveInstructions:
      'Start the recorder, then on the Altair type CSAVE"A" and press RETURN; ' +
      'the 88-ACR plays the program out at 300 baud. Feed that into this ' +
      'device, then start listening.',
  },

  aiProfile: altair8800AiProfile,
};
