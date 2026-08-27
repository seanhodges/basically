// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { hasFatalErrors, type Dialect, type TokenizeResult } from '../types';
// The 400 and the 800 are one design with different amounts of RAM fitted, and
// they run the same Atari BASIC cartridge - so the whole language layer, the
// keyboard and the samples are imported from the sibling and only the memory
// figure, the AI profile and the machine variant are this dialect's own. Listed
// member by member rather than spread over the sibling, as `bbcmaster` lists
// them over `bbcmicro`: what a sibling inherits and what it owns should be
// visible here, and a field that must not be shared - a tape instruction naming
// the machine, a memory map - should have to be written rather than inherited
// by omission.
import { atariCharset } from '../atari800/charset';
import { atariKeywords, atariOperators } from '../atari800/keywords';
import { atariVariableErrors } from '../../editor/variableLint';
import { tokenizeProgram } from '../atari800/tokenizer';
import {
  detokenizeProgram,
  detokenizeWithReport,
} from '../atari800/detokenizer';
import {
  atariCompletionSource,
  atariCrunched,
  atariLanguageSupport,
} from '../atari800/language';
import { atariBuildTargets } from '../atari800/targets';
import { atariKeyboardLayout } from '../atari800/keyboardLayout';
import { atariSamples } from '../atari800/samples';
import { atari400AiProfile } from './aiProfile';
import { ATARI_400_RAM_TOP, programRamBytes } from '../atari800/addresses';

/**
 * Atari 400 - the 16K machine of the pair: a membrane keyboard, one cartridge
 * slot, and otherwise the 800's hardware.
 *
 * The emulator is not wired yet, so `createEmulator` throws and the dialect is
 * not registered.
 */
export const atari400: Dialect = {
  id: 'atari400',
  name: '400',
  manufacturer: 'Atari',
  year: 1979,
  blurb: 'The budget model, with a membrane keyboard. Runs Atari BASIC.',
  docsReference: 'atari',

  // The one thing a BASIC program can tell the two machines apart by.
  programRamBytes: programRamBytes(ATARI_400_RAM_TOP),

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
  addressNotation: 'dec',
  memoryReads: { forms: ['peek'], calls: ['USR'] },

  createEmulator() {
    throw new Error('atari400: the emulator is not implemented yet');
  },

  keyboardLayout: atariKeyboardLayout,
  samples: atariSamples,
  buildTargets: atariBuildTargets,
  aiProfile: atari400AiProfile,
};
