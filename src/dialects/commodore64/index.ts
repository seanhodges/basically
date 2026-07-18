import { hasFatalErrors, type Dialect, type TokenizeResult } from '../types';
import { c64Charset } from './charset';
import { c64Keywords } from './keywords';
import { c64MemoryMap } from './memoryMap';
import { c64MemoryBlocks } from './memoryBlocks';
import { tokenizeProgram } from './tokenizer';
import {
  detokenizeProgram,
  detokenizeProgramWithReport,
  detokenizeT64WithReport,
} from './detokenizer';
import { isT64 } from './t64';
import { c64BuildTargets } from './targets';
import { c64LanguageSupport, c64CompletionSource } from './language';
import { c64VariableErrors } from '../../editor/variableLint';
import { c64AiProfile } from './aiProfile';
import { c64KeyboardLayout } from './keyboardLayout';
import { c64Samples } from './samples';
import {
  CASSETTE_SAMPLE_RATE,
  buildCassetteSamples,
} from './audio/cassetteEncoder';
import { decodeCassette } from './audio/cassetteDecoder';
import {
  C64Machine,
  C64_DISPLAY_WIDTH,
  C64_DISPLAY_HEIGHT,
} from '../../emulator/c64/c64Machine';

/**
 * Commodore 64 dialect.
 *
 * Commodore BASIC is tokenized natively in TypeScript (see tokenizer.ts)
 * into the genuine in-memory layout the BASIC ROM keeps from $0801 - the same
 * bytes SAVE writes. That tokenized program, with the 2-byte $0801 load address
 * prepended, is the dialect's "image": the emulator injects it straight into
 * RAM, and it is also the .prg import/export format. Hardware emulation is
 * delegated to the vendored viciious core (see src/emulator/c64/c64Machine.ts).
 */
export const commodore64: Dialect = {
  id: 'commodore64',
  name: 'C64',
  programRamBytes: 38911,
  memoryMap: c64MemoryMap,
  memoryBlocks: c64MemoryBlocks,

  // Commodore BASIC POKEs decimal addresses (`POKE 53280,0`), so the map opens
  // in Int.
  addressNotation: 'dec',
  // POKE writes, plus `LOAD "",dev,1` absolute machine-code loads for the map.
  memoryWrites: { forms: ['poke', 'load-device'] },
  fileExtensions: ['.txt', '.bas'],
  keywords: c64Keywords,
  charset: c64Charset,
  languageSupport: c64LanguageSupport,
  completionSource: c64CompletionSource,

  tokenize(source: string): TokenizeResult {
    const { program, errors } = tokenizeProgram(source);
    // A non-empty image is the load address plus a program with at least one
    // line (more than the bare 0x0000 end link).
    const image =
      !hasFatalErrors(errors) && program.length > 2
        ? Uint8Array.from([0x01, 0x08, ...program])
        : new Uint8Array(0);
    return { programBytes: program, image, errors, byteSize: program.length };
  },

  detokenize(image: Uint8Array): string {
    return detokenizeProgram(image);
  },

  detokenizeWithReport(image: Uint8Array) {
    if (isT64(image)) return detokenizeT64WithReport(image);
    return detokenizeProgramWithReport(image);
  },

  lint(source: string) {
    return [
      ...tokenizeProgram(source).errors,
      ...c64VariableErrors(source, c64Keywords),
    ];
  },

  // Prefetched by the app for cache warming; the C64 adapter loads the full ROM
  // set (BASIC + KERNAL + CHARGEN) itself from public/roms/c64/.
  romUrl: `${import.meta.env.BASE_URL}roms/c64/kernal.bin`,

  displaySize: { width: C64_DISPLAY_WIDTH, height: C64_DISPLAY_HEIGHT },

  debuggable: true,

  joystickModes: ['native'],

  // opts.rom/ramKb are ignored: viciious manages its own ROMs and 64K memory.
  // opts.files is the VFS store the C64's KERNAL disk traps (devices 8–11) use
  // for OPEN/PRINT#/INPUT#/GET#/CLOSE data-file I/O.
  createEmulator(opts) {
    return new C64Machine({ files: opts.files });
  },

  keyboardLayout: c64KeyboardLayout,

  samples: c64Samples,

  buildTargets: c64BuildTargets,

  binaryImports: [
    { extension: '.prg', label: 'Import .PRG…' },
    { extension: '.t64', label: 'Import .T64…' },
  ],

  audio: {
    sampleRate: CASSETTE_SAMPLE_RATE,
    buildSamples: (source, programName, robust) =>
      buildCassetteSamples(source, programName, robust),
    loadInstructions:
      'On the C64 type LOAD and press RETURN, then press PLAY on the datasette before starting playback. When it finds the program type RUN.',
    decodeSamples: (samples, sampleRate) => {
      const { name, data } = decodeCassette(samples, sampleRate);
      return { programName: name, source: detokenizeProgram(data) };
    },
    saveInstructions:
      'On the C64 type SAVE "NAME" and press RETURN, then press RECORD and PLAY on the datasette; the tape tone plays from the cassette port. Feed it into this device, then start listening.',
  },

  aiProfile: c64AiProfile,
};
