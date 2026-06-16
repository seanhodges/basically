import type { Dialect, TokenizeResult } from '../types';
// BBC BASIC IV on the Master is source- and (for shared keywords) token-
// compatible with the Model B's BASIC II, so the entire language layer —
// charset, keywords, tokenizer, completions, keyboard, targets — is shared
// with the bbcmicro dialect. Only the machine model and the AI profile differ.
// (If this sibling-import coupling grows, factor the shared pieces into a
// src/dialects/bbcShared/ module — see docs/dialect-roadmap.md.)
import { bbcCharset } from '../bbcmicro/charset';
import { bbcKeywords } from '../bbcmicro/keywords';
import { tokenizeProgram } from '../bbcmicro/tokenizer';
import { detokenizeProgram } from '../bbcmicro/detokenizer';
import {
  bbcBuildTargets,
  buildCassetteSamples,
  CASSETTE_SAMPLE_RATE,
} from '../bbcmicro/targets';
import { bbcLanguageSupport, bbcCompletionSource } from '../bbcmicro/language';
import { bbcKeyboardLayout } from '../bbcmicro/keyboardLayout';
import { bbcSamples } from '../bbcmicro/samples';
import { bbcMasterAiProfile } from './aiProfile';
import {
  BbcMachine,
  BBC_DISPLAY_WIDTH,
  BBC_DISPLAY_HEIGHT,
} from '../../emulator/bbc/bbcMachine';

/**
 * BBC Master dialect.
 *
 * Reuses the BBC Micro dialect's BASIC II tokenizer (BASIC IV keeps the same
 * token bytes for the shared keyword set) and delegates hardware emulation to
 * jsbeeb's 'Master' model — see src/emulator/bbc/bbcMachine.ts. Its MOS 3.20
 * ROM image ships under public/roms/master/.
 */
export const bbcmaster: Dialect = {
  id: 'bbcmaster',
  name: 'BBC Master',
  fileExtensions: ['.bas'],
  keywords: bbcKeywords,
  charset: bbcCharset,
  languageSupport: bbcLanguageSupport,
  completionSource: bbcCompletionSource,

  tokenize(source: string): TokenizeResult {
    const { bytes, errors } = tokenizeProgram(source);
    // A non-empty image is the program plus its 0x0D 0xFF end marker.
    const image =
      errors.length === 0 && bytes.length > 2 ? bytes : new Uint8Array(0);
    return { programBytes: bytes, image, errors, byteSize: bytes.length };
  },

  detokenize(image: Uint8Array): string {
    return detokenizeProgram(image);
  },

  lint(source: string) {
    return tokenizeProgram(source).errors;
  },

  // Prefetched for cache warming; the jsbeeb adapter loads the full Master ROM
  // set itself through the same base URL.
  romUrl: `${import.meta.env.BASE_URL}roms/master/mos3.20`,

  displaySize: { width: BBC_DISPLAY_WIDTH, height: BBC_DISPLAY_HEIGHT },

  // opts.rom/ramKb are ignored: jsbeeb manages its own ROMs and memory map.
  createEmulator() {
    return new BbcMachine('Master');
  },

  keyboardLayout: bbcKeyboardLayout,

  samples: bbcSamples,

  buildTargets: bbcBuildTargets,

  binaryImport: { extension: '.bbc', label: 'Import .BBC…' },

  audio: {
    sampleRate: CASSETTE_SAMPLE_RATE,
    buildSamples: (source, programName, robust) =>
      buildCassetteSamples(source, programName, robust),
    loadInstructions:
      'On the BBC Master type *TAPE then CHAIN "" and press RETURN before starting playback.',
  },

  aiProfile: bbcMasterAiProfile,
};
