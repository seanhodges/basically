import {
  hasFatalErrors,
  type Dialect,
  type MachineEmulator,
  type TokenizeError,
  type TokenizeResult,
} from '../types';
import { cpc464Keywords } from './keywords';
import { cpcCharset } from './charset';
import { cpcLanguageSupport, cpcCompletionSource } from './language';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram, detokenizeWithReport } from './detokenizer';
import { parseBasFile } from './basfile';
import { cpc464KeyboardLayout } from './keyboardLayout';
import { cpc464Samples } from './samples';
import { cpc464BuildTargets } from './targets';
import { cpc464AiProfile } from './aiProfile';
import { CpcMachine } from '../../emulator/cpc/cpcMachine';
import { DISPLAY_WIDTH, DISPLAY_HEIGHT } from '../../emulator/cpc/display';

/**
 * Amstrad CPC 464 (Locomotive BASIC 1.0).
 *
 * The language layer (Stage 1 of docs/contributing/dialect-plans/cpc464.md)
 * is native TypeScript: the tokenizer produces the genuine Locomotive BASIC
 * program-area byte layout - binary numeric constants and all - and that
 * tokenized program is the dialect's "image", loadable at &170. The AMSDOS
 * `.bas` container (basfile.ts) wraps/unwraps it for file import/export.
 * Emulation lands in Stage 2 (`src/emulator/cpc/`); the dialect stays
 * unregistered in src/dialects/registry.ts until Stage 3 (which also adds
 * the `mode` share verb to src/player/routes.ts in the same change).
 * The CPC 6128 sibling (../cpc6128/) delegates to this dialect.
 */
export const cpc464: Dialect = {
  id: 'cpc464',
  name: 'CPC 464',
  docsReference: 'cpc',
  // Locomotive BASIC addresses memory in &-prefixed hex (POKE &A000, …).
  addressNotation: 'hex',
  // PRINT FRE(0) on a clean 464 boot (BASIC 1.0, no AMSDOS).
  programRamBytes: 42619,
  // The combined 32K firmware+BASIC ROM (16K OS then 16K Locomotive BASIC 1.0).
  romUrl: `${import.meta.env.BASE_URL}roms/cpc/cpc464.rom`,
  // All three modes render into one 640×400 canvas (see emulator/cpc/display).
  displaySize: { width: DISPLAY_WIDTH, height: DISPLAY_HEIGHT },
  fileExtensions: ['.txt', '.bas'],
  keywords: cpc464Keywords,
  charset: cpcCharset,
  languageSupport: cpcLanguageSupport,
  completionSource: cpcCompletionSource,

  tokenize(source: string): TokenizeResult {
    const { bytes, errors } = tokenizeProgram(source, 'basic10');
    // A non-empty image is the program plus its zero length-word end marker.
    const image =
      !hasFatalErrors(errors) && bytes.length > 2 ? bytes : new Uint8Array(0);
    return { programBytes: bytes, image, errors, byteSize: bytes.length };
  },

  detokenize(image: Uint8Array): string {
    return detokenizeProgram(parseBasFile(image).program, 'basic10');
  },

  detokenizeWithReport(image: Uint8Array) {
    const { program, warnings } = parseBasFile(image);
    const report = detokenizeWithReport(program, 'basic10');
    return { ...report, warnings: [...warnings, ...report.warnings] };
  },

  lint(source: string): TokenizeError[] {
    return tokenizeProgram(source, 'basic10').errors;
  },

  createEmulator(opts): MachineEmulator {
    return new CpcMachine({ rom: opts.rom, model: '464', files: opts.files });
  },

  keyboardLayout: cpc464KeyboardLayout,

  samples: cpc464Samples,

  buildTargets: cpc464BuildTargets,

  aiProfile: cpc464AiProfile,
};
