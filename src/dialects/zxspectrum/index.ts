import {
  hasFatalErrors,
  type Dialect,
  type DetokenizeResult,
  type TokenizeResult,
} from '../types';
import { spectrumCharset } from './charset';
import { spectrumKeywords, spectrumOperators } from './keywords';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram } from './detokenizer';
import { buildTap, headerName, parseTap, parseTapAllFiles } from './tapfile';
import { rawEscapeWarning } from './importReport';
import { codeFilesToBlocks } from '../importBlocks';
import { decodeCassette } from './audio/cassetteDecoder';
import { spectrumLanguageSupport, spectrumCompletionSource } from './language';
import { spectrumVariableErrors } from '../../editor/variableLint';
import { spectrumAiProfile } from './aiProfile';
import {
  spectrumBuildTargets,
  buildCassetteSamples,
  CASSETTE_SAMPLE_RATE,
} from './targets';
import { SpectrumMachine } from './emulator/spectrumMachine';
import { ROM_BYTES } from './emulator/memory';
import { spectrumKeyboardLayout } from './keyboardLayout';
import { spectrumSamples } from './samples';
import { spectrumMemoryMap } from './memoryMap';
import { spectrumMemoryBlocks } from './memoryBlocks';
import { unwrapSpectrumStoredFile } from './storedFile';

export const zxspectrum: Dialect = {
  id: 'zxspectrum',
  name: 'Spectrum',
  manufacturer: 'Sinclair',
  year: 1982,
  blurb: 'Britain’s best-selling computer. 48K Sinclair BASIC.',
  basicDialect: '48K Sinclair BASIC',
  programRamBytes: 41472,
  memoryMap: spectrumMemoryMap,
  memoryBlocks: spectrumMemoryBlocks,
  unwrapStoredFile: unwrapSpectrumStoredFile,

  // Sinclair BASIC POKEs decimal addresses, so the map opens in Int.
  addressNotation: 'dec',
  statementSeparator: ':',
  // POKE writes, plus `LOAD "" CODE [addr]` binary-code loads for the map.
  memoryWrites: { forms: ['poke', 'load-code'] },
  // USR calls machine code at the address given. Its string form (`USR "a"`,
  // a UDG's address) is resolved to that address before the scan, so what is
  // left here is always a real call.
  memoryReads: { forms: ['peek'], calls: ['USR'] },
  fileExtensions: ['.txt', '.bas'],
  keywords: spectrumKeywords,
  operators: spectrumOperators,
  charset: spectrumCharset,
  languageSupport: spectrumLanguageSupport,
  completionSource: spectrumCompletionSource,

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

  lint(source: string) {
    return [
      ...tokenizeProgram(source).errors,
      ...spectrumVariableErrors(source, spectrumKeywords),
    ];
  },

  romUrl: `${import.meta.env.BASE_URL}roms/zxspectrum.rom`,
  romBytes: ROM_BYTES,

  debuggable: true,

  joystickModes: ['native', 'kempston'],

  // Array DATA and CODE saves are captured at the ROM's SA-BYTES/LD-BYTES tape
  // traps; a type-0 program SAVE passes through to real tape untouched.
  capturesDataFiles: true,

  createEmulator(opts) {
    return new SpectrumMachine({ rom: opts.rom, files: opts.files });
  },

  keyboardLayout: spectrumKeyboardLayout,

  samples: spectrumSamples,

  buildTargets: spectrumBuildTargets,

  binaryImports: [{ extension: '.tap', label: 'Import .TAP…' }],

  audio: {
    sampleRate: CASSETTE_SAMPLE_RATE,
    buildSamples: (source, programName, robust, opts) =>
      buildCassetteSamples(
        source,
        programName,
        robust,
        opts?.blocks,
        opts?.loader,
      ),
    loadInstructions:
      'On the Spectrum type LOAD "" - press J for LOAD, then symbol-shift-P twice for the quotes - and press ENTER before starting playback.',
    decodeSamples: (samples, sampleRate) => {
      // decodeCassette reframes every recovered block into a full multi-file
      // `.TAP` image, so a tape carrying CODE blocks (and an auto-loader ahead
      // of the program) round-trips through the same importer the `.TAP` file
      // button uses - recovering the blocks, preserved tape files and auto-start
      // line, not just the program.
      const { name, image } = decodeCassette(samples, sampleRate);
      const { program, code, tapeFiles, warnings } = parseTapAllFiles(image);
      const source = detokenizeProgram(program.program);
      const blocks = codeFilesToBlocks(code);
      const programName = headerName(program.header.subarray(1, 11)) || name;
      return {
        programName,
        source,
        warnings: [...warnings, ...rawEscapeWarning(source)],
        ...(blocks.length > 0 ? { blocks } : {}),
        ...(tapeFiles.length > 0 ? { tapeFiles } : {}),
        ...(program.autoStart !== null ? { autoStart: program.autoStart } : {}),
      };
    },
    saveInstructions:
      'On the Spectrum type SAVE "NAME" - press S, then symbol-shift-P twice for the quotes - and press ENTER; the tape tone plays from the MIC socket. Feed it into this device, then start listening.',
  },

  aiProfile: spectrumAiProfile,
};
