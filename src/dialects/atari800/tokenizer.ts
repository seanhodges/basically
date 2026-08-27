// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { CharsetError, type TokenizeError } from '../types';
import { lowerCaseKeywordMessage } from '../../editor/keywordCase';
import { atariCharset } from './charset';
import { isRepresentable, toAtariFloat } from './bcd';
import {
  ATARI_MAX_VARIABLES,
  ATARI_TOKENS,
  ATARI_VERBATIM,
  atariExpressions,
  atariStatements,
  type AtariKeyword,
} from './keywords';
import {
  buildAtariImage,
  MAX_LINE_NUMBER,
  type AtariLine,
  type AtariProgram,
  type AtariVariable,
  type AtariVariableKind,
} from './basfile';

/**
 * Atari BASIC's tokenizer: editor text to the pre-parsed image the ROM's `LOAD`
 * expects.
 *
 * Atari BASIC parses as it accepts a line rather than at run time, so this is a
 * parser and not a keyword substitution. Two consequences shape the code below.
 *
 * **The operator's byte depends on the parse, not the spelling.** `=` is one of
 * three tokens - comparison, numeric assignment, string assignment - and `(` is
 * one of six, depending on whether it opens a group, a function's argument, an
 * array or string subscript, or a `DIM`. So the scanner carries the state that
 * decides: whether an operand or an operator is due, what the last operand's
 * type was, and what each open bracket was opened by.
 *
 * **Variables are lifted out of the line.** A name is stored once in the
 * variable name table and referred to everywhere as `$80 + index`, which is why
 * a program may mention at most 128 of them. `A`, `A$` and `A(` are three
 * different entries, because the name table tags each with how it ends.
 *
 * Reserved words win over names, wherever the scanner is looking for one: the
 * ROM matches its table first, so `LETTER=1` assigns to `TER` and `FORCE=1` is
 * a `FOR` loop missing its `TO`. That is a real Atari BASIC trap rather than an
 * approximation here, and it is reproduced rather than smoothed over.
 */

/** Expression tokens the scanner emits by name rather than by table lookup. */
const T = {
  COMMA: 0x12,
  COLON: 0x14,
  SEMICOLON: 0x15,
  END_OF_STATEMENT: 0x16,
  ON_GOTO: 0x17,
  ON_GOSUB: 0x18,
  TO: 0x19,
  STEP: 0x1a,
  THEN: 0x1b,
  HASH: 0x1c,
  LE: 0x1d,
  NE: 0x1e,
  GE: 0x1f,
  LT: 0x20,
  GT: 0x21,
  EQ: 0x22,
  POWER: 0x23,
  MULTIPLY: 0x24,
  ADD: 0x25,
  SUBTRACT: 0x26,
  DIVIDE: 0x27,
  NOT: 0x28,
  OR: 0x29,
  AND: 0x2a,
  OPEN_GROUP: 0x2b,
  CLOSE: 0x2c,
  ASSIGN_NUMBER: 0x2d,
  ASSIGN_STRING: 0x2e,
  STRING_LE: 0x2f,
  STRING_NE: 0x30,
  STRING_GE: 0x31,
  STRING_LT: 0x32,
  STRING_GT: 0x33,
  STRING_EQ: 0x34,
  UNARY_PLUS: 0x35,
  UNARY_MINUS: 0x36,
  OPEN_STRING_SUBSCRIPT: 0x37,
  OPEN_ARRAY_SUBSCRIPT: 0x38,
  OPEN_ARRAY_DIM: 0x39,
  OPEN_FUNCTION: 0x3a,
  OPEN_STRING_DIM: 0x3b,
  COMMA_SUBSCRIPT: 0x3c,
} as const;

/** The relational operators, in both their numeric and their string forms. */
const RELATIONAL: { spelling: string; number: number; string: number }[] = [
  { spelling: '<=', number: T.LE, string: T.STRING_LE },
  { spelling: '<>', number: T.NE, string: T.STRING_NE },
  { spelling: '>=', number: T.GE, string: T.STRING_GE },
  { spelling: '<', number: T.LT, string: T.STRING_LT },
  { spelling: '>', number: T.GT, string: T.STRING_GT },
  { spelling: '=', number: T.EQ, string: T.STRING_EQ },
];

/** Single-character arithmetic operators. */
const ARITHMETIC: Record<string, number> = {
  '^': T.POWER,
  '*': T.MULTIPLY,
  '+': T.ADD,
  '-': T.SUBTRACT,
  '/': T.DIVIDE,
};

/** Longest spelling first, so `GO TO` is never read as `GOTO` plus a name. */
function byLengthDescending(a: AtariKeyword, b: AtariKeyword): number {
  return b.word.length - a.word.length;
}

const STATEMENT_WORDS = [...atariStatements].sort(byLengthDescending);
const FUNCTION_WORDS = atariExpressions
  .filter((k) => k.kind === 'function')
  .sort(byLengthDescending);

/** Words that may open an operand: the functions, plus the `NOT` prefix. */
const OPERAND_WORDS: { word: string; token: number; isFunction: boolean }[] = [
  ...FUNCTION_WORDS.map((k) => ({
    word: k.word,
    token: k.token,
    isFunction: true,
  })),
  { word: 'NOT', token: T.NOT, isFunction: false },
];

/** Words that may follow an operand: the infix words and the clause words. */
const OPERATOR_WORDS: { word: string; token: number }[] = [
  { word: 'AND', token: T.AND },
  { word: 'OR', token: T.OR },
  { word: 'THEN', token: T.THEN },
  { word: 'STEP', token: T.STEP },
  { word: 'TO', token: T.TO },
  { word: 'GOSUB', token: T.ON_GOSUB },
  { word: 'GOTO', token: T.ON_GOTO },
].sort((a, b) => b.word.length - a.word.length);

/** What an open bracket was opened by, which decides what a `,` inside it is. */
type BracketKind = 'group' | 'subscript';

const LETTER = /[A-Za-z]/;
const DIGIT = /[0-9]/;

/** One line of the editor's text, with the 1-based number the editor shows. */
interface SourceLine {
  text: string;
  editorLine: number;
}

/** Everything the scan of one program accumulates. */
class Program {
  readonly errors: TokenizeError[] = [];
  readonly variables: AtariVariable[] = [];
  private readonly index = new Map<string, number>();

  /** The token for a variable, interning it into the name table on first use. */
  variableToken(
    name: string,
    kind: AtariVariableKind,
    at: TokenizeError,
  ): number {
    const key = `${name} ${kind}`;
    const existing = this.index.get(key);
    if (existing !== undefined) return ATARI_TOKENS.VARIABLE_BASE + existing;

    if (this.variables.length >= ATARI_MAX_VARIABLES) {
      this.error({
        ...at,
        message: `Atari BASIC holds at most ${ATARI_MAX_VARIABLES} variables, and this program uses more`,
      });
      // Keep going on the last legal index: the count is what is wrong, and
      // reporting it once beats one error per later mention.
      return ATARI_TOKENS.VARIABLE_BASE + ATARI_MAX_VARIABLES - 1;
    }

    const slot = this.variables.length;
    this.index.set(key, slot);
    this.variables.push({ name, kind });
    return ATARI_TOKENS.VARIABLE_BASE + slot;
  }

  error(error: TokenizeError): void {
    this.errors.push(error);
  }
}

/**
 * The scanner for one source line: a cursor over its text, plus the state the
 * ambiguous tokens are resolved from.
 */
class LineScanner {
  private at = 0;
  /** True while an operand is due, which is what makes `-` unary. */
  private wantOperand = true;
  /** The type of the operand just read, which picks a relational's form. */
  private lastOperand: 'number' | 'string' | null = null;
  /** The `(` tokens still open, innermost last. */
  private readonly brackets: BracketKind[] = [];
  /** True inside DIM/COM, where `(` declares rather than subscripts. */
  private dimensioning = false;
  /**
   * What ended the statement, when something other than running out of line
   * did. Tracked rather than read back off the last byte, because a string
   * constant may perfectly well end with the colon token's own value.
   */
  private closedBy: 'colon' | 'then' | null = null;

  constructor(
    private readonly line: SourceLine,
    private readonly program: Program,
  ) {}

  private get text(): string {
    return this.line.text;
  }

  private fail(message: string, column = this.at, fatal = true): void {
    this.program.error({
      line: this.line.editorLine,
      column,
      message,
      ...(fatal ? {} : { fatal: false }),
    });
  }

  private skipSpaces(): void {
    while (this.at < this.text.length && this.text[this.at] === ' ') this.at++;
  }

  private get done(): boolean {
    this.skipSpaces();
    return this.at >= this.text.length;
  }

  /** The keyword matching here, longest first, or null. Advances on a match. */
  private takeWord<K extends { word: string }>(
    candidates: readonly K[],
  ): K | null {
    this.skipSpaces();
    const ahead = this.text.slice(this.at);
    for (const candidate of candidates) {
      if (ahead.startsWith(candidate.word)) {
        this.at += candidate.word.length;
        return candidate;
      }
      // A lower-case spelling reaches the ROM's scan as a name, so the program
      // will not do what its author meant. Tokenize it anyway and say so - but
      // only where the run *is* the word: `int1` is a name someone chose, not a
      // lower-case INT, and reading it as one would change a working program.
      const typed = ahead.slice(0, candidate.word.length);
      if (
        candidate.word.length > 1 &&
        typed.toUpperCase() === candidate.word &&
        !/[A-Za-z0-9]/.test(ahead[candidate.word.length] ?? '')
      ) {
        this.fail(lowerCaseKeywordMessage(typed, 'Atari'), this.at, false);
        this.at += candidate.word.length;
        return candidate;
      }
    }
    return null;
  }

  /** The line number this line opens with, or null when it has none. */
  takeLineNumber(): number | null {
    this.skipSpaces();
    const start = this.at;
    while (this.at < this.text.length && DIGIT.test(this.text[this.at]!)) {
      this.at++;
    }
    if (this.at === start) return null;
    return Number(this.text.slice(start, this.at));
  }

  /** Everything left on the line, as ATASCII - what REM and DATA store. */
  private takeRestOfLine(): number[] {
    const rest = this.text.slice(this.at);
    this.at = this.text.length;
    try {
      return [...atariCharset.toMachine(rest)];
    } catch (e) {
      const column = e instanceof CharsetError ? e.index : undefined;
      this.fail(
        e instanceof Error ? e.message : String(e),
        (column ?? 0) + this.text.length - rest.length,
      );
      return [];
    }
  }

  /** The statements this line holds, each with its terminator. */
  statements(): Uint8Array[] {
    const out: Uint8Array[] = [];
    while (!this.done) {
      // A statement stops at a colon or at the end of the line; either way the
      // loop picks the next one up, so nothing else consumes the separator.
      const before = this.at;
      out.push(Uint8Array.from(this.statement()));
      // Every path through `statement` either consumes text or runs to the end
      // of the line. If one ever stops doing that, stop here rather than spin.
      if (this.at === before) break;
    }
    return out;
  }

  /** One statement's tokens, terminator included. */
  private statement(): number[] {
    this.reset();
    const out: number[] = [];
    const keyword = this.takeWord(STATEMENT_WORDS);

    if (keyword === null) {
      // No reserved word here, so this is an assignment written without LET.
      out.push(ATARI_TOKENS.IMPLIED_LET);
      this.assignment(out);
      return this.terminate(out);
    }

    out.push(keyword.token);

    if (ATARI_VERBATIM.has(keyword.word)) {
      // REM and DATA store the rest of the line as characters, and carry no
      // terminator: the line's own length byte says where they stop. A colon
      // inside either is therefore data, not a statement separator.
      out.push(...this.takeRestOfLine());
      return out;
    }
    if (keyword.word === 'LET' || keyword.word === 'FOR') {
      // FOR's `=` assigns its control variable, so it carries the assignment
      // token; `expression` then picks the line up at TO.
      this.assignment(out);
      return this.terminate(out);
    }
    if (keyword.word === 'DIM' || keyword.word === 'COM') {
      this.dimensioning = true;
    }

    this.expression(out);
    return this.terminate(out);
  }

  private reset(): void {
    this.wantOperand = true;
    this.lastOperand = null;
    this.brackets.length = 0;
    this.dimensioning = false;
    this.closedBy = null;
  }

  /** A `target = value` assignment, target already unread. */
  private assignment(out: number[]): void {
    const target = this.operandWord(out);
    if (target === null) {
      this.fail('Expected a variable to assign to');
      this.at = this.text.length;
      return;
    }
    this.skipSpaces();
    if (this.text[this.at] !== '=') {
      this.fail('Expected = in an assignment');
      this.at = this.text.length;
      return;
    }
    this.at++;
    out.push(target === 'string' ? T.ASSIGN_STRING : T.ASSIGN_NUMBER);
    this.wantOperand = true;
    this.lastOperand = null;
    this.expression(out);
  }

  /**
   * The assignment target: a variable, with its subscript when it has one.
   * Returns the type assigned to, or null when no variable is there.
   */
  private operandWord(out: number[]): 'number' | 'string' | null {
    this.skipSpaces();
    const name = this.peekName();
    if (name === null) return null;
    this.at += name.length;

    const kind = this.nameKind();
    out.push(this.token(name, kind));
    if (kind === 'number') return 'number';

    // A subscripted target - `A$(3)` or `A(2,3)` - takes its brackets here, so
    // the `=` that follows is the assignment rather than a comparison inside.
    this.skipSpaces();
    if (this.text[this.at] === '(') {
      this.at++;
      out.push(
        kind === 'string' ? T.OPEN_STRING_SUBSCRIPT : T.OPEN_ARRAY_SUBSCRIPT,
      );
      this.brackets.push('subscript');
      this.wantOperand = true;
      this.subscript(out);
    }
    return kind === 'string' ? 'string' : 'number';
  }

  /** Scan up to and including the `)` that closes the subscript just opened. */
  private subscript(out: number[]): void {
    const depth = this.brackets.length;
    while (this.brackets.length >= depth && !this.done) {
      if (!this.step(out)) return;
    }
  }

  /** The name starting here, or null. Does not advance. */
  private peekName(): string | null {
    this.skipSpaces();
    if (!LETTER.test(this.text[this.at] ?? '')) return null;
    let end = this.at;
    while (end < this.text.length && /[A-Za-z0-9]/.test(this.text[end]!)) end++;
    return this.text.slice(this.at, end);
  }

  /** Which of the three name-table shapes the name just read has; consumes `$`. */
  private nameKind(): AtariVariableKind {
    if (this.text[this.at] === '$') {
      this.at++;
      return 'string';
    }
    // `(` decides between a scalar and an array, and stays unread: whoever
    // called needs it to choose the bracket's own token.
    let ahead = this.at;
    while (this.text[ahead] === ' ') ahead++;
    return this.text[ahead] === '(' ? 'array' : 'number';
  }

  private token(name: string, kind: AtariVariableKind): number {
    return this.program.variableToken(name.toUpperCase(), kind, {
      line: this.line.editorLine,
      column: this.at,
      message: '',
    });
  }

  /** Scan tokens until the statement ends. */
  private expression(out: number[]): void {
    while (!this.done) {
      if (!this.step(out)) return;
    }
  }

  /**
   * One token. Returns false when the statement is over - a colon at the top
   * level, or a `THEN` with a statement rather than a line number after it.
   */
  private step(out: number[]): boolean {
    this.skipSpaces();
    const ch = this.text[this.at]!;

    if (ch === ':' && this.brackets.length === 0) {
      this.at++;
      out.push(T.COLON);
      this.closedBy = 'colon';
      return false;
    }

    if (ch === '"') return this.stringConstant(out);
    if (
      DIGIT.test(ch) ||
      (ch === '.' && DIGIT.test(this.text[this.at + 1] ?? ''))
    )
      return this.numberConstant(out);
    if (LETTER.test(ch)) return this.word(out);
    return this.symbol(out);
  }

  private stringConstant(out: number[]): boolean {
    const open = this.at;
    this.at++;
    let end = this.text.indexOf('"', this.at);
    if (end < 0) {
      // The ROM closes an unterminated string at the end of the line rather
      // than refusing it, so a listing that relies on that still loads.
      end = this.text.length;
      this.fail('String has no closing quote', open, false);
    }
    const body = this.text.slice(this.at, end);
    let bytes: Uint8Array;
    try {
      bytes = atariCharset.toMachine(body);
    } catch (e) {
      const column = e instanceof CharsetError ? this.at + e.index : open;
      this.fail(e instanceof Error ? e.message : String(e), column);
      bytes = new Uint8Array(0);
    }
    if (bytes.length > 0xff) {
      this.fail('String constant is longer than 255 characters', open);
      bytes = bytes.slice(0, 0xff);
    }
    out.push(ATARI_TOKENS.STRING_CONSTANT, bytes.length, ...bytes);
    this.at = Math.min(end + 1, this.text.length);
    this.wantOperand = false;
    this.lastOperand = 'string';
    return true;
  }

  private numberConstant(out: number[]): boolean {
    const start = this.at;
    while (DIGIT.test(this.text[this.at] ?? '')) this.at++;
    if (this.text[this.at] === '.') {
      this.at++;
      while (DIGIT.test(this.text[this.at] ?? '')) this.at++;
    }
    if (this.text[this.at] === 'E' || this.text[this.at] === 'e') {
      const mark = this.at;
      this.at++;
      if (this.text[this.at] === '+' || this.text[this.at] === '-') this.at++;
      if (DIGIT.test(this.text[this.at] ?? '')) {
        while (DIGIT.test(this.text[this.at] ?? '')) this.at++;
      } else {
        // Not an exponent after all - `1E` is `1` and a variable called E.
        this.at = mark;
      }
    }
    const value = Number(this.text.slice(start, this.at));
    if (!isRepresentable(value)) {
      this.fail(
        `${this.text.slice(start, this.at)} is outside Atari BASIC's number range`,
        start,
      );
      out.push(ATARI_TOKENS.NUMERIC_CONSTANT, 0, 0, 0, 0, 0, 0);
    } else {
      out.push(ATARI_TOKENS.NUMERIC_CONSTANT, ...toAtariFloat(value));
    }
    this.wantOperand = false;
    this.lastOperand = 'number';
    return true;
  }

  /** A reserved word or a variable name. */
  private word(out: number[]): boolean {
    if (this.wantOperand) {
      const operand = this.takeWord(OPERAND_WORDS);
      if (operand !== null) {
        out.push(operand.token);
        if (operand.isFunction) {
          this.skipSpaces();
          if (this.text[this.at] === '(') {
            this.at++;
            out.push(T.OPEN_FUNCTION);
            this.brackets.push('group');
          }
          // The type a function yields is what its spelling ends with.
          this.lastOperand = operand.word.endsWith('$') ? 'string' : 'number';
          this.wantOperand = true;
          return true;
        }
        this.wantOperand = true;
        return true;
      }
      return this.variable(out);
    }

    const operator = this.takeWord(OPERATOR_WORDS);
    if (operator === null) {
      // Two operands with nothing between them: the ROM stops here, so do we.
      this.fail(`Expected an operator before ${this.peekName() ?? 'this'}`);
      this.at = this.text.length;
      return false;
    }
    out.push(operator.token);
    this.wantOperand = true;
    this.lastOperand = null;
    // `THEN` followed by anything but a line number ends the IF statement: what
    // comes after is a statement of its own, with its own record in the line.
    if (operator.token === T.THEN && !this.lineNumberAhead()) {
      this.closedBy = 'then';
      return false;
    }
    return true;
  }

  /** Whether what follows is a bare line number and nothing else. */
  private lineNumberAhead(): boolean {
    let ahead = this.at;
    while (this.text[ahead] === ' ') ahead++;
    if (!DIGIT.test(this.text[ahead] ?? '')) return false;
    while (DIGIT.test(this.text[ahead] ?? '')) ahead++;
    while (this.text[ahead] === ' ') ahead++;
    return ahead >= this.text.length || this.text[ahead] === ':';
  }

  private variable(out: number[]): boolean {
    const name = this.peekName();
    if (name === null) {
      this.fail('Expected a value');
      this.at = this.text.length;
      return false;
    }
    this.at += name.length;
    const kind = this.nameKind();
    out.push(this.token(name, kind));

    if (kind === 'number') {
      this.wantOperand = false;
      this.lastOperand = 'number';
      return true;
    }

    this.skipSpaces();
    if (this.text[this.at] === '(') {
      this.at++;
      out.push(this.openSubscript(kind));
      this.brackets.push('subscript');
      this.wantOperand = true;
      this.lastOperand = null;
      return true;
    }
    // A bare `A$` with no subscript is the whole string.
    this.wantOperand = false;
    this.lastOperand = kind === 'string' ? 'string' : 'number';
    return true;
  }

  /** Which of the four subscript-opening brackets this `(` is. */
  private openSubscript(kind: AtariVariableKind): number {
    if (this.dimensioning) {
      return kind === 'string' ? T.OPEN_STRING_DIM : T.OPEN_ARRAY_DIM;
    }
    return kind === 'string' ? T.OPEN_STRING_SUBSCRIPT : T.OPEN_ARRAY_SUBSCRIPT;
  }

  private symbol(out: number[]): boolean {
    const ch = this.text[this.at]!;

    if (ch === '(') {
      this.at++;
      out.push(T.OPEN_GROUP);
      this.brackets.push('group');
      this.wantOperand = true;
      this.lastOperand = null;
      return true;
    }
    if (ch === ')') {
      this.at++;
      out.push(T.CLOSE);
      this.brackets.pop();
      this.wantOperand = false;
      return true;
    }
    if (ch === ',') {
      this.at++;
      out.push(
        this.brackets[this.brackets.length - 1] === 'subscript'
          ? T.COMMA_SUBSCRIPT
          : T.COMMA,
      );
      this.wantOperand = true;
      this.lastOperand = null;
      return true;
    }
    if (ch === ';') {
      this.at++;
      out.push(T.SEMICOLON);
      this.wantOperand = true;
      this.lastOperand = null;
      return true;
    }
    if (ch === '#') {
      this.at++;
      out.push(T.HASH);
      this.wantOperand = true;
      return true;
    }

    if (this.wantOperand && (ch === '+' || ch === '-')) {
      this.at++;
      out.push(ch === '+' ? T.UNARY_PLUS : T.UNARY_MINUS);
      return true;
    }

    for (const relational of RELATIONAL) {
      if (this.text.startsWith(relational.spelling, this.at)) {
        this.at += relational.spelling.length;
        out.push(
          this.lastOperand === 'string' ? relational.string : relational.number,
        );
        this.wantOperand = true;
        this.lastOperand = null;
        return true;
      }
    }

    const arithmetic = ARITHMETIC[ch];
    if (arithmetic !== undefined) {
      this.at++;
      out.push(arithmetic);
      this.wantOperand = true;
      this.lastOperand = null;
      return true;
    }

    this.fail(`Atari BASIC has no ${JSON.stringify(ch)} here`);
    this.at = this.text.length;
    return false;
  }

  /**
   * Close a statement with the end-of-statement token, unless something else
   * already closed it - the colon that separates two statements, or the `THEN`
   * that hands the rest of the line to a statement of its own.
   */
  private terminate(out: number[]): number[] {
    if (this.closedBy === null) out.push(T.END_OF_STATEMENT);
    return out;
  }
}

/** What {@link tokenizeProgram} produces. */
export interface AtariTokenizeResult {
  /** The full `.BAS` image, header and all. */
  image: Uint8Array;
  /** The bytes the image occupies in the machine's RAM (the image less its header). */
  programBytes: Uint8Array;
  errors: TokenizeError[];
}

/** Tokenize `source` into the image Atari BASIC's `LOAD` reads. */
export function tokenizeProgram(source: string): AtariTokenizeResult {
  const program = new Program();
  const lines: AtariLine[] = [];
  const seen = new Set<number>();
  let previous = -1;

  const sourceLines = source.split(/\r\n|\r|\n/);
  for (let i = 0; i < sourceLines.length; i++) {
    const text = sourceLines[i]!;
    if (text.trim() === '') continue;
    const editorLine = i + 1;

    const scanner = new LineScanner({ text, editorLine }, program);
    const number = scanner.takeLineNumber();
    if (number === null) {
      program.error({
        line: editorLine,
        column: 0,
        message: 'Every Atari BASIC line needs a line number',
      });
      continue;
    }
    if (number < 0 || number > MAX_LINE_NUMBER) {
      program.error({
        line: editorLine,
        column: 0,
        message: `Line numbers run from 0 to ${MAX_LINE_NUMBER}`,
      });
      continue;
    }
    if (seen.has(number)) {
      program.error({
        line: editorLine,
        column: 0,
        message: `Line ${number} appears more than once`,
      });
    }
    if (number <= previous) {
      program.error({
        line: editorLine,
        column: 0,
        message: `Line ${number} is out of order`,
        fatal: false,
      });
    }
    seen.add(number);
    previous = number;

    lines.push({ number, statements: scanner.statements() });
  }

  const built: AtariProgram = { variables: program.variables, lines };
  const image = buildAtariImage(built);
  return {
    image,
    programBytes: image.slice(14),
    errors: program.errors,
  };
}
