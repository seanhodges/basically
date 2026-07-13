import type { BuildTarget } from '../types';
import { fatalErrors } from '../types';
import { tokenizeProgram } from './tokenizer';

/**
 * Build the loadable .prg image: the 2-byte load address ($0401, the PET base)
 * followed by the tokenized program. This is the same image the emulator injects
 * and the import/export file format — identical in shape to the C64's, only the
 * address differs.
 *
 * The cassette .wav target and the `BuildTarget[]` list land in Stage 4; for now
 * this exposes the image builder the tokenizer path and tests need.
 */
export function buildPrg(source: string): Uint8Array {
  const { program, errors } = tokenizeProgram(source);
  const fatal = fatalErrors(errors);
  if (fatal.length > 0) {
    throw new Error(
      `Program has ${fatal.length} error(s) - fix them before building`,
    );
  }
  // A bare 0x0000 end link means the program is empty.
  if (program.length <= 2) {
    throw new Error('Program is empty');
  }
  return Uint8Array.from([0x01, 0x04, ...program]);
}

// TODO (pet Stage 4): .prg + cassette .wav build targets.
export const petBuildTargets: BuildTarget[] = [];
