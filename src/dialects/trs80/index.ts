import type { Dialect, TokenizeError, TokenizeResult } from '../types';
import { trs80Charset } from './charset';
import { trs80Keywords } from './keywords';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram } from './detokenizer';
import { trs80LanguageSupport, trs80CompletionSource } from './language';
import { trs80AiProfile } from './aiProfile';
import { trs80BuildTargets } from './targets';
import { Trs80InterpreterMachine } from './interpreter/machine';
import { trs80KeyboardLayout } from './keyboardLayout';
import { trs80Samples } from './samples';

/**
 * TRS-80 Model I (Level II BASIC). The default backend is the ROM-free
 * high-level interpreter under `interpreter/`, so the dialect needs no `romUrl`.
 * The Z80 + ROM machine (`emulator/trs80Machine.ts`) is kept in the tree as an
 * alternate "accuracy mode" for anyone who supplies their own legally-obtained
 * Level II ROM.
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

  // No romUrl: the interpreter backend needs no ROM image.

  // Wider than the 256×192 default: a 64×16 character display at an 8×12 cell.
  displaySize: { width: 512, height: 192 },

  // The interpreter introspects its own state, so the step debugger and the
  // variable watcher are available.
  debuggable: true,

  createEmulator() {
    return new Trs80InterpreterMachine();
  },

  keyboardLayout: trs80KeyboardLayout,

  samples: trs80Samples,

  buildTargets: trs80BuildTargets,

  aiProfile: trs80AiProfile,
};
