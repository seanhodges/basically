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
import { tokenizeProgram } from './tokenizer';
import { pmd85VariableErrors } from '../../editor/variableLint';
import { Pmd85Machine } from './emulator/pmd85Machine';
import { ROM_IMAGE_SIZE, splitRomImage } from './romImage';
import { PROGRAM_BASE, STACK_TOP } from './addresses';
import { DISPLAY_HEIGHT, DISPLAY_WIDTH } from './emulator/display';

/**
 * The Tesla PMD 85-2 (BASIC-G).
 *
 * The language layer is real - keywords, charset, tokenizer, detokenizer,
 * image builder and lint all work against the shipped BASIC-G V2.0 image - but
 * the emulator, keyboard, samples and file exports are still throwing stubs, so
 * the dialect is deliberately absent from `src/dialects/registry.ts` until it
 * can actually run a program.
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
  romUrl: `${import.meta.env.BASE_URL}roms/pmd85.rom`,
  romBytes: ROM_IMAGE_SIZE,

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
