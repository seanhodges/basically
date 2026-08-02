import { hasFatalErrors, type Dialect, type TokenizeResult } from '../types';
import { bbcCharset } from './charset';
import { bbcKeywords } from './keywords';
import { tokenizeProgram } from './tokenizer';
import {
  detokenizeProgram,
  detokenizeWithReport,
  detokenizeBbcDiscWithReport,
} from './detokenizer';
import { isBbcDisc } from '../../emulator/bbc/bbcDisc';
import {
  bbcBuildTargets,
  buildCassetteSamples,
  CASSETTE_SAMPLE_RATE,
} from './targets';
import { decodeCassette } from './audio/cassetteDecoder';
import { bbcLanguageSupport, bbcCompletionSource } from './language';
import { bbcAiProfile } from './aiProfile';
import { bbcKeyboardLayout } from './keyboardLayout';
import { BBC_DISPLAY_CONTROLS } from './teletextChips';
import { bbcSamples } from './samples';
import { bbcMicroMemoryMap } from './memoryMap';
import { bbcMicroMemoryBlocks } from './memoryBlocks';
import {
  BbcMachine,
  BBC_DISPLAY_WIDTH,
  BBC_DISPLAY_HEIGHT,
} from '../../emulator/bbc/bbcMachine';

/**
 * BBC Micro Model B dialect.
 *
 * BBC BASIC is tokenized natively in TypeScript (see tokenizer.ts) into the
 * genuine BASIC II byte layout - the same bytes the BASIC ROM keeps from PAGE
 * and that SAVE writes to disc. That tokenized program is the dialect's
 * "image": the emulator pokes it straight in at PAGE, and it is also the
 * import/export file format (.bbc). Hardware emulation is delegated to jsbeeb
 * (see src/emulator/bbc/bbcMachine.ts).
 */
export const bbcmicro: Dialect = {
  id: 'bbcmicro',
  name: 'BBC Micro',
  manufacturer: 'Acorn',
  year: 1981,
  blurb: 'The BBC’s computer literacy machine. Runs BBC BASIC II.',
  docsReference: 'bbc',
  programRamBytes: 28672,
  fileExtensions: ['.txt', '.bas'],
  keywords: bbcKeywords,
  charset: bbcCharset,
  languageSupport: bbcLanguageSupport,
  completionSource: bbcCompletionSource,

  tokenize(source: string): TokenizeResult {
    const { bytes, errors } = tokenizeProgram(source);
    // A non-empty image is the program plus its 0x0D 0xFF end marker.
    const image =
      !hasFatalErrors(errors) && bytes.length > 2 ? bytes : new Uint8Array(0);
    return { programBytes: bytes, image, errors, byteSize: bytes.length };
  },

  detokenize(image: Uint8Array): string {
    return detokenizeProgram(image);
  },

  detokenizeWithReport(image: Uint8Array) {
    if (isBbcDisc(image)) return detokenizeBbcDiscWithReport(image);
    return detokenizeWithReport(image);
  },

  lint(source: string) {
    return tokenizeProgram(source).errors;
  },

  // Prefetched by the app for cache warming; the jsbeeb adapter loads the
  // full ROM set (OS + BASIC + DFS) itself through the same base URL.
  romUrl: `${import.meta.env.BASE_URL}roms/BASIC.ROM`,

  displaySize: { width: BBC_DISPLAY_WIDTH, height: BBC_DISPLAY_HEIGHT },

  memoryMap: bbcMicroMemoryMap,
  memoryBlocks: bbcMicroMemoryBlocks,

  // BBC BASIC addresses memory in hex (`?&2000`), so the map opens in Hex.
  addressNotation: 'hex',
  statementSeparator: ':',

  // BBC BASIC has no POKE: memory writes use `?`/`!` indirection (`?&2000=5`),
  // with `&` hex addresses.
  memoryWrites: { forms: ['indirection', 'star-load'], hexPrefix: '&' },

  debuggable: true,

  joystickModes: ['native'],
  // The analogue port has two independent fire lines (PB4/PB5).
  joystickFireButtons: 2,

  // opts.rom/ramKb are ignored: jsbeeb manages its own ROMs and memory map.
  // opts.files is forwarded to service program-driven data file I/O.
  createEmulator(opts) {
    return new BbcMachine('B', { files: opts.files });
  },

  keyboardLayout: bbcKeyboardLayout,

  displayControls: BBC_DISPLAY_CONTROLS,

  samples: bbcSamples,

  buildTargets: bbcBuildTargets,

  binaryImports: [
    { extension: '.bbc', label: 'Import .BBC…' },
    { extension: '.ssd', label: 'Import .SSD…' },
  ],

  audio: {
    sampleRate: CASSETTE_SAMPLE_RATE,
    buildSamples: (source, programName, robust) =>
      buildCassetteSamples(source, programName, robust),
    loadInstructions:
      'On the BBC type *TAPE then CHAIN "" and press RETURN before starting playback.',
    decodeSamples: (samples, sampleRate) => {
      const { name, data } = decodeCassette(samples, sampleRate);
      return { programName: name, source: detokenizeProgram(data) };
    },
    saveInstructions:
      'On the BBC type *TAPE then SAVE "NAME" and press RETURN; the tape tone plays from the cassette port. Feed it into this device, then start listening.',
  },

  aiProfile: bbcAiProfile,
};
