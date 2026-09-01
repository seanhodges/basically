import type { TokenizeError } from '../types';

/** Editor text -> the tokenized program bytes SAM BASIC stores. */
export function tokenizeProgram(_source: string): {
  bytes: Uint8Array;
  errors: TokenizeError[];
} {
  throw new Error('samcoupe: not implemented');
}
