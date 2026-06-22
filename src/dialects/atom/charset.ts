import { type CharsetMapping } from '../types';

/**
 * Acorn Atom (MC6847 VDG) character mapping. STUB — Stage 1 implements the real
 * text ↔ Atom-code mapping. The throwing bodies are placeholders; the dialect is
 * not registered yet, so nothing calls them.
 */
export const atomCharset: CharsetMapping = {
  toMachine(_text: string): Uint8Array {
    throw new Error('atom: charset.toMachine not implemented');
  },
  toUnicode(_codes: ArrayLike<number>): string {
    throw new Error('atom: charset.toUnicode not implemented');
  },
  glyph(_code: number): string {
    throw new Error('atom: charset.glyph not implemented');
  },
};
