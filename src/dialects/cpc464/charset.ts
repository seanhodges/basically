import type { CharsetMapping } from '../types';

/**
 * The Amstrad CPC 256-glyph character set (32–126 near-ASCII, 127–255 block
 * graphics / symbols / accented forms), shared by the CPC 464 and CPC 6128.
 * Stage 1 fills this in; escape-table scaffolding comes in Stage 6 via
 * `npm run gen:escapes`. See docs/contributing/dialect-plans/cpc464.md.
 */
export const cpcCharset: CharsetMapping = {
  toMachine(_text: string): Uint8Array {
    throw new Error('cpc464: not implemented');
  },
  toUnicode(_codes: ArrayLike<number>): string {
    throw new Error('cpc464: not implemented');
  },
  glyph(_code: number): string {
    throw new Error('cpc464: not implemented');
  },
};
