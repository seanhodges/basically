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
import { detokenizeProgram } from './detokenizer';
import { tokenizeProgram } from './tokenizer';
import { Pmd85Machine } from './emulator/pmd85Machine';
import { ROM_IMAGE_SIZE, splitRomImage } from './romImage';
import { DISPLAY_HEIGHT, DISPLAY_WIDTH } from './emulator/display';

/**
 * The Tesla PMD 85-2 (BASIC-G).
 *
 * Scaffolding only: every member below throws, and the dialect is deliberately
 * absent from `src/dialects/registry.ts` until it can actually run a program.
 *
 * Three things about this machine are worth knowing before touching any of it:
 *
 *  - **It is an 8080, not a Z80.** The MHB8080A is a Tesla-made 8080A clone, so
 *    the vendored Z80 core executes its object code directly - as it already
 *    does for the Altair, whose adapter carries the two flag corrections that
 *    makes necessary.
 *  - **BASIC-G is not in the address space.** It lives in a replaceable ROM
 *    Module read through an 8255 at ports 0xF8-0xFB, which the Monitor copies
 *    into RAM before it runs. The machine therefore needs two ROM images.
 *  - **The screen packs six pixels to a byte**, 48 displayed bytes into a
 *    64-byte scanline stride, with the top two bits of each byte holding a
 *    four-level attribute.
 *
 * The picker identity fields carry their intended values, but nothing checks
 * them while the dialect is unregistered - `registry.test.ts` only sees machines
 * the registry lists, so the blurb's 72-character budget is unenforced here.
 */
export const pmd85: Dialect = {
  id: 'pmd85',
  name: 'PMD 85-2',
  manufacturer: 'Tesla',
  year: 1986,
  blurb: 'Czechoslovakia’s school computer. Runs BASIC-G.',

  // 48K fitted, of which 16K is video RAM. What BASIC-G actually leaves a
  // program has to be read off the machine, not derived from those two numbers.
  programRamBytes: 0,

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

  lint(source: string): TokenizeError[] {
    return tokenizeProgram(source).errors;
  },

  /**
   * The Monitor ROM and the BASIC-G module concatenated into one image - see
   * `romImage.ts` for the layout. Neither half ships yet, so `romBundled: false`
   * turns the missing file into a "supply your own image" offer rather than a
   * 404, and keeps the machine out of the pickers until one is installed.
   */
  romUrl: `${import.meta.env.BASE_URL}roms/pmd85.rom`,
  romBytes: ROM_IMAGE_SIZE,
  romBundled: false,

  displaySize: { width: DISPLAY_WIDTH, height: DISPLAY_HEIGHT },

  addressNotation: 'hex',
  statementSeparator: ':',

  memoryMap: pmd85MemoryMap,
  memoryBlocks: pmd85MemoryBlocks,

  createEmulator(opts) {
    return new Pmd85Machine(splitRomImage(opts.rom));
  },

  keyboardLayout: pmd85KeyboardLayout,
  samples: pmd85Samples,
  buildTargets: pmd85BuildTargets,

  aiProfile: pmd85AiProfile,
};
