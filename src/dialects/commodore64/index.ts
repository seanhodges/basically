import type { Dialect, TokenizeResult } from '../types';
import { c64Charset } from './charset';
import { c64Keywords } from './keywords';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram } from './detokenizer';
import { c64BuildTargets } from './targets';
import { c64LanguageSupport, c64CompletionSource } from './language';
import { c64AiProfile } from './aiProfile';
import { c64KeyboardLayout } from './keyboardLayout';
import { c64Samples } from './samples';
import {
  C64Machine,
  C64_DISPLAY_WIDTH,
  C64_DISPLAY_HEIGHT,
} from '../../emulator/c64/c64Machine';

/**
 * Commodore 64 dialect.
 *
 * Commodore BASIC v2 is tokenized natively in TypeScript (see tokenizer.ts)
 * into the genuine in-memory layout the BASIC ROM keeps from $0801 — the same
 * bytes SAVE writes. That tokenized program, with the 2-byte $0801 load address
 * prepended, is the dialect's "image": the emulator injects it straight into
 * RAM, and it is also the .prg import/export format. Hardware emulation is
 * delegated to the vendored viciious core (see src/emulator/c64/c64Machine.ts).
 */
export const commodore64: Dialect = {
  id: 'commodore64',
  name: 'Commodore 64',
  fileExtensions: ['.bas'],
  keywords: c64Keywords,
  charset: c64Charset,
  languageSupport: c64LanguageSupport,
  completionSource: c64CompletionSource,

  tokenize(source: string): TokenizeResult {
    const { program, errors } = tokenizeProgram(source);
    // A non-empty image is the load address plus a program with at least one
    // line (more than the bare 0x0000 end link).
    const image =
      errors.length === 0 && program.length > 2
        ? Uint8Array.from([0x01, 0x08, ...program])
        : new Uint8Array(0);
    return { programBytes: program, image, errors, byteSize: program.length };
  },

  detokenize(image: Uint8Array): string {
    return detokenizeProgram(image);
  },

  lint(source: string) {
    return tokenizeProgram(source).errors;
  },

  // Prefetched by the app for cache warming; the C64 adapter loads the full ROM
  // set (BASIC + KERNAL + CHARGEN) itself from public/roms/c64/.
  romUrl: `${import.meta.env.BASE_URL}roms/c64/kernal.bin`,

  displaySize: { width: C64_DISPLAY_WIDTH, height: C64_DISPLAY_HEIGHT },

  // opts.rom/ramKb are ignored: viciious manages its own ROMs and 64K memory.
  createEmulator() {
    return new C64Machine();
  },

  keyboardLayout: c64KeyboardLayout,

  samples: c64Samples,

  buildTargets: c64BuildTargets,

  binaryImports: [{ extension: '.prg', label: 'Import .PRG…' }],

  aiProfile: c64AiProfile,
};
