// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { KeywordInfo } from '../../dialects/types';
import { CompileError } from './errors';

/**
 * One lexical unit of a line body.
 *
 * Unlike the tokenized dialects there is nothing to un-tokenize here: BASIC was
 * compiled on this machine, so a program is characters from the paper tape to
 * the end, and the compiler lexed them at `RUN`. This does the same over the
 * decoded text of a line.
 */
export type Lexeme =
  | { kind: 'kw'; word: string }
  | { kind: 'num'; value: number }
  | { kind: 'str'; value: string }
  | { kind: 'name'; name: string }
  | { kind: 'punct'; ch: string };

/**
 * A string variable's name carries its own `$`, so `A$` and `A` are two
 * different names and every table keyed by name - the scalars, the vectors, a
 * `READ` target - separates the two types without a second field to carry.
 */
export function isStringName(name: string): boolean {
  return name.endsWith('$');
}

/** A name with its type marker removed, which is what a subscript rule reads. */
export function baseName(name: string): string {
  return isStringName(name) ? name.slice(0, -1) : name;
}

/** Every keyword, longest first, so `RETURN` is never read as `REM` + junk. */
export function keywordWords(
  keywords: readonly KeywordInfo[],
): readonly string[] {
  return keywords.map((k) => k.word).sort((a, b) => b.length - a.length);
}

const DIGIT = /[0-9]/;
const LETTER = /[A-Z]/;

/**
 * Delete every blank outside a string literal, which is what the compiler's own
 * reader does before anything looks at the line. It is why `P R I N T` is
 * PRINT, `GO TO` is GOTO and `FORI=1TO10` is a loop, and it is also why the
 * lexer below can match a keyword anywhere without worrying about what
 * separates it from its neighbour.
 */
export function deleteBlanks(text: string): string {
  let out = '';
  let inString = false;
  for (const ch of text) {
    if (ch === '"') inString = !inString;
    if (ch === ' ' && !inString) continue;
    out += ch;
  }
  return out;
}

/**
 * Lex one line body, blanks already deleted.
 *
 * A variable is one letter and at most one digit, so a name is never long
 * enough to swallow a keyword and a keyword can be matched greedily wherever it
 * appears. A second digit is the compiler's own "bad variable": `A1` is a
 * variable and `A12` is nothing at all.
 *
 * `words` is the machine's vocabulary as {@link keywordWords} orders it, which
 * is what decides where a keyword ends and a name begins.
 *
 * `strings` opens the one place the two editions lex differently: a `$` after a
 * name makes it a string variable, and a machine without strings has no reading
 * of the character at all. Section 2.7: "Any ordinary variable followed by a $
 * (dollar sign) will stand for a string", so the one-letter-plus-optional-digit
 * rule carries over unchanged and the marker is simply appended to the name.
 */
export function lexBody(
  body: string,
  words: readonly string[],
  strings = false,
): Lexeme[] {
  const out: Lexeme[] = [];
  let i = 0;
  while (i < body.length) {
    const ch = body[i]!;

    if (ch === '"') {
      let s = '';
      i++;
      while (i < body.length && body[i] !== '"') s += body[i++]!;
      if (i >= body.length) throw new CompileError('INCORRECT_FORMAT');
      i++; // closing quote
      out.push({ kind: 'str', value: s });
      continue;
    }

    if (DIGIT.test(ch) || (ch === '.' && DIGIT.test(body[i + 1] ?? ''))) {
      const start = i;
      while (i < body.length && DIGIT.test(body[i]!)) i++;
      if (body[i] === '.') {
        i++;
        while (i < body.length && DIGIT.test(body[i]!)) i++;
      }
      // `1E6` is a constant, not the variable E6: nothing may follow a number
      // but an operator, so a letter here can only be the exponent marker.
      if (body[i] === 'E' && /[0-9+-]/.test(body[i + 1] ?? '')) {
        i++;
        if (body[i] === '+' || body[i] === '-') i++;
        if (!DIGIT.test(body[i] ?? ''))
          throw new CompileError('ILLEGAL_CONSTANT');
        while (i < body.length && DIGIT.test(body[i]!)) i++;
      }
      const value = Number(body.slice(start, i));
      if (!Number.isFinite(value)) throw new CompileError('ILLEGAL_CONSTANT');
      out.push({ kind: 'num', value });
      continue;
    }

    if (LETTER.test(ch)) {
      const word = words.find((w) => body.startsWith(w, i));
      if (word !== undefined) {
        out.push({ kind: 'kw', word });
        i += word.length;
        continue;
      }
      let name = ch;
      i++;
      if (DIGIT.test(body[i] ?? '')) name += body[i++]!;
      if (DIGIT.test(body[i] ?? '')) throw new CompileError('ILLEGAL_VARIABLE');
      if (strings && body[i] === '$') {
        name += body[i++]!;
      }
      out.push({ kind: 'name', name });
      continue;
    }

    // `(` and `[` are the same bracket to the compiler, and so are their
    // closers, so a subscript may be written either way and even mixed.
    const normalised = ch === '[' ? '(' : ch === ']' ? ')' : ch;
    out.push({ kind: 'punct', ch: normalised });
    i++;
  }
  return out;
}

/** Mutable cursor over a line's lexemes, shared by the executor and evaluator. */
export class Stream {
  pos = 0;
  constructor(public readonly lx: readonly Lexeme[]) {}

  eof(): boolean {
    return this.pos >= this.lx.length;
  }
  peek(): Lexeme | undefined {
    return this.lx[this.pos];
  }
  advance(): Lexeme | undefined {
    return this.lx[this.pos++];
  }
  /** The keyword at the cursor, or undefined if the cursor is not on one. */
  peekKw(): string | undefined {
    const t = this.lx[this.pos];
    return t?.kind === 'kw' ? t.word : undefined;
  }
  /** Consume the next lexeme iff it is the given keyword. */
  eatKw(word: string): boolean {
    if (this.peekKw() === word) {
      this.pos++;
      return true;
    }
    return false;
  }
  peekPunct(): string | undefined {
    const t = this.lx[this.pos];
    return t?.kind === 'punct' ? t.ch : undefined;
  }
  eatPunct(ch: string): boolean {
    if (this.peekPunct() === ch) {
      this.pos++;
      return true;
    }
    return false;
  }
}
