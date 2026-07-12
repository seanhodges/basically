import type { Dialect, MachineEmulator, TokenizeResult } from '../types';
import { vic20Keywords } from './keywords';
import { vic20Charset } from './charset';
import { vic20LanguageSupport, vic20CompletionSource } from './language';
import { vic20BuildTargets } from './targets';
import { vic20KeyboardLayout } from './keyboardLayout';
import { vic20Samples } from './samples';
import { vic20AiProfile } from './aiProfile';

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

  tokenize(_source: string): TokenizeResult {
    throw new Error('vic20: not implemented (Stage 1)');
  },

  detokenize(_image: Uint8Array): string {
    throw new Error('vic20: not implemented (Stage 1)');
  },

  lint(_source: string) {
    throw new Error('vic20: not implemented (Stage 1)');
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
