import type { Dialect, TokenizeError, TokenizeResult } from '../types';
import { zx80Charset } from './charset';
import { zx80Keywords } from './keywords';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram } from './detokenizer';
import { buildOFile, parseOFile } from './ofile';
import { decodeCassette } from './audio/cassetteDecoder';
import { zx80LanguageSupport, zx80CompletionSource } from './language';
import { zx80AiProfile } from './aiProfile';
import {
  zx80BuildTargets,
  buildCassetteSamples,
  CASSETTE_SAMPLE_RATE,
} from './targets';
import { Zx80Machine } from './emulator/zx80Machine';
import { zx80KeyboardLayout } from './keyboardLayout';
import { zx80Samples } from './samples';

export const zx80: Dialect = {
  id: 'zx80',
  name: 'ZX80',
  programRamBytes: 15360,
  fileExtensions: ['.bas'],
  keywords: zx80Keywords,
  charset: zx80Charset,
  languageSupport: zx80LanguageSupport,
  completionSource: zx80CompletionSource,

  tokenize(source: string): TokenizeResult {
    const { bytes, errors } = tokenizeProgram(source);
    const image =
      errors.length === 0 && bytes.length > 0
        ? buildOFile(bytes)
        : new Uint8Array(0);
    return { programBytes: bytes, image, errors, byteSize: bytes.length };
  },

  detokenize(image: Uint8Array): string {
    return detokenizeProgram(parseOFile(image).program);
  },

  lint(source: string): TokenizeError[] {
    return tokenizeProgram(source).errors;
  },

  romUrl: `${import.meta.env.BASE_URL}roms/zx80.rom`,

  debuggable: true,

  createEmulator(opts) {
    return new Zx80Machine(opts);
  },

  keyboardLayout: zx80KeyboardLayout,

  samples: zx80Samples,

  buildTargets: zx80BuildTargets,

  binaryImports: [{ extension: '.o', label: 'Import .O…' }],

  audio: {
    sampleRate: CASSETTE_SAMPLE_RATE,
    buildSamples: (source, programName, robust) =>
      buildCassetteSamples(source, programName, robust),
    loadInstructions:
      'On the ZX80 type LOAD — press W in keyword mode — and press NEW LINE before starting playback. When the program has loaded, type RUN.',
    decodeSamples: (samples, sampleRate) => {
      const { data } = decodeCassette(samples, sampleRate);
      // The ZX80 has no named files, so there is no name on the tape.
      return {
        programName: '',
        source: detokenizeProgram(parseOFile(data).program),
      };
    },
    saveInstructions:
      'On the ZX80 type SAVE — press E in keyword mode — and press NEW LINE; the tape tone plays from the MIC socket. Feed it into this device, then start listening.',
  },

  aiProfile: zx80AiProfile,
};
