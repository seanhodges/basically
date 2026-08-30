// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import {
  hasFatalErrors,
  type Dialect,
  type MachineEmulator,
  type TokenizeError,
  type TokenizeResult,
} from '../types';
import { apple2AiProfile } from './aiProfile';
import { apple2Charset } from './charset';
import { apple2KeyboardLayout } from './keyboardLayout';
import { apple2Keywords, apple2Operators } from './keywords';
import {
  apple2CompletionSource,
  apple2Crunched,
  apple2LanguageSupport,
} from './language';
import { apple2MemoryBlocks } from './memoryBlocks';
import { apple2MemoryMap } from './memoryMap';
import { apple2Samples } from './samples';
import { apple2BuildTargets } from './targets';
import {
  COLD_START_BYTES_FREE,
  DISPLAY_HEIGHT,
  DISPLAY_WIDTH,
  FIRMWARE_BYTES,
} from './addresses';
import { apple2UnnumberedLineKey } from './directLine';
import { buildBasicImage, parseBasicImage } from './basicImage';
import { detokenizeProgram, detokenizeProgramWithReport } from './detokenizer';
import { tokenizeProgram } from './tokenizer';
import { apple2VariableErrors } from '../../editor/variableLint';

/**
 * The Apple II (Apple II Integer BASIC).
 *
 * Not in `src/dialects/registry.ts`: an unfinished machine must not be
 * selectable, and registering one turns every registry-driven battery on at
 * once. The emulator, the keyboard, the samples and the build targets below are
 * throwing stubs until each is written; the language layer is real.
 *
 * The picker identity and the RAM figure are placeholders that satisfy the
 * contract; each is written for real when the dialect is registered.
 */
export const apple2: Dialect = {
  id: 'apple2',
  name: 'Apple II',
  manufacturer: 'Apple',
  year: 1977,
  blurb: 'Runs Apple II Integer BASIC.',

  // Cold-start LOMEM/HIMEM leave 47104 bytes, shared between program and
  // variables.
  programRamBytes: COLD_START_BYTES_FREE,

  fileExtensions: ['.bas', '.txt'],
  keywords: apple2Keywords,
  operators: apple2Operators,
  charset: apple2Charset,
  languageSupport: apple2LanguageSupport,
  completionSource: apple2CompletionSource,
  crunched: apple2Crunched,

  /**
   * Text to the bytes the interpreter stores, plus the length-prefixed record
   * `SAVE` writes around them. The program sits at the *top* of the workspace
   * and grows down, so its size is checked against the workspace the listing
   * asks for rather than against a base address.
   */
  tokenize(source: string): TokenizeResult {
    const { program, errors, workspace } = tokenizeProgram(source);
    const all = [...errors, ...apple2VariableErrors(source, apple2Keywords)];
    const capacity = workspace.himem - workspace.lomem;
    if (program.length > capacity) {
      all.push({
        line: 1,
        column: 0,
        message: workspace.declared
          ? `Program is ${program.length} bytes; the workspace this listing asks for holds ${capacity}, shared with its variables`
          : `Program is ${program.length} bytes; the stock workspace holds ${capacity}, shared with its variables`,
      });
    }
    const runnable = hasFatalErrors(all) ? new Uint8Array(0) : program;
    return {
      programBytes: runnable,
      image: buildBasicImage(runnable, workspace),
      errors: all,
      byteSize: program.length,
    };
  },

  /**
   * The commands this machine takes without a line number. Consulted by the
   * editor's numbering and the AI merge, so neither numbers one, reorders one,
   * or drops one - each would change what the line means.
   */
  unnumberedLineKey: apple2UnnumberedLineKey,

  detokenize(image: Uint8Array): string {
    return detokenizeProgram(parseBasicImage(image).program);
  },

  detokenizeWithReport(image: Uint8Array) {
    const { program, headed } = parseBasicImage(image);
    const result = detokenizeProgramWithReport(program);
    return headed
      ? result
      : {
          ...result,
          warnings: [
            'The two-byte length header does not match the file, so the whole file was read as program text',
            ...result.warnings,
          ],
        };
  },

  lint(source: string): TokenizeError[] {
    return [
      ...tokenizeProgram(source).errors,
      ...apple2VariableErrors(source, apple2Keywords),
    ];
  },

  romUrl: `${import.meta.env.BASE_URL}roms/apple2.rom`,
  romBytes: FIRMWARE_BYTES,

  // The hi-res raster; the text and lo-res pages are drawn into it.
  displaySize: { width: DISPLAY_WIDTH, height: DISPLAY_HEIGHT },

  // Integer BASIC has no hex literal: PEEK and POKE take signed decimal, which
  // is why an I/O address is written negative.
  addressNotation: 'hex',
  statementSeparator: ':',
  memoryReads: { forms: ['peek'] },

  // The interpreter keeps a pointer to the line it is executing, so the machine
  // can name a line and be stepped a line at a time.
  debuggable: true,

  memoryMap: apple2MemoryMap,
  memoryBlocks: apple2MemoryBlocks,

  createEmulator(): MachineEmulator {
    throw new Error('apple2: not implemented');
  },

  keyboardLayout: apple2KeyboardLayout,
  samples: apple2Samples,
  buildTargets: apple2BuildTargets,

  aiProfile: apple2AiProfile,
};
