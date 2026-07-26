import {
  hasFatalErrors,
  type Dialect,
  type DetokenizeResult,
  type TokenizeError,
  type TokenizeResult,
} from '../types';
import { rawEscapeWarning } from '../zxspectrum/importReport';
import { codeFilesToBlocks } from '../importBlocks';
// The 128K / +2 / +3 shares the entire 48K Spectrum language and tape layer -
// only memory paging, the dual ROM, the AY-3-8912 sound chip and the two extra
// BASIC tokens (SPECTRUM, PLAY) differ. Identical pieces are re-exported from
// ../zxspectrum (see charset.ts / tapfile.ts / keyboardLayout.ts) the way
// bbcmaster reuses bbcmicro. See docs/dialect-plans/zxspectrum128.md.
import { spectrum128Charset } from './charset';
import { spectrum128Keywords } from './keywords';
import { spectrumVariableErrors } from '../../editor/variableLint';
import { buildTap, parseTap, parseTapAllFiles } from './tapfile';
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
import { spectrum128MemoryMap } from './memoryMap';
// The block linter's figures (valid RAM, reserved screen/sysvars, program
// area) are shared as-is with the 48K dialect: the 128K's low 0x4000-0x5CCB
// window mirrors the 48K layout exactly (see ./memoryMap.ts), and the default
// block address 0x8000 falls in RAM bank 2, present on both machines.
import { spectrumMemoryBlocks } from '../zxspectrum/memoryBlocks';

/**
 * ZX Spectrum 128K / +2 / +3 (128 BASIC), registered in src/dialects/registry.ts.
 * It shares the 48K Spectrum language and tape layer, adding only the two extra
 * tokens (SPECTRUM, PLAY), memory paging, the dual ROM and the AY-3-8912 sound
 * chip. The 32K 128K ROM lives under public/roms/zxspectrum128.rom. See
 * docs/dialect-plans/zxspectrum128.md.
 */
export const zxspectrum128: Dialect = {
  id: 'zxspectrum128',
  name: 'Spectrum 128',
  manufacturer: 'Sinclair',
  year: 1985,
  blurb: 'The Spectrum with AY sound. Runs 128 Sinclair BASIC.',
  docsReference: 'zxspectrum',
  programRamBytes: 41472,
  memoryMap: spectrum128MemoryMap,
  memoryBlocks: spectrumMemoryBlocks,

  // Sinclair BASIC POKEs decimal addresses, so the map opens in Int.
  addressNotation: 'dec',
  // POKE writes, plus `LOAD "" CODE [addr]` binary-code loads for the map.
  memoryWrites: { forms: ['poke', 'load-code'] },
  fileExtensions: ['.txt', '.bas'],
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
    const { program, code, tapeFiles, warnings } = parseTapAllFiles(image);
    const source = detokenizeProgram(program.program);
    const blocks = codeFilesToBlocks(code);
    return {
      source,
      warnings: [...warnings, ...rawEscapeWarning(source)],
      ...(blocks.length > 0 ? { blocks } : {}),
      ...(tapeFiles.length > 0 ? { tapeFiles } : {}),
      ...(program.autoStart !== null ? { autoStart: program.autoStart } : {}),
    };
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
      // decodeCassette reframes every recovered block into a full multi-file
      // `.TAP`, so route it through the same importer the `.TAP` file button
      // uses - a recorded multi-file tape (CODE blocks, extra programs) comes
      // back with its blocks, preserved tape files and auto-start line, matching
      // this dialect's own `detokenizeWithReport`.
      const { name, image } = decodeCassette(samples, sampleRate);
      const { program, code, tapeFiles, warnings } = parseTapAllFiles(image);
      const source = detokenizeProgram(program.program);
      const blocks = codeFilesToBlocks(code);
      return {
        programName: name,
        source,
        warnings: [...warnings, ...rawEscapeWarning(source)],
        ...(blocks.length > 0 ? { blocks } : {}),
        ...(tapeFiles.length > 0 ? { tapeFiles } : {}),
        ...(program.autoStart !== null ? { autoStart: program.autoStart } : {}),
      };
    },
    saveInstructions:
      'On the 128K in 128 BASIC type SAVE "NAME" and press ENTER; the tape tone plays from the EAR/MIC socket. Feed it into this device, then start listening.',
  },

  aiProfile: spectrum128AiProfile,
};
