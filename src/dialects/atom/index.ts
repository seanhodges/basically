import { hasFatalErrors, type Dialect, type TokenizeResult } from '../types';
import { atomCharset } from './charset';
import { atomKeywords, atomOperators } from './keywords';
import { atomVariableErrors } from '../../editor/variableLint';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram, detokenizeProgramWithReport } from './detokenizer';
import { atomBuildTargets } from './targets';
import {
  CASSETTE_SAMPLE_RATE,
  buildCassetteSamples,
} from './audio/cassetteEncoder';
import { decodeCassette } from './audio/cassetteDecoder';
import { atomLanguageSupport, atomCompletionSource } from './language';
import { atomAiProfile } from './aiProfile';
import { atomKeyboardLayout } from './keyboardLayout';
import { atomSamples } from './samples';
import { atomMemoryMap } from './memoryMap';
import { atomMemoryBlocks } from './memoryBlocks';
import { TEXT_START, TEXT_TOP } from './addresses';
import { AtomMachine } from '../../emulator/atom/atomMachine';

/**
 * Acorn Atom dialect.
 *
 * Atom BASIC is a genuinely new dialect (its own tokenizer/charset/keywords):
 * a program line is stored as near-plain ASCII from #2900, and that image is
 * both what the emulator pokes in and the round-trippable program format.
 * Hardware emulation is delegated to the bundled jsbeeb core via the Atom
 * adapter (`src/emulator/atom/atomMachine.ts`, an 'Atom-Tape-FP' model).
 */
export const atom: Dialect = {
  id: 'atom',
  name: 'Atom',
  manufacturer: 'Acorn',
  year: 1980,
  blurb: 'Acorn’s forerunner to the BBC Micro. Runs Atom BASIC.',
  // A fully expanded 12K Atom holds 5K of internal RAM at #2800; the
  // floating-point ROM takes the first page, leaving #2900-#3BFF for BASIC.
  programRamBytes: TEXT_TOP - TEXT_START,
  fileExtensions: ['.txt', '.bas'],
  keywords: atomKeywords,
  operators: atomOperators,
  charset: atomCharset,
  languageSupport: atomLanguageSupport,
  completionSource: atomCompletionSource,

  tokenize(source: string): TokenizeResult {
    const { bytes, errors } = tokenizeProgram(source);
    // Statement-shape lint is non-fatal (the ROM stores such lines verbatim
    // and errors only at RUN), so it keeps its squiggle without emptying the
    // runnable image; only framing errors do that.
    const image = hasFatalErrors(errors) ? new Uint8Array(0) : bytes;
    return { programBytes: bytes, image, errors, byteSize: bytes.length };
  },

  detokenize(image: Uint8Array): string {
    return detokenizeProgram(image);
  },

  detokenizeWithReport(image: Uint8Array) {
    return detokenizeProgramWithReport(image);
  },

  lint(source: string) {
    return [
      ...tokenizeProgram(source).errors,
      ...atomVariableErrors(source, atomKeywords),
    ];
  },

  // The jsbeeb adapter loads the full Atom ROM set (Kernel + FloatingPoint +
  // Basic) itself; this URL is only the app's cache-warming prefetch.
  romUrl: `${import.meta.env.BASE_URL}roms/atom/Atom_Basic.rom`,

  // displaySize omitted: the Atom's 256x192 (CLEAR 4) matches the app default.

  memoryMap: atomMemoryMap,

  memoryBlocks: atomMemoryBlocks,

  // Atom BASIC addresses memory in hex (`?#DE`), so the map opens in Hex.
  addressNotation: 'hex',
  statementSeparator: ';',

  // Atom BASIC has no POKE: memory writes use `?`/`!` indirection (`?#DE=0`),
  // with `#` hex addresses, and `;` separates statements.
  memoryWrites: {
    forms: ['indirection', 'star-load'],
    hexPrefix: '#',
    statementSep: ';',
  },
  // Reads use the same sigils in an expression (`C=?#DE`); LINK is the Atom's
  // one way into machine code.
  memoryReads: { forms: ['indirection'], calls: ['LINK'] },

  // FIN/FOUT/BGET/BPUT/SHUT, trapped at the redirected OS file vectors.
  capturesDataFiles: true,

  // opts.rom/ramKb are ignored: jsbeeb manages its own ROMs and memory map.
  // opts.files is the VFS sink for Atom BASIC's FIN/FOUT/BGET/BPUT/SHUT.
  createEmulator(opts) {
    return new AtomMachine({ files: opts.files });
  },

  keyboardLayout: atomKeyboardLayout,
  samples: atomSamples,
  buildTargets: atomBuildTargets,

  binaryImports: [
    { extension: '.atm', label: 'Import .ATM…' },
    { extension: '.dsk', label: 'Import .DSK disk…' },
  ],

  audio: {
    sampleRate: CASSETTE_SAMPLE_RATE,
    buildSamples: (source, programName, robust) =>
      buildCassetteSamples(source, programName, robust),
    loadInstructions:
      'On the Atom type LOAD"" (or *LOAD"") and press RETURN before starting playback; when the > prompt returns type RUN.',
    decodeSamples: (samples, sampleRate) => {
      const { name, data } = decodeCassette(samples, sampleRate);
      return { programName: name, source: detokenizeProgram(data) };
    },
    saveInstructions:
      'On the Atom type SAVE"NAME" and press RETURN; the tape tone plays from the cassette port. Feed it into this device, then start listening.',
  },

  aiProfile: atomAiProfile,
};
