import type { CharsetMapping } from '../types';

/**
 * SAM Coupé character codes <-> editor text. Each block graphic takes its exact
 * Unicode character where one exists; an escape is the fallback only where
 * injectivity or Unicode leaves no choice.
 */
export const samcoupeCharset: CharsetMapping = {
  toMachine(_text: string): Uint8Array {
    throw new Error('samcoupe: not implemented');
  },
  toUnicode(_codes: ArrayLike<number>): string {
    throw new Error('samcoupe: not implemented');
  },
  glyph(_code: number): string {
    throw new Error('samcoupe: not implemented');
  },
};
