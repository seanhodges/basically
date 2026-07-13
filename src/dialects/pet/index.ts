import type { Dialect, MachineEmulator, TokenizeResult } from '../types';
import { petKeywords } from './keywords';
import { petCharset } from './charset';
import { petLanguageSupport, petCompletionSource } from './language';
import { petBuildTargets } from './targets';
import { petKeyboardLayout } from './keyboardLayout';
import { petSamples } from './samples';
import { petAiProfile } from './aiProfile';

/**
 * Commodore PET dialect - scaffolding only, NOT registered in
 * src/dialects/registry.ts until Stage 3 of its plan.
 *
 * Staged plan: docs/contributing/dialect-plans/pet.md. In brief: PET BASIC 4.0
 * shares the C64 language layer via a CbmVariant seam ($0401 load address +
 * disk tokens $CC-$DA); the emulator is an in-tree 6502 bus (vendored
 * src/emulator/6502/ core) with shared Commodore chips under
 * src/emulator/commodore/ and the machine under src/emulator/pet/.
 */
export const pet: Dialect = {
  id: 'pet',
  name: 'Commodore PET',
  // BASIC 4.0 "31743 BYTES FREE" on a 32KB machine.
  programRamBytes: 31743,
  fileExtensions: ['.txt', '.bas'],
  keywords: petKeywords,
  charset: petCharset,
  languageSupport: petLanguageSupport,
  completionSource: petCompletionSource,

  tokenize(_source: string): TokenizeResult {
    throw new Error('pet: not implemented (Stage 1)');
  },

  detokenize(_image: Uint8Array): string {
    throw new Error('pet: not implemented (Stage 1)');
  },

  lint(_source: string) {
    throw new Error('pet: not implemented (Stage 1)');
  },

  // TODO (pet Stage 2): romUrl + displaySize once the machine and its ROM set
  // land under src/emulator/pet/ and public/roms/pet/.

  createEmulator(_opts): MachineEmulator {
    throw new Error('pet: not implemented (Stage 2)');
  },

  keyboardLayout: petKeyboardLayout,

  samples: petSamples,

  buildTargets: petBuildTargets,

  // TODO (pet Stage 4): binaryImports (.prg) + audio (cassette WAV at $0401).

  aiProfile: petAiProfile,
};
