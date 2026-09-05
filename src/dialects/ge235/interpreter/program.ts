// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { ge235Charset, CR, EOM } from '../charset';
import { MAX_LINES, MAX_LINE_NUMBER } from '../tokenizer';
import { CompileError, type CompileFault } from './errors';
import { deleteBlanks, lexBody, type Lexeme } from './lex';

export interface BasicLine {
  lineNo: number;
  lexemes: readonly Lexeme[];
}

export interface Program {
  lines: BasicLine[];
  /** Line number -> index into {@link lines}, for GOTO/GOSUB resolution. */
  index: Map<number, number>;
  /** Everything the compiler found wrong while reading the tape. */
  faults: CompileFault[];
}

/**
 * Read a paper tape into lines the executor can walk.
 *
 * The tape is BCD codes with a carriage return after each line and an
 * end-of-message code closing it, so this is the tokenizer's inverse plus the
 * lexing the compiler did in the same pass. Faults are collected rather than
 * thrown, because the compiler listed every line it could not read before
 * refusing to run the program - one message per line, not the first one only.
 *
 * A `REM` line is not lexed past its keyword: the comment text is prose, and
 * the compiler stopped reading the line as soon as it recognised the word.
 */
export function parseProgram(image: Uint8Array): Program {
  const lines: BasicLine[] = [];
  const index = new Map<number, number>();
  const faults: CompileFault[] = [];

  for (const record of records(image)) {
    const text = ge235Charset.toUnicode(record);
    if (text.trim() === '') continue; // blank paper between records
    const match = /^\s*(\d+)(.*)$/.exec(text);
    if (!match) {
      faults.push({ code: 'ILLEGAL_INSTRUCTION' });
      continue;
    }
    const lineNo = Number(match[1]);
    if (lineNo > MAX_LINE_NUMBER) {
      faults.push({ code: 'ILLEGAL_NUMBER', line: lineNo });
      continue;
    }

    const body = deleteBlanks(match[2]!);
    if (body === '') {
      faults.push({ code: 'ILLEGAL_INSTRUCTION', line: lineNo });
      continue;
    }

    let lexemes: readonly Lexeme[];
    if (body.startsWith('REM')) {
      lexemes = [{ kind: 'kw', word: 'REM' }];
    } else {
      try {
        lexemes = lexBody(body);
      } catch (e) {
        if (!(e instanceof CompileError)) throw e;
        faults.push({ code: e.code, line: lineNo });
        continue;
      }
    }

    index.set(lineNo, lines.length);
    lines.push({ lineNo, lexemes });
  }

  if (lines.length > MAX_LINES) {
    faults.push({ code: 'PROGRAM_TOO_LONG', line: lines[MAX_LINES]!.lineNo });
  }
  return { lines, index, faults };
}

/** The tape's line records: codes between carriage returns, up to end of message. */
function* records(image: Uint8Array): Generator<number[]> {
  let record: number[] = [];
  for (const byte of image) {
    const code = byte & 0o77;
    if (code === EOM) break;
    if (code === CR) {
      if (record.length > 0) yield record;
      record = [];
      continue;
    }
    record.push(code);
  }
  // A tape whose last line was never terminated still carries that line.
  if (record.length > 0) yield record;
}
