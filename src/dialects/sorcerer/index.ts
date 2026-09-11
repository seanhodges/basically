// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type {
  Dialect,
  MachineEmulator,
  TokenizeError,
  TokenizeResult,
} from '../types';
import { hasFatalErrors } from '../types';
import { sorcererCharset } from './charset';
import { sorcererKeywords, sorcererOperators } from './keywords';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram } from './detokenizer';
import { buildBasicImage } from './basicImage';
import { sorcererVariableErrors } from '../../editor/variableLint';
import {
  sorcererCompletionSource,
  sorcererCrunched,
  sorcererLanguageSupport,
} from './language';
import { sorcererAiProfile } from './aiProfile';
import { sorcererBuildTargets } from './targets';
import { sorcererKeyboardLayout } from './keyboardLayout';
import { sorcererSamples } from './samples';
import { sorcererMemoryMap } from './memoryMap';
import { sorcererMemoryBlocks } from './memoryBlocks';
import {
  CHAR_CELL_HEIGHT,
  CHAR_CELL_WIDTH,
  SCREEN_COLUMNS,
  SCREEN_ROWS,
} from './addresses';
import { ROM_IMAGE_SIZE, splitRomImage } from './romImage';
import { SorcererMachine } from '../../emulator/sorcerer/sorcererMachine';

/**
 * The Exidy Sorcerer (Exidy Standard BASIC).
 *
 * **Not registered yet.** The dialect is deliberately absent from
 * `src/dialects/registry.ts`: the line in that file turns on some seventy
 * registry-driven test batteries at once, so it goes in last, once everything
 * they ask for is in place. The machine below is real, boots the ROM, and runs
 * the bundled samples off its own keyboard; what is still a stub is the
 * runtime introspection above it - the memory map, the variable watcher and the
 * run report - and the file exports.
 *
 * ## Sourcing
 *
 * Every fact in this dialect cites one of these rather than a recollection of
 * the machine:
 *
 *  - **Sorcerer Technical Manual**, Exidy Inc., March 1979 (archive.org
 *    `Sorcer_Technical_Manual_1979-03_Exidy`) - the memory map, video timing,
 *    I/O ports and cassette interface.
 *  - **Sorcerer 2 Technical Manual**, Exidy Inc., December 1979 (bitsavers
 *    `pdf/exidy/Exidy_Sorcerer_2_Technical_Manual_Dec1979.pdf`).
 *  - **Sorcerer Software Manual**, Exidy Inc., April 1979 (bitsavers
 *    `pdf/exidy/Sorcerer_Software_Manual_Apr79.pdf`) - the Monitor, its entry
 *    points and workareas, and the BASIC control area.
 *  - **Exidy Software Internals Manual**, Vic Tolomei, 1979 (archive.org
 *    `Exidy_Software_Internals_Manual_1979_Tolomei_Vic`) - the interpreter's own
 *    workspace, which is what the variable watcher reads.
 *
 * Where a manual is silent, say so rather than reaching for a plausible-sounding
 * implementation detail; and confirm anything the ROM can answer against the
 * booted ROM, which is the cheaper check. `programRamBytes` below is the worked
 * example - it is a figure read off the machine's own sign-on banner
 * (`EXIDY STANDARD BASIC VER 1.0 ... 31976 BYTES FREE` on the modelled 32K
 * machine), not one computed from the fitted RAM less an estimate of overhead.
 *
 * ## Three things worth knowing before working on it
 *
 *  - **Three ROMs, one image.** The 4K Monitor at 0xE000, the 8K Standard BASIC
 *    ROM PAC at 0xC000 and the 1K character generator at 0xF800 are different
 *    devices on different chip selects, and the dialect seam hands a machine one
 *    `rom: Uint8Array`. They travel concatenated - firmware, cartridge, font -
 *    the way `pmd85.rom` carries its two halves. The font is the part that is
 *    easy to forget and impossible to do without: nothing else holds the shapes
 *    of codes 0-127, so an image without it boots a machine whose screen stays
 *    blank whatever is written to it. See `romImage.ts`.
 *  - **The character generator is half RAM.** Codes 0-127 come from ROM at
 *    0xF800; codes 128-255 are bitmaps in RAM at 0xFC00, into which the Monitor
 *    copies the "standard" graphics set at boot. So those shapes are a
 *    convention a running program may overwrite, not a fixed font, and the
 *    user-definable band at 192-255 is what SHIFT + GRAPHIC types.
 *  - **Exidy Standard BASIC is a Microsoft 8K BASIC**, so the program hand-over
 *    (`src/emulator/microsoftBasicLoad.ts`), the variable decoding
 *    (`src/emulator/microsoftBasicVars.ts`) and the variable linting
 *    (`microsoftVariableErrors`) are all shared with the Altair and the PMD 85.
 *    The *token bytes* are not: they are this ROM's, and reading them off the
 *    Altair's table would be wrong.
 */
export const sorcerer: Dialect = {
  id: 'sorcerer',
  // Picker identity, written to the rules in the `adding-a-target-system`
  // skill and revisited when the dialect registers, which is the first time
  // anything checks it. A new picker group: no other Exidy machine ships, so
  // there is no sibling spelling to match.
  name: 'Sorcerer',
  manufacturer: 'Exidy',
  year: 1978,
  blurb: 'The ROM PAC micro. Runs Exidy Standard BASIC.',
  // From the ROM PAC's own sign-on banner. Deliberately no `basicFamily`: the
  // name on the machine is Exidy's, and this project draws the family line at
  // the vendor's name rather than at the ancestry - which is why Commodore
  // BASIC, Applesoft and Level II BASIC are not filed under Microsoft BASIC
  // either.
  basicDialect: 'Exidy Standard BASIC',

  fileExtensions: ['txt', 'bas'],

  keywords: sorcererKeywords,
  operators: sorcererOperators,
  charset: sorcererCharset,

  languageSupport: sorcererLanguageSupport,
  completionSource: sorcererCompletionSource,

  tokenize(source: string): TokenizeResult {
    const { program, errors } = tokenizeProgram(source);
    const image = hasFatalErrors(errors)
      ? new Uint8Array(0)
      : buildBasicImage(program);
    return {
      programBytes: program,
      image,
      errors,
      byteSize: program.length,
    };
  },
  detokenize: detokenizeProgram,
  lint(source: string): TokenizeError[] {
    return [
      ...tokenizeProgram(source).errors,
      ...sorcererVariableErrors(source, sorcererKeywords),
    ];
  },

  /** Spaces outside strings, REM and DATA are eaten, so `FORI=1TO5` is valid. */
  crunched: sorcererCrunched,

  /**
   * The Monitor, the Standard BASIC ROM PAC and the character generator
   * concatenated in that order (see `romImage.ts`). `romBytes` is declared so a
   * user may replace the set from Settings, the way every other bundled-ROM
   * machine here does.
   */
  romUrl: `${import.meta.env.BASE_URL}roms/sorcerer/sorcerer.rom`,
  romBytes: ROM_IMAGE_SIZE,

  /** 64x30 characters of 8x8 dots, monochrome - not the 256x192 default. */
  displaySize: {
    width: SCREEN_COLUMNS * CHAR_CELL_WIDTH,
    height: SCREEN_ROWS * CHAR_CELL_HEIGHT,
  },

  /** The banner's own figure on the modelled 32K machine. */
  programRamBytes: 31976,

  /** The Monitor and its manuals both address memory in hex. */
  addressNotation: 'hex',
  statementSeparator: ':',

  memoryMap: sorcererMemoryMap,
  memoryBlocks: sorcererMemoryBlocks,

  createEmulator(opts): MachineEmulator {
    return new SorcererMachine(splitRomImage(opts.rom));
  },

  keyboardLayout: sorcererKeyboardLayout,
  samples: sorcererSamples,
  buildTargets: sorcererBuildTargets,
  aiProfile: sorcererAiProfile,
};
