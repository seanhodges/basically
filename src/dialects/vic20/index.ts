import { hasFatalErrors, type Dialect, type TokenizeResult } from '../types';
import {
  Vic20Machine,
  VIC20_DISPLAY_WIDTH,
  VIC20_DISPLAY_HEIGHT,
} from '../../emulator/vic20/vic20Machine';
import { vic20Keywords } from './keywords';
import { vic20Charset } from './charset';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram, detokenizeProgramWithReport } from './detokenizer';
import { vic20LanguageSupport, vic20CompletionSource } from './language';
import { vic20BuildTargets } from './targets';
import { vic20KeyboardLayout } from './keyboardLayout';
import { vic20Samples } from './samples';
import { vic20AiProfile } from './aiProfile';
import {
  CASSETTE_SAMPLE_RATE,
  buildCassetteSamples,
  decodeSamples,
} from './audio/cassette';
import { c64VariableErrors } from '../../editor/variableLint';

/**
 * Commodore VIC-20 dialect, registered in src/dialects/registry.ts.
 *
 * BASIC V2 is token-identical to the C64's, so the language layer is
 * re-exported through a CbmVariant seam with a $1001 (unexpanded) load
 * address; the emulator is an in-tree 6502 bus (vendored src/emulator/6502/
 * core) with a from-scratch frame-approximate VIC-I renderer under
 * src/emulator/vic20/, reusing the shared Commodore chips under
 * src/emulator/commodore/.
 */
export const vic20: Dialect = {
  id: 'vic20',
  name: 'Commodore VIC-20',
  // VIC-20 BASIC V2 is token-identical to the C64's, so the keyword reference
  // (what the docs button deep-links) is the same page - reuse it rather than
  // duplicate it, as bbcmaster reuses 'bbc' and zxspectrum128 reuses 'zxspectrum'.
  docsReference: 'commodore64',
  // Unexpanded VIC-20: "3583 BYTES FREE".
  programRamBytes: 3583,
  fileExtensions: ['.txt', '.bas'],
  keywords: vic20Keywords,
  charset: vic20Charset,
  languageSupport: vic20LanguageSupport,
  completionSource: vic20CompletionSource,

  tokenize(source: string): TokenizeResult {
    const { program, errors } = tokenizeProgram(source);
    // A non-empty image is the load address plus a program with at least one
    // line (more than the bare 0x0000 end link). Unexpanded VIC-20 programs
    // load at $1001.
    const image =
      !hasFatalErrors(errors) && program.length > 2
        ? Uint8Array.from([0x01, 0x10, ...program])
        : new Uint8Array(0);
    return { programBytes: program, image, errors, byteSize: program.length };
  },

  detokenize(image: Uint8Array): string {
    return detokenizeProgram(image);
  },

  detokenizeWithReport(image: Uint8Array) {
    return detokenizeProgramWithReport(image);
  },

  lint(source: string) {
    // Reuse the C64 Microsoft-BASIC variable checks; the VIC-20 keyword table
    // is the C64's, so no dialect-specific keyword set is needed here.
    return [
      ...tokenizeProgram(source).errors,
      ...c64VariableErrors(source, vic20Keywords),
    ];
  },

  // Prefetched by the app for cache warming; the VIC-20 machine loads the full
  // ROM set (BASIC + KERNAL + CHARGEN) itself from public/roms/vic20/.
  romUrl: `${import.meta.env.BASE_URL}roms/vic20/kernal.bin`,

  displaySize: { width: VIC20_DISPLAY_WIDTH, height: VIC20_DISPLAY_HEIGHT },

  debuggable: true,

  // The unexpanded VIC-20 reads a single digital joystick (up/down/left/fire on
  // VIA1 PA2–PA5, right on VIA2 PB7); the machine folds fire2 into fire1.
  joystickModes: ['native'],

  // opts.rom/ramKb are ignored: the machine manages its own ROM set and the
  // fixed unexpanded 64K map.
  createEmulator(opts) {
    return new Vic20Machine({ files: opts.files });
  },

  keyboardLayout: vic20KeyboardLayout,

  samples: vic20Samples,

  buildTargets: vic20BuildTargets,

  binaryImports: [{ extension: '.prg', label: 'Import .PRG…' }],

  audio: {
    sampleRate: CASSETTE_SAMPLE_RATE,
    buildSamples: (source, programName, robust) =>
      buildCassetteSamples(source, programName, robust),
    loadInstructions:
      'On the VIC-20 type LOAD and press RETURN, then press PLAY on the datasette before starting playback. When it finds the program type RUN.',
    decodeSamples: (samples, sampleRate) => decodeSamples(samples, sampleRate),
    saveInstructions:
      'On the VIC-20 type SAVE "NAME" and press RETURN, then press RECORD and PLAY on the datasette; the tape tone plays from the cassette port. Feed it into this device, then start listening.',
  },

  aiProfile: vic20AiProfile,
};
