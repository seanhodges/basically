import { CharsetError, type CharsetMapping } from '../types';

/**
 * ZX Spectrum character set <-> editor text.
 *
 * The Spectrum is largely ASCII for codes 0x20–0x7F, including lowercase, with
 * three substitutions: 0x5E is ↑ (used for the power operator), 0x60 is £ and
 * 0x7F is ©. Codes 0x80–0x8F are the 2×2 block-graphics characters, written
 * here as Unicode block elements. Keyword tokens (0xA5–0xFF) are handled by the
 * tokenizer, not the charset.
 *
 * Two escape forms cover the bytes with no unicode equivalent, so imported
 * programs round-trip without loss:
 *
 * - UDGs 0x90–0xA4 are written `\a`–`\u` (the zmakebas convention); `\\` is a
 *   literal backslash.
 * - Embedded attribute-control sequences are written as brace directives:
 *   `{INK n}`, `{PAPER n}`, `{FLASH n}`, `{BRIGHT n}`, `{INVERSE n}`,
 *   `{OVER n}` (one operand byte), `{AT r,c}` and `{TAB n}` (two operand
 *   bytes; TAB's operand is 16-bit little-endian). `{0xNN}` is a raw byte for
 *   anything else. A `{...}` that doesn't match a directive is literal text —
 *   the Spectrum has real `{`/`}` characters at 0x7B/0x7D.
 */

/** Codes 0x80–0x8F: block graphics, by quadrant bits TL=1 TR=2 BL=4 BR=8. */
const GRAPHIC_UNICODE: Record<number, string> = {
  0x80: ' ', // blank graphic (renders as a space)
  0x81: '▘',
  0x82: '▝',
  0x83: '▀',
  0x84: '▖',
  0x85: '▌',
  0x86: '▞',
  0x87: '▛',
  0x88: '▗',
  0x89: '▚',
  0x8a: '▐',
  0x8b: '▜',
  0x8c: '▄',
  0x8d: '▙',
  0x8e: '▟',
  0x8f: '█',
};

const charToCode = new Map<string, number>();
const codeToChar = new Map<number, string>();

// Standard ASCII range, then the Spectrum-specific overrides.
for (let c = 0x20; c <= 0x7e; c++) {
  const ch = String.fromCharCode(c);
  charToCode.set(ch, c);
  codeToChar.set(c, ch);
}
const OVERRIDES: Record<number, string> = {
  0x5e: '↑',
  0x60: '£',
  0x7f: '©',
};
for (const [code, ch] of Object.entries(OVERRIDES)) {
  charToCode.set(ch, Number(code));
  codeToChar.set(Number(code), ch);
}
// Accept '^' and '`' as convenient aliases for ↑ and £.
charToCode.set('^', 0x5e);
charToCode.set('`', 0x60);

for (const [code, ch] of Object.entries(GRAPHIC_UNICODE)) {
  codeToChar.set(Number(code), ch);
  if (ch !== ' ') charToCode.set(ch, Number(code));
}

export const ENTER = 0x0d;
export const NUMBER_MARKER = 0x0e;
export const QUOTE = 0x22;

const BACKSLASH = 0x5c;
const OPEN_BRACE = 0x7b;
const CLOSE_BRACE = 0x7d;
const UDG_FIRST = 0x90;
const UDG_LAST = 0xa4;

/** Embedded attribute-control codes and how many operand bytes each carries. */
export const CONTROL_CODES: Record<number, { name: string; operands: 1 | 2 }> =
  {
    0x10: { name: 'INK', operands: 1 },
    0x11: { name: 'PAPER', operands: 1 },
    0x12: { name: 'FLASH', operands: 1 },
    0x13: { name: 'BRIGHT', operands: 1 },
    0x14: { name: 'INVERSE', operands: 1 },
    0x15: { name: 'OVER', operands: 1 },
    0x16: { name: 'AT', operands: 2 },
    0x17: { name: 'TAB', operands: 2 },
  };

const controlByName = new Map<string, number>(
  Object.entries(CONTROL_CODES).map(([code, c]) => [c.name, Number(code)]),
);

/** Parse the content of a `{...}` directive to machine bytes; null if not one. */
function parseDirective(content: string): number[] | null {
  const raw = /^0x([0-9A-Fa-f]{2})$/.exec(content);
  if (raw) return [parseInt(raw[1]!, 16)];
  const at = /^AT\s+(\d+)\s*,\s*(\d+)$/i.exec(content);
  if (at) {
    const r = Number(at[1]);
    const c = Number(at[2]);
    return r <= 0xff && c <= 0xff ? [0x16, r, c] : null;
  }
  const tab = /^TAB\s+(\d+)$/i.exec(content);
  if (tab) {
    const n = Number(tab[1]);
    return n <= 0xffff ? [0x17, n & 0xff, (n >> 8) & 0xff] : null;
  }
  const single = /^([A-Za-z]+)\s+(\d+)$/.exec(content);
  if (single) {
    const code = controlByName.get(single[1]!.toUpperCase());
    const n = Number(single[2]);
    if (code !== undefined && CONTROL_CODES[code]!.operands === 1 && n <= 0xff)
      return [code, n];
  }
  return null;
}

/**
 * Parse one editor unit (a character, a `\x` UDG escape or a `{...}`
 * directive) starting at index i. Returns the machine bytes it encodes and the
 * number of source characters consumed. Used inside string literals and REM
 * bodies; the tokenizer's expression path stays per-character, so escapes are
 * not recognized there.
 */
export function parseChar(
  text: string,
  i: number,
): { codes: number[]; length: number } {
  const ch = text[i]!;
  if (ch === '\\') {
    const next = text[i + 1];
    // A trailing backslash stays a literal 0x5C so single-character
    // toMachine() calls keep working.
    if (next === undefined) return { codes: [BACKSLASH], length: 1 };
    if (next === '\\') return { codes: [BACKSLASH], length: 2 };
    if (/[a-uA-U]/.test(next)) {
      const udg = UDG_FIRST + (next.toLowerCase().charCodeAt(0) - 97);
      return { codes: [udg], length: 2 };
    }
    throw new CharsetError(
      `Unknown escape "\\${next}" (UDGs are \\a-\\u; use \\\\ for a backslash)`,
      i,
    );
  }
  if (ch === '{') {
    const close = text.indexOf('}', i + 1);
    if (close !== -1) {
      const codes = parseDirective(text.slice(i + 1, close));
      if (codes) return { codes, length: close + 1 - i };
    }
    // Not a directive: fall through to a literal '{'.
  }
  const code = charToCode.get(ch);
  if (code === undefined) {
    throw new CharsetError(
      `Character "${ch}" does not exist on the ZX Spectrum`,
      i,
    );
  }
  return { codes: [code], length: 1 };
}

/**
 * The plain editor character for a code, or undefined for anything that would
 * need an escape (UDGs, control codes…). Used by the detokenizer outside
 * strings, where escapes are not recognized.
 */
export function plainChar(code: number): string | undefined {
  return codeToChar.get(code);
}

function rawByte(b: number): string {
  return `{0x${b.toString(16).padStart(2, '0').toUpperCase()}}`;
}

/**
 * Decode one machine unit (a control sequence with its operands, a UDG or a
 * plain character) starting at index i, never reading at or past `end`.
 * Returns the editor text and the number of bytes consumed. Every byte decodes
 * to something `parseChar` maps back to the same byte(s) — nothing becomes '?'.
 */
export function decodeSpan(
  bytes: ArrayLike<number>,
  i: number,
  end: number,
): { text: string; length: number } {
  const b = bytes[i]!;
  const ctrl = CONTROL_CODES[b];
  if (ctrl) {
    // Truncated operands (control byte at the very end): raw escape instead.
    if (i + ctrl.operands >= end) return { text: rawByte(b), length: 1 };
    if (b === 0x16) {
      return { text: `{AT ${bytes[i + 1]},${bytes[i + 2]}}`, length: 3 };
    }
    if (b === 0x17) {
      const n = bytes[i + 1]! | (bytes[i + 2]! << 8);
      return { text: `{TAB ${n}}`, length: 3 };
    }
    return { text: `{${ctrl.name} ${bytes[i + 1]}}`, length: 2 };
  }
  if (b >= UDG_FIRST && b <= UDG_LAST) {
    return { text: '\\' + String.fromCharCode(97 + b - UDG_FIRST), length: 1 };
  }
  // The blank graphic renders as a space but is a distinct byte; escape it so
  // the decode is byte-exact (a plain space would re-tokenize as 0x20).
  if (b === 0x80) return { text: rawByte(b), length: 1 };
  if (b === BACKSLASH) return { text: '\\\\', length: 1 };
  if (b === OPEN_BRACE) {
    // If the literal bytes ahead happen to read as a directive, escape this
    // brace so the text still round-trips byte-exactly.
    for (let j = i + 1; j < end; j++) {
      const c = bytes[j]!;
      if (c === CLOSE_BRACE) {
        let content = '';
        for (let k = i + 1; k < j; k++)
          content += String.fromCharCode(bytes[k]!);
        if (parseDirective(content)) return { text: rawByte(b), length: 1 };
        break;
      }
      if (c === OPEN_BRACE || c < 0x20 || c > 0x7a) break;
    }
    return { text: '{', length: 1 };
  }
  const direct = codeToChar.get(b);
  if (direct !== undefined) return { text: direct, length: 1 };
  return { text: rawByte(b), length: 1 };
}

export const spectrumCharset: CharsetMapping = {
  toMachine(text: string): Uint8Array {
    const out: number[] = [];
    let i = 0;
    while (i < text.length) {
      const { codes, length } = parseChar(text, i);
      out.push(...codes);
      i += length;
    }
    return Uint8Array.from(out);
  },

  toUnicode(codes: ArrayLike<number>): string {
    let s = '';
    let i = 0;
    while (i < codes.length) {
      if (codes[i] === ENTER) {
        s += '\n';
        i++;
        continue;
      }
      const { text, length } = decodeSpan(codes, i, codes.length);
      s += text;
      i += length;
    }
    return s;
  },

  glyph(code: number): string {
    if (code === ENTER) return '\n';
    return decodeSpan([code], 0, 1).text;
  },
};
