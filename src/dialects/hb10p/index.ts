// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import {
  hasFatalErrors,
  type DetokenizeResult,
  type Dialect,
  type MachineEmulator,
  type TokenizeError,
  type TokenizeResult,
} from '../types';
import { hb10pKeywords, hb10pOperators } from './keywords';
import { hb10pCharset } from './charset';
import {
  hb10pCompletionSource,
  hb10pCrunched,
  hb10pLanguageSupport,
} from './language';
import { hb10pKeyboardLayout } from './keyboardLayout';
import { hb10pSamples } from './samples';
import { hb10pBuildTargets } from './targets';
import { hb10pAiProfile } from './aiProfile';
import { hb10pMemoryMap } from './memoryMap';
import { hb10pMemoryBlocks } from './memoryBlocks';
import { tokenizeProgram } from './tokenizer';
import { buildBasFile, importBasFile } from './basfile';
import {
  casToTapeStream,
  isCasImage,
  readTapeFile,
  readTapeStream,
} from './casfile';
import { hb10pCassetteAudio } from './audio/cassette';
import { hb10pVariableErrors } from '../../editor/variableLint';
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
 */
const HB10P_MODEL: MsxModel = {
  ramKb: 64,
  ramSlot: 3,
  region: 'pal',
  vdp: 't6950',
  keyboardId: 'international',
  // Page 3 of slot 0 answers with the main RAM on this machine; see MsxModel.
  slot0Page3: 'ram-mirror',
  romPath: 'public/roms/msx/hb10p.rom',
};

export const hb10p: Dialect = {
  id: 'hb10p',
  name: 'HB-10P',
  manufacturer: 'Sony',
  year: 1986,
  blurb: 'Sony’s MSX HitBit. Runs MSX BASIC 1.0.',
  basicDialect: 'MSX BASIC 1.0',
  basicFamily: 'MSX BASIC',
  docsReference: 'msx',
  // MSX BASIC addresses memory in &H-prefixed hex (POKE &HC000, …).
  addressNotation: 'hex',
  statementSeparator: ':',
  memoryMap: hb10pMemoryMap,
  memoryBlocks: hb10pMemoryBlocks,
  memoryWrites: { forms: ['poke'], hexPrefix: '&H' },
  memoryReads: { forms: ['peek'] },
  // The machine's own sign-on figure, which is also what settles the long-
  // running question of how much RAM an HB-10P has: 28815 is the 64 KB
  // machine's answer, and a 16 KB one would print 12431.
  programRamBytes: 28815,
  // The MSX general-purpose port is the machine's own game interface, read
  // through the PSG's I/O register rather than through the key matrix, and it
  // carries two triggers rather than one.
  joystickModes: ['native'],
  joystickFireButtons: 2,
  romUrl: `${import.meta.env.BASE_URL}roms/msx/hb10p.rom`,
  romBytes: 32 * 1024,
  displaySize: { width: DISPLAY_WIDTH, height: DISPLAY_HEIGHT },
  fileExtensions: ['.txt', '.bas'],
  keywords: hb10pKeywords,
  operators: hb10pOperators,
  charset: hb10pCharset,
  crunched: hb10pCrunched,
  languageSupport: hb10pLanguageSupport,
  completionSource: hb10pCompletionSource,

  tokenize(source: string): TokenizeResult {
    const { bytes, errors } = tokenizeProgram(source);
    // A non-empty image is the tokenized marker plus a program with at least
    // one line (more than the bare 0x0000 end link).
    const image =
      !hasFatalErrors(errors) && bytes.length > 2
        ? buildBasFile(bytes)
        : new Uint8Array(0);
    return {
      programBytes: bytes,
      image,
      errors,
      byteSize: bytes.length,
    };
  },

  detokenize(image: Uint8Array): string {
    return importProgramImage(image).source;
  },

  detokenizeWithReport(image: Uint8Array): DetokenizeResult {
    return importProgramImage(image);
  },

  lint(source: string): TokenizeError[] {
    return [
      ...tokenizeProgram(source).errors,
      ...hb10pVariableErrors(source, hb10pKeywords),
    ];
  },

  createEmulator(opts): MachineEmulator {
    return new MsxMachine({
      rom: opts.rom,
      model: HB10P_MODEL,
      charset: hb10pCharset,
      files: opts.files,
    });
  },

  // The machine reports the line it is on and steps a line at a time, so the
  // toolbar offers Step and Resume; `debugCapability.test.ts` pins the flag to
  // what MsxMachine actually implements.
  debuggable: true,
  keyboardLayout: hb10pKeyboardLayout,
  samples: hb10pSamples,
  buildTargets: hb10pBuildTargets,
  binaryImports: [
    { extension: '.bas', label: 'Import tokenized .BAS…' },
    { extension: '.cas', label: 'Import .CAS cassette…' },
  ],
  audio: hb10pCassetteAudio,
  aiProfile: hb10pAiProfile,
};

/**
 * Import a file the machine could have written: a `.cas` tape image, or the
 * `.bas` a disk save leaves - tokenized or an ASCII listing.
 *
 * The `.cas` is told by its block marker rather than by the extension it
 * arrived under, so a tape image dropped on the editor reads as one whichever
 * way it is named.
 */
function importProgramImage(image: Uint8Array): DetokenizeResult {
  if (!isCasImage(image)) return importBasFile(image);
  const file = readTapeStream(casToTapeStream(image));
  if (!file) {
    return {
      source: '',
      warnings: [
        'This .cas file holds no MSX tape file this dialect can read.',
      ],
    };
  }
  return readTapeFile(file);
}
