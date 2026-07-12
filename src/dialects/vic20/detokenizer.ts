import type { DetokenizeResult } from '../types';

/**
 * TODO (vic20 Stage 1): thin wrappers over the commodore64 detokenizer via
 * the CbmVariant seam ($1001 load address, c64WordByToken, a machine hint
 * naming the RAM-expansion load addresses $0401/+3K and $1201/+8K).
 * See docs/contributing/dialect-plans/vic20.md.
 */
export function detokenizeProgram(_image: Uint8Array): string {
  throw new Error('vic20: not implemented (Stage 1)');
}

export function detokenizeProgramWithReport(
  _image: Uint8Array,
): DetokenizeResult {
  throw new Error('vic20: not implemented (Stage 1)');
}
