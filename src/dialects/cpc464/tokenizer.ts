import type { TokenizeError } from '../types';
import type { LocoBasicVariant } from './keywords';

/**
 * Locomotive BASIC tokenizer: line records
 * `[u16 LE total length][u16 LE line number][tokens…][0x00]`, program
 * terminated by a zero length word, numeric constants stored in binary
 * (&0E–&18 small ints, &19 byte, &1A int, &1B binary, &1C hex, &1E line
 * number, &1F 5-byte float). Collects TokenizeError[] (1-based line,
 * 0-based column) instead of throwing. Stage 1 fills this in.
 */
export function tokenizeProgram(
  _source: string,
  _variant: LocoBasicVariant = 'basic10',
): { bytes: Uint8Array; errors: TokenizeError[] } {
  throw new Error('cpc464: not implemented');
}
