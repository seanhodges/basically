// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import {
  hasFatalErrors,
  type Dialect,
  type MachineEmulator,
  type TokenizeError,
  type TokenizeResult,
} from '../types';
import { apple2AiProfile } from './aiProfile';
import { apple2Charset } from './charset';
import { apple2KeyboardLayout } from './keyboardLayout';
import { apple2Keywords, apple2Operators } from './keywords';
import {
  apple2CompletionSource,
  apple2Crunched,
  apple2LanguageSupport,
} from './language';
import { apple2MemoryBlocks } from './memoryBlocks';
import { apple2MemoryMap } from './memoryMap';
import { apple2Samples } from './samples';
import { apple2BuildTargets } from './targets';
import {
  COLD_START_BYTES_FREE,
  DISPLAY_HEIGHT,
  DISPLAY_WIDTH,
  FIRMWARE_BYTES,
} from './addresses';
import {
  apple2UnnumberedLineKey,
  declaredWorkspace,
  workspacePreamble,
} from './directLine';
import { buildBasicImage, parseBasicImage } from './basicImage';
import { detokenizeProgram, detokenizeProgramWithReport } from './detokenizer';
import { tokenizeProgram } from './tokenizer';
import {
  CASSETTE_SAMPLE_RATE,
  buildCassetteSamples,
} from './audio/cassetteEncoder';
import { decodeCassette } from './audio/cassetteDecoder';
import { apple2VariableErrors } from '../../editor/variableLint';
import { Apple2Machine } from '../../emulator/apple2/apple2Machine';
import { integerBasicSupport } from './machineSupport';

/**
 * The Apple II (Apple II Integer BASIC).
 *
 * The board is emulated in `src/emulator/apple2/` and shared with the Apple II
 * Plus, which is the same hardware with Applesoft in its ROM sockets. What is
 * this dialect's own is the language layer, the ROM image and the workspace
 * knowledge the machine is handed as a support object.
 */
export const apple2: Dialect = {
  id: 'apple2',
  name: 'Apple II',
  manufacturer: 'Apple',
  year: 1977,
  blurb: 'Colour graphics off the shelf. Runs Apple II Integer BASIC.',
  basicDialect: 'Apple II Integer BASIC',
  basicFamily: 'Integer BASIC',
  docsReference: 'integer-basic',

  // Cold-start LOMEM/HIMEM leave 47104 bytes, shared between program and
  // variables.
  programRamBytes: COLD_START_BYTES_FREE,

  fileExtensions: ['.bas', '.txt'],
  keywords: apple2Keywords,
  operators: apple2Operators,
  charset: apple2Charset,
  languageSupport: apple2LanguageSupport,
  completionSource: apple2CompletionSource,
  crunched: apple2Crunched,

  /**
   * Text to the bytes the interpreter stores, plus the length-prefixed record
   * `SAVE` writes around them. The program sits at the *top* of the workspace
   * and grows down, so its size is checked against the workspace the listing
   * asks for rather than against a base address.
   */
  tokenize(source: string): TokenizeResult {
    const { program, errors, workspace } = tokenizeProgram(source);
    const all = [...errors, ...apple2VariableErrors(source, apple2Keywords)];
    const capacity = workspace.himem - workspace.lomem;
    if (program.length > capacity) {
      all.push({
        line: 1,
        column: 0,
        message: workspace.declared
          ? `Program is ${program.length} bytes; the workspace this listing asks for holds ${capacity}, shared with its variables`
          : `Program is ${program.length} bytes; the stock workspace holds ${capacity}, shared with its variables`,
      });
    }
    const runnable = hasFatalErrors(all) ? new Uint8Array(0) : program;
    return {
      programBytes: runnable,
      image: buildBasicImage(runnable, workspace),
      errors: all,
      byteSize: program.length,
    };
  },

  /**
   * The commands this machine takes without a line number. Consulted by the
   * editor's numbering and the AI merge, so neither numbers one, reorders one,
   * or drops one - each would change what the line means.
   */
  unnumberedLineKey: apple2UnnumberedLineKey,

  detokenize(image: Uint8Array): string {
    return detokenizeProgram(parseBasicImage(image).program);
  },

  detokenizeWithReport(image: Uint8Array) {
    const { program, headed } = parseBasicImage(image);
    const result = detokenizeProgramWithReport(program);
    return headed
      ? result
      : {
          ...result,
          warnings: [
            'The two-byte length header does not match the file, so the whole file was read as program text',
            ...result.warnings,
          ],
        };
  },

  lint(source: string): TokenizeError[] {
    return [
      ...tokenizeProgram(source).errors,
      ...apple2VariableErrors(source, apple2Keywords),
    ];
  },

  romUrl: `${import.meta.env.BASE_URL}roms/apple2.rom`,
  romBytes: FIRMWARE_BYTES,

  // The hi-res raster; the text and lo-res pages are drawn into it.
  displaySize: { width: DISPLAY_WIDTH, height: DISPLAY_HEIGHT },

  // Integer BASIC has no hex literal: PEEK and POKE take signed decimal, which
  // is why an I/O address is written negative.
  addressNotation: 'hex',
  statementSeparator: ':',
  memoryReads: { forms: ['peek'] },

  // The interpreter keeps a pointer to the line it is executing, so the machine
  // can name a line and be stepped a line at a time.
  debuggable: true,

  // The game port's two paddles, each with its own button, which is what the
  // machine has instead of a joystick - and what `PDL(` reads.
  joystickModes: ['native'],
  joystickFireButtons: 2,

  memoryMap: apple2MemoryMap,
  memoryBlocks: apple2MemoryBlocks,

  /**
   * The board is shared with the Apple II Plus, which is the same hardware with
   * the other BASIC in its ROM sockets, so what makes this an Apple II rather
   * than a II Plus is the support object rather than the machine.
   */
  createEmulator(opts): MachineEmulator {
    return new Apple2Machine({ rom: opts.rom, basic: integerBasicSupport });
  },

  keyboardLayout: apple2KeyboardLayout,
  samples: apple2Samples,
  buildTargets: apple2BuildTargets,
  binaryImports: [{ extension: '.bin', label: 'Import cassette record…' }],

  /**
   * Cassette, which is the only route into an unexpanded Apple II and the one
   * Integer BASIC has commands for. `LOAD` and `SAVE` do the whole job, so the
   * instructions below are a command rather than the monitor incantation the
   * Apple I needs.
   */
  audio: {
    sampleRate: CASSETTE_SAMPLE_RATE,
    buildSamples: (source, _programName, robust) =>
      buildCassetteSamples(source, robust),

    /**
     * The workspace has to be typed *before* `LOAD`, because the tape does not
     * carry it: `LOAD` puts the program at the top of whatever workspace the
     * machine already has. A program that moved its own bounds therefore names
     * them here, from the same unnumbered preamble the listing carries.
     */
    loadInstructions: (source: string) => {
      const { lomem, himem } = declaredWorkspace(source);
      const preamble = workspacePreamble(lomem, himem);
      const bounds =
        preamble.length > 0
          ? `First type ${preamble.join(' and ')} - this program moved its own workspace and the tape does not carry the bounds. Then start `
          : 'Start ';
      return (
        `${bounds}playback, then type LOAD at the > prompt and press Return - ` +
        'the machine spends about four seconds letting the tape settle before ' +
        'it starts listening, so there is no need to wait for the leader tone ' +
        'to finish. It beeps once for the length record and once for the ' +
        'program; LIST or RUN it when the second beep comes. ERR before a beep ' +
        'means the checksum failed - rewind and try again with the volume a ' +
        'little lower.'
      );
    },

    decodeSamples: (samples, sampleRate) => {
      const { programName, data, warnings } = decodeCassette(
        samples,
        sampleRate,
      );
      const report = detokenizeProgramWithReport(parseBasicImage(data).program);
      return {
        programName,
        source: report.source,
        warnings: [...warnings, ...report.warnings],
      };
    },

    saveInstructions:
      'Start the recorder, then type SAVE at the > prompt and press Return. ' +
      'The machine writes ten seconds of leader, the two-byte length record, ' +
      'four more seconds of leader and then the program, and beeps when it is ' +
      'done. Feed that into this device, then start listening.',
  },

  aiProfile: apple2AiProfile,
};
