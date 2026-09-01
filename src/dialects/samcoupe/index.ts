import {
  hasFatalErrors,
  type Dialect,
  type DetokenizeResult,
  type TokenizeResult,
} from '../types';
import { samcoupeCharset } from './charset';
import { samcoupeKeywords, samcoupeOperators } from './keywords';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram, detokenizeWithWarnings } from './detokenizer';
import { buildSamFile, parseSamFile, parseSamFileWithReport } from './samfile';
import { samcoupeCompletionSource, samcoupeLanguageSupport } from './language';
import { samcoupeVariableErrors } from '../../editor/variableLint';
import { samcoupeAiProfile } from './aiProfile';
import { samcoupeBuildTargets } from './targets';
import { samcoupeKeyboardLayout } from './keyboardLayout';
import { samcoupeSamples } from './samples';
import { samcoupeMemoryMap } from './memoryMap';
import { samcoupeMemoryBlocks } from './memoryBlocks';
import { SamMachine } from './emulator/samMachine';
import { ROM_BYTES } from './emulator/memory';
import { DISPLAY_HEIGHT, DISPLAY_WIDTH } from './emulator/display';

/**
 * The SAM Coupé. Not registered yet, so nothing in the app can reach it; the
 * members below are filled in as each part of the machine is built.
 *
 * The picker identity - the blurb especially - is written for its reader when
 * the dialect joins the registry.
 */
export const samcoupe: Dialect = {
  id: 'samcoupe',
  name: 'Coupé',
  manufacturer: 'MGT',
  year: 1989,
  basicDialect: 'SAM BASIC',
  blurb: 'A 6MHz Z80 with four screen modes. Runs SAM BASIC.',
  programRamBytes: 0,
  memoryMap: samcoupeMemoryMap,
  memoryBlocks: samcoupeMemoryBlocks,
  displaySize: { width: DISPLAY_WIDTH, height: DISPLAY_HEIGHT },

  statementSeparator: ':',
  fileExtensions: ['.txt', '.bas'],
  keywords: samcoupeKeywords,
  operators: samcoupeOperators,
  charset: samcoupeCharset,
  languageSupport: samcoupeLanguageSupport,
  completionSource: samcoupeCompletionSource,

  tokenize(source: string, opts): TokenizeResult {
    const { bytes, errors } = tokenizeProgram(source);
    const image =
      !hasFatalErrors(errors) && bytes.length > 0
        ? buildSamFile(bytes, opts?.programName ?? 'program')
        : new Uint8Array(0);
    return { programBytes: bytes, image, errors, byteSize: bytes.length };
  },

  detokenize(image: Uint8Array): string {
    return detokenizeProgram(parseSamFile(image).program);
  },

  detokenizeWithReport(image: Uint8Array): DetokenizeResult {
    const { file, warnings } = parseSamFileWithReport(image);
    const text = detokenizeWithWarnings(
      file ? file.program : new Uint8Array(0),
    );
    return {
      source: text.source,
      warnings: [...warnings, ...text.warnings],
      autoStart: file?.autoStart ?? null,
    };
  },

  lint(source: string) {
    return [
      ...tokenizeProgram(source).errors,
      ...samcoupeVariableErrors(source, samcoupeKeywords),
    ];
  },

  romUrl: `${import.meta.env.BASE_URL}roms/samcoupe.rom`,
  romBytes: ROM_BYTES,

  createEmulator(opts) {
    return new SamMachine({ rom: opts.rom });
  },

  keyboardLayout: samcoupeKeyboardLayout,
  samples: samcoupeSamples,
  buildTargets: samcoupeBuildTargets,
  aiProfile: samcoupeAiProfile,
};
