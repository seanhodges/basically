import { CharsetError, type CharsetMapping } from '../types';

/**
 * Acorn Atom character mapping.
 *
 * Atom BASIC stores program lines as plain ASCII (the tokenizer does no
 * keyword-to-byte packing - see {@link import('./tokenizer').tokenizeProgram}),
 * so the "machine code" for a source character is just its byte. The mapping is
 * **total** - every byte 0x00–0xFF has a text form that {@link parseChar} turns
 * back into the same byte - so an imported image never silently corrupts.
 *
 *  - 0x20–0x7E is printable ASCII, straight through both ways. Lower case is
 *    preserved (a pasted listing survives; the export path warns separately that
 *    a real Atom wants upper-case keywords).
 *  - Every other byte - the control codes 0x00–0x1F and 0x7F, and the top-bit
 *    (inverse-video) bytes 0x80–0xFF the MC6847 shows in reverse - has no plain
 *    form and is written as a `{0xNN}` raw-byte escape.
 *
 * The escape deliberately does **not** use a `%`-prefix for inverse video: on the
 * floating-point ROM `%A`…`%Z` name the FP variables, so `%` must stay a literal
 * character. A `{...}` that is not a well-formed `{0xNN}` escape is literal text
 * (the Atom has real `{`/`}` at 0x7B/0x7D); a literal `{` that would otherwise
 * read as an escape is itself escaped so the text still round-trips.
 */

const OPEN_BRACE = 0x7b;
const CLOSE_BRACE = 0x7d;

/** The `{0xNN}` raw-byte escape for a byte with no printable form. */
function rawByte(code: number): string {
  return `{0x${(code & 0xff).toString(16).padStart(2, '0').toUpperCase()}}`;
}

/** The plain editor character for a code in 0x20–0x7E, else undefined. */
export function plainChar(code: number): string | undefined {
  const c = code & 0xff;
  return c >= 0x20 && c <= 0x7e ? String.fromCharCode(c) : undefined;
}

/** Parse the content of a `{...}` escape to a byte; null if it isn't one. */
function parseEscape(content: string): number | null {
  const m = /^0x([0-9A-Fa-f]{2})$/.exec(content);
  return m ? parseInt(m[1]!, 16) : null;
}

/**
 * Parse one editor unit - a character or a `{0xNN}` escape - starting at index
 * i. Returns the machine byte it encodes and the number of source characters
 * consumed.
 */
export function parseChar(
  text: string,
  i: number,
): { code: number; length: number } {
  if (text[i] === '{') {
    const close = text.indexOf('}', i + 1);
    if (close !== -1) {
      const code = parseEscape(text.slice(i + 1, close));
      if (code !== null) return { code, length: close + 1 - i };
    }
    // Not an escape: fall through to a literal '{' (0x7B).
  }
  const code = text.charCodeAt(i);
  if (code >= 0x20 && code <= 0x7e) return { code, length: 1 };
  throw new CharsetError(
    `Character ${JSON.stringify(text[i])} has no Acorn Atom equivalent`,
    i,
  );
}

/**
 * Decode one machine byte to editor text, never reading at or past `end`. Every
 * byte becomes something {@link parseChar} maps back to the same byte: printable
 * ASCII passes through, a literal `{` that would otherwise read as an escape is
 * itself escaped, and every other byte (controls, inverse-video top-bit bytes)
 * becomes `{0xNN}`. Always advances one byte.
 */
export function decodeSpan(
  bytes: ArrayLike<number>,
  i: number,
  end: number,
): { text: string; length: number } {
  const b = bytes[i]! & 0xff;
  if (b === OPEN_BRACE) {
    for (let j = i + 1; j < end; j++) {
      const c = bytes[j]!;
      if (c === CLOSE_BRACE) {
        let content = '';
        for (let k = i + 1; k < j; k++)
          content += String.fromCharCode(bytes[k]!);
        if (parseEscape(content) !== null)
          return { text: rawByte(b), length: 1 };
        break;
      }
      if (c === OPEN_BRACE || c < 0x20 || c > 0x7e) break;
    }
    return { text: '{', length: 1 };
  }
  const plain = plainChar(b);
  return plain !== undefined
    ? { text: plain, length: 1 }
    : { text: rawByte(b), length: 1 };
}

export const atomCharset: CharsetMapping = {
  toMachine(text: string): Uint8Array {
    const out: number[] = [];
    let i = 0;
    while (i < text.length) {
      const { code, length } = parseChar(text, i);
      out.push(code);
      i += length;
    }
    return Uint8Array.from(out);
  },

  toUnicode(codes: ArrayLike<number>): string {
    let text = '';
    let i = 0;
    while (i < codes.length) {
      const { text: t, length } = decodeSpan(codes, i, codes.length);
      text += t;
      i += length;
    }
    return text;
  },

  glyph(code: number): string {
    // A single-character display form for debug/status readouts; the top-bit
    // inverse-video byte shows its base glyph.
    return plainChar(code & 0x7f) ?? '?';
  },
};
