// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import {
  hasFatalErrors,
  type Dialect,
  type MachineEmulator,
  type TokenizeError,
  type TokenizeResult,
} from '../types';
// The II and the II Plus are one design with a different BASIC in ROM, so the
// charset and the keyboard are imported from the sibling and everything the
// interpreter decides is this dialect's own. Listed member by member rather
// than spread over the sibling, as `atari400` lists them over `atari800`: what
// a sibling inherits and what it owns should be visible here.
import { Apple2Machine } from '../../emulator/apple2/apple2Machine';
import { apple2Charset } from '../apple2/charset';
import { apple2plusAiProfile } from './aiProfile';
import { apple2plusKeyboardLayout } from './keyboardLayout';
import { apple2plusKeywords, apple2plusOperators } from './keywords';
import {
  apple2plusCompletionSource,
  apple2plusCrunched,
  apple2plusLanguageSupport,
} from './language';
import { applesoftSupport } from './machineSupport';
import { apple2plusMemoryBlocks } from './memoryBlocks';
import { apple2plusMemoryMap } from './memoryMap';
import { apple2plusSamples } from './samples';
import { apple2plusBuildTargets } from './targets';
import { COLD_START_BYTES_FREE, FIRMWARE_BYTES } from './addresses';
import { DISPLAY_HEIGHT, DISPLAY_WIDTH } from '../apple2/addresses';
import { buildBasicImage, parseBasicImage } from './basicImage';
import { detokenizeProgram, detokenizeProgramWithReport } from './detokenizer';
import { tokenizeProgram } from './tokenizer';
import {
  CASSETTE_SAMPLE_RATE,
  buildCassetteSamples,
  decodeCassette,
} from './audio/cassette';
import { apple2plusVariableErrors } from '../../editor/variableLint';

/**
 * The Apple II Plus (Applesoft BASIC).
 *
 * Not in `src/dialects/registry.ts`: an unfinished machine must not be
 * selectable, and registering one turns every registry-driven battery on at
 * once. The language layer, the machine and the samples below are real and
 * driven headlessly by the tests alongside, as are the tape and the file
 * exports; the memory map is still empty, and the picker identity is a
 * placeholder that satisfies the contract until the dialect is registered.
 */
export const apple2plus: Dialect = {
  id: 'apple2plus',
  name: 'Apple II Plus',
  manufacturer: 'Apple',
  year: 1979,
  blurb: 'Runs Applesoft BASIC.',
  docsReference: 'applesoft',

  programRamBytes: COLD_START_BYTES_FREE,

  fileExtensions: ['.bas', '.txt'],
  keywords: apple2plusKeywords,
  operators: apple2plusOperators,
  charset: apple2Charset,
  languageSupport: apple2plusLanguageSupport,
  completionSource: apple2plusCompletionSource,
  crunched: apple2plusCrunched,

  /**
   * The image is the program: Applesoft's linked list from `$0801` is what the
   * tokenizer already emits, so there is no container to wrap it in. A fatal
   * error still yields an empty image rather than a half-built one.
   */
  tokenize(source: string): TokenizeResult {
    const { program, errors } = tokenizeProgram(source);
    const all = [
      ...errors,
      ...apple2plusVariableErrors(source, apple2plusKeywords),
    ];
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

  detokenize(image: Uint8Array): string {
    return detokenizeProgram(parseBasicImage(image).program);
  },

  detokenizeWithReport(image: Uint8Array) {
    return detokenizeProgramWithReport(parseBasicImage(image).program);
  },

  lint(source: string): TokenizeError[] {
    return this.tokenize(source).errors;
  },

  romUrl: `${import.meta.env.BASE_URL}roms/apple2plus.rom`,
  romBytes: FIRMWARE_BYTES,

  displaySize: { width: DISPLAY_WIDTH, height: DISPLAY_HEIGHT },

  addressNotation: 'hex',
  statementSeparator: ':',
  memoryReads: { forms: ['peek'] },

  // CURLIN names the executing line, so the machine can be stepped a line at a
  // time.
  debuggable: true,

  memoryMap: apple2plusMemoryMap,
  memoryBlocks: apple2plusMemoryBlocks,

  /**
   * The board is shared with the Apple II, which is the same hardware with the
   * other BASIC in its ROM sockets, so what makes this a II Plus rather than a
   * II is the support object rather than the machine.
   */
  createEmulator(opts): MachineEmulator {
    return new Apple2Machine({ rom: opts.rom, basic: applesoftSupport });
  },

  keyboardLayout: apple2plusKeyboardLayout,
  samples: apple2plusSamples,
  buildTargets: apple2plusBuildTargets,
  binaryImports: [{ extension: '.bin', label: 'Import cassette record…' }],

  /**
   * Cassette, which is the only route into an unexpanded Apple II Plus and the
   * one Applesoft has commands for. `LOAD` and `SAVE` do the whole job and the
   * program's address is fixed, so - unlike the sibling, whose tape does not
   * carry the workspace its listing was written under - there is nothing for
   * the user to type first.
   */
  audio: {
    sampleRate: CASSETTE_SAMPLE_RATE,
    buildSamples: (source, _programName, robust) =>
      buildCassetteSamples(source, robust),

    loadInstructions:
      'Start playback, then type LOAD at the ] prompt and press Return - the ' +
      'machine spends about four seconds letting the tape settle before it ' +
      'starts listening, so there is no need to wait for the leader tone to ' +
      'finish. It beeps once for the header record and once for the program; ' +
      'LIST or RUN it when the second beep comes. ERR before a beep means the ' +
      'checksum failed - rewind and try again with the volume a little lower.',

    decodeSamples: (samples, sampleRate) => {
      const { programName, data, warnings } = decodeCassette(
        samples,
        sampleRate,
      );
      const report = detokenizeProgramWithReport(parseBasicImage(data).program);
      return {
        programName,
        source: report.source,
        warnings: [...warnings, ...report.warnings],
      };
    },

    saveInstructions:
      'Start the recorder, then type SAVE at the ] prompt and press Return. ' +
      'The machine writes ten seconds of leader and the three-byte header ' +
      'record, then ten more seconds of leader and the program, beeping after ' +
      'each. Feed that into this device, then start listening.',
  },

  aiProfile: apple2plusAiProfile,
};
