// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { KeywordInfo } from '../types';

/**
 * Apple II Integer BASIC's tokens, read off the interpreter image itself.
 *
 * This machine has no reserved-word table. It has a **syntax table** in
 * `$EC00`-`$EDFF`, a chain of grammar rules the entry parser walks backwards
 * through, and a token is simply an ordinal: token N is the Nth keyword
 * boundary counting down from `$EDFF` (and from `$ECFF` for N >= `$51`, which is
 * how a one-byte token reaches a two-page table). `LIST` decodes a token by
 * walking that same chain, so the table below was produced by running the ROM's
 * own walk over the image and then confirmed a second way - by booting the
 * firmware, typing each construct at the interpreter's `>` prompt and reading
 * the stored bytes back out of the program area.
 *
 * The consequence for the tokenizer next door is the thing to know before
 * reading it: **a keyword's token depends on where it appears.** `PRINT` has
 * three (string argument, numeric argument, no argument), `,` has eleven and
 * `(` has seven, because the token records which grammar rule matched. That is
 * why the tokenizer is a parser rather than a scanner, and why the constants
 * below are named for their context.
 *
 * The near-miss to avoid is the Apple I's interpreter in
 * `../apple1/keywords.ts`. It is the same design one revision earlier and it
 * differs here in ways that look like typos: `HIMEM=` there is `HIMEM:` on this
 * machine, `OFF` (which cancels `AUTO`) is `MAN`, `SCR` is `NEW`, and `LOAD`,
 * `SAVE`, `CON`, `ASC(`, `SCRN(`, `PDL(`, `VLIN`, `VTAB`, `AT`, `GR`, `TEXT`,
 * `POP`, `TRACE`/`NOTRACE`, `DSP`/`NODSP`, `PR#` and `IN#` are all new. The
 * token *numbering* diverges from `$04` onwards and never realigns exactly, so
 * nothing in this file may be copied across.
 */

/**
 * Token bytes, named for the grammar rule each one records.
 *
 * Bytes `$C0`-`$FF` are not tokens at all - they are the characters of a
 * variable name, stored with bit 7 set - and `$80`-`$BF` introduces a two-byte
 * integer constant (the byte itself is the ASCII of the constant's first digit,
 * which is why `PRINT 007` stores `B0 07 00`). Only `$00`-`$7F` are tokens.
 */
export const T = {
  /** Ends a stored line. */
  EOL: 0x01,
  /** Statement separator. */
  COLON: 0x03,

  // Prompt commands. These are a grammar of their own and the interpreter
  // refuses all but LIST inside a numbered line - `10 NEW` answers
  // *** SYNTAX ERR.
  LOAD: 0x04,
  SAVE: 0x05,
  CON: 0x06,
  RUN_LINE: 0x07,
  RUN: 0x08,
  DEL: 0x09,
  DEL_COMMA: 0x0a,
  NEW: 0x0b,
  CLR: 0x0c,
  AUTO: 0x0d,
  AUTO_COMMA: 0x0e,
  MAN: 0x0f,
  HIMEM_SET: 0x10,
  LOMEM_SET: 0x11,

  // Binary operators, in the interpreter's own order.
  ADD: 0x12,
  SUB: 0x13,
  MUL: 0x14,
  DIV: 0x15,
  EQ: 0x16,
  NE_HASH: 0x17,
  GE: 0x18,
  GT: 0x19,
  LE: 0x1a,
  NE_ANGLE: 0x1b,
  LT: 0x1c,
  AND: 0x1d,
  OR: 0x1e,
  MOD: 0x1f,
  POW: 0x20,

  /** `(` opening a string DIM: `DIM A$(20)`. */
  DIM_STR_LPAREN: 0x22,
  /** `,` inside a substring: `A$(1,2)`. */
  SUBSTR_COMMA: 0x23,
  /** `THEN` followed by a line number. */
  THEN_LINE: 0x24,
  /** `THEN` followed by a statement. */
  THEN_STMT: 0x25,
  /** `,` in INPUT, before a string variable. */
  INPUT_COMMA_STR: 0x26,
  /** `,` in INPUT, before a numeric variable. */
  INPUT_COMMA_NUM: 0x27,
  /** Opens a string literal; the characters follow with bit 7 set. */
  QUOTE_OPEN: 0x28,
  /** Closes a string literal. */
  QUOTE_CLOSE: 0x29,
  /** `(` opening a substring: `A$(2)` / `A$(1,2)`. */
  SUBSTR_LPAREN: 0x2a,
  /** `(` opening a numeric array subscript: `B(1)`. */
  ARRAY_LPAREN: 0x2d,

  PEEK: 0x2e,
  RND: 0x2f,
  SGN: 0x30,
  ABS: 0x31,
  PDL: 0x32,

  /** `(` opening a numeric DIM: `DIM B(10)`. */
  DIM_NUM_LPAREN: 0x34,
  /** Unary `+`. */
  POS: 0x35,
  /** Unary `-`. */
  NEG: 0x36,
  NOT: 0x37,
  /** `(` grouping a numeric expression: `(1+2)`. */
  LPAREN: 0x38,
  /** `=` comparing two strings. */
  STR_EQ: 0x39,
  /** `#` comparing two strings. */
  STR_NE: 0x3a,
  /** `LEN(` - the keyword carries its own opening parenthesis. */
  LEN: 0x3b,
  /** `ASC(` - likewise. */
  ASC: 0x3c,
  /** `SCRN(` - likewise; it is the one function taking two arguments. */
  SCRN: 0x3d,
  /** `,` between SCRN's column and row. */
  SCRN_COMMA: 0x3e,
  /** `(` opening a function argument: `PEEK(`, `RND(`, `ABS(`, `SGN(`, `PDL(`. */
  FN_LPAREN: 0x3f,

  /** The `$` that marks a string variable, stored as a token, not a character. */
  DOLLAR: 0x40,

  /** `(` indexing a string on the left of an assignment: `A$(1)="Q"`. */
  STR_DEST_LPAREN: 0x42,
  /** `,` in DIM, before a string item. */
  DIM_COMMA_STR: 0x43,
  /** `,` in DIM, before a numeric item. */
  DIM_COMMA_NUM: 0x44,
  /** `;` in PRINT, before a string item. */
  PRINT_SEMI_STR: 0x45,
  /** `;` in PRINT, before a numeric item. */
  PRINT_SEMI_NUM: 0x46,
  /** Trailing `;` - ends the statement and suppresses the newline. */
  PRINT_SEMI_END: 0x47,
  /** `,` in PRINT, before a string item. */
  PRINT_COMMA_STR: 0x48,
  /** `,` in PRINT, before a numeric item. */
  PRINT_COMMA_NUM: 0x49,
  /** Trailing `,` - ends the statement at the next tab stop. */
  PRINT_COMMA_END: 0x4a,

  TEXT: 0x4b,
  GR: 0x4c,
  CALL: 0x4d,
  /** `DIM` whose first item is a string. */
  DIM_STR: 0x4e,
  /** `DIM` whose first item is numeric. */
  DIM_NUM: 0x4f,
  TAB: 0x50,
  END: 0x51,
  /** `INPUT` whose first variable is a string, with no prompt. */
  INPUT_STR: 0x52,
  /** `INPUT` with a string-literal prompt. */
  INPUT_PROMPT: 0x53,
  /** `INPUT` whose first variable is numeric, with no prompt. */
  INPUT_NUM: 0x54,
  FOR: 0x55,
  /** `=` in a FOR header. */
  FOR_EQ: 0x56,
  TO: 0x57,
  STEP: 0x58,
  NEXT: 0x59,
  /** `,` between NEXT control variables. */
  NEXT_COMMA: 0x5a,
  RETURN: 0x5b,
  GOSUB: 0x5c,
  /** `REM`; the rest of the line follows as literal characters. */
  REM: 0x5d,
  LET: 0x5e,
  GOTO: 0x5f,
  IF: 0x60,
  /** `PRINT` whose first item is a string. */
  PRINT_STR: 0x61,
  /** `PRINT` whose first item is numeric. */
  PRINT_NUM: 0x62,
  /** `PRINT` with no items. */
  PRINT: 0x63,
  POKE: 0x64,
  /** `,` between POKE's address and its byte. */
  POKE_COMMA: 0x65,

  COLOR_SET: 0x66,
  PLOT: 0x67,
  PLOT_COMMA: 0x68,
  HLIN: 0x69,
  HLIN_COMMA: 0x6a,
  HLIN_AT: 0x6b,
  VLIN: 0x6c,
  VLIN_COMMA: 0x6d,
  VLIN_AT: 0x6e,
  VTAB: 0x6f,

  /** `=` assigning a string. */
  STR_ASSIGN: 0x70,
  /** `=` assigning a number. */
  NUM_ASSIGN: 0x71,
  RPAREN: 0x72,

  /** `LIST` with a line or a range after it. */
  LIST_RANGE: 0x74,
  /** `,` between LIST's two line numbers. */
  LIST_COMMA: 0x75,
  /** `LIST` on its own. */
  LIST: 0x76,
  POP: 0x77,
  /** `NODSP` naming a string variable. */
  NODSP_STR: 0x78,
  /** `NODSP` naming a numeric variable. */
  NODSP_NUM: 0x79,
  NOTRACE: 0x7a,
  /** `DSP` naming a string variable. */
  DSP_STR: 0x7b,
  /** `DSP` naming a numeric variable. */
  DSP_NUM: 0x7c,
  TRACE: 0x7d,
  PR_HASH: 0x7e,
  IN_HASH: 0x7f,
} as const;

/** First byte of a stored integer constant: the ASCII of its first digit | 0x80. */
export const CONST_INTRO_BASE = 0xb0;

/**
 * Table entries no construct reaches, kept here so the detokenizer can name a
 * byte an imported image turns out to hold.
 *
 * Each was hunted for at the machine and none of them can be typed: `RNDX` is
 * read as a variable of that name, and `!` and the duplicate `+`, `$` and `)`
 * belong to grammar rules the entry parser has no path into. They are boundaries
 * in the syntax table all the same, which is why they consume token numbers.
 */
export const APPLE2_UNREACHABLE: Record<number, string> = {
  0x02: '_',
  0x21: '+',
  0x2b: '!',
  0x2c: '!',
  0x33: 'RNDX',
  0x41: ' $',
  0x73: ')',
};

/**
 * Commands the interpreter takes only at the `>` prompt. Typed inside a
 * numbered line every one of them answers `*** SYNTAX ERR`, because the syntax
 * table reaches them through a rule the deferred-line grammar never enters.
 *
 * `LIST` is **not** among them, which is the surprise: `10 LIST` stores as token
 * `$76` and `10 LIST 1,2` as `$74 … $75 …`, so a program can list itself.
 */
export const APPLE2_DIRECT_ONLY: readonly string[] = [
  'AUTO',
  'CLR',
  'CON',
  'DEL',
  'HIMEM:',
  'LOAD',
  'LOMEM:',
  'MAN',
  'NEW',
  'RUN',
  'SAVE',
];

/**
 * The words that end a variable name where they appear inside one.
 *
 * A name is scanned character by character, and from its **second** character
 * on the parser tries these seven first - they are exactly the words that may
 * follow a complete expression, so finding one means the name has ended. Typed
 * at the machine: `SCORE=1`, `ATOM=1`, `XGOTO=1` and `XFOR=1` each answer
 * `*** SYNTAX ERR` (they hold `OR`, `TO`, `TO` and `OR`), while `TOTAL`,
 * `ANDY`, `BTAB`, `XPEEK` and `XNEXT` are all ordinary variables - a word at
 * the name's first character is not one of these matches, and no other keyword
 * matches anywhere.
 */
export const APPLE2_NAME_BREAKERS: readonly string[] = [
  'AND',
  'AT',
  'MOD',
  'OR',
  'STEP',
  'THEN',
  'TO',
];

/** Raw table: [spelling, canonical token, kind, signature?, doc?]. */
const TABLE: [string, number, KeywordInfo['kind'], string?, string?][] = [
  // Statements a program line can hold.
  ['CALL', T.CALL, 'command', 'CALL addr', 'Call machine code at an address.'],
  ['COLOR=', T.COLOR_SET, 'command', 'COLOR=n', 'Set the lo-res plot colour.'],
  ['DIM', T.DIM_NUM, 'command', 'DIM A(n)', 'Declare an array or string.'],
  ['DSP', T.DSP_NUM, 'command', 'DSP v', 'Trace one variable as it changes.'],
  ['END', T.END, 'command', 'END', 'Stop the program.'],
  ['FOR', T.FOR, 'command', 'FOR v=a TO b [STEP c]', 'Begin a counting loop.'],
  ['GOSUB', T.GOSUB, 'command', 'GOSUB line', 'Call a subroutine.'],
  ['GOTO', T.GOTO, 'command', 'GOTO line', 'Jump to a line number.'],
  ['GR', T.GR, 'command', 'GR', 'Switch to 40x40 lo-res graphics.'],
  ['HLIN', T.HLIN, 'command', 'HLIN a,b AT y', 'Draw a lo-res row.'],
  ['AT', T.HLIN_AT, 'command', 'AT n', 'The row or column HLIN/VLIN draws on.'],
  ['IF', T.IF, 'command', 'IF cond THEN ...', 'Conditional execution.'],
  ['IN#', T.IN_HASH, 'command', 'IN#slot', 'Take input from a slot.'],
  [
    'INPUT',
    T.INPUT_NUM,
    'command',
    'INPUT ["text",]v',
    'Read from the keyboard.',
  ],
  ['LET', T.LET, 'command', 'LET v=expr', 'Assign a value (optional keyword).'],
  ['LIST', T.LIST, 'command', 'LIST [n[,m]]', 'List the program.'],
  ['NEXT', T.NEXT, 'command', 'NEXT v[,v]', 'Close a FOR loop.'],
  ['NODSP', T.NODSP_NUM, 'command', 'NODSP v', 'Stop tracing a variable.'],
  ['NOTRACE', T.NOTRACE, 'command', 'NOTRACE', 'Stop printing line numbers.'],
  ['PLOT', T.PLOT, 'command', 'PLOT x,y', 'Light one lo-res block.'],
  ['POKE', T.POKE, 'command', 'POKE addr,byte', 'Store a byte in memory.'],
  ['POP', T.POP, 'command', 'POP', 'Drop the top GOSUB return address.'],
  ['PR#', T.PR_HASH, 'command', 'PR#slot', 'Send output to a slot.'],
  ['PRINT', T.PRINT, 'command', 'PRINT [item][;|,]', 'Print to the display.'],
  ['REM', T.REM, 'command', 'REM text', 'A comment to end of line.'],
  ['RETURN', T.RETURN, 'command', 'RETURN', 'Return from a subroutine.'],
  ['STEP', T.STEP, 'command', 'STEP n', 'FOR loop increment.'],
  ['TAB', T.TAB, 'command', 'TAB n', 'Move the print column (a statement).'],
  ['TEXT', T.TEXT, 'command', 'TEXT', 'Switch back to the 40x24 text screen.'],
  ['THEN', T.THEN_STMT, 'command', 'THEN line|stmt', 'IF consequent.'],
  ['TO', T.TO, 'command', 'TO n', 'FOR loop limit.'],
  ['TRACE', T.TRACE, 'command', 'TRACE', 'Print each line number as it runs.'],
  ['VLIN', T.VLIN, 'command', 'VLIN a,b AT x', 'Draw a lo-res column.'],
  ['VTAB', T.VTAB, 'command', 'VTAB n', 'Move the print row.'],

  // Prompt commands - legal at the > prompt, never inside a line.
  ['AUTO', T.AUTO, 'command', 'AUTO n[,step]', 'Number lines as you type.'],
  ['CLR', T.CLR, 'command', 'CLR', 'Clear all variables.'],
  ['CON', T.CON, 'command', 'CON', 'Continue a stopped program.'],
  ['DEL', T.DEL, 'command', 'DEL n[,m]', 'Delete a line or a range.'],
  ['HIMEM:', T.HIMEM_SET, 'command', 'HIMEM:n', 'Set the top of BASIC memory.'],
  ['LOAD', T.LOAD, 'command', 'LOAD', 'Read a program from cassette.'],
  ['LOMEM:', T.LOMEM_SET, 'command', 'LOMEM:n', 'Set the bottom of variables.'],
  ['MAN', T.MAN, 'command', 'MAN', 'Cancel AUTO line numbering.'],
  ['NEW', T.NEW, 'command', 'NEW', 'Erase the program.'],
  ['RUN', T.RUN, 'command', 'RUN [line]', 'Start the program.'],
  ['SAVE', T.SAVE, 'command', 'SAVE', 'Write the program to cassette.'],

  // Functions. Every one takes its argument in parentheses.
  ['ABS', T.ABS, 'function', 'ABS(n)', 'Absolute value.'],
  ['ASC', T.ASC, 'function', 'ASC(A$)', 'Code of the first character.'],
  ['LEN', T.LEN, 'function', 'LEN(A$)', 'Length of a string.'],
  ['PDL', T.PDL, 'function', 'PDL(n)', 'Read paddle n: 0 to 255.'],
  ['PEEK', T.PEEK, 'function', 'PEEK(addr)', 'Read a byte; addr is signed.'],
  ['RND', T.RND, 'function', 'RND(n)', 'Random integer 0..n-1.'],
  ['SCRN', T.SCRN, 'function', 'SCRN(x,y)', 'Colour of a lo-res block.'],
  ['SGN', T.SGN, 'function', 'SGN(n)', 'Sign: -1, 0 or 1.'],

  // Named operators.
  ['AND', T.AND, 'operator', 'a AND b', 'Logical and.'],
  ['MOD', T.MOD, 'operator', 'a MOD b', 'Remainder after division.'],
  ['NOT', T.NOT, 'operator', 'NOT a', 'Logical not.'],
  ['OR', T.OR, 'operator', 'a OR b', 'Logical or.'],
];

export const apple2Keywords: KeywordInfo[] = TABLE.map(
  ([word, token, kind, signature, doc]) => ({
    word,
    token,
    kind,
    ...(signature ? { signature } : {}),
    ...(doc ? { doc } : {}),
  }),
);

/**
 * The symbolic operators, longest first so `<=` is matched before `<`.
 *
 * `#` is this BASIC's "not equal"; `<>` is accepted as well and both store a
 * token of their own. There is no `<>` for strings - a string comparison takes
 * only `=` and `#`, and `IF A$<B$` answers `*** SYNTAX ERR`.
 *
 * `^` is here, and it is the interesting difference from the Apple I: the same
 * token `$20` reaches a working handler on this machine, where
 * `PRINT 2^3` answers 8, so it is offered rather than refused.
 */
export const apple2Operators: readonly string[] = [
  '<=',
  '>=',
  '<>',
  '*',
  '/',
  '+',
  '-',
  '^',
  '=',
  '#',
  '<',
  '>',
];

/** Keyword spellings the tokenizer matches, longest first. */
export const apple2KeywordsByLength: readonly KeywordInfo[] = [
  ...apple2Keywords,
].sort((a, b) => b.word.length - a.word.length);
