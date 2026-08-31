// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { TokenizeError } from '../types';
import {
  apple2plusKeywordsInTokenOrder,
  type Apple2PlusKeyword,
} from './keywords';
import { MAX_ENTRY_BYTES, MAX_LINE, PROGRAM_BASE } from './addresses';

/**
 * Source text -> the tokenized program Applesoft holds from `$0801`.
 *
 * Everything the scanner does below was measured by typing the construct at the
 * `]` prompt of `public/roms/apple2plus.rom` and reading the program area back
 * out between TXTTAB and VARTAB; `tokenizer.test.ts` carries that corpus as its
 * expectations. Four behaviours are worth stating before the code, because
 * three of them are surprising and the fourth is what makes the third possible:
 *
 *  - **Spaces are thrown away.** Outside a string, a REM body and a DATA
 *    statement, the parser simply does not store them: `10 PRINT   1` and
 *    `10 PRINT 1` are the same seven bytes. That is why LIST puts its own
 *    spacing back around every token, and why `PR INT 1` and `FORI=1TO10` both
 *    work - the scan skips spaces *while matching a keyword too*, so a keyword
 *    can be split or glued at will.
 *  - **The table is scanned in token order and the first match wins.** Not the
 *    longest match: `HGR2` is ahead of `HGR` and `PR#` ahead of `PRINT` in the
 *    ROM's own table, which is the only reason those read correctly.
 *  - **A keyword is matched anywhere, including inside a name.** `LATCH=1`
 *    stores as `L`, the AT token, `CH` - and then fails to run. This is the
 *    machine's most famous trap and it is reproduced here rather than smoothed
 *    over, because a tokenizer that quietly did the sensible thing would send a
 *    program to the emulator that behaves differently from the one the IDE
 *    shows. `variableLint.ts` is where the reader is warned.
 *  - **AT, ATN and TO are one decision.** Because `AT` sits at `$C5` and `ATN`
 *    at `$E1`, `AT` matches first every time, so the ROM patches it up by
 *    looking at the character that follows: `N` makes it ATN, `O` makes it a
 *    literal `A` followed by TO (which is what rescues `FOR I=A TO B`), and
 *    anything else - a space included - leaves it as AT. Hence `A TO B` is
 *    `A`,TO,`B` while `A T O B` is AT,`O`,`B`.
 */
export interface TokenizedProgram {
  /**
   * The program as it sits in memory from `$0801`: for each line a two-byte
   * absolute link to the next, the two-byte line number, the tokenized body and
   * a `$00`, ending on a zero link.
   */
  program: Uint8Array;
  errors: TokenizeError[];
}

/** Lowest and highest byte a typed line can carry: space to underscore. */
const FIRST_PRINTABLE = 0x20;
const LAST_PRINTABLE = 0x5f;

/** `{0xNN}` - a byte the machine can hold but nobody can type. */
const BYTE_ESCAPE = /^\{0x([0-9a-fA-F]{2})\}/;

/** The token the parser answers `?` with, before it scans the table at all. */
const PRINT_TOKEN = 0xba;

/** The three tokens the AT rule chooses between. */
const AT_TOKEN = 0xc5;
const ATN_TOKEN = 0xe1;
const TO_TOKEN = 0xc1;
/** The `A` the AT rule hands back when it has decided the keyword was TO. */
const LETTER_A = 0x41;

/**
 * How far into `body` the spelling `word` reaches from `pos`, or undefined.
 *
 * Spaces in the *input* are stepped over as the ROM steps over them, so the
 * length returned is what the match consumed rather than the word's own length.
 */
function matchAt(body: string, pos: number, word: string): number | undefined {
  let i = pos;
  for (const want of word) {
    while (body[i] === ' ') i++;
    if (body[i] === undefined) return undefined;
    if (body[i]!.toUpperCase() !== want) return undefined;
    i++;
  }
  return i - pos;
}

/** The first keyword in the ROM's table order that matches at `pos`. */
function matchKeyword(
  body: string,
  pos: number,
): { keyword: Apple2PlusKeyword; length: number } | undefined {
  for (const keyword of apple2plusKeywordsInTokenOrder) {
    const length = matchAt(body, pos, keyword.word);
    if (length !== undefined) return { keyword, length };
  }
  return undefined;
}

/** One source character as the byte (or bytes) the machine stores for it. */
function readUnit(
  body: string,
  pos: number,
): { byte: number; length: number } | undefined {
  const escape = BYTE_ESCAPE.exec(body.slice(pos));
  if (escape) {
    return { byte: parseInt(escape[1]!, 16), length: escape[0].length };
  }
  const code = body[pos]!.toUpperCase().charCodeAt(0);
  if (code < FIRST_PRINTABLE || code > LAST_PRINTABLE) return undefined;
  return { byte: code, length: 1 };
}

/** Tokenize one line's body - everything after its line number. */
function tokenizeBody(
  body: string,
  editorLine: number,
  bodyCol: number,
  errors: TokenizeError[],
): number[] {
  const out: number[] = [];
  let pos = 0;
  let inString = false;
  let inData = false;
  let inRem = false;

  const pushLiteral = (): void => {
    const unit = readUnit(body, pos);
    if (!unit) {
      errors.push({
        line: editorLine,
        column: bodyCol + pos,
        endColumn: bodyCol + pos + 1,
        message:
          `The Apple II Plus cannot store '${body[pos]}' - it has no lower ` +
          'case and no character above underscore. Write it as {0xNN} if the ' +
          'byte is what you want.',
      });
      pos++;
      return;
    }
    out.push(unit.byte);
    pos += unit.length;
  };

  while (pos < body.length) {
    const ch = body[pos]!;

    // REM takes the rest of the line, colons and all, exactly as typed.
    if (inRem) {
      pushLiteral();
      continue;
    }
    if (inString) {
      if (ch === '"') {
        out.push(0x22);
        inString = false;
        pos++;
      } else pushLiteral();
      continue;
    }
    if (ch === '"') {
      out.push(0x22);
      inString = true;
      pos++;
      continue;
    }
    // A DATA statement is literal to its closing colon - the quote branch above
    // runs first, so a colon inside a quoted item does not end it.
    if (inData) {
      if (ch === ':') {
        out.push(0x3a);
        inData = false;
        pos++;
      } else pushLiteral();
      continue;
    }

    if (ch === ' ') {
      pos++;
      continue;
    }
    if (ch === '?') {
      out.push(PRINT_TOKEN);
      pos++;
      continue;
    }

    const hit = matchKeyword(body, pos);
    if (hit) {
      const { keyword, length } = hit;
      if (keyword.token === AT_TOKEN) {
        // The next character is read raw: a space here is not stepped over, so
        // `AT N` stays AT and `ATN` does not.
        const next = body[pos + length]?.toUpperCase();
        if (next === 'N') {
          out.push(ATN_TOKEN);
          pos += length + 1;
          continue;
        }
        if (next === 'O') {
          out.push(LETTER_A, TO_TOKEN);
          pos += length + 1;
          continue;
        }
      }
      out.push(keyword.token);
      pos += length;
      if (keyword.verbatimRest === 'line') inRem = true;
      else if (keyword.verbatimRest === 'statement') inData = true;
      continue;
    }

    pushLiteral();
  }

  return out;
}

interface LineRecord {
  lineNo: number;
  body: number[];
}

export function tokenizeProgram(source: string): TokenizedProgram {
  const errors: TokenizeError[] = [];
  const records: LineRecord[] = [];
  let previous = -1;

  const lines = source.split('\n');
  for (let index = 0; index < lines.length; index++) {
    let raw = lines[index]!;
    if (raw.endsWith('\r')) raw = raw.slice(0, -1);
    if (raw.trim() === '') continue;
    const editorLine = index + 1;

    const match = /^(\s*)(\d+)(.*)$/.exec(raw);
    if (!match) {
      errors.push({
        line: editorLine,
        column: 0,
        message: 'Missing line number',
      });
      continue;
    }
    const lineNo = parseInt(match[2]!, 10);
    const numberCol = match[1]!.length;
    if (lineNo > 0xffff) {
      // The line field is two bytes; there is no image to build from this.
      errors.push({
        line: editorLine,
        column: numberCol,
        message: `Line number ${lineNo} exceeds the 16-bit maximum (65535)`,
      });
      continue;
    }
    if (lineNo > MAX_LINE) {
      // `64000 END` answers ?SYNTAX ERROR at the prompt, but a line that high
      // stores and runs perfectly once it is in memory - an imported program
      // may hold one. Warn and keep it.
      errors.push({
        line: editorLine,
        column: numberCol,
        message: `Line number ${lineNo} is above the ${MAX_LINE} Applesoft accepts at entry`,
        fatal: false,
      });
    }
    if (lineNo <= previous) {
      errors.push({
        line: editorLine,
        column: numberCol,
        message: `Line number ${lineNo} is not greater than the previous (${previous})`,
        fatal: false,
      });
    }
    previous = lineNo;

    if (raw.length > MAX_ENTRY_BYTES) {
      errors.push({
        line: editorLine,
        column: MAX_ENTRY_BYTES,
        message:
          `Line is ${raw.length} characters; the machine keeps the first ` +
          `${MAX_ENTRY_BYTES} of a typed line and drops the rest`,
        fatal: false,
      });
    }

    const rest = match[3]!;
    const lead = rest.length - rest.trimStart().length;
    records.push({
      lineNo,
      body: tokenizeBody(
        rest.slice(lead),
        editorLine,
        numberCol + match[2]!.length + lead,
        errors,
      ),
    });
  }

  const program: number[] = [];
  let address = PROGRAM_BASE;
  for (const { lineNo, body } of records) {
    const next = address + 2 + 2 + body.length + 1;
    program.push(next & 0xff, (next >> 8) & 0xff);
    program.push(lineNo & 0xff, (lineNo >> 8) & 0xff);
    program.push(...body, 0x00);
    address = next;
  }
  // The zero link the interpreter stops on.
  program.push(0x00, 0x00);

  return { program: Uint8Array.from(program), errors };
}
