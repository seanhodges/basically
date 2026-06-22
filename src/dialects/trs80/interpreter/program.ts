import { lexBody, type Lexeme } from './lex';

export interface BasicLine {
  lineNo: number;
  lexemes: Lexeme[];
  /** Raw tokenized body bytes (no header / terminator) — used for DATA scan. */
  body: Uint8Array;
}

export interface Program {
  lines: BasicLine[];
  /** line number -> index into {@link lines}, for GOTO/GOSUB resolution. */
  index: Map<number, number>;
}

/**
 * Parse a loadable program image — the linked-line layout {@link tokenizeProgram}
 * emits from 0x42E8 (`u16 link`, `u16 line number`, body, `0x00`, ending in a
 * `0x0000` link) — into executable lines. The absolute link pointers are not
 * needed at this level, so records are read sequentially up to the null link.
 */
export function parseProgram(image: Uint8Array): Program {
  const lines: BasicLine[] = [];
  const index = new Map<number, number>();
  let p = 0;
  while (p + 4 <= image.length) {
    const link = image[p]! | (image[p + 1]! << 8);
    if (link === 0) break;
    const lineNo = image[p + 2]! | (image[p + 3]! << 8);
    let i = p + 4;
    while (i < image.length && image[i] !== 0x00) i++;
    const body = image.subarray(p + 4, i);
    index.set(lineNo, lines.length);
    lines.push({ lineNo, lexemes: lexBody(body), body });
    p = i + 1;
  }
  return { lines, index };
}
