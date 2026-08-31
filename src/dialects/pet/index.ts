import { hasFatalErrors, type Dialect, type TokenizeResult } from '../types';
import {
  PetMachine,
  PET_DISPLAY_WIDTH,
  PET_DISPLAY_HEIGHT,
} from '../../emulator/pet/petMachine';
import { petKeywords } from './keywords';
import { c64Operators } from '../commodore64/keywords';
import { petCharset } from './charset';
import { petMemoryMap } from './memoryMap';
import { petMemoryBlocks } from './memoryBlocks';
import { tokenizeProgram } from './tokenizer';
import {
  detokenizeProgram,
  detokenizeProgramWithReport,
  detokenizeD64WithReport,
} from './detokenizer';
import { isD64 } from '../commodore64/d64';
import {
  petLanguageSupport,
  petCompletionSource,
  petCrunched,
} from './language';
import { petBuildTargets } from './targets';
import { petKeyboardLayout } from './keyboardLayout';
import { petSamples } from './samples';
import { petAiProfile } from './aiProfile';
import {
  CASSETTE_SAMPLE_RATE,
  buildCassetteSamples,
  decodeSamples,
} from './audio/cassette';
import { c64VariableErrors } from '../../editor/variableLint';

/**
 * Commodore PET dialect.
 *
 * PET BASIC 4.0 shares the C64 language layer via a CbmVariant seam ($0401
 * load address + disk tokens $CC-$DA); the emulator is an in-tree 6502 bus
 * (vendored src/emulator/6502/ core) with shared Commodore chips under
 * src/emulator/commodore/ and the machine under src/emulator/pet/.
 */
export const pet: Dialect = {
  id: 'pet',
  name: 'PET',
  manufacturer: 'Commodore',
  year: 1977,
  blurb: 'Commodore’s all-in-one original. Runs Commodore BASIC 4.0.',
  basicDialect: 'Commodore BASIC 4.0',
  // BASIC 4.0 shares the merged 'commodore' reference page with the C64/VIC-20
  // (V2); its fifteen extra disk commands are tagged there as BASIC 4.0.
  docsReference: 'commodore',
  // BASIC 4.0 "31743 BYTES FREE" on a 32KB machine.
  programRamBytes: 31743,
  memoryMap: petMemoryMap,
  memoryBlocks: petMemoryBlocks,

  // Commodore BASIC POKEs decimal addresses, so the map opens in Int.
  addressNotation: 'dec',
  statementSeparator: ':',
  // POKE writes, plus `LOAD "",dev,1` absolute machine-code loads for the map.
  memoryWrites: { forms: ['poke', 'load-device'] },
  memoryReads: { forms: ['peek'], calls: ['SYS'] },
  fileExtensions: ['.txt', '.bas'],
  keywords: petKeywords,
  operators: c64Operators,
  charset: petCharset,
  languageSupport: petLanguageSupport,
  completionSource: petCompletionSource,
  crunched: petCrunched,

  tokenize(source: string): TokenizeResult {
    const { program, errors } = tokenizeProgram(source);
    // A non-empty image is the load address plus a program with at least one
    // line (more than the bare 0x0000 end link). PET programs load at $0401.
    const image =
      !hasFatalErrors(errors) && program.length > 2
        ? Uint8Array.from([0x01, 0x04, ...program])
        : new Uint8Array(0);
    return { programBytes: program, image, errors, byteSize: program.length };
  },

  detokenize(image: Uint8Array): string {
    return detokenizeProgram(image);
  },

  detokenizeWithReport(image: Uint8Array) {
    if (isD64(image)) return detokenizeD64WithReport(image);
    return detokenizeProgramWithReport(image);
  },

  lint(source: string) {
    // Reuse the C64 Microsoft-BASIC variable checks, passing the PET keyword
    // table so the disk commands (DOPEN, SCRATCH…) aren't mistaken for variables.
    return [
      ...tokenizeProgram(source).errors,
      ...c64VariableErrors(source, petKeywords),
    ];
  },

  // Prefetched by the app for cache warming; the PET adapter loads the full ROM
  // set (BASIC 4.0 + editor + KERNAL + chargen) itself from public/roms/pet/.
  romUrl: `${import.meta.env.BASE_URL}roms/pet/kernal-4.901465-22.bin`,

  displaySize: { width: PET_DISPLAY_WIDTH, height: PET_DISPLAY_HEIGHT },

  debuggable: true,

  // The KERNAL channel-I/O routines, for devices 8-11: a virtual disk unit.
  capturesDataFiles: true,

  // opts.rom/ramKb are ignored: the PET machine loads its own six ROM images and
  // models a fixed 32 KB machine. opts.files is the VFS store the PET's KERNAL
  // disk traps use for OPEN/PRINT#/INPUT#/GET#/CLOSE data-file I/O.
  createEmulator(opts) {
    return new PetMachine({ files: opts.files });
  },

  keyboardLayout: petKeyboardLayout,

  samples: petSamples,

  buildTargets: petBuildTargets,

  binaryImports: [
    { extension: '.prg', label: 'Import .PRG…' },
    { extension: '.d64', label: 'Import .D64…' },
  ],

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
      'On the PET type LOAD and press RETURN, then press PLAY on the datasette before starting playback. When it finds the program type RUN.',
    decodeSamples: (samples, sampleRate) => decodeSamples(samples, sampleRate),
    saveInstructions:
      'On the PET type SAVE "NAME" and press RETURN, then press RECORD and PLAY on the datasette; the tape tone plays from the cassette port. Feed it into this device, then start listening.',
  },

  aiProfile: petAiProfile,
};
