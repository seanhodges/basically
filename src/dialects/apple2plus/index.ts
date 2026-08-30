// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type {
  Dialect,
  MachineEmulator,
  TokenizeError,
  TokenizeResult,
} from '../types';
// The II and the II Plus are one design with a different BASIC in ROM, so the
// charset and the keyboard are imported from the sibling and everything the
// interpreter decides is this dialect's own. Listed member by member rather
// than spread over the sibling, as `atari400` lists them over `atari800`: what
// a sibling inherits and what it owns should be visible here.
import { apple2Charset } from '../apple2/charset';
import { apple2plusAiProfile } from './aiProfile';
import { apple2plusKeyboardLayout } from './keyboardLayout';
import { apple2plusKeywords, apple2plusOperators } from './keywords';
import {
  apple2plusCompletionSource,
  apple2plusCrunched,
  apple2plusLanguageSupport,
} from './language';
import { apple2plusMemoryBlocks } from './memoryBlocks';
import { apple2plusMemoryMap } from './memoryMap';
import { apple2plusSamples } from './samples';
import { apple2plusBuildTargets } from './targets';
import { COLD_START_BYTES_FREE, FIRMWARE_BYTES } from './addresses';
import { DISPLAY_HEIGHT, DISPLAY_WIDTH } from '../apple2/addresses';

/**
 * The Apple II Plus (Applesoft BASIC).
 *
 * Not in `src/dialects/registry.ts`: an unfinished machine must not be
 * selectable. The members below are throwing stubs until each is written, and
 * the picker identity and the RAM figure are placeholders satisfying the
 * contract until the dialect is registered.
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

  tokenize(_source: string): TokenizeResult {
    throw new Error('apple2plus: not implemented');
  },

  detokenize(_image: Uint8Array): string {
    throw new Error('apple2plus: not implemented');
  },

  lint(_source: string): TokenizeError[] {
    throw new Error('apple2plus: not implemented');
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

  createEmulator(): MachineEmulator {
    throw new Error('apple2plus: not implemented');
  },

  keyboardLayout: apple2plusKeyboardLayout,
  samples: apple2plusSamples,
  buildTargets: apple2plusBuildTargets,

  aiProfile: apple2plusAiProfile,
};
