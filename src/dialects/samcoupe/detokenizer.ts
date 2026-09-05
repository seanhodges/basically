import { decodeSpan, ENTER, NUMBER_MARKER, QUOTE } from './charset';
import {
  COMMAND_FIRST,
  FUNCTION_LEADER,
  REM_TOKEN,
  SHORT_ELSE,
  SHORT_IF,
  samcoupeKeywords,
} from './keywords';

/**
 * Tokenized program bytes -> editable text.
 *
 * The line layout is `INSERTLN`'s: a u16 big-endian line number, a u16
 * little-endian length covering the body and its terminating 0x0D, then the
 * body. A high byte of 0xFF where a line number would start is the ROM's
 * end-of-program stopper.
 *
 * Spacing follows the ROM's own LIST (`PRGR802` and the routines below it in
 * tprint.asm), because the tokenizer eats exactly the spaces LIST puts back:
 *
 * - a command or qualifier (0x85-0xFE) prints with a space either side;
 * - MOD, DIV, BOR, BAND, OR and AND print with a space either side;
 * - `<>`, `<=` and `>=` print with neither;
 * - the calculator functions (0x53-0x79), FN and BIN print with a trailing
 *   space and no leading one, their argument following unbracketed;
 * - the remaining immediate functions print with neither, taking no argument or
 *   a bracketed one.
 */

/** Word for each single-byte token, and for each 0xFF-prefixed code. */
const WORDS = new Map<number, string>(
  samcoupeKeywords.map((k) => [k.token, k.word]),
);
// The two tokens the syntax pass writes list back as the word their long twin
// carries, so they are not table entries of their own.
WORDS.set(SHORT_IF, 'IF');
WORDS.set(SHORT_ELSE, 'ELSE');

/** Spacing LIST puts round a keyword. */
function spacing(token: number): { leading: boolean; trailing: boolean } {
  if (token >= COMMAND_FIRST) return { leading: true, trailing: true };
  if (token >= 0x7a && token <= 0x80) return { leading: true, trailing: true };
  if (token >= 0x81 && token <= 0x83)
    return { leading: false, trailing: false };
  if (token >= 0x53) return { leading: false, trailing: true };
  // FN and BIN, alone among the immediate functions, take a trailing space.
  if (token === 0x42 || token === 0x43)
    return { leading: false, trailing: true };
  return { leading: false, trailing: false };
}

/** One line's bytes turned back into text, without its line number. */
function detokenizeLine(body: ArrayLike<number>, end: number): string {
  let text = '';
  // A trailing space a keyword owes is held until something follows it, so a
  // line never ends in one the source did not have.
  let pendingSpace = false;
  let inQuotes = false;

  const put = (s: string): void => {
    if (pendingSpace) {
      text += ' ';
      pendingSpace = false;
    }
    text += s;
  };

  let i = 0;
  while (i < end) {
    const b = body[i]!;

    if (inQuotes) {
      if (b === QUOTE) {
        put('"');
        inQuotes = false;
        i++;
        continue;
      }
      const { text: s, length } = decodeSpan(body, i, end);
      put(s);
      i += length;
      continue;
    }

    if (b === QUOTE) {
      put('"');
      inQuotes = true;
      i++;
      continue;
    }

    if (b === NUMBER_MARKER) {
      // The five hidden bytes restate the digits already emitted.
      i += 6;
      continue;
    }

    const token =
      b === FUNCTION_LEADER && i + 1 < end
        ? body[i + 1]!
        : b >= COMMAND_FIRST
          ? b
          : null;
    const word = token === null ? undefined : WORDS.get(token);
    if (token !== null && word !== undefined) {
      const { leading, trailing } = spacing(token);
      if (leading && !pendingSpace && text.length > 0 && !text.endsWith(' '))
        text += ' ';
      put(word);
      pendingSpace = trailing;
      i += b === FUNCTION_LEADER ? 2 : 1;
      if (token === REM_TOKEN) {
        // The rest of the line is text exactly as it was typed.
        let rest = '';
        let j = i;
        while (j < end) {
          const span = decodeSpan(body, j, end);
          rest += span.text;
          j += span.length;
        }
        put(rest);
        pendingSpace = false;
        i = end;
      }
      continue;
    }

    const { text: s, length } = decodeSpan(body, i, end);
    put(s);
    i += length;
  }
  return text;
}

export function detokenizeProgram(bytes: Uint8Array): string {
  return detokenizeWithWarnings(bytes).source;
}

/** The text form plus anything the bytes carried that it could not. */
export function detokenizeWithWarnings(bytes: Uint8Array): {
  source: string;
  warnings: string[];
} {
  const lines: string[] = [];
  const warnings: string[] = [];
  let p = 0;
  while (p + 4 <= bytes.length) {
    const hi = bytes[p]!;
    if (hi === 0xff) break; // end-of-program stopper
    const lineNo = (hi << 8) | bytes[p + 1]!;
    const len = bytes[p + 2]! | (bytes[p + 3]! << 8);
    p += 4;
    if (len < 1 || p + len > bytes.length) {
      warnings.push(
        `Line ${lineNo} claims ${len} bytes but only ${bytes.length - p} remain; the rest of the program was dropped.`,
      );
      break;
    }
    const body = bytes.subarray(p, p + len);
    // The body's own terminator is not part of the text.
    const bodyEnd = body[len - 1] === ENTER ? len - 1 : len;
    if (bodyEnd === len) {
      warnings.push(`Line ${lineNo} is not terminated by a carriage return.`);
    }
    lines.push(`${lineNo} ${detokenizeLine(body, bodyEnd)}`);
    p += len;
  }
  if (p < bytes.length && bytes[p] !== 0xff) {
    warnings.push(
      `${bytes.length - p} trailing bytes after the last line were not part of the program.`,
    );
  }
  return { source: lines.join('\n'), warnings };
}
