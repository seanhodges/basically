// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import {
  hasFatalErrors,
  type Dialect,
  type TokenizeError,
  type TokenizeResult,
} from '../types';
import { apple1AiProfile } from './aiProfile';
import { apple1Charset } from './charset';
import { apple1KeyboardLayout } from './keyboardLayout';
import { apple1Keywords, apple1Operators } from './keywords';
import {
  apple1CompletionSource,
  apple1Crunched,
  apple1LanguageSupport,
} from './language';
import { apple1MemoryBlocks } from './memoryBlocks';
import { apple1MemoryMap } from './memoryMap';
import { apple1Samples } from './samples';
import { apple1BuildTargets } from './targets';
import { COLD_START_BYTES_FREE, FIRMWARE_BYTES } from './addresses';
import { decodeCassette } from './audio/aciDecoder';
import { CASSETTE_SAMPLE_RATE, buildCassetteSamples } from './audio/aciEncoder';
import { buildBasicImage, parseBasicImage } from './basicImage';
import { detokenizeProgram, detokenizeProgramWithReport } from './detokenizer';
import { tokenizeProgram } from './tokenizer';
import { apple1VariableErrors } from '../../editor/variableLint';
import { Apple1Machine } from '../../emulator/apple1/apple1Machine';

/**
 * The Apple I (Apple 1 Integer BASIC).
 *
 * The dialect is deliberately absent from `src/dialects/registry.ts` until it
 * has an emulator, a keyboard and samples, so an unfinished machine cannot be
 * picked.
 *
 * The one thing worth knowing before reading further: this machine's firmware is
 * two chips, and the ROM seam carries one image per dialect, so `apple1.rom` is
 * both of them concatenated - the 256-byte monitor PROM first, then the 4K
 * Integer BASIC image. `scripts/build-apple1-rom.mts` builds it and
 * `public/roms/ATTRIBUTION.md` records where the two halves come from. The
 * monitor leads so that an image carrying only the monitor still boots: the seam
 * pads a short image with 0xFF, which this machine reads as "no interpreter
 * fitted" rather than as a broken ROM.
 */
export const apple1: Dialect = {
  id: 'apple1',
  name: 'Apple I',
  manufacturer: 'Apple',
  year: 1976,
  blurb: 'Woz’s hand-built kit computer. Runs Apple 1 Integer BASIC.',

  // Stock LOMEM/HIMEM leave 2048 bytes, shared between program and variables.
  programRamBytes: COLD_START_BYTES_FREE,

  fileExtensions: ['.bas', '.txt'],
  keywords: apple1Keywords,
  operators: apple1Operators,
  charset: apple1Charset,
  languageSupport: apple1LanguageSupport,
  completionSource: apple1CompletionSource,
  crunched: apple1Crunched,

  /**
   * Text to the bytes the interpreter stores, plus the pair of memory ranges a
   * cassette dump holds. The program sits at the *top* of the workspace and
   * grows down, so `image` is built around it rather than from a base address.
   */
  tokenize(source: string): TokenizeResult {
    const { program, errors } = tokenizeProgram(source);
    const all = [...errors, ...apple1VariableErrors(source, apple1Keywords)];
    if (program.length > COLD_START_BYTES_FREE) {
      all.push({
        line: 1,
        column: 0,
        message: `Program is ${program.length} bytes; the stock workspace holds ${COLD_START_BYTES_FREE}, shared with its variables`,
      });
    }
    const runnable = hasFatalErrors(all) ? new Uint8Array(0) : program;
    return {
      programBytes: runnable,
      image: buildBasicImage(runnable),
      errors: all,
      byteSize: program.length,
    };
  },

  /**
   * The seam hands over the whole image - both ACI ranges - so the program text
   * has to be located inside it first: it sits at the TOP of the workspace, at
   * the address the housekeeping block's PP pointer gives.
   */
  detokenize(image: Uint8Array): string {
    return detokenizeProgram(parseBasicImage(image).program);
  },

  detokenizeWithReport(image: Uint8Array) {
    return detokenizeProgramWithReport(parseBasicImage(image).program);
  },

  lint(source: string): TokenizeError[] {
    return [
      ...tokenizeProgram(source).errors,
      ...apple1VariableErrors(source, apple1Keywords),
    ];
  },

  /**
   * The monitor and Integer BASIC as one image. `romBundled` is left at its
   * default: the file ships, so a missing one really is a fetch failure rather
   * than a state to explain.
   */
  romUrl: `${import.meta.env.BASE_URL}roms/apple1.rom`,
  romBytes: FIRMWARE_BYTES,

  // A 40x24 terminal at the machine's own 7x8 cell.
  displaySize: { width: 280, height: 192 },

  // Integer BASIC has no hex literal: PEEK and POKE take signed decimal, which
  // is why an I/O address is written negative.
  addressNotation: 'hex',
  // `:` really is the separator here, not just on the Apple II: the
  // interpreter's own `null_stmt` handler is annotated "used to execute LET
  // keyword or colon (statement separator)", and `10 A=1: PRINT A` stores the
  // colon as token $03.
  statementSeparator: ':',
  memoryReads: { forms: ['peek'] },

  // Integer BASIC keeps a pointer to the line it is executing (PLINE), so the
  // machine can name a line and be stepped a line at a time.
  debuggable: true,

  memoryMap: apple1MemoryMap,
  memoryBlocks: apple1MemoryBlocks,

  createEmulator(opts) {
    return new Apple1Machine({ rom: opts.rom });
  },

  keyboardLayout: apple1KeyboardLayout,
  samples: apple1Samples,
  buildTargets: apple1BuildTargets,

  /**
   * The cassette dump is the machine's only binary program file (`.bin` because
   * the ACI never claimed an extension - see `targets.ts`).
   */
  binaryImports: [{ extension: '.bin', label: 'Import cassette dump…' }],

  /**
   * The Apple Cassette Interface. There is no `LOAD` or `SAVE` to name in the
   * instructions, because Integer BASIC has neither: both sides leave BASIC for
   * the monitor, start the card at `$C100` and give it the two ranges by
   * address. Typing anything else - or the ranges in the other order - reads
   * back a workspace whose pointers describe someone else's program, so the
   * commands are spelled out verbatim.
   */
  audio: {
    sampleRate: CASSETTE_SAMPLE_RATE,
    buildSamples: (source, _programName, robust) =>
      buildCassetteSamples(source, robust),
    loadInstructions:
      'On the Apple I type C100R and press Return to start the cassette ' +
      'interface, then type 4A.FF R 800.FFF R - but press Return only once ' +
      'playback has reached the steady leader tone. The monitor answers with ' +
      '\\ when both ranges have loaded; type E2B3R to re-enter BASIC, and the ' +
      'program is there to LIST or RUN.',
    decodeSamples: (samples, sampleRate) => {
      const { programName, data } = decodeCassette(samples, sampleRate);
      const { source, warnings } = detokenizeProgramWithReport(
        parseBasicImage(data).program,
      );
      return { programName, source, warnings };
    },
    saveInstructions:
      'Start the recorder, then on the Apple I type C100R and press Return, ' +
      'followed by 4A.FF W 800.FFF W - the card writes both ranges, ten ' +
      'seconds of leader in front of each, and answers \\ when it is done. ' +
      'Feed that into this device, then start listening.',
  },

  aiProfile: apple1AiProfile,
};
