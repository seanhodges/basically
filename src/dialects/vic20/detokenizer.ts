import type { DetokenizeResult } from '../types';
import {
  detokenizeProgram as detokenizeCbm,
  detokenizeProgramWithReport as detokenizeCbmWithReport,
  detokenizeD64WithReport as detokenizeCbmD64WithReport,
  detokenizeCbmTapeWithReport as detokenizeCbmTapeShared,
  type CbmDetokenizeVariant,
  type CbmTapeFile,
} from '../commodore64/detokenizer';
import { vic20WordByToken } from './keywords';

/**
 * The VIC-20's LIST/import variant: unexpanded .prg images load at $1001,
 * tokens decode through the plain BASIC V2 table (byte-identical to the C64's),
 * and a foreign load address is reported as most likely a C64 ($0801) or a
 * RAM-expanded VIC-20 ($0401 with +3K, $1201 with +8K/+16K) image.
 */
const VIC20_DETOKENIZE_VARIANT: CbmDetokenizeVariant = {
  loadAddress: 0x1001,
  wordByToken: vic20WordByToken,
  machineHint:
    'C64 ($0801), a RAM-expanded VIC-20 ($0401 with +3K, $1201 with +8K/+16K) or machine-code',
  machineName: 'VIC-20',
};

/** Convert a tokenized VIC-20 BASIC V2 program (or .prg) back into editable text. */
export function detokenizeProgram(image: Uint8Array): string {
  return detokenizeCbm(image, VIC20_DETOKENIZE_VARIANT);
}

/** Like {@link detokenizeProgram} but with import-fidelity warnings (.prg path). */
export function detokenizeProgramWithReport(
  image: Uint8Array,
): DetokenizeResult {
  return detokenizeCbmWithReport(image, VIC20_DETOKENIZE_VARIANT);
}

/**
 * Import a `.d64` disk image: the largest $1001 BASIC program becomes the
 * editable source, other BASIC programs are preserved as tape files, and
 * non-$1001 entries import as memory blocks (see the C64 implementation).
 */
export function detokenizeD64WithReport(image: Uint8Array): DetokenizeResult {
  return detokenizeCbmD64WithReport(image, VIC20_DETOKENIZE_VARIANT);
}

/**
 * Assemble the files recovered from a decoded cassette into an import result,
 * applying the same multi-part convention as the `.d64` import - what makes a
 * program exported to tape *with* memory blocks round-trip through audio.
 */
export function detokenizeCbmTapeWithReport(
  files: readonly CbmTapeFile[],
): DetokenizeResult & { programName: string } {
  return detokenizeCbmTapeShared(files, VIC20_DETOKENIZE_VARIANT);
}
