import { CharsetError, type CharsetMapping } from './types';

/**
 * Shared builder for the Sinclair ZX80/ZX81 character set.
 *
 * Both machines share the same text<->code conventions and the same display
 * codes for digits (0x1C-0x25), letters (0x26-0x3F) and inverse video (bit 7),
 * but they assign the *punctuation and block-graphics* region (0x00-0x1B) to
 * different codes — and store strings behind a different quote code. Each
 * dialect supplies its own tables here; everything else is identical, so the
 * parsing/rendering machinery lives in one place.
 */
export interface SinclairCharsetConfig {
  /** Machine name, used only in "character does not exist" error messages. */
  machineName: string;
  /** Code -> source character for the printable punctuation range. */
  basePunct: Record<number, string>;
  /** Code -> unicode block element for graphics that have an exact glyph. */
  graphicUnicode: Record<number, string>;
  /** Two-char backslash escape (left/right cell halves) -> code. */
  escapes: Record<string, number>;
  /** End-of-line code (0x76 on both machines). */
  newline: number;
  /** Inverse-video bit (0x80 on both machines). */
  inverse: number;
}

export interface SinclairCharset {
  charset: CharsetMapping;
  parseChar(text: string, i: number): { code: number; length: number };
}

export function createSinclairCharset(
  config: SinclairCharsetConfig,
): SinclairCharset {
  const { machineName, basePunct, graphicUnicode, escapes, newline, inverse } =
    config;

  const charToCode = new Map<string, number>();
  const codeToChar = new Map<number, string>();

  for (const [code, ch] of Object.entries(basePunct)) {
    charToCode.set(ch, Number(code));
    codeToChar.set(Number(code), ch);
  }
  for (let d = 0; d <= 9; d++) {
    charToCode.set(String(d), 0x1c + d);
    codeToChar.set(0x1c + d, String(d));
  }
  for (let i = 0; i < 26; i++) {
    const ch = String.fromCharCode(65 + i);
    charToCode.set(ch, 0x26 + i);
    codeToChar.set(0x26 + i, ch);
  }
  for (const [code, ch] of Object.entries(graphicUnicode)) {
    charToCode.set(ch, Number(code));
  }

  const escapeForCode = new Map<number, string>();
  for (const [esc, code] of Object.entries(escapes)) {
    if (!escapeForCode.has(code)) escapeForCode.set(code, '\\' + esc);
  }

  /**
   * Parse one editor character (possibly an escape/% sequence) starting at
   * index i. Returns the machine code and the number of source chars consumed.
   */
  function parseChar(
    text: string,
    i: number,
  ): { code: number; length: number } {
    const ch = text[i]!;
    if (ch === '\\') {
      const esc = text.slice(i + 1, i + 3);
      if (esc.length === 2 && esc in escapes) {
        return { code: escapes[esc]!, length: 3 };
      }
      throw new CharsetError(`Unknown graphics escape "\\${esc}"`, i);
    }
    if (ch === '%') {
      const next = text[i + 1];
      if (next === undefined)
        throw new CharsetError(
          '% at end of input (expected a character to invert)',
          i,
        );
      const upper = next.toUpperCase();
      const base = charToCode.get(upper);
      if (base === undefined || base > 0x3f) {
        throw new CharsetError(`Cannot invert "${next}"`, i);
      }
      return { code: base | inverse, length: 2 };
    }
    const upper = ch.toUpperCase();
    const code = charToCode.get(upper);
    if (code === undefined) {
      throw new CharsetError(
        `Character "${ch}" does not exist on the ${machineName}`,
        i,
      );
    }
    return { code, length: 1 };
  }

  function codeToText(code: number): string {
    if (code === newline) return '\n';
    const direct = codeToChar.get(code);
    if (direct !== undefined) return direct;
    const uni = graphicUnicode[code];
    if (uni !== undefined) return uni;
    const esc = escapeForCode.get(code);
    if (esc !== undefined) return esc;
    if (code >= inverse && code <= (inverse | 0x3f)) {
      const base = codeToChar.get(code & 0x7f);
      if (base !== undefined) return '%' + base;
    }
    return '?';
  }

  const charset: CharsetMapping = {
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
      let s = '';
      for (let i = 0; i < codes.length; i++) s += codeToText(codes[i]!);
      return s;
    },

    glyph(code: number): string {
      return codeToText(code);
    },
  };

  return { charset, parseChar };
}
