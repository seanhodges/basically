import { CharsetError, type CharsetMapping } from '../types';

/**
 * Acorn Atom character mapping.
 *
 * Atom BASIC stores program lines as plain ASCII (the tokenizer does no
 * keyword-to-byte packing — see {@link import('./tokenizer').tokenizeProgram}),
 * so the "machine code" for a source character is just its ASCII value. The
 * Atom's primary character set covers printable ASCII 0x20–0x7E; the editor is
 * upper-case-oriented like the real machine, but lower case is accepted and
 * round-trips so pasted listings survive.
 *
 * (The MC6847's *display* codes — letters at 0x00–0x1F, inverse video at the
 * high bit — are an internal screen-RAM encoding handled by the emulator
 * adapter, not this source-text mapping.)
 */
export const atomCharset: CharsetMapping = {
  toMachine(text: string): Uint8Array {
    const out = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (code < 0x20 || code > 0x7e) {
        throw new CharsetError(
          `Character ${JSON.stringify(text[i])} has no Acorn Atom equivalent`,
          i,
        );
      }
      out[i] = code;
    }
    return out;
  },

  toUnicode(codes: ArrayLike<number>): string {
    let text = '';
    for (let i = 0; i < codes.length; i++) {
      const code = codes[i]! & 0x7f; // strip any inverse-video bit
      if (code >= 0x20 && code <= 0x7e) text += String.fromCharCode(code);
      else text += '?';
    }
    return text;
  },

  glyph(code: number): string {
    const c = code & 0x7f;
    return c >= 0x20 && c <= 0x7e ? String.fromCharCode(c) : '?';
  },
};
