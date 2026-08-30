// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type {
  Dialect,
  MachineEmulator,
  TokenizeError,
  TokenizeResult,
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

/**
 * The Apple II (Apple II Integer BASIC).
 *
 * Not in `src/dialects/registry.ts`: an unfinished machine must not be
 * selectable, and registering one turns every registry-driven battery on at
 * once. The members below are throwing stubs until each is written.
 *
 * The picker identity, the RAM figure and the ROM's byte count are placeholders
 * that satisfy the contract; each is written for real - and measured off the
 * booted machine, where it is a measurement - when the dialect is registered.
 */
export const apple2: Dialect = {
  id: 'apple2',
  name: 'Apple II',
  manufacturer: 'Apple',
  year: 1977,
  blurb: 'Runs Apple II Integer BASIC.',

  programRamBytes: COLD_START_BYTES_FREE,

  fileExtensions: ['.bas', '.txt'],
  keywords: apple2Keywords,
  operators: apple2Operators,
  charset: apple2Charset,
  languageSupport: apple2LanguageSupport,
  completionSource: apple2CompletionSource,
  crunched: apple2Crunched,

  tokenize(_source: string): TokenizeResult {
    throw new Error('apple2: not implemented');
  },

  detokenize(_image: Uint8Array): string {
    throw new Error('apple2: not implemented');
  },

  lint(_source: string): TokenizeError[] {
    throw new Error('apple2: not implemented');
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
