// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { CompileError, type CompileFault } from './errors';
import { deleteBlanks, keywordWords, lexBody, type Lexeme } from './lex';
import type { DartmouthCharset, DartmouthProfile } from './profile';

export interface BasicLine {
  lineNo: number;
  lexemes: readonly Lexeme[];
  /**
   * A `DATA` line's constants, as the characters they were punched as. `DATA`
   * is the one statement the lexer cannot read: section 2.7 has its strings
   * "recognized by the fact that they start with a letter", so `DATA ONE, TWO`
   * carries two words that a lexer would see as the keyword `ON` and a pile of
   * loose variables. The constants are therefore kept as text and split by the
   * rule that knows about them - which is also why blanks survive here when
   * every other line has had them deleted.
   */
  dataText?: string;
}

export interface Program {
  lines: BasicLine[];
  /** Line number -> index into {@link lines}, for GOTO/GOSUB resolution. */
  index: Map<number, number>;
  /** Everything the compiler found wrong while reading the tape. */
  faults: CompileFault[];
  /** Characters the whole program occupies, which one size rule counts. */
  characters: number;
}

/**
 * Read a paper tape into lines the executor can walk.
 *
 * The tape is character codes with a carriage return after each line, and on a
 * machine whose set has one an end-of-message code closing it, so this is the
 * tokenizer's inverse plus the lexing the compiler did in the same pass. Faults
 * are collected rather than thrown, because the compiler listed every line it
 * could not read before refusing to run the program - one message per line, not
 * the first one only.
 *
 * Two statements are not lexed past their keyword. A `REM` line's text is prose,
 * and the compiler stopped reading it as soon as it recognised the word; a
 * `DATA` line's constants are kept as characters for the reason {@link
 * BasicLine.dataText} gives.
 */
export function parseProgram(
  image: Uint8Array,
  profile: DartmouthProfile,
): Program {
  const lines: BasicLine[] = [];
  const index = new Map<number, number>();
  const faults: CompileFault[] = [];
  const { charset, limits, language } = profile;
  const words = keywordWords(profile.keywords);
  let characters = 0;

  for (const record of records(image, charset)) {
    const text = charset.mapping.toUnicode(record);
    if (text.trim() === '') continue; // blank paper between records
    characters += record.length;
    const match = /^\s*(\d+)(.*)$/.exec(text);
    if (!match) {
      faults.push({ code: 'ILLEGAL_INSTRUCTION' });
      continue;
    }
    const lineNo = Number(match[1]);
    if (lineNo > limits.maxLineNumber) {
      faults.push({ code: 'ILLEGAL_NUMBER', line: lineNo });
      continue;
    }

    const raw = language.apostropheRemark
      ? stripApostrophe(match[2]!)
      : match[2]!;
    const body = deleteBlanks(raw);
    if (body === '') {
      faults.push({ code: 'ILLEGAL_INSTRUCTION', line: lineNo });
      continue;
    }

    let lexemes: readonly Lexeme[];
    let dataText: string | undefined;
    if (body.startsWith('REM')) {
      lexemes = [{ kind: 'kw', word: 'REM' }];
    } else if (body.startsWith('DATA')) {
      lexemes = [{ kind: 'kw', word: 'DATA' }];
      dataText = afterWord(raw, 'DATA') ?? '';
    } else {
      try {
        lexemes = lexBody(body, words, language.strings);
      } catch (e) {
        if (!(e instanceof CompileError)) throw e;
        faults.push({ code: e.code, line: lineNo });
        continue;
      }
    }

    index.set(lineNo, lines.length);
    lines.push(
      dataText === undefined
        ? { lineNo, lexemes }
        : { lineNo, lexemes, dataText },
    );
  }

  if (limits.maxLines !== undefined && lines.length > limits.maxLines) {
    faults.push({
      code: 'PROGRAM_TOO_LONG',
      line: lines[limits.maxLines]!.lineNo,
    });
  }
  return { lines, index, faults, characters };
}

/**
 * Cut a line at the apostrophe that starts a remark, which section 2.5 places
 * "at the end of the line, followed by a remark". The same paragraph names the
 * exception this has to honour: "if the line ended in a string, then BASIC will
 * think that the apostrophe is part of the string, and the method will not
 * work" - so an apostrophe inside quotation marks is text, not a comment.
 */
function stripApostrophe(raw: string): string {
  let inString = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]!;
    if (ch === '"') inString = !inString;
    else if (ch === "'" && !inString) return raw.slice(0, i);
  }
  return raw;
}

/**
 * The text after a statement word, with the blanks the compiler would have
 * deleted skipped while matching it rather than before - the manual writes the
 * same statement both ways, so a word may be spelled out with spaces through
 * it. Null where the line does not open with the word.
 */
function afterWord(raw: string, word: string): string | null {
  let i = 0;
  let matched = 0;
  while (i < raw.length && matched < word.length) {
    const ch = raw[i]!;
    if (ch === ' ') {
      i++;
      continue;
    }
    if (ch !== word[matched]) return null;
    matched++;
    i++;
  }
  return matched === word.length ? raw.slice(i) : null;
}

/**
 * The tape's line records: codes between carriage returns, up to end of
 * message. The line feed that follows a carriage return on an ASCII tape is
 * framing rather than text - it advances the paper, and a machine whose set
 * writes both after every line would otherwise open each record with it.
 */
function* records(
  image: Uint8Array,
  charset: DartmouthCharset,
): Generator<number[]> {
  let record: number[] = [];
  for (const byte of image) {
    const code = byte & charset.codeMask;
    if (code === charset.eom) break;
    if (code === charset.lf) continue;
    if (code === charset.cr) {
      if (record.length > 0) yield record;
      record = [];
      continue;
    }
    record.push(code);
  }
  // A tape whose last line was never terminated still carries that line.
  if (record.length > 0) yield record;
}
