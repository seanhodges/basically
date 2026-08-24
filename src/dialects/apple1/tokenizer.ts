// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { CharsetError, type TokenizeError } from '../types';
import { parseChar } from './charset';
import {
  APPLE1_DIRECT_ONLY,
  APPLE1_NONFUNCTIONAL,
  CONST_INTRO_BASE,
  T,
} from './keywords';
import { MAX_INT, MAX_LINE, MAX_LINE_BYTES } from './addresses';

export interface TokenizedProgram {
  /**
   * The tokenized program exactly as it sits in RAM: one record per line, in
   * ascending line-number order, each `[length][lineNo lo][lineNo hi][tokens]
   * [0x01]` with the length counting its own byte. There is no link field and no
   * terminator - the program's extent is the gap between the zero-page pointers
   * PP and HIMEM, and it is stored at the *top* of the workspace, so this block
   * loads at `HIMEM - program.length`.
   */
  program: Uint8Array;
  errors: TokenizeError[];
}

/** What an expression evaluated to, which decides several tokens' bytes. */
type ValueType = 'num' | 'str';

/** Statement keywords, tried in this order at the start of a statement. */
const STATEMENT_WORDS = [
  'RETURN',
  'GOSUB',
  'PRINT',
  'INPUT',
  'GOTO',
  'NEXT',
  'POKE',
  'CALL',
  'DIM',
  'END',
  'FOR',
  'REM',
  'TAB',
  'LET',
  'IF',
] as const;

/** Functions, tried before a variable name at the start of an operand. */
const FUNCTION_TOKENS: Record<string, number> = {
  PEEK: T.PEEK,
  RND: T.RND,
  SGN: T.SGN,
  ABS: T.ABS,
};

/** Symbolic binary operators, longest spelling first. */
const BINARY_OPS: [string, number][] = [
  ['<=', T.LE],
  ['>=', T.GE],
  ['<>', T.NE_ANGLE],
  ['*', T.MUL],
  ['/', T.DIV],
  ['+', T.ADD],
  ['-', T.SUB],
  ['<', T.LT],
  ['>', T.GT],
  ['=', T.EQ],
  ['#', T.NE_HASH],
];

/** Thrown to abandon the current line; the error is already recorded. */
class LineError extends Error {}

/**
 * One line's parser.
 *
 * Integer BASIC tokenizes **on entry**, and the token it picks for a keyword
 * depends on the grammar rule that matched it - `PRINT` has three bytes, `,` has
 * eight - so this is a recursive-descent parser rather than a keyword scanner.
 * Operators are emitted in source order: precedence is resolved at run time by
 * the interpreter's own precedence stack, so `-(1+2)*3 MOD 4` is stored exactly
 * as it reads.
 *
 * Spaces are skipped everywhere outside a string literal and a REM body, which
 * is why `FORI=1TO10` stores as FOR I = 1 TO 10 (read back off the machine).
 */
class LineParser {
  private pos = 0;
  private out: number[] = [];

  constructor(
    private readonly body: string,
    private readonly editorLine: number,
    private readonly bodyCol: number,
    private readonly errors: TokenizeError[],
  ) {}

  // -- source access --------------------------------------------------------

  private skipSpaces(): void {
    while (this.body[this.pos] === ' ' || this.body[this.pos] === '\t')
      this.pos++;
  }

  private peek(): string | undefined {
    this.skipSpaces();
    return this.body[this.pos];
  }

  private atEnd(): boolean {
    return this.peek() === undefined;
  }

  /** Consume `text` (case-insensitively) if it sits at the cursor. */
  private eat(text: string): boolean {
    this.skipSpaces();
    const slice = this.body.substr(this.pos, text.length);
    if (slice.toUpperCase() !== text) return false;
    this.pos += text.length;
    return true;
  }

  /** Record an error at the cursor and abandon the line. */
  private fail(message: string, from = this.pos): never {
    this.errors.push({
      line: this.editorLine,
      column: this.bodyCol + from,
      endColumn: this.bodyCol + Math.max(from + 1, this.pos),
      message,
    });
    throw new LineError(message);
  }

  private expect(text: string, what = text): void {
    if (!this.eat(text)) this.fail(`Expected ${what}`);
  }

  // -- emitting -------------------------------------------------------------

  private emit(...bytes: number[]): void {
    this.out.push(...bytes);
  }

  /** Run `fn` with a fresh output buffer and return what it wrote. */
  private capture<R>(fn: () => R): { bytes: number[]; value: R } {
    const saved = this.out;
    this.out = [];
    try {
      const value = fn();
      return { bytes: this.out, value };
    } finally {
      this.out = saved;
    }
  }

  // -- literals -------------------------------------------------------------

  /**
   * An unsigned integer constant: the ASCII of its first digit with bit 7 set,
   * then the value little-endian. `A=007` really does store `B0 07 00` - the
   * introducing byte is the digit as typed, not a fixed marker.
   */
  private emitConstant(): void {
    this.skipSpaces();
    const start = this.pos;
    let digits = '';
    while (/[0-9]/.test(this.body[this.pos] ?? ''))
      digits += this.body[this.pos++];
    if (!digits) this.fail('Expected a number', start);
    const value = Number(digits);
    if (value > MAX_INT) {
      this.fail(
        `${digits} is over ${MAX_INT}; Integer BASIC has no larger number`,
        start,
      );
    }
    this.emit(
      CONST_INTRO_BASE + Number(digits[0]),
      value & 0xff,
      (value >> 8) & 0xff,
    );
  }

  /** A string literal: an opening token, the characters, a closing token. */
  private emitStringLiteral(): void {
    const start = this.pos;
    this.expect('"', 'an opening quote');
    this.emit(T.QUOTE_OPEN);
    for (;;) {
      const ch = this.body[this.pos];
      if (ch === undefined) this.fail('Unterminated string literal', start);
      if (ch === '"') {
        this.pos++;
        this.emit(T.QUOTE_CLOSE);
        return;
      }
      try {
        const { code, length } = parseChar(this.body, this.pos);
        this.emit(code);
        this.pos += length;
      } catch (e) {
        if (!(e instanceof CharsetError)) throw e;
        this.fail(e.message);
      }
    }
  }

  // -- names ----------------------------------------------------------------

  /**
   * A variable name: **one letter, optionally one digit**, optionally `$`.
   *
   * That really is the whole rule, and it is the tightest naming in the project.
   * Read off the machine: `A1=3` is stored, while `AB=2`, `ABC=4`, `A12=1` and
   * `A1$="X"` each answer `*** SYNTAX ERR`. The interpreter identifies a
   * variable by exactly two bytes - the letter and the digit (or 0) - and a
   * string's `$` is stored as token `$40` rather than as a character, which is
   * why a string name has no room for a digit.
   */
  private readName(): { chars: number[]; type: ValueType } {
    this.skipSpaces();
    const start = this.pos;
    const letter = (this.body[this.pos] ?? '').toUpperCase();
    if (!/^[A-Z]$/.test(letter)) this.fail('Expected a variable name', start);
    this.pos++;
    const chars = [letter.charCodeAt(0) | 0x80];
    const digit = this.body[this.pos] ?? '';
    if (/[0-9]/.test(digit)) {
      this.pos++;
      chars.push(digit.charCodeAt(0) | 0x80);
      // A second digit would be a third significant byte the interpreter never
      // reads, so it is rejected here exactly as the machine rejects it - and a
      // `$` after the digit for the same reason, which is why a string variable
      // is a bare letter: `A1$="X"` is *** SYNTAX ERR on the machine.
      if (/[0-9A-Za-z$]/.test(this.body[this.pos] ?? '')) {
        this.fail(
          'An Apple I variable name is one letter and at most one digit',
          start,
        );
      }
      return { chars, type: 'num' };
    }
    if (/[A-Za-z]/.test(this.body[this.pos] ?? '')) {
      this.fail(
        'An Apple I variable name is one letter and at most one digit',
        start,
      );
    }
    if (this.body[this.pos] === '$') {
      this.pos++;
      chars.push(T.DOLLAR);
      return { chars, type: 'str' };
    }
    return { chars, type: 'num' };
  }

  // -- expressions ----------------------------------------------------------

  /**
   * One operand: a constant, a string literal, a parenthesised expression, a
   * unary operator, a function call, or a variable with its optional subscript.
   *
   * `unary` is false once one unary operator has been consumed. The grammar
   * allows exactly one - `A=NOT NOT 1` and `A=- -1` are both `*** SYNTAX ERR` on
   * the machine, while `A=-(-1)` is fine, because the parenthesis starts a fresh
   * expression.
   */
  private operand(unary = true): ValueType {
    const ch = this.peek();
    if (ch === undefined) this.fail('Expected an expression');
    if (ch === '"') {
      this.emitStringLiteral();
      return 'str';
    }
    if (/[0-9]/.test(ch)) {
      this.emitConstant();
      return 'num';
    }
    if (unary && this.eat('+')) {
      this.emit(T.POS);
      this.operand(false);
      return 'num';
    }
    if (unary && this.eat('-')) {
      this.emit(T.NEG);
      this.operand(false);
      return 'num';
    }
    if (this.eat('(')) {
      this.emit(T.LPAREN);
      this.expression();
      this.expect(')', 'a closing parenthesis');
      this.emit(T.RPAREN);
      return 'num';
    }
    if (unary && this.eat('NOT')) {
      this.emit(T.NOT);
      this.operand(false);
      return 'num';
    }
    // LEN carries its own opening parenthesis in a single token, so the `(` is
    // matched here and never emitted.
    if (this.eat('LEN')) {
      this.expect('(', 'LEN(');
      this.emit(T.LEN);
      this.expression();
      this.expect(')', 'a closing parenthesis');
      this.emit(T.RPAREN);
      return 'num';
    }
    for (const [word, token] of Object.entries(FUNCTION_TOKENS)) {
      if (this.eat(word)) {
        this.emit(token);
        this.expect('(', `${word}(`);
        this.emit(T.FN_LPAREN);
        this.expression();
        this.expect(')', 'a closing parenthesis');
        this.emit(T.RPAREN);
        return 'num';
      }
    }
    if (/^TAB/i.test(this.body.slice(this.pos))) {
      this.fail(
        'TAB is a statement on the Apple I, not a function: write TAB n on its own',
      );
    }
    if (
      !unary &&
      (ch === '+' || ch === '-' || /^NOT/i.test(this.body.slice(this.pos)))
    ) {
      this.fail(
        'Integer BASIC allows only one unary operator; parenthesise the operand',
      );
    }
    this.rejectNonFunctional();
    return this.variableOperand();
  }

  /** A variable reference, with an array subscript or a substring range. */
  private variableOperand(): ValueType {
    const { chars, type } = this.readName();
    this.emit(...chars);
    if (type === 'str') {
      if (this.eat('(')) {
        this.emit(T.SUBSTR_LPAREN);
        this.expression();
        if (this.eat(',')) {
          this.emit(T.SUBSTR_COMMA);
          this.expression();
        }
        this.expect(')', 'a closing parenthesis');
        this.emit(T.RPAREN);
      }
      return 'str';
    }
    if (this.eat('(')) {
      this.emit(T.ARRAY_LPAREN);
      this.expression();
      this.expect(')', 'a closing parenthesis');
      this.emit(T.RPAREN);
    }
    return 'num';
  }

  /**
   * A whole expression. Operators are emitted where they are written; the only
   * thing this has to decide is whether `=` and `#` are the numeric comparisons
   * or the string ones, which the left operand's type settles.
   */
  private expression(): ValueType {
    let type = this.operand();
    for (;;) {
      if (type === 'str') {
        if (this.eat('=')) {
          this.emit(T.STR_EQ);
          this.stringOperand();
          type = 'num';
          continue;
        }
        if (this.eat('#')) {
          this.emit(T.STR_NE);
          this.stringOperand();
          type = 'num';
          continue;
        }
        return type;
      }
      const named = this.eatNamedOperator();
      if (named !== null) {
        this.emit(named);
        this.operand();
        continue;
      }
      // `^` is in the syntax table and reaches no handler: a line carrying one
      // tokenizes, runs as far as the operator and never comes back, which is
      // worse than being told. Refused here rather than emitted, on the same
      // footing as the vestigial graphics words.
      if (this.body[this.pos] === '^') {
        this.fail(
          'The Apple I has no power operator: ^ is in the syntax table but reaches no handler, and a program using it hangs. Multiply, or loop',
        );
      }
      const symbol = BINARY_OPS.find(([text]) => this.eat(text));
      if (!symbol) return type;
      this.emit(symbol[1]);
      this.operand();
    }
  }

  /** AND / OR / MOD, which must be matched before a variable name would be. */
  private eatNamedOperator(): number | null {
    if (this.eat('AND')) return T.AND;
    if (this.eat('MOD')) return T.MOD;
    if (this.eat('OR')) return T.OR;
    return null;
  }

  private stringOperand(): void {
    const start = this.pos;
    if (this.operand() !== 'str')
      this.fail('Expected a string on both sides of the comparison', start);
  }

  // -- statements -----------------------------------------------------------

  /** Refuse a word the ROM parses but the machine cannot execute. */
  private rejectNonFunctional(): void {
    for (const word of Object.keys(APPLE1_NONFUNCTIONAL)) {
      const start = this.pos;
      if (this.eat(word)) {
        this.fail(APPLE1_NONFUNCTIONAL[word]!, start);
      }
    }
  }

  /** Refuse a command the interpreter takes only at the `>` prompt. */
  private rejectDirectOnly(): void {
    for (const word of APPLE1_DIRECT_ONLY) {
      const start = this.pos;
      if (this.eat(word)) {
        this.fail(
          `${word} is a direct-mode command; the Apple I refuses it inside a program line`,
          start,
        );
      }
    }
  }

  private statementEnds(): boolean {
    return this.atEnd() || this.peek() === ':';
  }

  private statement(): void {
    this.rejectDirectOnly();
    this.rejectNonFunctional();

    for (const word of STATEMENT_WORDS) {
      if (!this.eat(word)) continue;
      switch (word) {
        case 'REM':
          return this.remBody();
        case 'END':
          return this.emit(T.END);
        case 'RETURN':
          return this.emit(T.RETURN);
        case 'GOTO':
          this.emit(T.GOTO);
          this.expression();
          return;
        case 'GOSUB':
          this.emit(T.GOSUB);
          this.expression();
          return;
        case 'IF':
          return this.ifStatement();
        case 'FOR':
          return this.forStatement();
        case 'NEXT':
          return this.nextStatement();
        case 'PRINT':
          return this.printStatement();
        case 'INPUT':
          return this.inputStatement();
        case 'POKE':
          this.emit(T.POKE);
          this.expression();
          this.expect(',', "a comma between POKE's address and byte");
          this.emit(T.POKE_COMMA);
          this.expression();
          return;
        case 'CALL':
          this.emit(T.CALL);
          this.expression();
          return;
        case 'TAB':
          // TAB is a statement here, not a function: `TAB 5` moves the print
          // column, and `PRINT TAB(5)` is a syntax error on this machine.
          this.emit(T.TAB);
          this.expression();
          return;
        case 'DIM':
          return this.dimStatement();
        case 'LET':
          this.emit(T.LET);
          return this.assignment();
      }
    }
    this.assignment();
  }

  /** REM stores the rest of the line verbatim, spaces and colons included. */
  private remBody(): void {
    this.emit(T.REM);
    while (this.pos < this.body.length) {
      try {
        const { code, length } = parseChar(this.body, this.pos);
        this.emit(code);
        this.pos += length;
      } catch (e) {
        if (!(e instanceof CharsetError)) throw e;
        this.fail(e.message);
      }
    }
  }

  private ifStatement(): void {
    this.emit(T.IF);
    this.expression();
    this.expect('THEN', 'THEN');
    // `THEN 100` and `THEN GOTO 100` are different tokens: the first is the
    // interpreter's own jump form and takes a literal line number, the second a
    // whole statement.
    const next = this.peek();
    if (next !== undefined && /[0-9]/.test(next)) {
      this.emit(T.THEN_LINE);
      this.emitConstant();
      return;
    }
    this.emit(T.THEN_STMT);
    this.statement();
  }

  private forStatement(): void {
    this.emit(T.FOR);
    const { chars, type } = this.readName();
    if (type === 'str') this.fail('A FOR control variable must be numeric');
    this.emit(...chars);
    this.expect('=', "an '=' in the FOR header");
    this.emit(T.FOR_EQ);
    this.expression();
    this.expect('TO', 'TO');
    this.emit(T.TO);
    this.expression();
    if (this.eat('STEP')) {
      this.emit(T.STEP);
      this.expression();
    }
  }

  private nextStatement(): void {
    this.emit(T.NEXT);
    for (;;) {
      const { chars, type } = this.readName();
      if (type === 'str') this.fail('A NEXT control variable must be numeric');
      this.emit(...chars);
      if (!this.eat(',')) return;
      this.emit(T.NEXT_COMMA);
    }
  }

  /**
   * PRINT's tokens all name the type of the item that *follows* them - the
   * keyword itself names the first item's, each separator the next one's - so
   * every item is parsed into a buffer first and its token chosen afterwards.
   */
  private printStatement(): void {
    if (this.statementEnds()) return this.emit(T.PRINT);
    const first = this.capture(() => this.expression());
    this.emit(first.value === 'str' ? T.PRINT_STR : T.PRINT_NUM);
    this.emit(...first.bytes);
    for (;;) {
      const separator = this.eat(';') ? ';' : this.eat(',') ? ',' : null;
      if (separator === null) return;
      if (separator === ';' && this.statementEnds()) {
        // A trailing `;` suppresses the newline and ends the statement. A
        // trailing `,` has no token at all - the machine rejects `PRINT "X",`.
        this.emit(T.PRINT_SEMI_END);
        return;
      }
      const item = this.capture(() => this.expression());
      const isStr = item.value === 'str';
      this.emit(
        separator === ';'
          ? isStr
            ? T.PRINT_SEMI_STR
            : T.PRINT_SEMI_NUM
          : isStr
            ? T.PRINT_COMMA_STR
            : T.PRINT_COMMA_NUM,
      );
      this.emit(...item.bytes);
    }
  }

  private inputStatement(): void {
    if (this.peek() === '"') {
      const prompt = this.capture(() => this.emitStringLiteral());
      this.emit(T.INPUT_PROMPT);
      this.emit(...prompt.bytes);
      this.expect(',', 'a comma after the INPUT prompt');
      this.inputVariable(true);
    } else {
      const first = this.capture(() => this.inputTarget());
      this.emit(first.value === 'str' ? T.INPUT_STR : T.INPUT_NUM);
      this.emit(...first.bytes);
    }
    while (this.eat(',')) this.inputVariable(true);
  }

  /** One INPUT target, preceded by the comma token its type selects. */
  private inputVariable(withComma: boolean): void {
    const item = this.capture(() => this.inputTarget());
    if (withComma) {
      this.emit(item.value === 'str' ? T.INPUT_COMMA_STR : T.INPUT_COMMA_NUM);
    }
    this.emit(...item.bytes);
  }

  private inputTarget(): ValueType {
    return this.variableOperand();
  }

  /**
   * DIM's tokens follow PRINT's rule: the keyword names the first item's type
   * and each comma the next item's. Only one dimension is allowed - the machine
   * refuses `DIM Z(2,3)`.
   */
  private dimStatement(): void {
    const first = this.capture(() => this.dimItem());
    this.emit(first.value === 'str' ? T.DIM_STR : T.DIM_NUM);
    this.emit(...first.bytes);
    while (this.eat(',')) {
      const item = this.capture(() => this.dimItem());
      this.emit(item.value === 'str' ? T.DIM_COMMA_STR : T.DIM_COMMA_NUM);
      this.emit(...item.bytes);
    }
  }

  private dimItem(): ValueType {
    const { chars, type } = this.readName();
    this.emit(...chars);
    this.expect('(', 'a dimension in parentheses');
    this.emit(type === 'str' ? T.DIM_STR_LPAREN : T.DIM_NUM_LPAREN);
    this.expression();
    this.expect(')', 'a closing parenthesis');
    this.emit(T.RPAREN);
    return type;
  }

  private assignment(): void {
    const { chars, type } = this.readName();
    this.emit(...chars);
    if (type === 'str') {
      if (this.eat('(')) {
        // `A$(1)="Q"` overwrites from position 1. Only a single index is
        // allowed on the left - `A$(1,2)="Q"` is a syntax error on the machine.
        this.emit(T.STR_DEST_LPAREN);
        this.expression();
        this.expect(')', 'a closing parenthesis');
        this.emit(T.RPAREN);
      }
      this.expect('=', "an '=' in the assignment");
      this.emit(T.STR_ASSIGN);
      this.stringOperand();
      return;
    }
    if (this.eat('(')) {
      this.emit(T.ARRAY_LPAREN);
      this.expression();
      this.expect(')', 'a closing parenthesis');
      this.emit(T.RPAREN);
    }
    this.expect('=', "an '=' in the assignment");
    this.emit(T.NUM_ASSIGN);
    this.expression();
  }

  /** Parse the whole line body; returns the token bytes without the trailer. */
  parse(): number[] | null {
    try {
      for (;;) {
        this.statement();
        if (this.atEnd()) break;
        if (!this.eat(':')) this.fail('Unexpected text after the statement');
        this.emit(T.COLON);
        // A line may end on its separator; the machine stores nothing for it.
        if (this.atEnd()) break;
      }
      return this.out;
    } catch (e) {
      if (e instanceof LineError) return null;
      throw e;
    }
  }
}

interface LineRecord {
  lineNo: number;
  body: number[];
}

/**
 * Editor text -> the bytes Integer BASIC stores after entry.
 *
 * Per project convention this collects {@link TokenizeError}s rather than
 * throwing, with 1-based lines and 0-based columns. Every error here is fatal:
 * this machine's tokenizer is a parser, so a line it cannot parse has no byte
 * form at all, and there is no heuristic statement-shape lint to soften.
 *
 * Because the interpreter tokenizes on entry, the stored form *is* what `LIST`
 * prints back - so the round trip through {@link detokenizeProgram} is a real
 * equivalence rather than an approximation.
 */
export function tokenizeProgram(source: string): TokenizedProgram {
  const errors: TokenizeError[] = [];
  const records: LineRecord[] = [];
  let prevLineNo = -1;

  const lines = source.split('\n');
  for (let li = 0; li < lines.length; li++) {
    let raw = lines[li]!;
    if (raw.endsWith('\r')) raw = raw.slice(0, -1);
    if (raw.trim() === '') continue;
    const editorLine = li + 1;

    const m = /^(\s*)(\d+)(.*)$/.exec(raw);
    if (!m) {
      errors.push({
        line: editorLine,
        column: 0,
        message: 'Missing line number',
      });
      continue;
    }
    const lineNo = parseInt(m[2]!, 10);
    if (lineNo > MAX_LINE) {
      errors.push({
        line: editorLine,
        column: m[1]!.length,
        message: `Line number ${lineNo} out of range 0–${MAX_LINE}`,
      });
      continue;
    }
    if (lineNo <= prevLineNo) {
      errors.push({
        line: editorLine,
        column: m[1]!.length,
        message: `Line number ${lineNo} is not greater than the previous (${prevLineNo})`,
        fatal: false,
      });
    }
    prevLineNo = lineNo;

    const afterNumber = m[1]!.length + m[2]!.length;
    const rest = m[3]!;
    const lead = rest.length - rest.trimStart().length;
    const body = rest.slice(lead);
    const bodyCol = afterNumber + lead;

    // A line number with nothing after it deletes that line on the machine;
    // in a listing it is an empty line and stores nothing.
    if (body === '') continue;

    const parsed = new LineParser(body, editorLine, bodyCol, errors).parse();
    if (parsed === null) continue;

    const length = 1 + 2 + parsed.length + 1;
    if (length > MAX_LINE_BYTES) {
      errors.push({
        line: editorLine,
        column: m[1]!.length,
        message: `Line is ${length} bytes tokenized; the interpreter stores at most ${MAX_LINE_BYTES}`,
      });
      continue;
    }
    records.push({ lineNo, body: parsed });
  }

  const prog: number[] = [];
  for (const { lineNo, body } of records) {
    prog.push(1 + 2 + body.length + 1);
    prog.push(lineNo & 0xff, (lineNo >> 8) & 0xff);
    prog.push(...body, T.EOL);
  }

  return { program: Uint8Array.from(prog), errors };
}
