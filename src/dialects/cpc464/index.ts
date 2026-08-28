import {
  hasFatalErrors,
  type Dialect,
  type MachineEmulator,
  type TokenizeError,
  type TokenizeResult,
} from '../types';
import { cpc464Keywords } from './keywords';
import { cpcCharset } from './charset';
import { cpcLanguageSupport, cpcCompletionSource } from './language';
import { tokenizeProgram } from './tokenizer';
import { importCpcImage } from './importCpc';
import { cpc464KeyboardLayout } from './keyboardLayout';
import { cpc464Samples } from './samples';
import { cpc464BuildTargets } from './targets';
import { cpc464AiProfile } from './aiProfile';
import { cpc464MemoryMap } from './memoryMap';
import { cpc464MemoryBlocks } from './memoryBlocks';
import {
  buildCassetteSamples,
  decodeCassette,
  CASSETTE_SAMPLE_RATE,
} from './audio/cassette';
import { CpcMachine } from '../../emulator/cpc/cpcMachine';
import { DISPLAY_WIDTH, DISPLAY_HEIGHT } from '../../emulator/cpc/display';
import { CPC_ROM_SIZE } from '../../emulator/cpc/memory';

/**
 * Amstrad CPC 464 (Locomotive BASIC 1.0).
 *
 * The language layer is native TypeScript: the tokenizer produces the genuine
 * Locomotive BASIC program-area byte layout - binary numeric constants and all
 * - and that tokenized program is the dialect's "image", loadable at &170. The
 * AMSDOS `.bas` container (basfile.ts) wraps/unwraps it for file import/export.
 * The machine lives in `src/emulator/cpc/`, shared with the CPC 6128 sibling
 * (../cpc6128/), which delegates to this dialect.
 */
export const cpc464: Dialect = {
  id: 'cpc464',
  name: 'CPC 464',
  manufacturer: 'Amstrad',
  year: 1984,
  blurb: 'Amstrad’s all-in-one with tape. Locomotive BASIC 1.0.',
  docsReference: 'cpc',
  // Locomotive BASIC addresses memory in &-prefixed hex (POKE &A000, …).
  addressNotation: 'hex',
  statementSeparator: ':',
  // The 64K memory map + where user memory blocks may live.
  memoryMap: cpc464MemoryMap,
  memoryBlocks: cpc464MemoryBlocks,
  // POKE addr,val with &-hex addresses drives the memory-map viewer's markers.
  memoryWrites: { forms: ['poke'], hexPrefix: '&' },
  memoryReads: { forms: ['peek'], calls: ['CALL'] },
  // The emulator introspects the current BASIC line (currentLine/debugStep), so
  // the toolbar offers the step debugger.
  debuggable: true,
  // The firmware cassette jumpblock, for the data-file entries: OPENIN/OPENOUT
  // and the character calls either side of them reach the IDE's file store.
  capturesDataFiles: true,
  // Joystick 0 is matrix line 9, read through the AY like the keyboard; the CPC
  // port exposes two independent fire buttons.
  joystickModes: ['native'],
  joystickFireButtons: 2,
  // PRINT FRE(0) on a clean 464 boot (BASIC 1.0, no AMSDOS): the program area
  // from &0170 up to HIMEM, which the firmware leaves at &AB7F with no disc
  // ROM below it. Fitting AMSDOS drops HIMEM to &A67B and this to the 42,249
  // a disc-equipped machine reports.
  programRamBytes: 43535,
  // The combined 32K firmware+BASIC ROM (16K OS then 16K Locomotive BASIC 1.0).
  romUrl: `${import.meta.env.BASE_URL}roms/cpc/cpc464.rom`,
  romBytes: CPC_ROM_SIZE,
  // All three modes render into one 640×400 canvas (see emulator/cpc/display).
  displaySize: { width: DISPLAY_WIDTH, height: DISPLAY_HEIGHT },
  fileExtensions: ['.txt', '.bas'],
  keywords: cpc464Keywords,
  charset: cpcCharset,
  languageSupport: cpcLanguageSupport,
  completionSource: cpcCompletionSource,

  tokenize(source: string): TokenizeResult {
    const { bytes, errors } = tokenizeProgram(source, 'basic10');
    // A non-empty image is the program plus its zero length-word end marker.
    const image =
      !hasFatalErrors(errors) && bytes.length > 2 ? bytes : new Uint8Array(0);
    return { programBytes: bytes, image, errors, byteSize: bytes.length };
  },

  detokenize(image: Uint8Array): string {
    return importCpcImage(image).source;
  },

  detokenizeWithReport(image: Uint8Array) {
    return importCpcImage(image);
  },

  lint(source: string): TokenizeError[] {
    return tokenizeProgram(source, 'basic10').errors;
  },

  createEmulator(opts): MachineEmulator {
    return new CpcMachine({ rom: opts.rom, model: '464', files: opts.files });
  },

  keyboardLayout: cpc464KeyboardLayout,

  samples: cpc464Samples,

  buildTargets: cpc464BuildTargets,

  binaryImports: [{ extension: '.cdt', label: 'Import .CDT tape…' }],

  audio: {
    sampleRate: CASSETTE_SAMPLE_RATE,
    buildSamples: (source, programName, robust) =>
      buildCassetteSamples(source, programName, robust),
    loadInstructions:
      'On the CPC type RUN" and press ENTER (or LOAD "" for a program you want to list first), then press any key to start the tape. Press-any-key and the "Loading" message appear as it reads.',
    decodeSamples: (samples, sampleRate) => {
      const { name, program, warnings } = decodeCassette(samples, sampleRate);
      const report = importCpcImage(program);
      return {
        programName: name,
        source: report.source,
        warnings: [...warnings, ...report.warnings],
      };
    },
    saveInstructions:
      'On the CPC type SAVE "NAME" and press ENTER, then press REC and PLAY; the program plays out as a tape tone you can capture here.',
  },

  aiProfile: cpc464AiProfile,
};
