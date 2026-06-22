import type { TokenizeError } from '../types';

export interface TokenizedProgram {
  /**
   * The tokenized program as it sits in memory from 0x42E8 (TXTTAB): for each
   * line a 2-byte absolute link to the next line, the 2-byte little-endian line
   * number, the tokenized body and a 0x00 terminator, ending with a 0x0000 null
   * link. Mirrors the C64 layout (see commodore64/tokenizer.ts) but based at
   * 0x42E8 with the Level II token table.
   */
  program: Uint8Array;
  errors: TokenizeError[];
}

/** Stub — filled in by Stage 1 of docs/dialect-plans/trs80.md. */
export function tokenizeProgram(_source: string): TokenizedProgram {
  throw new Error('trs80: tokenizer not implemented');
}
