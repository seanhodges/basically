import type { Dialect, TokenizeResult } from '../types';
import { atomCharset } from './charset';
import { atomKeywords } from './keywords';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram } from './detokenizer';
import { atomBuildTargets } from './targets';
import { atomLanguageSupport, atomCompletionSource } from './language';
import { atomAiProfile } from './aiProfile';
import { atomKeyboardLayout } from './keyboardLayout';
import { atomSamples } from './samples';
import { AtomMachine } from '../../emulator/atom/atomMachine';

/**
 * Acorn Atom dialect.
 *
 * Atom BASIC is a genuinely new dialect (its own tokenizer/charset/keywords):
 * a program line is stored as near-plain ASCII from #2900, and that image is
 * both what the emulator pokes in and the round-trippable program format.
 * Hardware emulation is delegated to the bundled jsbeeb core via the Atom
 * adapter (`src/emulator/atom/atomMachine.ts`, an 'Atom-Tape-FP' model).
 */
export const atom: Dialect = {
  id: 'atom',
  name: 'Acorn Atom',
  fileExtensions: ['.bas'],
  keywords: atomKeywords,
  charset: atomCharset,
  languageSupport: atomLanguageSupport,
  completionSource: atomCompletionSource,

  tokenize(source: string): TokenizeResult {
    const { bytes, errors } = tokenizeProgram(source);
    const image = errors.length === 0 ? bytes : new Uint8Array(0);
    return { programBytes: bytes, image, errors, byteSize: bytes.length };
  },

  detokenize(image: Uint8Array): string {
    return detokenizeProgram(image);
  },

  lint(source: string) {
    return tokenizeProgram(source).errors;
  },

  // The jsbeeb adapter loads the full Atom ROM set (Kernel + FloatingPoint +
  // Basic) itself; this URL is only the app's cache-warming prefetch.
  romUrl: `${import.meta.env.BASE_URL}roms/atom/Atom_Basic.rom`,

  // displaySize omitted: the Atom's 256x192 (CLEAR 4) matches the app default.

  // opts.rom/ramKb are ignored: jsbeeb manages its own ROMs and memory map.
  createEmulator() {
    return new AtomMachine();
  },

  keyboardLayout: atomKeyboardLayout,
  samples: atomSamples,
  buildTargets: atomBuildTargets,
  aiProfile: atomAiProfile,
};
