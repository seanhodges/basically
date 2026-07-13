import {
  hasFatalErrors,
  type Dialect,
  type MachineEmulator,
  type TokenizeResult,
} from '../types';
import { petKeywords } from './keywords';
import { petCharset } from './charset';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram, detokenizeProgramWithReport } from './detokenizer';
import { petLanguageSupport, petCompletionSource } from './language';
import { petBuildTargets } from './targets';
import { petKeyboardLayout } from './keyboardLayout';
import { petSamples } from './samples';
import { petAiProfile } from './aiProfile';
import { c64VariableErrors } from '../../editor/variableLint';

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

  tokenize(source: string): TokenizeResult {
    const { program, errors } = tokenizeProgram(source);
    // A non-empty image is the load address plus a program with at least one
    // line (more than the bare 0x0000 end link). PET programs load at $0401.
    const image =
      !hasFatalErrors(errors) && program.length > 2
        ? Uint8Array.from([0x01, 0x04, ...program])
        : new Uint8Array(0);
    return { programBytes: program, image, errors, byteSize: program.length };
  },

  detokenize(image: Uint8Array): string {
    return detokenizeProgram(image);
  },

  detokenizeWithReport(image: Uint8Array) {
    return detokenizeProgramWithReport(image);
  },

  lint(source: string) {
    // Reuse the C64 Microsoft-BASIC variable checks, passing the PET keyword
    // table so the disk commands (DOPEN, SCRATCH…) aren't mistaken for variables.
    return [
      ...tokenizeProgram(source).errors,
      ...c64VariableErrors(source, petKeywords),
    ];
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
