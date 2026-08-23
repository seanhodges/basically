// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { Dialect, TokenizeError, TokenizeResult } from '../types';
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
import { Apple1Machine } from '../../emulator/apple1/apple1Machine';

/**
 * The Apple I (Apple 1 Integer BASIC).
 *
 * Every member below is a throwing stub, and the dialect is deliberately absent
 * from `src/dialects/registry.ts` so an unfinished machine cannot be picked.
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
  blurb: "Woz's hand-built kit computer. Runs Apple 1 Integer BASIC.",

  // Stock LOMEM/HIMEM leave 2048 bytes, shared between program and variables.
  programRamBytes: COLD_START_BYTES_FREE,

  fileExtensions: ['.bas', '.txt'],
  keywords: apple1Keywords,
  operators: apple1Operators,
  charset: apple1Charset,
  languageSupport: apple1LanguageSupport,
  completionSource: apple1CompletionSource,
  crunched: apple1Crunched,

  tokenize(_source: string): TokenizeResult {
    throw new Error('apple1: not implemented');
  },

  detokenize(_image: Uint8Array): string {
    throw new Error('apple1: not implemented');
  },

  lint(_source: string): TokenizeError[] {
    throw new Error('apple1: not implemented');
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
  // Null until somebody establishes whether this BASIC accepts more than one
  // statement per line, and with which separator. Apple II Integer BASIC's ':'
  // is not evidence for the 1976 interpreter.
  statementSeparator: null,
  memoryReads: { forms: ['peek'] },

  memoryMap: apple1MemoryMap,
  memoryBlocks: apple1MemoryBlocks,

  createEmulator(opts) {
    return new Apple1Machine({ rom: opts.rom });
  },

  keyboardLayout: apple1KeyboardLayout,
  samples: apple1Samples,
  buildTargets: apple1BuildTargets,

  aiProfile: apple1AiProfile,
};
