import {
  hasFatalErrors,
  type Dialect,
  type DetokenizeResult,
  type TokenizeError,
  type TokenizeResult,
} from '../types';
import { rawEscapeWarning } from '../zxspectrum/importReport';
// The 128K / +2 / +3 shares the entire 48K Spectrum language and tape layer -
// only memory paging, the dual ROM, the AY-3-8912 sound chip and the two extra
// BASIC tokens (SPECTRUM, PLAY) differ. Identical pieces are re-exported from
// ../zxspectrum (see charset.ts / tapfile.ts / keyboardLayout.ts) the way
// bbcmaster reuses bbcmicro. See docs/dialect-plans/zxspectrum128.md.
import { spectrum128Charset } from './charset';
import { spectrum128Keywords } from './keywords';
import { spectrumVariableErrors } from '../../editor/variableLint';
import { buildTap, parseTap, parseTapWithReport } from './tapfile';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram } from './detokenizer';
import { decodeCassette } from '../zxspectrum/audio/cassetteDecoder';
import {
  spectrum128LanguageSupport,
  spectrum128CompletionSource,
} from './language';
import { spectrum128AiProfile } from './aiProfile';
import {
  spectrum128BuildTargets,
  buildCassetteSamples,
  CASSETTE_SAMPLE_RATE,
} from './targets';
import { Spectrum128Machine } from './emulator/spectrum128Machine';
import { spectrum128KeyboardLayout } from './keyboardLayout';
import { spectrum128Samples } from './samples';

/**
 * ZX Spectrum 128K / +2 / +3 (128 BASIC), registered in src/dialects/registry.ts.
 * It shares the 48K Spectrum language and tape layer, adding only the two extra
 * tokens (SPECTRUM, PLAY), memory paging, the dual ROM and the AY-3-8912 sound
 * chip. The 32K 128K ROM lives under public/roms/zxspectrum128.rom. See
 * docs/dialect-plans/zxspectrum128.md.
 */
export const zxspectrum128: Dialect = {
  id: 'zxspectrum128',
  name: 'Spectrum 128K',
  docsReference: 'zxspectrum',
  programRamBytes: 41472,
  fileExtensions: ['.bas'],
  keywords: spectrum128Keywords,
  charset: spectrum128Charset,
  languageSupport: spectrum128LanguageSupport,
  completionSource: spectrum128CompletionSource,

  tokenize(source: string): TokenizeResult {
    const { bytes, errors } = tokenizeProgram(source);
    const image =
      !hasFatalErrors(errors) && bytes.length > 0
        ? buildTap(bytes)
        : new Uint8Array(0);
    return { programBytes: bytes, image, errors, byteSize: bytes.length };
  },

  detokenize(image: Uint8Array): string {
    return detokenizeProgram(parseTap(image).program);
  },

  detokenizeWithReport(image: Uint8Array): DetokenizeResult {
    const { parsed, warnings } = parseTapWithReport(image);
    const source = detokenizeProgram(parsed.program);
    return { source, warnings: [...warnings, ...rawEscapeWarning(source)] };
  },

  lint(source: string): TokenizeError[] {
    return [
      ...tokenizeProgram(source).errors,
      ...spectrumVariableErrors(source, spectrum128Keywords),
    ];
  },

  romUrl: `${import.meta.env.BASE_URL}roms/zxspectrum128.rom`,

  debuggable: true,

  joystickModes: ['native', 'kempston'],

  // opts.ramKb is ignored: the 128K always provides its eight 16K banks itself.
  createEmulator(opts) {
    return new Spectrum128Machine({ rom: opts.rom, files: opts.files });
  },

  keyboardLayout: spectrum128KeyboardLayout,

  samples: spectrum128Samples,

  buildTargets: spectrum128BuildTargets,

  binaryImports: [{ extension: '.tap', label: 'Import .TAP…' }],

  audio: {
    sampleRate: CASSETTE_SAMPLE_RATE,
    buildSamples: (source, programName, robust) =>
      buildCassetteSamples(source, programName, robust),
    loadInstructions:
      'On the 128K, choose "128 BASIC" (or "Tape Loader") from the menu, then type LOAD "" and press ENTER before starting playback.',
    decodeSamples: (samples, sampleRate) => {
      const { name, image } = decodeCassette(samples, sampleRate);
      return {
        programName: name,
        source: detokenizeProgram(parseTap(image).program),
      };
    },
    saveInstructions:
      'On the 128K in 128 BASIC type SAVE "NAME" and press ENTER; the tape tone plays from the EAR/MIC socket. Feed it into this device, then start listening.',
  },

  aiProfile: spectrum128AiProfile,
};
