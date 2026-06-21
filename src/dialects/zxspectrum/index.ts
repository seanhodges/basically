import type { Dialect, TokenizeResult } from '../types';
import { spectrumCharset } from './charset';
import { spectrumKeywords } from './keywords';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram } from './detokenizer';
import { buildTap, parseTap } from './tapfile';
import { decodeCassette } from './audio/cassetteDecoder';
import { spectrumLanguageSupport, spectrumCompletionSource } from './language';
import { spectrumAiProfile } from './aiProfile';
import {
  spectrumBuildTargets,
  buildCassetteSamples,
  CASSETTE_SAMPLE_RATE,
} from './targets';
import { SpectrumMachine } from './emulator/spectrumMachine';
import { spectrumKeyboardLayout } from './keyboardLayout';
import { spectrumSamples } from './samples';

export const zxspectrum: Dialect = {
  id: 'zxspectrum',
  name: 'Spectrum',
  fileExtensions: ['.bas'],
  keywords: spectrumKeywords,
  charset: spectrumCharset,
  languageSupport: spectrumLanguageSupport,
  completionSource: spectrumCompletionSource,

  tokenize(source: string): TokenizeResult {
    const { bytes, errors } = tokenizeProgram(source);
    const image =
      errors.length === 0 && bytes.length > 0
        ? buildTap(bytes)
        : new Uint8Array(0);
    return { programBytes: bytes, image, errors, byteSize: bytes.length };
  },

  detokenize(image: Uint8Array): string {
    return detokenizeProgram(parseTap(image).program);
  },

  lint(source: string) {
    return tokenizeProgram(source).errors;
  },

  romUrl: `${import.meta.env.BASE_URL}roms/zxspectrum.rom`,

  debuggable: true,

  createEmulator(opts) {
    return new SpectrumMachine({ rom: opts.rom });
  },

  keyboardLayout: spectrumKeyboardLayout,

  samples: spectrumSamples,

  buildTargets: spectrumBuildTargets,

  binaryImports: [{ extension: '.tap', label: 'Import .TAP…' }],

  audio: {
    sampleRate: CASSETTE_SAMPLE_RATE,
    buildSamples: (source, programName, robust) =>
      buildCassetteSamples(source, programName, robust),
    loadInstructions:
      'On the Spectrum type LOAD "" — press J for LOAD, then symbol-shift-P twice for the quotes — and press ENTER before starting playback.',
    decodeSamples: (samples, sampleRate) => {
      const { name, image } = decodeCassette(samples, sampleRate);
      return {
        programName: name,
        source: detokenizeProgram(parseTap(image).program),
      };
    },
    saveInstructions:
      'On the Spectrum type SAVE "NAME" — press S, then symbol-shift-P twice for the quotes — and press ENTER; the tape tone plays from the MIC socket. Feed it into this device, then start listening.',
  },

  aiProfile: spectrumAiProfile,
};
