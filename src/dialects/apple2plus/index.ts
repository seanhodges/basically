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
import { detokenizeProgram } from './detokenizer';
import { tokenizeProgram } from './tokenizer';
import { apple2plusVariableErrors } from '../../editor/variableLint';

/**
 * The Apple II Plus (Applesoft BASIC).
 *
 * Not in `src/dialects/registry.ts`: an unfinished machine must not be
 * selectable, and registering one turns every registry-driven battery on at
 * once. The language layer, the machine and the samples below are real and
 * driven headlessly by the tests alongside; the memory map and the transfer
 * targets are still empty, and the picker identity is a placeholder that
 * satisfies the contract until the dialect is registered.
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

  aiProfile: apple2plusAiProfile,
};
