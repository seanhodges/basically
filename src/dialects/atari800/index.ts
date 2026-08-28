// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { hasFatalErrors, type Dialect, type TokenizeResult } from '../types';
import { atariCharset } from './charset';
import { atariKeywords, atariOperators } from './keywords';
import { atariVariableErrors } from '../../editor/variableLint';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram, detokenizeWithReport } from './detokenizer';
import {
  atariCompletionSource,
  atariCrunched,
  atariLanguageSupport,
} from './language';
import { atari800AiProfile } from './aiProfile';
import { atariBuildTargets, atariCassetteAudio } from './targets';
import { atariKeyboardLayout } from './keyboardLayout';
import { atariSamples } from './samples';
import { atari800MemoryBlocks } from './memoryBlocks';
import {
  ATARI_800_RAM_TOP,
  ATARI_ROM_BYTES,
  programRamBytes,
} from './addresses';
import {
  ATARI_DISPLAY_HEIGHT,
  ATARI_DISPLAY_WIDTH,
  AtariMachine,
} from '../../emulator/atari/atariMachine';

/**
 * Atari 800 - the 48K machine of the pair, running Atari BASIC from cartridge.
 *
 * The whole language layer lives here and the Atari 400 imports it; the two
 * machines differ only in how much RAM is fitted, which is why they ship
 * together in the shape the BBC Micro and BBC Master already use.
 *
 * Not registered yet: the machine runs, and the dialect is driven by its own
 * tests, but the picker will not offer it until the rest of the batteries a
 * registered dialect owes are in place.
 */
export const atari800: Dialect = {
  id: 'atari800',
  name: '800',
  manufacturer: 'Atari',
  year: 1979,
  blurb: 'Two cartridge slots and 48K. Runs Atari BASIC.',
  docsReference: 'atari',

  // With the BASIC cartridge fitted nothing can reach the RAM behind $A000, so
  // a 48K machine offers a good deal less than 48K.
  programRamBytes: programRamBytes(ATARI_800_RAM_TOP),

  fileExtensions: ['.txt', '.bas'],
  keywords: atariKeywords,
  operators: atariOperators,
  charset: atariCharset,
  languageSupport: atariLanguageSupport,
  completionSource: atariCompletionSource,
  crunched: atariCrunched,

  tokenize(source: string): TokenizeResult {
    const { image, programBytes, errors } = tokenizeProgram(source);
    return {
      programBytes,
      image: hasFatalErrors(errors) ? new Uint8Array(0) : image,
      errors,
      byteSize: programBytes.length,
    };
  },

  detokenize(image: Uint8Array): string {
    return detokenizeProgram(image);
  },

  detokenizeWithReport(image: Uint8Array) {
    return detokenizeWithReport(image);
  },

  lint(source: string) {
    return [
      ...tokenizeProgram(source).errors,
      ...atariVariableErrors(source, atariKeywords),
    ];
  },

  statementSeparator: ':',

  // Atari BASIC has no hex literals, so POKE and PEEK addresses are decimal.
  addressNotation: 'dec',

  // USR's first argument is the address it calls, unlike the Microsoft USR that
  // passes its argument to a routine reached through a vector.
  memoryReads: { forms: ['peek'], calls: ['USR'] },

  romUrl: `${import.meta.env.BASE_URL}roms/atari.rom`,
  romBytes: ATARI_ROM_BYTES,

  // The widest playfield ANTIC can show, at two pixels a colour clock, and the
  // scanlines either side of it that a television showed: the 40x24 text screen
  // sits in the middle of it with a border, exactly as it does on a set.
  displaySize: { width: ATARI_DISPLAY_WIDTH, height: ATARI_DISPLAY_HEIGHT },

  debuggable: true,

  createEmulator(opts) {
    return new AtariMachine({ model: '800', rom: opts.rom });
  },

  memoryBlocks: atari800MemoryBlocks,

  keyboardLayout: atariKeyboardLayout,
  samples: atariSamples,
  buildTargets: atariBuildTargets,

  // The tokenized `.bas` also serves as an editor-text extension, so a file
  // dropped on the editor is read as text; the tokenized form is imported
  // through the Import dialog, which asks the dialect rather than the name.
  binaryImports: [
    { extension: '.bas', label: 'Import tokenized .BAS…' },
    { extension: '.lst', label: 'Import .LST listing…' },
    { extension: '.cas', label: 'Import .CAS cassette…' },
  ],

  audio: atariCassetteAudio,
  aiProfile: atari800AiProfile,
};
