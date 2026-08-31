import {
  hasFatalErrors,
  type Dialect,
  type MachineEmulator,
  type TokenizeError,
  type TokenizeResult,
} from '../types';
// The CPC 6128 delegates to the CPC 464 dialect (the bbcmaster/zxspectrum128
// pattern): shared Locomotive BASIC language layer (with the 1.1 keyword
// variant), shared src/emulator/cpc/ machine (model '6128' adds the 128K
// RAM banking and the BASIC 1.1 ROM), shared docs page (docsReference 'cpc').
import { cpcCharset } from '../cpc464/charset';
import { tokenizeProgram } from '../cpc464/tokenizer';
import { importCpcImage } from '../cpc464/importCpc';
import { cpc464 } from '../cpc464';
import { cpc464MemoryBlocks } from '../cpc464/memoryBlocks';
import {
  buildCassetteSamples,
  decodeCassette,
  CASSETTE_SAMPLE_RATE,
} from '../cpc464/audio/cassette';
import { cpc6128KeyboardLayout } from './keyboardLayout';
import { cpc6128Samples } from './samples';
import { cpc6128MemoryMap } from './memoryMap';
import { cpc6128BuildTargets } from './targets';
import { cpc6128LanguageSupport, cpc6128CompletionSource } from './language';
import { cpc6128Keywords } from './keywords';
import { cpc6128AiProfile } from './aiProfile';
import { CpcMachine } from '../../emulator/cpc/cpcMachine';
import { DISPLAY_WIDTH, DISPLAY_HEIGHT } from '../../emulator/cpc/display';
import { CPC_ROM_SIZE } from '../../emulator/cpc/memory';

/**
 * Amstrad CPC 6128 (Locomotive BASIC 1.1), registered in
 * src/dialects/registry.ts alongside the 464 (whose share verb is `mode`; this
 * one's is `fill`, a BASIC 1.1-only keyword).
 *
 * A delegation dialect: it owns the 1.1 keyword selection, its memory map, its
 * AI profile, its keyboard theme and its metadata, and takes the rest - the
 * charset, tokenizer, samples, tape formats and the machine itself - from the
 * 464 behind the BASIC variant seam. The machine is `CpcMachine` model '6128':
 * bank-switched 128K and the BASIC 1.1 / OS 2.x ROM pair. AMSDOS, the µPD765
 * FDC and `.dsk` are deliberately deferred - it boots and runs BASIC without
 * them.
 */
export const cpc6128: Dialect = {
  id: 'cpc6128',
  name: 'CPC 6128',
  manufacturer: 'Amstrad',
  year: 1985,
  // Deliberately not "…and a disc drive", true of the machine though that is:
  // this build runs it tape-only, and the picker should not sell a feature the
  // IDE does not have.
  blurb: 'The CPC with 128K and more keywords. Locomotive BASIC 1.1.',
  basicDialect: 'Locomotive BASIC 1.1',
  docsReference: 'cpc',
  // Locomotive BASIC addresses memory in &-prefixed hex (POKE &A000, …).
  addressNotation: 'hex',
  statementSeparator: ':',
  memoryMap: cpc6128MemoryMap,
  // Same base 64K layout as the 464, so the block linter's figures carry over.
  memoryBlocks: cpc464MemoryBlocks,
  memoryWrites: { forms: ['poke'], hexPrefix: '&' },
  memoryReads: { forms: ['peek'], calls: ['CALL'] },
  // The machine introspects the current BASIC line, so the step debugger is on.
  debuggable: true,
  // Joystick 0 is matrix line 9, read through the AY like the keyboard; the CPC
  // port exposes two independent fire buttons.
  joystickModes: ['native'],
  joystickFireButtons: 2,
  // The same as the 464's: BASIC 1.1 moved its workspace pointers but not
  // HIMEM, and this machine runs with no AMSDOS below it. Revisit only when
  // AMSDOS ships, which would take it down to the disc machine's 42249.
  programRamBytes: cpc464.programRamBytes,
  // The combined 32K firmware+BASIC ROM (16K OS 2.x then 16K Locomotive
  // BASIC 1.1). No AMSDOS ROM: the 6128 runs tape-only here.
  romUrl: `${import.meta.env.BASE_URL}roms/cpc/cpc6128.rom`,
  romBytes: CPC_ROM_SIZE,
  // All three modes render into one 640×400 canvas (see emulator/cpc/display).
  displaySize: { width: DISPLAY_WIDTH, height: DISPLAY_HEIGHT },
  fileExtensions: ['.txt', '.bas'],
  keywords: cpc6128Keywords,
  charset: cpcCharset,
  languageSupport: cpc6128LanguageSupport,
  completionSource: cpc6128CompletionSource,

  tokenize(source: string): TokenizeResult {
    const { bytes, errors } = tokenizeProgram(source, 'basic11');
    // A non-empty image is the program plus its zero length-word end marker.
    const image =
      !hasFatalErrors(errors) && bytes.length > 2 ? bytes : new Uint8Array(0);
    return { programBytes: bytes, image, errors, byteSize: bytes.length };
  },

  detokenize(image: Uint8Array): string {
    return importCpcImage(image, 'basic11').source;
  },

  detokenizeWithReport(image: Uint8Array) {
    return importCpcImage(image, 'basic11');
  },

  lint(source: string): TokenizeError[] {
    return tokenizeProgram(source, 'basic11').errors;
  },

  // The firmware cassette jumpblock, at the same addresses the 464 uses: the
  // jumpblock is central RAM, so it does not move with the ROM.
  capturesDataFiles: true,

  createEmulator(opts): MachineEmulator {
    // ramKb is ignored: the 6128's 128K is not an option, it is the machine.
    return new CpcMachine({ rom: opts.rom, model: '6128', files: opts.files });
  },

  keyboardLayout: cpc6128KeyboardLayout,

  samples: cpc6128Samples,

  buildTargets: cpc6128BuildTargets,

  binaryImports: [{ extension: '.cdt', label: 'Import .CDT tape…' }],

  audio: {
    sampleRate: CASSETTE_SAMPLE_RATE,
    buildSamples: (source, programName, robust) =>
      buildCassetteSamples(source, programName, robust, 'basic11'),
    loadInstructions:
      'On the CPC type RUN" and press ENTER (or LOAD "" for a program you want to list first), then press any key to start the tape. Press-any-key and the "Loading" message appear as it reads. No |TAPE is needed: this 6128 runs without AMSDOS, so the cassette is already its filing system.',
    decodeSamples: (samples, sampleRate) => {
      const { name, program, warnings } = decodeCassette(samples, sampleRate);
      const report = importCpcImage(program, 'basic11');
      return {
        programName: name,
        source: report.source,
        warnings: [...warnings, ...report.warnings],
      };
    },
    saveInstructions:
      'On the CPC type SAVE "NAME" and press ENTER, then press REC and PLAY; the program plays out as a tape tone you can capture here.',
  },

  aiProfile: cpc6128AiProfile,
};
