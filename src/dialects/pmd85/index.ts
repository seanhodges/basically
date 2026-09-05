// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { Dialect, TokenizeError, TokenizeResult } from '../types';
import { pmd85AiProfile } from './aiProfile';
import { pmd85Charset } from './charset';
import { pmd85BuildTargets } from './targets';
import { pmd85KeyboardLayout } from './keyboardLayout';
import { pmd85Keywords, pmd85Operators } from './keywords';
import { pmd85CompletionSource, pmd85LanguageSupport } from './language';
import { pmd85MemoryMap } from './memoryMap';
import { pmd85MemoryBlocks } from './memoryBlocks';
import { pmd85Samples } from './samples';
import { detokenizeProgram, detokenizeProgramWithReport } from './detokenizer';
import {
  CASSETTE_SAMPLE_RATE,
  buildCassetteSamples,
} from './audio/cassetteEncoder';
import { decodePmd85Tape } from './audio/cassetteDecoder';
import {
  DEFAULT_FILE_NUMBER,
  firstProgramFile,
  parseTapeImage,
  programFromTapeFile,
} from './tape';
import { unwrapPmd85StoredFile } from './storedFile';
import { tokenizeProgram } from './tokenizer';
import { pmd85VariableErrors } from '../../editor/variableLint';
import { Pmd85Machine } from './emulator/pmd85Machine';
import { ROM_IMAGE_SIZE, splitRomImage } from './romImage';
import { PROGRAM_BASE, STACK_TOP } from './addresses';
import { DISPLAY_HEIGHT, DISPLAY_WIDTH } from './emulator/display';

/**
 * The Tesla PMD 85-2 (BASIC-G).
 *
 * Four things about this machine are worth knowing before touching any of it,
 * and none is visible from its spec sheet:
 *
 *  - **It is an 8080, not a Z80.** The MHB8080A is a Tesla-made 8080A clone, so
 *    the vendored Z80 core executes its object code directly - as it already
 *    does for the Altair, whose adapter carries the two flag corrections that
 *    makes necessary.
 *  - **BASIC-G is not in the address space.** It lives in a replaceable ROM
 *    Module read through an 8255 at ports 0xF8-0xFB, which the Monitor copies
 *    into RAM before it runs. The machine therefore needs two ROM images, and
 *    the interpreter it ends up running is a writable copy at address 0.
 *  - **The screen packs six pixels to a byte**, 48 displayed bytes into a
 *    64-byte scanline stride, with the top two bits of each byte holding the
 *    cell's blink and brightness attribute.
 *  - **Variable names are case sensitive**, which no other Microsoft BASIC here
 *    is: `A` and `a` are two variables. See `PMD85_LEXIS`.
 *  - **Its tape names nothing.** `SAVE` and `LOAD` take a *number*, not a name,
 *    so every export goes out as file {@link DEFAULT_FILE_NUMBER} and the eight
 *    characters of name in the header are a label for a human to read.
 */
export const pmd85: Dialect = {
  id: 'pmd85',
  name: 'PMD 85-2',
  manufacturer: 'Tesla',
  year: 1986,
  blurb: 'Czechoslovakia’s school computer. Runs BASIC-G.',
  basicDialect: 'BASIC-G',

  /**
   * What BASIC-G leaves a program is not derivable from "48K fitted, 16K of it
   * video RAM": the interpreter is copied into the bottom of RAM and its own
   * pointers carve up what is left. Program text, variables and arrays share
   * the run from {@link PROGRAM_BASE} up to the stack the interpreter sets at
   * {@link STACK_TOP}, which is the figure below. String space is *not* taken
   * out of it - that has its own region higher up, above the workspace.
   */
  programRamBytes: STACK_TOP - PROGRAM_BASE,

  fileExtensions: ['.bas'],
  keywords: pmd85Keywords,
  operators: pmd85Operators,
  charset: pmd85Charset,
  languageSupport: pmd85LanguageSupport,
  completionSource: pmd85CompletionSource,

  tokenize(source: string): TokenizeResult {
    const { program, errors } = tokenizeProgram(source);
    return {
      programBytes: program,
      image: program,
      errors,
      byteSize: program.length,
    };
  },

  detokenize(image: Uint8Array): string {
    return detokenizeProgram(image);
  },

  detokenizeWithReport: detokenizeProgramWithReport,

  /**
   * Editor diagnostics: everything `tokenize` reports, plus the two ways a
   * name can go wrong on a Microsoft BASIC - a name that embeds a reserved
   * word, and two names the interpreter cannot tell apart because it keeps
   * only their first two characters.
   */
  lint(source: string): TokenizeError[] {
    return [
      ...tokenizeProgram(source).errors,
      ...pmd85VariableErrors(source, pmd85Keywords),
    ];
  },

  /**
   * Monitor 2 and the BASIC-G V2.0 module concatenated into one image - see
   * `romImage.ts` for the layout, and `public/roms/ATTRIBUTION.md` for where
   * the two halves come from. `romBytes` is declared so a user may replace the
   * pair from Settings, the way every other bundled-ROM machine here does.
   */
  romUrl: `${import.meta.env.BASE_URL}roms/pmd85/pmd85.rom`,
  romBytes: ROM_IMAGE_SIZE,

  displaySize: { width: DISPLAY_WIDTH, height: DISPLAY_HEIGHT },

  addressNotation: 'hex',
  statementSeparator: ':',
  /** Spaces outside strings, REM and DATA are eaten, so `FORI=1TO5` is valid. */
  crunched: true,

  memoryMap: pmd85MemoryMap,
  memoryBlocks: pmd85MemoryBlocks,

  /**
   * `POKE addr,byte` with a hex literal written `'FF` - the apostrophe form
   * BASIC-G's own scanner reads, and the notation this machine's listings are
   * written in. Reads and calls are the Microsoft pair, with USR where a later
   * BASIC would have CALL.
   */
  memoryWrites: { forms: ['poke'], hexPrefix: "'" },
  memoryReads: { forms: ['peek'], calls: ['USR'] },

  debuggable: true,

  /**
   * The 4004/482 on the I/O board's GPIO0 connector - the machine's own stick,
   * and the only one worth a mode. BASIC-G has no keyword that reads it, so a
   * program gets at it with `INP` after turning the connector's buffer inward;
   * `emulator/gpio.ts` has the sequence.
   */
  joystickModes: ['native'],

  /**
   * The cassette, which is the only thing BASIC-G can write to: the deck keeps
   * what `SAVE` and `DSAVE` put on tape and plays it back for `LOAD`/`DLOAD`.
   */
  capturesDataFiles: true,

  createEmulator(opts) {
    return new Pmd85Machine({ ...splitRomImage(opts.rom), files: opts.files });
  },

  unwrapStoredFile: unwrapPmd85StoredFile,

  keyboardLayout: pmd85KeyboardLayout,
  samples: pmd85Samples,
  buildTargets: pmd85BuildTargets,

  /** The two framings of the same tape - see `tape.ts`. */
  binaryImports: [
    { extension: '.ptp', label: 'Import .ptp tape…' },
    { extension: '.pmd', label: 'Import .pmd file…' },
  ],

  /**
   * Cassette audio: 1200 baud, eight data bits and two stop bits, phase encoded
   * so the receiver can find its own clock - `audio/cassetteEncoder.ts` has the
   * derivation, which came off the Monitor's own tape routine.
   *
   * The instructions name BASIC-G's own commands and spell out what otherwise
   * catches people out: the tape commands take a *number*, so `SAVE "GAME"`
   * answers `Type conv.` and there is nothing to type but `LOAD 1`.
   */
  audio: {
    sampleRate: CASSETTE_SAMPLE_RATE,
    buildSamples: (source, programName, robust) =>
      buildCassetteSamples(source, programName, robust),
    loadInstructions:
      `On the PMD 85 type LOAD ${DEFAULT_FILE_NUMBER} and press EOL (the tape ` +
      'commands take a file number, not a name), then start playback; the ' +
      'machine returns to OK when the program has loaded, then type RUN.',
    decodeSamples: (samples, sampleRate) => {
      const parse = parseTapeImage(decodePmd85Tape(samples, sampleRate));
      const { file, warnings } = firstProgramFile(parse);
      if (!file) {
        throw new Error(warnings[0] ?? 'The recording holds no BASIC program');
      }
      return {
        programName: file.header.name,
        source: detokenizeProgram(programFromTapeFile(file)),
        warnings: [...parse.warnings, ...warnings],
      };
    },
    saveInstructions:
      `Start the recorder, then on the PMD 85 type SAVE ${DEFAULT_FILE_NUMBER} ` +
      'and press EOL; the machine plays the program out at 1200 baud. Feed ' +
      'that into this device, then start listening.',
  },

  aiProfile: pmd85AiProfile,
};
