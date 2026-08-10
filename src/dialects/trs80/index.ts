import type { Dialect, TokenizeError, TokenizeResult } from '../types';
import { hasFatalErrors } from '../types';
import { trs80Charset } from './charset';
import { trs80Keywords, trs80Operators } from './keywords';
import { trs80VariableErrors } from '../../editor/variableLint';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram, detokenizeProgramWithReport } from './detokenizer';
import {
  trs80LanguageSupport,
  trs80CompletionSource,
  trs80Crunched,
} from './language';
import { trs80AiProfile } from './aiProfile';
import { trs80BuildTargets } from './targets';
import { Trs80InterpreterMachine } from './interpreter/machine';
import { trs80KeyboardLayout } from './keyboardLayout';
import { trs80MemoryBlocks } from './memoryBlocks';
import { trs80Samples } from './samples';
import {
  CASSETTE_SAMPLE_RATE,
  buildCassetteSamples,
} from './audio/cassetteEncoder';
import { decodeCassette } from './audio/cassetteDecoder';

/**
 * TRS-80 (Level II BASIC). The default backend is the ROM-free
 * high-level interpreter under `interpreter/`, so the dialect needs no `romUrl`.
 * The Z80 + ROM machine (`emulator/trs80Machine.ts`) is kept in the tree as an
 * alternate "accuracy mode" for anyone who supplies their own legally-obtained
 * Level II ROM.
 */
export const trs80: Dialect = {
  id: 'trs80',
  name: 'TRS-80',
  manufacturer: 'Tandy',
  year: 1977,
  blurb: 'Tandy’s Radio Shack original. Runs Level II BASIC.',
  programRamBytes: 15572,
  memoryBlocks: trs80MemoryBlocks,
  fileExtensions: ['.txt', '.bas'],
  keywords: trs80Keywords,
  operators: trs80Operators,
  charset: trs80Charset,
  languageSupport: trs80LanguageSupport,
  completionSource: trs80CompletionSource,
  crunched: trs80Crunched,

  tokenize(source: string): TokenizeResult {
    const { program, errors } = tokenizeProgram(source);
    const image = hasFatalErrors(errors) ? new Uint8Array(0) : program;
    return {
      programBytes: program,
      image,
      errors,
      byteSize: program.length,
    };
  },

  detokenize(image: Uint8Array): string {
    return detokenizeProgram(image);
  },

  detokenizeWithReport(image: Uint8Array) {
    return detokenizeProgramWithReport(image);
  },

  lint(source: string): TokenizeError[] {
    return [
      ...tokenizeProgram(source).errors,
      ...trs80VariableErrors(source, trs80Keywords),
    ];
  },

  // No romUrl: the interpreter backend needs no ROM image.

  // Wider than the 256×192 default: a 64×16 character display at an 8×12 cell.
  displaySize: { width: 512, height: 192 },

  // TRS-80 BASIC PEEKs/POKEs decimal addresses. No memoryMap yet, so the viewer
  // never surfaces this, but declare it so the default is correct if one is added.
  addressNotation: 'dec',
  statementSeparator: ':',

  // PEEK reads a byte; USR is absent, because its argument is data passed to
  // the routine whose address was set up by POKE or DEF USR.
  memoryReads: { forms: ['peek'] },

  // The interpreter introspects its own state, so the step debugger and the
  // variable watcher are available.
  debuggable: true,

  createEmulator(opts) {
    return new Trs80InterpreterMachine(opts.files);
  },

  keyboardLayout: trs80KeyboardLayout,

  samples: trs80Samples,

  buildTargets: trs80BuildTargets,

  binaryImports: [
    { extension: '.cas', label: 'Import .CAS…' },
    { extension: '.dsk', label: 'Import .DSK disk…' },
  ],

  audio: {
    sampleRate: CASSETTE_SAMPLE_RATE,
    buildSamples: (source, programName, robust) =>
      buildCassetteSamples(source, programName, robust),
    loadInstructions:
      'On the TRS-80 type CLOAD and press ENTER - the blinking * means it is searching the tape - then start playback. When READY returns, type RUN.',
    decodeSamples: (samples, sampleRate) => {
      const { programName, data } = decodeCassette(samples, sampleRate);
      return { programName, source: detokenizeProgram(data) };
    },
    saveInstructions:
      'On the TRS-80 type CSAVE "F" and press ENTER, then press RECORD on the recorder; the program plays out as a 500-baud tape tone you can capture here.',
  },

  aiProfile: trs80AiProfile,
};
