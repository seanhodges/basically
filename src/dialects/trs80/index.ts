import type { Dialect, TokenizeError, TokenizeResult } from '../types';
import { trs80Charset } from './charset';
import { trs80Keywords } from './keywords';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram } from './detokenizer';
import { trs80LanguageSupport, trs80CompletionSource } from './language';
import { trs80AiProfile } from './aiProfile';
import { trs80BuildTargets } from './targets';
import { Trs80Machine } from './emulator/trs80Machine';
import { trs80KeyboardLayout } from './keyboardLayout';
import { trs80Samples } from './samples';

/**
 * TRS-80 Model I (Level II BASIC) — assembled but **not yet registered** in
 * src/dialects/registry.ts. The members below are throwing stubs; each stage of
 * docs/dialect-plans/trs80.md fills one in. Registration is Stage 3, gated on a
 * usable ROM (see the licensing note in the plan).
 */
export const trs80: Dialect = {
  id: 'trs80',
  name: 'TRS-80 Model I',
  fileExtensions: ['.bas'],
  keywords: trs80Keywords,
  charset: trs80Charset,
  languageSupport: trs80LanguageSupport,
  completionSource: trs80CompletionSource,

  tokenize(source: string): TokenizeResult {
    const { program, errors } = tokenizeProgram(source);
    return {
      programBytes: program,
      image: program,
      errors,
      byteSize: program.length,
    };
  },

  detokenize(image: Uint8Array): string {
    return detokenizeProgram(image);
  },

  lint(source: string): TokenizeError[] {
    return tokenizeProgram(source).errors;
  },

  romUrl: `${import.meta.env.BASE_URL}roms/trs80.rom`,

  // Wider than the 256×192 default: a 64×16 character display at an 8×12 cell.
  displaySize: { width: 512, height: 192 },

  createEmulator(opts) {
    return new Trs80Machine(opts);
  },

  keyboardLayout: trs80KeyboardLayout,

  samples: trs80Samples,

  buildTargets: trs80BuildTargets,

  aiProfile: trs80AiProfile,
};
