import { CharsetError, type CharsetMapping } from '../types';
import {
  BLOCK_GRAPHIC_UNICODE,
  UDG_FIRST,
  UDG_LAST,
  UDG_UNICODE,
  udgLetter,
} from './graphics';

/**
 * SAM Coupé character codes <-> editor text.
 *
 * 0x20-0x7F is ASCII with three substitutions, all read out of the ROM's own
 * compressed font (`CHARSRC` in text.asm, unpacked by `UPACK`): 0x5E draws an
 * up arrow and is the power operator, 0x60 draws `£`, and 0x7F draws `©` - the
 * ROM even patches bit 6 of five of that glyph's scans by hand. Lower case is
 * present and distinct throughout.
 *
 * 0x80-0x8F are the 2x2 block graphics and 0x90-0xA8 the twenty-five
 * user-defined graphics, both from `./graphics`, which derives the quadrant bit
 * order from the ROM's own `POUDG`. Codes 0xA9 and up are keyword tokens in a
 * program line; as characters they reach the second UDG bank and have no
 * settled spelling, so they are written as raw escapes.
 *
 * Two escape forms cover the bytes with no Unicode equivalent, so imported
 * programs round-trip without loss:
 *
 * - `\a`-`\y` are the user-defined graphics, an alternative spelling of the
 *   squared capitals 🄰-🅈. `\\` is a literal backslash - the SAM has a real
 *   one at 0x5C.
 * - Embedded print-control sequences are brace directives: `{PEN n}`,
 *   `{PAPER n}`, `{FLASH n}`, `{BRIGHT n}`, `{INVERSE n}`, `{OVER n}` (one
 *   operand byte), `{AT line,column}` and `{TAB n}` (two operand bytes each -
 *   the ROM reads two for TAB and discards the second). `{INK n}` is accepted
 *   for `{PEN n}`, the way the keyword is. `{0xNN}` is a raw byte for anything
 *   else, and a `{...}` that matches no directive is literal text.
 */

const charToCode = new Map<string, number>();
const codeToChar = new Map<number, string>();

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
// '^' and '`' are the reachable keys for the two the font redraws.
charToCode.set('^', 0x5e);
charToCode.set('`', 0x60);

for (const [code, ch] of Object.entries(BLOCK_GRAPHIC_UNICODE)) {
  codeToChar.set(Number(code), ch);
  if (ch !== ' ') charToCode.set(ch, Number(code));
}
for (const [code, ch] of Object.entries(UDG_UNICODE)) {
  codeToChar.set(Number(code), ch);
  charToCode.set(ch, Number(code));
}

/** End of a program line, and the code CHR$ 13 prints. */
export const ENTER = 0x0d;
/** Marks the five hidden bytes holding a numeric literal's value. */
export const NUMBER_MARKER = 0x0e;
export const QUOTE = 0x22;

const BACKSLASH = 0x5c;
const OPEN_BRACE = 0x7b;
const CLOSE_BRACE = 0x7d;

/** Print-control codes that carry operand bytes, and how many each takes. */
export const CONTROL_CODES: Record<number, { name: string; operands: 1 | 2 }> =
  {
    0x10: { name: 'PEN', operands: 1 },
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
// The machine takes INK as a spelling of PEN, so the directive does too.
controlByName.set('INK', 0x10);

/** Parse the content of a `{...}` directive to machine bytes; null if not one. */
function parseDirective(content: string): number[] | null {
  const raw = /^0x([0-9A-Fa-f]{2})$/.exec(content);
  if (raw) return [parseInt(raw[1]!, 16)];
  const at = /^AT\s+(\d+)\s*,\s*(\d+)$/i.exec(content);
  if (at) {
    const line = Number(at[1]);
    const column = Number(at[2]);
    return line <= 0xff && column <= 0xff ? [0x16, line, column] : null;
  }
  // TAB's second operand byte is read and discarded by the ROM, so the
  // directive writes zero and the decoder only uses this spelling when the
  // stored byte is zero too.
  const tab = /^TAB\s+(\d+)$/i.exec(content);
  if (tab) {
    const n = Number(tab[1]);
    return n <= 0xff ? [0x17, n, 0] : null;
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
 * Parse one editor unit (a character, a `\x` UDG escape or a `{...}` directive)
 * starting at index i. Returns the machine bytes it encodes and the number of
 * source characters consumed.
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
    if (/[a-yA-Y]/.test(next)) {
      const udg = UDG_FIRST + (next.toLowerCase().charCodeAt(0) - 97);
      return { codes: [udg], length: 2 };
    }
    throw new CharsetError(
      `Unknown escape "\\${next}" (UDGs are \\a-\\y; use \\\\ for a backslash)`,
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
  // The UDG characters are astral, so read a whole code point rather than a
  // UTF-16 unit - a lone surrogate maps to nothing and would report the
  // character as one the machine does not have.
  const unit = String.fromCodePoint(text.codePointAt(i)!);
  const code = charToCode.get(unit);
  if (code === undefined) {
    throw new CharsetError(
      `Character "${unit}" does not exist on the SAM Coupé`,
      i,
    );
  }
  return { codes: [code], length: unit.length };
}

/**
 * The plain editor character for a code, or undefined for anything that would
 * need an escape. Used where escapes are not recognized.
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
 * to something {@link parseChar} maps back to the same byte(s).
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
      // A non-zero discarded operand has no spelling, so keep the raw byte and
      // let the two operands decode as themselves.
      if (bytes[i + 2] !== 0) return { text: rawByte(b), length: 1 };
      return { text: `{TAB ${bytes[i + 1]}}`, length: 3 };
    }
    return { text: `{${ctrl.name} ${bytes[i + 1]}}`, length: 2 };
  }
  if (b >= UDG_FIRST && b <= UDG_LAST) {
    return { text: UDG_UNICODE[b]!, length: 1 };
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

/** The `\x` escape spelling of a user-defined graphic code. */
export function udgEscape(code: number): string {
  return `\\${udgLetter(code).toLowerCase()}`;
}

export const samcoupeCharset: CharsetMapping = {
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
