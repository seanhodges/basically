// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { KeywordInfo } from '../types';

/**
 * Apple 1 Integer BASIC's tokens, read off the interpreter image itself.
 *
 * This machine does not have a reserved-word table. It has a **syntax table** at
 * `$EC53`-`$EDFF`, a chain of grammar rules the entry parser walks backwards
 * through, and a token is simply an ordinal: token N is the Nth keyword boundary
 * counting down from `$EDFF` (and from `$ECFF` for N >= `$51`, which is how the
 * one-byte token reaches a two-page table). `LIST` decodes a token by walking
 * that same chain, so the table below was produced by running the ROM's own walk
 * over the image and then confirmed a second way - by booting the firmware,
 * typing each construct at the interpreter's `>` prompt and reading the stored
 * bytes back out of the program area.
 *
 * The consequence for the tokenizer next door is the thing to know before
 * reading it: **a keyword's token depends on where it appears.** `PRINT` has
 * three (string argument, numeric argument, no argument), `,` has eight and `(`
 * has six, because the token records which grammar rule matched. That is why the
 * tokenizer is a parser rather than a scanner, and why the constants below are
 * named for their context.
 *
 * The near-miss to avoid is Apple II Integer BASIC. It is the dialect the world
 * remembers and it differs here in ways that look like typos: `HIMEM:` there is
 * `HIMEM=` on this machine, there is no `MAN` (the command that cancels `AUTO`
 * is `OFF`), no `ASC`, no `SCRN`, no `VLIN`, no `VTAB`, no `GR`, no `TEXT`, no
 * `NEW` and no `?` shorthand for `PRINT`.
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

  // Direct-mode commands. These are a grammar of their own and the interpreter
  // refuses them inside a numbered line - `10 CLR` answers *** SYNTAX ERR.
  LIST_RANGE: 0x04,
  LIST_COMMA: 0x05,
  LIST: 0x06,
  RUN_LINE: 0x07,
  RUN: 0x08,
  DEL: 0x09,
  DEL_COMMA: 0x0a,
  SCR: 0x0b,
  CLR: 0x0c,
  AUTO: 0x0d,
  AUTO_COMMA: 0x0e,
  OFF: 0x0f,
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
  /** In the table, but its handler jumps to `$0000`; see NONFUNCTIONAL. */
  USR: 0x32,

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
  /** In the table, but reads as 0 at run time; see NONFUNCTIONAL. */
  COLOR_FN: 0x3c,
  /** In the table, but reads as 0 at run time; see NONFUNCTIONAL. */
  HIMEM_FN: 0x3d,
  /** In the table, but reads as 0 at run time; see NONFUNCTIONAL. */
  LOMEM_FN: 0x3e,
  /** `(` opening a function argument: `PEEK(`, `RND(`, `ABS(`, `SGN(`. */
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

  // The vestigial graphics statements; see NONFUNCTIONAL.
  COLOR_SET: 0x66,
  PLOT: 0x67,
  PLOT_COMMA: 0x68,
  HLIN: 0x69,
  HLIN_COMMA: 0x6a,
  HLIN_AT: 0x6b,

  /** `=` assigning a string. */
  STR_ASSIGN: 0x70,
  /** `=` assigning a number. */
  NUM_ASSIGN: 0x71,
  RPAREN: 0x72,
} as const;

/** First byte of a stored integer constant: the ASCII of its first digit | 0x80. */
export const CONST_INTRO_BASE = 0xb0;

/**
 * Words the ROM's syntax table accepts but the machine cannot execute.
 *
 * Each was typed at the interpreter and then run. `USR(1)` stops the program
 * dead - its verb address is `$0000`. `HIMEM`, `LOMEM` and `COLOR` used as
 * expressions all evaluate to 0. `COLOR=`, `PLOT`, `HLIN` and `AT` parse and
 * then reach POKE's handler, on a machine with no graphics hardware at all -
 * they are Woz's work towards the Apple II left in an Apple I image, which is
 * also why their partners `VLIN`, `VTAB` and `GR` are absent entirely.
 *
 * They are deliberately not offered as keywords: completing a word that hangs
 * the machine is worse than not knowing it. The tokenizer recognises them anyway
 * so that a program that uses one gets told why rather than "unknown word".
 */
export const APPLE1_NONFUNCTIONAL: Record<string, string> = {
  USR: 'USR is in the interpreter but its handler address is $0000 - calling it stops the program.',
  HIMEM:
    'HIMEM reads as 0 in an expression on this machine; use PEEK(76)+PEEK(77)*256.',
  LOMEM:
    'LOMEM reads as 0 in an expression on this machine; use PEEK(74)+PEEK(75)*256.',
  COLOR: 'COLOR reads as 0: the Apple I has no graphics hardware.',
  'COLOR=': 'COLOR= does nothing: the Apple I has no graphics hardware.',
  PLOT: 'PLOT does nothing: the Apple I has no graphics hardware.',
  HLIN: 'HLIN does nothing: the Apple I has no graphics hardware.',
};

/**
 * Commands the interpreter takes only at the `>` prompt. Typed inside a numbered
 * line every one of them answers `*** SYNTAX ERR`, because the syntax table
 * reaches them through a rule the deferred-line grammar never enters.
 */
export const APPLE1_DIRECT_ONLY: readonly string[] = [
  'AUTO',
  'CLR',
  'DEL',
  'HIMEM=',
  'LIST',
  'LOMEM=',
  'OFF',
  'RUN',
  'SCR',
];

/** Raw table: [spelling, canonical token, kind, signature?, doc?]. */
const TABLE: [string, number, KeywordInfo['kind'], string?, string?][] = [
  // Statements a program line can hold.
  ['CALL', T.CALL, 'command', 'CALL addr', 'Call machine code at an address.'],
  ['DIM', T.DIM_NUM, 'command', 'DIM A(n)', 'Declare an array or string.'],
  ['END', T.END, 'command', 'END', 'Stop the program.'],
  ['FOR', T.FOR, 'command', 'FOR v=a TO b [STEP c]', 'Begin a counting loop.'],
  ['GOSUB', T.GOSUB, 'command', 'GOSUB line', 'Call a subroutine (8 deep).'],
  ['GOTO', T.GOTO, 'command', 'GOTO line', 'Jump to a line number.'],
  ['IF', T.IF, 'command', 'IF cond THEN ...', 'Conditional execution.'],
  [
    'INPUT',
    T.INPUT_NUM,
    'command',
    'INPUT ["text",]v',
    'Read from the keyboard.',
  ],
  ['LET', T.LET, 'command', 'LET v=expr', 'Assign a value (optional keyword).'],
  ['NEXT', T.NEXT, 'command', 'NEXT v[,v]', 'Close a FOR loop.'],
  ['POKE', T.POKE, 'command', 'POKE addr,byte', 'Store a byte in memory.'],
  ['PRINT', T.PRINT, 'command', 'PRINT [item][;|,]', 'Print to the display.'],
  ['REM', T.REM, 'command', 'REM text', 'A comment to end of line.'],
  ['RETURN', T.RETURN, 'command', 'RETURN', 'Return from a subroutine.'],
  ['STEP', T.STEP, 'command', 'STEP n', 'FOR loop increment.'],
  ['TAB', T.TAB, 'command', 'TAB n', 'Move the print column (a statement).'],
  ['THEN', T.THEN_STMT, 'command', 'THEN line|stmt', 'IF consequent.'],
  ['TO', T.TO, 'command', 'TO n', 'FOR loop limit.'],

  // Direct-mode commands - legal at the > prompt, never inside a line.
  ['AUTO', T.AUTO, 'command', 'AUTO n[,step]', 'Number lines as you type.'],
  ['CLR', T.CLR, 'command', 'CLR', 'Clear all variables.'],
  ['DEL', T.DEL, 'command', 'DEL n[,m]', 'Delete a line or a range.'],
  ['HIMEM=', T.HIMEM_SET, 'command', 'HIMEM=n', 'Set the top of BASIC memory.'],
  ['LIST', T.LIST, 'command', 'LIST [n[,m]]', 'List the program.'],
  ['LOMEM=', T.LOMEM_SET, 'command', 'LOMEM=n', 'Set the bottom of variables.'],
  ['OFF', T.OFF, 'command', 'OFF', 'Cancel AUTO line numbering.'],
  ['RUN', T.RUN, 'command', 'RUN [line]', 'Start the program.'],
  ['SCR', T.SCR, 'command', 'SCR', 'Scratch (erase) the program.'],

  // Functions. Every one takes its argument in parentheses.
  ['ABS', T.ABS, 'function', 'ABS(n)', 'Absolute value.'],
  ['LEN', T.LEN, 'function', 'LEN(A$)', 'Length of a string.'],
  ['PEEK', T.PEEK, 'function', 'PEEK(addr)', 'Read a byte; addr is signed.'],
  ['RND', T.RND, 'function', 'RND(n)', 'Random integer 0..n-1.'],
  ['SGN', T.SGN, 'function', 'SGN(n)', 'Sign: -1, 0 or 1.'],

  // Named operators.
  ['AND', T.AND, 'operator', 'a AND b', 'Logical and.'],
  ['MOD', T.MOD, 'operator', 'a MOD b', 'Remainder after division.'],
  ['NOT', T.NOT, 'operator', 'NOT a', 'Logical not.'],
  ['OR', T.OR, 'operator', 'a OR b', 'Logical or.'],
];

export const apple1Keywords: KeywordInfo[] = TABLE.map(
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
 * only `=` and `#`.
 *
 * `^` is not here, and it is the interesting omission: the syntax table has a
 * token for it, so `10 PRINT 2^3` tokenizes, but the interpreter reaches no
 * handler for it and the program stops there and never comes back - typed at
 * the machine, which prints the line before it and then nothing at all. The
 * tokenizer refuses it with a message instead, exactly as it refuses the
 * vestigial graphics words above.
 */
export const apple1Operators: readonly string[] = [
  '<=',
  '>=',
  '<>',
  '*',
  '/',
  '+',
  '-',
  '=',
  '#',
  '<',
  '>',
];

/** Keyword spellings the tokenizer matches, longest first. */
export const apple1KeywordsByLength: readonly KeywordInfo[] = [
  ...apple1Keywords,
].sort((a, b) => b.word.length - a.word.length);
