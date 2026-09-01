import {
  hasFatalErrors,
  type Dialect,
  type DetokenizeResult,
  type TokenizeResult,
} from '../types';
import { samcoupeCharset } from './charset';
import { samcoupeKeywords, samcoupeOperators } from './keywords';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram, detokenizeWithWarnings } from './detokenizer';
import { buildSamFile, parseSamFile, parseSamFileWithReport } from './samfile';
import { samcoupeCompletionSource, samcoupeLanguageSupport } from './language';
import { samcoupeVariableErrors } from '../../editor/variableLint';
import { samcoupeAiProfile } from './aiProfile';
import {
  buildCassetteSamples,
  CASSETTE_SAMPLE_RATE,
  samcoupeBuildTargets,
} from './targets';
import { decodeSamCassette } from './audio/cassetteDecoder';
import { samcoupeKeyboardLayout } from './keyboardLayout';
import { samcoupeSamples } from './samples';
import { samcoupeMemoryMap } from './memoryMap';
import { samcoupeMemoryBlocks } from './memoryBlocks';
import { SamMachine } from './emulator/samMachine';
import { ROM_BYTES } from './emulator/memory';
import { DISPLAY_HEIGHT, DISPLAY_WIDTH } from './emulator/display';

/**
 * The SAM Coupé. Not registered yet, so nothing in the app can reach it; the
 * members below are filled in as each part of the machine is built.
 *
 * The picker identity - the blurb especially - is written for its reader when
 * the dialect joins the registry.
 */
export const samcoupe: Dialect = {
  id: 'samcoupe',
  name: 'Coupé',
  manufacturer: 'MGT',
  year: 1989,
  basicDialect: 'SAM BASIC',
  blurb: 'A 6MHz Z80 with four screen modes. Runs SAM BASIC.',
  programRamBytes: 0,
  memoryMap: samcoupeMemoryMap,
  memoryBlocks: samcoupeMemoryBlocks,
  displaySize: { width: DISPLAY_WIDTH, height: DISPLAY_HEIGHT },

  statementSeparator: ':',
  // POKE and DPOKE for the writes, and `LOAD "name" CODE` for a block that
  // arrives from tape; `&` opens a hex literal in any of their addresses.
  memoryWrites: { forms: ['poke', 'load-code'], hexPrefix: '&' },
  // Both call forms take the address itself, unlike the Microsoft `USR(x)`.
  memoryReads: { forms: ['peek'], calls: ['CALL', 'USR'] },
  // SAM BASIC's own documentation writes PEEK and POKE addresses in decimal,
  // and so do the samples; the viewer's toggle reaches the `&` spelling.
  addressNotation: 'dec',
  debuggable: true,
  // The SAM's 9-pin port is read as keys 6-9 and 0 on the matrix - the machine's
  // only joystick, and the one SAM BASIC's own key tests see.
  joystickModes: ['native'],
  fileExtensions: ['.txt', '.bas'],
  keywords: samcoupeKeywords,
  operators: samcoupeOperators,
  charset: samcoupeCharset,
  languageSupport: samcoupeLanguageSupport,
  completionSource: samcoupeCompletionSource,

  tokenize(source: string, opts): TokenizeResult {
    const { bytes, errors } = tokenizeProgram(source);
    const image =
      !hasFatalErrors(errors) && bytes.length > 0
        ? buildSamFile(bytes, opts?.programName ?? 'program')
        : new Uint8Array(0);
    return { programBytes: bytes, image, errors, byteSize: bytes.length };
  },

  detokenize(image: Uint8Array): string {
    return detokenizeProgram(parseSamFile(image).program);
  },

  detokenizeWithReport(image: Uint8Array): DetokenizeResult {
    const { file, warnings } = parseSamFileWithReport(image);
    const text = detokenizeWithWarnings(
      file ? file.program : new Uint8Array(0),
    );
    return {
      source: text.source,
      warnings: [...warnings, ...text.warnings],
      autoStart: file?.autoStart ?? null,
    };
  },

  lint(source: string) {
    return [
      ...tokenizeProgram(source).errors,
      ...samcoupeVariableErrors(source, samcoupeKeywords),
    ];
  },

  romUrl: `${import.meta.env.BASE_URL}roms/samcoupe.rom`,
  romBytes: ROM_BYTES,

  createEmulator(opts) {
    return new SamMachine({ rom: opts.rom });
  },

  keyboardLayout: samcoupeKeyboardLayout,
  samples: samcoupeSamples,
  buildTargets: samcoupeBuildTargets,

  binaryImports: [{ extension: '.tap', label: 'Import .TAP…' }],

  audio: {
    sampleRate: CASSETTE_SAMPLE_RATE,
    buildSamples: (source, programName, robust) =>
      buildCassetteSamples(source, programName, robust),
    loadInstructions:
      'On the SAM Coupé type LOAD "" - or press F7, which types it for you - and press ENTER before starting playback.',
    decodeSamples: (samples, sampleRate) => {
      // The decoder re-frames every recovered block into a container image, so
      // a recording goes back through the same reader the .TAP button uses and
      // arrives with the header's warnings and auto-start line, not just the
      // program text.
      const { name, image } = decodeSamCassette(samples, sampleRate);
      const { file, warnings } = parseSamFileWithReport(image);
      const text = detokenizeWithWarnings(
        file ? file.program : new Uint8Array(0),
      );
      return {
        programName: file?.name || name,
        source: text.source,
        warnings: [...warnings, ...text.warnings],
        ...(file?.autoStart != null ? { autoStart: file.autoStart } : {}),
      };
    },
    saveInstructions:
      'On the SAM Coupé type SAVE "NAME" and press ENTER; it asks you to start the tape and press a key, and the tone then plays from the tape socket. Feed that into this device, then start listening.',
  },

  aiProfile: samcoupeAiProfile,
};
