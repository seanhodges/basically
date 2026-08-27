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
import { atariBuildTargets } from './targets';
import { atariKeyboardLayout } from './keyboardLayout';
import { atariSamples } from './samples';
import { ATARI_800_RAM_TOP, programRamBytes } from './addresses';

/**
 * Atari 800 - the 48K machine of the pair, running Atari BASIC from cartridge.
 *
 * The whole language layer lives here and the Atari 400 imports it; the two
 * machines differ only in how much RAM is fitted, which is why they ship
 * together in the shape the BBC Micro and BBC Master already use.
 *
 * The emulator is not wired yet, so `createEmulator` throws and the dialect is
 * not registered: it is driven by its own tests until there is a machine to run
 * it on.
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

  createEmulator() {
    throw new Error('atari800: the emulator is not implemented yet');
  },

  keyboardLayout: atariKeyboardLayout,
  samples: atariSamples,
  buildTargets: atariBuildTargets,
  aiProfile: atari800AiProfile,
};
