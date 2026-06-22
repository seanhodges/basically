import type { TokenizeError } from '../types';

/**
 * Atom BASIC tokenizer. STUB — Stage 1 implements text → Atom program image
 * (line records of `u16 line number` + ASCII body + 0x0D from #2900) and
 * collects {@link TokenizeError}[] instead of throwing. The throwing body here
 * is a placeholder; the dialect is unregistered, so nothing calls it.
 */
export function tokenizeProgram(_source: string): {
  bytes: Uint8Array;
  errors: TokenizeError[];
} {
  throw new Error('atom: tokenizer not implemented');
}
