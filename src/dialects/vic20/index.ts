import {
  hasFatalErrors,
  type Dialect,
  type MachineEmulator,
  type TokenizeResult,
} from '../types';
import { vic20Keywords } from './keywords';
import { vic20Charset } from './charset';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram, detokenizeProgramWithReport } from './detokenizer';
import { vic20LanguageSupport, vic20CompletionSource } from './language';
import { vic20BuildTargets } from './targets';
import { vic20KeyboardLayout } from './keyboardLayout';
import { vic20Samples } from './samples';
import { vic20AiProfile } from './aiProfile';
import { c64VariableErrors } from '../../editor/variableLint';

/**
 * Commodore VIC-20 dialect - scaffolding only, NOT registered in
 * src/dialects/registry.ts until Stage 3 of its plan.
 *
 * Staged plan: docs/contributing/dialect-plans/vic20.md. In brief: BASIC V2 is
 * token-identical to the C64's, so the language layer is re-exported through a
 * CbmVariant seam with a $1001 (unexpanded) load address; the emulator is an
 * in-tree 6502 bus (vendored src/emulator/6502/ core) with a from-scratch
 * frame-approximate VIC-I renderer under src/emulator/vic20/, reusing the
 * shared Commodore chips under src/emulator/commodore/.
 */
export const vic20: Dialect = {
  id: 'vic20',
  name: 'Commodore VIC-20',
  // Unexpanded VIC-20: "3583 BYTES FREE".
  programRamBytes: 3583,
  fileExtensions: ['.txt', '.bas'],
  keywords: vic20Keywords,
  charset: vic20Charset,
  languageSupport: vic20LanguageSupport,
  completionSource: vic20CompletionSource,

  tokenize(source: string): TokenizeResult {
    const { program, errors } = tokenizeProgram(source);
    // A non-empty image is the load address plus a program with at least one
    // line (more than the bare 0x0000 end link). Unexpanded VIC-20 programs
    // load at $1001.
    const image =
      !hasFatalErrors(errors) && program.length > 2
        ? Uint8Array.from([0x01, 0x10, ...program])
        : new Uint8Array(0);
    return { programBytes: program, image, errors, byteSize: program.length };
  },

  detokenize(image: Uint8Array): string {
    return detokenizeProgram(image);
  },

  detokenizeWithReport(image: Uint8Array) {
    return detokenizeProgramWithReport(image);
  },

  lint(source: string) {
    // Reuse the C64 Microsoft-BASIC variable checks; the VIC-20 keyword table
    // is the C64's, so no dialect-specific keyword set is needed here.
    return [
      ...tokenizeProgram(source).errors,
      ...c64VariableErrors(source, vic20Keywords),
    ];
  },

  // TODO (vic20 Stage 2): romUrl + displaySize once the machine and its ROM
  // set land under src/emulator/vic20/ and public/roms/vic20/.

  createEmulator(_opts): MachineEmulator {
    throw new Error('vic20: not implemented (Stage 2)');
  },

  keyboardLayout: vic20KeyboardLayout,

  samples: vic20Samples,

  buildTargets: vic20BuildTargets,

  // TODO (vic20 Stage 3): joystickModes: ['native'] once the machine wires
  // VIA1/VIA2 joystick lines.
  // TODO (vic20 Stage 4): binaryImports (.prg) + audio (cassette WAV at $1001).

  aiProfile: vic20AiProfile,
};
