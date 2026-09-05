// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { CharsetError, type TokenizeError } from '../types';
import { parseChar } from './charset';
import {
  APPLE2_DIRECT_ONLY,
  APPLE2_NAME_BREAKERS,
  CONST_INTRO_BASE,
  T,
} from './keywords';
import { MAX_ENTRY_BYTES, MAX_INT, MAX_LINE } from './addresses';
import {
  parseDirectLine,
  workspaceFault,
  STOCK_WORKSPACE,
  type Workspace,
} from './directLine';

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
  /**
   * The workspace the listing asks for with `LOMEM:`/`HIMEM:`, or the stock
   * pair when it asks for nothing. Whoever builds an image passes this to
   * `buildBasicImage`, because the program is stored at the *top* of the
   * workspace: where it loads is a function of HIMEM, not of a base address.
   *
   * Always a workspace the machine could keep. Bounds it could not are a fatal
   * error and leave this at the stock pair, so that a caller building an image
   * from a program that failed to tokenize still gets a usable one.
   */
  workspace: Workspace;
}

/** What an expression evaluated to, which decides several tokens' bytes. */
type ValueType = 'num' | 'str';

/**
 * Statement keywords, tried in this order at the start of a statement.
 *
 * No entry here is a prefix of another, so the order is for reading rather than
 * for matching.
 */
const STATEMENT_WORDS = [
  'NOTRACE',
  'RETURN',
  'GOSUB',
  'COLOR=',
  'NODSP',
  'PRINT',
  'INPUT',
  'TRACE',
  'TEXT',
  'VTAB',
  'VLIN',
  'HLIN',
  'PLOT',
  'POKE',
  'CALL',
  'LIST',
  'NEXT',
  'GOTO',
  'END',
  'FOR',
  'REM',
  'TAB',
  'LET',
  'DIM',
  'DSP',
  'POP',
  'PR#',
  'IN#',
  'GR',
  'IF',
] as const;

/** Functions whose argument sits in a parenthesis of its own. */
const FUNCTION_TOKENS: Record<string, number> = {
  PEEK: T.PEEK,
  RND: T.RND,
  SGN: T.SGN,
  ABS: T.ABS,
  PDL: T.PDL,
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
  ['^', T.POW],
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
 * eleven - so this is a recursive-descent parser rather than a keyword scanner.
 * Operators are emitted in source order: precedence is resolved at run time by
 * the interpreter's own precedence stack, so `-(1+2)*3 MOD 4` is stored exactly
 * as it reads.
 *
 * Spaces are skipped everywhere outside a string literal and a REM body, which
 * is why `FORI=1TO10` stores as FOR I = 1 TO 10 and `PR INT 1` as PRINT 1 (both
 * read back off the machine).
 *
 * One divergence from the ROM, in the machine's favour and worth knowing: the
 * interpreter's grammar walk backtracks out of a statement rule that fails part
 * way through, so `PLOTX=1` - where `PLOT X` then wants a comma and does not
 * find one - is a variable called `PLOTX` there and a `PLOT` with a missing
 * comma here. Committing to the keyword is what lets the error name the comma;
 * the names it costs are the ones that open with `PLOT`, `POKE` or `DIM` and go
 * on to something else, and no listing has ever wanted one.
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

  /**
   * Consume `text` (case-insensitively) if it sits at the cursor, tolerating
   * spaces **inside** it as well as before it.
   *
   * The interpreter crunches on entry - it skips spaces everywhere outside a
   * string literal and a REM body - so `PR INT 1` really does store as PRINT 1
   * and `COLOR = 5` as `COLOR=5`, both read back off the machine. Matching each
   * character in turn is what reproduces that; matching the spelling as one
   * slice would refuse the spaced forms a printed listing is full of.
   */
  private eat(text: string): boolean {
    let p = this.pos;
    for (const c of text) {
      while (this.body[p] === ' ' || this.body[p] === '\t') p++;
      if ((this.body[p] ?? '').toUpperCase() !== c) return false;
      p++;
    }
    this.pos = p;
    return true;
  }

  /** Whether `word` sits at the cursor followed by `(`, without consuming it. */
  private looksLikeCall(word: string): boolean {
    const from = this.body.slice(this.pos).replace(/^[ \t]+/, '');
    if (from.slice(0, word.length).toUpperCase() !== word) return false;
    return from.slice(word.length).trimStart().startsWith('(');
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
      this.emitLiteralChar();
    }
  }

  /**
   * One character of a string literal or a REM body.
   *
   * A program stores literal characters with bit 7 set, and every byte below
   * `$80` is a token to the interpreter's execute loop - `$01` is the one that
   * ends the line - so the charset's inverse and flashing codes cannot go here
   * even though they are perfectly good screen bytes. Nor can they be typed:
   * the keyboard has no way to enter one.
   */
  private emitLiteralChar(): void {
    const start = this.pos;
    try {
      const { code, length } = parseChar(this.body, this.pos);
      if (code < 0x80) {
        this.pos += length;
        this.fail(
          'Inverse and flashing characters cannot go in a program line: a byte below $80 is a token there. POKE them to the text page instead',
          start,
        );
      }
      this.emit(code);
      this.pos += length;
    } catch (e) {
      if (!(e instanceof CharsetError)) throw e;
      this.fail(e.message, start);
    }
  }

  // -- names ----------------------------------------------------------------

  /**
   * A variable name: a letter, then letters and digits, then an optional `$`.
   *
   * Every character is significant - `LONGVARIABLENAME=1` stores all sixteen -
   * but the scan stops early on one of {@link APPLE2_NAME_BREAKERS}, because the
   * parser tries those seven words at every position after the first. That is
   * the machine's rule and not a simplification of it: `TOTAL` and `ANDY` are
   * variables (the word is at the first character, where the parser is not
   * looking for it) while `ATOM` is `A TO M` and `SCORE` is `SC OR E`, both
   * `*** SYNTAX ERR`. What that leaves here is a name ending sooner than the
   * writer meant, and whatever follows it failing to parse.
   */
  private readName(): { chars: number[]; type: ValueType } {
    this.skipSpaces();
    const start = this.pos;
    const letter = (this.body[this.pos] ?? '').toUpperCase();
    if (!/^[A-Z]$/.test(letter)) this.fail('Expected a variable name', start);
    this.pos++;
    const chars = [letter.charCodeAt(0) | 0x80];
    for (;;) {
      const ch = this.body[this.pos];
      if (ch === undefined || !/[0-9A-Za-z]/.test(ch)) break;
      if (this.breakerAt(this.pos)) break;
      chars.push(ch.toUpperCase().charCodeAt(0) | 0x80);
      this.pos++;
    }
    if (this.body[this.pos] === '$') {
      this.pos++;
      chars.push(T.DOLLAR);
      return { chars, type: 'str' };
    }
    return { chars, type: 'num' };
  }

  /** The name-breaking word starting at `at`, or null. */
  private breakerAt(at: number): string | null {
    const rest = this.body.slice(at).toUpperCase();
    return APPLE2_NAME_BREAKERS.find((w) => rest.startsWith(w)) ?? null;
  }

  // -- expressions ----------------------------------------------------------

  /**
   * One operand: a constant, a string literal, a parenthesised expression, a
   * unary operator, a function call, or a variable with its optional subscript.
   *
   * Unary operators stack, unlike on the Apple I: `A=NOT NOT 1` and `A=- -1`
   * are both stored (`37 37 …` and `36 36 …`) rather than refused.
   */
  private operand(): ValueType {
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
    if (this.eat('+')) {
      this.emit(T.POS);
      this.operand();
      return 'num';
    }
    if (this.eat('-')) {
      this.emit(T.NEG);
      this.operand();
      return 'num';
    }
    if (this.eat('(')) {
      this.emit(T.LPAREN);
      this.expression();
      this.expect(')', 'a closing parenthesis');
      this.emit(T.RPAREN);
      return 'num';
    }
    if (this.eat('NOT')) {
      this.emit(T.NOT);
      this.operand();
      return 'num';
    }
    // A function word not followed by `(` is a variable whose name starts with
    // it, which is what the machine makes of `A=PEEKX` and `A=LENX`.
    // LEN, ASC and SCRN carry their own opening parenthesis in a single token,
    // so the `(` is matched here and never emitted.
    for (const [word, token] of [
      ['LEN', T.LEN],
      ['ASC', T.ASC],
    ] as const) {
      if (!this.looksLikeCall(word)) continue;
      this.eat(word);
      this.expect('(', `${word}(`);
      this.emit(token);
      this.expression();
      this.expect(')', 'a closing parenthesis');
      this.emit(T.RPAREN);
      return 'num';
    }
    if (this.looksLikeCall('SCRN')) {
      this.eat('SCRN');
      this.expect('(', 'SCRN(');
      this.emit(T.SCRN);
      this.expression();
      this.expect(',', "a comma between SCRN's column and row");
      this.emit(T.SCRN_COMMA);
      this.expression();
      this.expect(')', 'a closing parenthesis');
      this.emit(T.RPAREN);
      return 'num';
    }
    for (const [word, token] of Object.entries(FUNCTION_TOKENS)) {
      if (!this.looksLikeCall(word)) continue;
      this.eat(word);
      this.emit(token);
      this.expect('(', `${word}(`);
      this.emit(T.FN_LPAREN);
      this.expression();
      this.expect(')', 'a closing parenthesis');
      this.emit(T.RPAREN);
      return 'num';
    }
    if (/^TAB\s*\(/i.test(this.body.slice(this.pos))) {
      this.fail(
        'TAB is a statement on this machine, not a function: write TAB n on its own',
      );
    }
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
        // There is no ordering on strings: `IF A$<B$` is *** SYNTAX ERR.
        const ordering = ['<=', '>=', '<>', '<', '>'].find((op) =>
          this.body.slice(this.pos).trimStart().startsWith(op),
        );
        if (ordering) {
          this.fail(
            `Strings compare only with = and #; there is no ${ordering} for them`,
          );
        }
        return type;
      }
      const named = this.eatNamedOperator();
      if (named !== null) {
        this.emit(named);
        this.operand();
        continue;
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

  /**
   * Refuse a command the interpreter takes only at the `>` prompt.
   *
   * The word has to end where it ends: these are not in the deferred grammar at
   * all, so `10 RUNS=1` is a variable called `RUNS` on the machine rather than a
   * misplaced `RUN`. The two spelled with a colon need no such check - nothing
   * can follow `LOMEM:` and still be one name.
   */
  private rejectDirectOnly(): void {
    for (const word of APPLE2_DIRECT_ONLY) {
      const start = this.pos;
      if (!this.eat(word)) continue;
      if (
        /[A-Z]$/.test(word) &&
        /[0-9A-Za-z]/.test(this.body[this.pos] ?? '')
      ) {
        this.pos = start;
        continue;
      }
      this.fail(
        `${word} is a prompt command; the Apple II refuses it inside a program line`,
        start,
      );
    }
  }

  private statementEnds(): boolean {
    return this.atEnd() || this.peek() === ':';
  }

  private statement(): void {
    this.rejectDirectOnly();

    for (const word of STATEMENT_WORDS) {
      if (!this.eat(word)) continue;
      switch (word) {
        case 'REM':
          return this.remBody();
        case 'END':
          return this.emit(T.END);
        case 'RETURN':
          return this.emit(T.RETURN);
        case 'GR':
          return this.emit(T.GR);
        case 'TEXT':
          return this.emit(T.TEXT);
        case 'POP':
          return this.emit(T.POP);
        case 'TRACE':
          return this.emit(T.TRACE);
        case 'NOTRACE':
          return this.emit(T.NOTRACE);
        case 'DSP':
          return this.traceVariable(T.DSP_STR, T.DSP_NUM);
        case 'NODSP':
          return this.traceVariable(T.NODSP_STR, T.NODSP_NUM);
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
        case 'LIST':
          return this.listStatement();
        case 'POKE':
          return this.pair(T.POKE, T.POKE_COMMA, "POKE's address and byte");
        case 'PLOT':
          return this.pair(T.PLOT, T.PLOT_COMMA, "PLOT's column and row");
        case 'HLIN':
          return this.lineStatement(T.HLIN, T.HLIN_COMMA, T.HLIN_AT);
        case 'VLIN':
          return this.lineStatement(T.VLIN, T.VLIN_COMMA, T.VLIN_AT);
        case 'COLOR=':
          this.emit(T.COLOR_SET);
          this.expression();
          return;
        case 'CALL':
          this.emit(T.CALL);
          this.expression();
          return;
        case 'PR#':
          this.emit(T.PR_HASH);
          this.expression();
          return;
        case 'IN#':
          this.emit(T.IN_HASH);
          this.expression();
          return;
        case 'TAB':
          // TAB is a statement here, not a function: `TAB 5` moves the print
          // column, and `PRINT TAB(5)` reads TAB as an array on this machine.
          this.emit(T.TAB);
          this.expression();
          return;
        case 'VTAB':
          this.emit(T.VTAB);
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
    while (this.pos < this.body.length) this.emitLiteralChar();
  }

  /** `DSP v` / `NODSP v`, whose token names the variable's type. */
  private traceVariable(strToken: number, numToken: number): void {
    const { chars, type } = this.readName();
    this.emit(type === 'str' ? strToken : numToken, ...chars);
  }

  /** A statement of the form `KEYWORD expr , expr`. */
  private pair(keyword: number, comma: number, what: string): void {
    this.emit(keyword);
    this.expression();
    this.expect(',', `a comma between ${what}`);
    this.emit(comma);
    this.expression();
  }

  /** `HLIN a,b AT c` and its vertical twin. */
  private lineStatement(keyword: number, comma: number, at: number): void {
    this.pair(keyword, comma, 'the two ends of the line');
    this.expect('AT', 'AT');
    this.emit(at);
    this.expression();
  }

  /** `LIST`, which is the one prompt command a program line may also hold. */
  private listStatement(): void {
    if (this.statementEnds()) return this.emit(T.LIST);
    this.emit(T.LIST_RANGE);
    this.expression();
    if (!this.eat(',')) return;
    this.emit(T.LIST_COMMA);
    this.expression();
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
      if (this.statementEnds()) {
        // Either separator may end the statement: a trailing `;` suppresses the
        // newline and a trailing `,` moves to the next tab stop, and each has a
        // token of its own.
        this.emit(separator === ';' ? T.PRINT_SEMI_END : T.PRINT_COMMA_END);
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
      this.inputVariable();
    } else {
      const first = this.capture(() => this.variableOperand());
      this.emit(first.value === 'str' ? T.INPUT_STR : T.INPUT_NUM);
      this.emit(...first.bytes);
    }
    while (this.eat(',')) this.inputVariable();
  }

  /** One INPUT target, preceded by the comma token its type selects. */
  private inputVariable(): void {
    const item = this.capture(() => this.variableOperand());
    this.emit(
      item.value === 'str' ? T.INPUT_COMMA_STR : T.INPUT_COMMA_NUM,
      ...item.bytes,
    );
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
  /** The physical source line, whose length shares the entry buffer. */
  typed: string;
  editorLine: number;
  column: number;
}

/** One `LOMEM:`/`HIMEM:` line, kept so a bad pair is reported where it was written. */
interface Declaration {
  value: number;
  line: number;
  column: number;
  endColumn: number;
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

  /** The last `LOMEM:`/`HIMEM:` read; each one overwrites the pointer. */
  let lomem: Declaration | null = null;
  let himem: Declaration | null = null;

  const lines = source.split('\n');
  for (let li = 0; li < lines.length; li++) {
    let raw = lines[li]!;
    if (raw.endsWith('\r')) raw = raw.slice(0, -1);
    if (raw.trim() === '') continue;
    const editorLine = li + 1;

    const m = /^(\s*)(\d+)(.*)$/.exec(raw);
    if (!m) {
      // A listing writes the interpreter's prompt commands on a line of their
      // own, with no number - the `NEW` / `HIMEM:` preamble it opens with, and
      // often a bare `RUN` at the foot. They store no bytes and take no part in
      // the ascending-order rule the numbered lines are held to; only
      // `LOMEM:`/`HIMEM:` change what is built.
      const direct = parseDirectLine(raw);
      if (direct.kind === 'error') {
        errors.push({
          line: editorLine,
          column: direct.column,
          endColumn: direct.endColumn,
          message: direct.message,
        });
      } else if (direct.kind === 'line') {
        const { command, args, column, endColumn } = direct.line;
        if (command === 'LOMEM:')
          lomem = { value: args[0]!, column, endColumn, line: editorLine };
        if (command === 'HIMEM:')
          himem = { value: args[0]!, column, endColumn, line: editorLine };
      } else {
        errors.push({
          line: editorLine,
          column: 0,
          message: 'Missing line number',
        });
      }
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

    records.push({
      lineNo,
      body: parsed,
      typed: raw.trim(),
      editorLine,
      column: m[1]!.length,
    });
  }

  const prog: number[] = [];
  for (const record of records) {
    const { lineNo, body } = record;
    const stored = 1 + 2 + body.length + 1;
    // The entry buffer holds the typed text and the tokens crunched out of it at
    // the same time, so it is their sum the interpreter runs out of.
    if (record.typed.length + stored > MAX_ENTRY_BYTES) {
      errors.push({
        line: record.editorLine,
        column: record.column,
        message: `Line is ${record.typed.length} characters and ${stored} bytes tokenized; the entry buffer holds ${MAX_ENTRY_BYTES} of the two together and answers *** TOO LONG ERR above it`,
      });
      continue;
    }
    prog.push(stored);
    prog.push(lineNo & 0xff, (lineNo >> 8) & 0xff);
    prog.push(...body, T.EOL);
  }

  return {
    program: Uint8Array.from(prog),
    errors,
    workspace: resolveWorkspace(lomem, himem, errors),
  };
}

/**
 * The declared bounds, or the stock pair when the listing declared none - or
 * declared a pair the machine could not keep, which is reported at the later of
 * the two lines, that being the one the reader would change.
 */
function resolveWorkspace(
  lomem: Declaration | null,
  himem: Declaration | null,
  errors: TokenizeError[],
): Workspace {
  if (!lomem && !himem) return STOCK_WORKSPACE;

  const low = lomem?.value ?? STOCK_WORKSPACE.lomem;
  const high = himem?.value ?? STOCK_WORKSPACE.himem;
  const fault = workspaceFault(low, high);
  if (!fault) return { lomem: low, himem: high, declared: true };

  const at = [lomem, himem]
    .filter((d) => d !== null)
    .sort((a, b) => b.line - a.line)[0]!;
  errors.push({
    line: at.line,
    column: at.column,
    endColumn: at.endColumn,
    message: fault,
  });
  return STOCK_WORKSPACE;
}
