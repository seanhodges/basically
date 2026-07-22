import type { LocoBasicVariant } from './keywords';

/**
 * Tokenized Locomotive BASIC program bytes → editable source. Must reformat
 * the binary numeric encodings losslessly (hex back to `&…`, floats to
 * Locomotive's display form). Stage 1 fills this in.
 */
export function detokenizeProgram(
  _program: Uint8Array,
  _variant: LocoBasicVariant = 'basic10',
): string {
  throw new Error('cpc464: not implemented');
}
