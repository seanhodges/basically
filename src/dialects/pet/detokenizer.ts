import type { DetokenizeResult } from '../types';
import {
  detokenizeProgram as detokenizeCbm,
  detokenizeProgramWithReport as detokenizeCbmWithReport,
  detokenizeD64WithReport as detokenizeCbmD64WithReport,
  detokenizeCbmTapeWithReport as detokenizeCbmTapeShared,
  type CbmDetokenizeVariant,
  type CbmTapeFile,
} from '../commodore64/detokenizer';
import { petWordByToken } from './keywords';

/**
 * The PET's LIST/import variant: .prg images load at $0401, tokens decode
 * through the BASIC 4.0 table (so $CC–$DA list as DOPEN…DIRECTORY), and a
 * foreign load address is reported as most likely a C64/VIC-20/C128 image.
 */
const PET_DETOKENIZE_VARIANT: CbmDetokenizeVariant = {
  loadAddress: 0x0401,
  wordByToken: petWordByToken,
  machineHint: 'C64/VIC-20/C128 or machine-code',
  machineName: 'PET',
};

/** Convert a tokenized PET BASIC 4.0 program (or .prg) back into editable text. */
export function detokenizeProgram(image: Uint8Array): string {
  return detokenizeCbm(image, PET_DETOKENIZE_VARIANT);
}

/** Like {@link detokenizeProgram} but with import-fidelity warnings (.prg path). */
export function detokenizeProgramWithReport(
  image: Uint8Array,
): DetokenizeResult {
  return detokenizeCbmWithReport(image, PET_DETOKENIZE_VARIANT);
}

/**
 * Import a `.d64` disk image: the largest $0401 BASIC program becomes the
 * editable source, other BASIC programs are preserved as tape files, and
 * non-$0401 entries import as memory blocks (see the C64 implementation).
 */
export function detokenizeD64WithReport(image: Uint8Array): DetokenizeResult {
  return detokenizeCbmD64WithReport(image, PET_DETOKENIZE_VARIANT);
}

/**
 * Assemble the files recovered from a decoded cassette into an import result,
 * applying the same multi-part convention as the `.d64` import - what makes a
 * program exported to tape *with* memory blocks round-trip through audio.
 */
export function detokenizeCbmTapeWithReport(
  files: readonly CbmTapeFile[],
): DetokenizeResult & { programName: string } {
  return detokenizeCbmTapeShared(files, PET_DETOKENIZE_VARIANT);
}
