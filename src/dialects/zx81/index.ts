import {
  hasFatalErrors,
  type Dialect,
  type DetokenizeResult,
  type TokenizeError,
  type TokenizeResult,
} from '../types';
import { zx81Charset } from './charset';
import { zx81Keywords } from './keywords';
import { tokenizeProgram } from './tokenizer';
import {
  detokenizeProgram,
  detokenizeProgramWithInfo,
  structuralWarnings,
} from './detokenizer';
import { rawEscapeWarning } from '../sinclairImportReport';
import { buildPFile, parsePFile } from './pfile';
import { decodeCassette } from './audio/cassetteDecoder';
import { zx81LanguageSupport, zx81CompletionSource } from './language';
import { zx81VariableErrors } from '../../editor/variableLint';
import { zx81AiProfile } from './aiProfile';
import {
  zx81BuildTargets,
  buildCassetteSamples,
  CASSETTE_SAMPLE_RATE,
} from './targets';
import { Zx81Machine } from './emulator/zx81Machine';
import { zx81KeyboardLayout } from './keyboardLayout';
import { zx81Samples } from './samples';
import { zx81MemoryMap } from './memoryMap';
import { zx81MemoryBlocks } from './memoryBlocks';

export const zx81: Dialect = {
  id: 'zx81',
  name: 'ZX81',
  manufacturer: 'Sinclair',
  year: 1981,
  blurb: 'Sinclair’s million-selling breakthrough. ZX81 BASIC.',
  programRamBytes: 15360,
  memoryMap: zx81MemoryMap,
  memoryBlocks: zx81MemoryBlocks,

  // Sinclair BASIC POKEs decimal addresses, so the map opens in Int.
  addressNotation: 'dec',
  statementSeparator: null,
  fileExtensions: ['.txt', '.bas'],
  keywords: zx81Keywords,
  charset: zx81Charset,
  languageSupport: zx81LanguageSupport,
  completionSource: zx81CompletionSource,

  tokenize(source: string): TokenizeResult {
    const { bytes, errors } = tokenizeProgram(source);
    const image =
      !hasFatalErrors(errors) && bytes.length > 0
        ? buildPFile(bytes)
        : new Uint8Array(0);
    return { programBytes: bytes, image, errors, byteSize: bytes.length };
  },

  detokenize(image: Uint8Array): string {
    return detokenizeProgram(parsePFile(image).program);
  },

  detokenizeWithReport(image: Uint8Array): DetokenizeResult {
    const { program, vars, eLine, autoStart } = parsePFile(image);
    const { source, binaryLines } = detokenizeProgramWithInfo(program);
    const warnings = [
      ...structuralWarnings(program),
      ...rawEscapeWarning(source),
    ];
    if (binaryLines > 0) {
      const lines = binaryLines === 1 ? 'line' : 'lines';
      warnings.push(
        `${binaryLines} machine-code ${lines} (the hidden-code-in-REM trick) ` +
          'imported as opaque #BIN blocks; they run and export byte-exactly ' +
          'but are not editable as BASIC text.',
      );
    }
    // A .P saved mid-program (the SAVE-inside-the-program trick) carries the
    // program's variables too; only the program text survives import, so a
    // resumed auto-start may find its state gone.
    if (autoStart !== null && eLine - vars > 1) {
      warnings.push(
        `This .P auto-runs from line ${autoStart} and was saved with its ` +
          'variables; import keeps only the program text, so RUN starts at ' +
          'that line with fresh variables.',
      );
    }
    return {
      source,
      warnings,
      ...(autoStart !== null ? { autoStart } : {}),
    };
  },

  lint(source: string): TokenizeError[] {
    return [
      ...tokenizeProgram(source).errors,
      ...zx81VariableErrors(source, zx81Keywords),
    ];
  },

  romUrl: `${import.meta.env.BASE_URL}roms/zx81.rom`,

  debuggable: true,

  createEmulator(opts) {
    return new Zx81Machine(opts);
  },

  keyboardLayout: zx81KeyboardLayout,

  samples: zx81Samples,

  buildTargets: zx81BuildTargets,

  binaryImports: [{ extension: '.p', label: 'Import .P…' }],

  supportsBinaryLines: true,

  audio: {
    sampleRate: CASSETTE_SAMPLE_RATE,
    buildSamples: (source, programName, robust) =>
      buildCassetteSamples(source, programName, robust),
    loadInstructions:
      'On the ZX81 type LOAD "" - press J for LOAD, then shift-P twice for the quotes - and press NEW LINE before starting playback.',
    decodeSamples: (samples, sampleRate) => {
      const { name, data } = decodeCassette(samples, sampleRate);
      return {
        programName: name,
        source: detokenizeProgram(parsePFile(data).program),
      };
    },
    saveInstructions:
      'On the ZX81 type SAVE "NAME" - press S, then shift-P twice for the quotes - and press NEW LINE; the tape tone plays from the MIC socket. Feed it into this device, then start listening.',
  },

  aiProfile: zx81AiProfile,
};
