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

/**
 * Acorn Atom dialect — STUB scaffold.
 *
 * Assembled from throwing stubs; **not** registered in
 * `src/dialects/registry.ts` until Stage 3 of `docs/dialect-plans/atom.md`.
 * Atom BASIC is a genuinely new dialect (its own tokenizer/charset/keywords),
 * driven over the bundled jsbeeb core via a future `AtomMachine`
 * (`src/emulator/atom/atomMachine.ts`, Stage 2).
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

  // The jsbeeb adapter (Stage 2) loads the full Atom ROM set itself; this URL
  // is only the app's cache-warming prefetch.
  romUrl: `${import.meta.env.BASE_URL}roms/atom/Atom_Basic.rom`,

  createEmulator() {
    throw new Error(
      'atom: emulator not implemented (see docs/dialect-plans/atom.md, Stage 2)',
    );
  },

  keyboardLayout: atomKeyboardLayout,
  samples: atomSamples,
  buildTargets: atomBuildTargets,
  aiProfile: atomAiProfile,
};
