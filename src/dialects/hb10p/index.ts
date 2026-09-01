// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type {
  Dialect,
  MachineEmulator,
  TokenizeError,
  TokenizeResult,
} from '../types';
import { hb10pKeywords } from './keywords';
import { hb10pCharset } from './charset';
import { hb10pCompletionSource, hb10pLanguageSupport } from './language';
import { hb10pKeyboardLayout } from './keyboardLayout';
import { hb10pSamples } from './samples';
import { hb10pBuildTargets } from './targets';
import { hb10pAiProfile } from './aiProfile';
import { hb10pMemoryMap } from './memoryMap';
import { hb10pMemoryBlocks } from './memoryBlocks';
import { tokenizeProgram } from './tokenizer';
import { importBasFile } from './basfile';
import { MsxMachine } from '../../emulator/msx/msxMachine';
import { DISPLAY_HEIGHT, DISPLAY_WIDTH } from '../../emulator/msx/display';
import type { MsxModel } from '../../emulator/msx/model';

/**
 * Sony HB-10P (MSX BASIC 1.0) - the European model of Sony's HitBit MSX1.
 *
 * The language layer is native TypeScript: the tokenizer produces the genuine
 * MSX program-area byte layout, typed numeric constants and all, and that is
 * the dialect's image. The machine lives in `src/emulator/msx/`, shared with
 * whatever MSX joins it later; everything that distinguishes one MSX from
 * another is in the {@link MsxModel} below rather than inside the machine.
 *
 * The picker identity here is provisional and is written for real when the
 * dialect is offered to the user.
 */
const HB10P_MODEL: MsxModel = {
  ramKb: 64,
  ramSlot: 3,
  region: 'pal',
  vdp: 't6950',
  keyboardId: 'international',
};

export const hb10p: Dialect = {
  id: 'hb10p',
  name: 'HB-10P',
  manufacturer: 'Sony',
  year: 1986,
  blurb: 'Sony’s MSX HitBit. Runs MSX BASIC 1.0.',
  basicDialect: 'MSX BASIC 1.0',
  docsReference: 'msx',
  // MSX BASIC addresses memory in &H-prefixed hex (POKE &HC000, …).
  addressNotation: 'hex',
  statementSeparator: ':',
  memoryMap: hb10pMemoryMap,
  memoryBlocks: hb10pMemoryBlocks,
  memoryWrites: { forms: ['poke'], hexPrefix: '&H' },
  memoryReads: { forms: ['peek'] },
  // Provisional: the machine's own sign-on figure replaces this once it boots.
  programRamBytes: 0,
  romUrl: `${import.meta.env.BASE_URL}roms/msx/hb10p.rom`,
  romBytes: 32 * 1024,
  displaySize: { width: DISPLAY_WIDTH, height: DISPLAY_HEIGHT },
  fileExtensions: ['.txt', '.bas'],
  keywords: hb10pKeywords,
  charset: hb10pCharset,
  languageSupport: hb10pLanguageSupport,
  completionSource: hb10pCompletionSource,

  tokenize(source: string): TokenizeResult {
    const { bytes, errors } = tokenizeProgram(source);
    return {
      programBytes: bytes,
      image: bytes,
      errors,
      byteSize: bytes.length,
    };
  },

  detokenize(image: Uint8Array): string {
    return importBasFile(image).source;
  },

  lint(source: string): TokenizeError[] {
    return tokenizeProgram(source).errors;
  },

  createEmulator(opts): MachineEmulator {
    return new MsxMachine({
      rom: opts.rom,
      model: HB10P_MODEL,
      files: opts.files,
    });
  },

  keyboardLayout: hb10pKeyboardLayout,
  samples: hb10pSamples,
  buildTargets: hb10pBuildTargets,
  aiProfile: hb10pAiProfile,
};
