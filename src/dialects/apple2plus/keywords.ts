// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { KeywordInfo } from '../types';

/**
 * Applesoft's tokens, walked out of the interpreter image itself.
 *
 * The table sits at `$D0D0` in `public/roms/apple2plus.rom` and is the ordinary
 * Microsoft one: the keywords' characters in ASCII with bit 7 set on the last
 * of each, run together and closed by a `$00`. Token `$80` is the first entry
 * and each one after it is the next, which makes the order below the ROM's own
 * rather than an editorial one - `keywords.test.ts` re-walks the image and
 * fails if this file drifts from it.
 *
 * That order is not decoration: **the tokenizer scans this table in it**, and
 * the first entry that matches at a position wins. It is what puts `HGR2`
 * ahead of `HGR`, `PR#` ahead of `PRINT`, and `STORE` ahead of `STOP` - and
 * what makes `AT` (`$C5`) match inside a name long before `ATN` (`$E1`) gets a
 * look, which is the machine's most famous trap and is handled where the
 * tokenizer implements it.
 *
 * The sibling's `../apple2/keywords.ts` shares more than a dozen spellings with
 * this one and not a single token: that machine has no reserved-word table at
 * all, only a syntax table whose tokens depend on grammatical position. Nothing
 * may be carried between the two files.
 */
export interface Apple2PlusKeyword extends KeywordInfo {
  /** True for REM/DATA: the rest of the line or statement is stored verbatim. */
  verbatimRest?: 'line' | 'statement';
  /** A tokenizing-only synonym (`?`), kept out of the LIST decode map. */
  alias?: boolean;
}

/** Raw table: [spelling, token, kind, signature?, doc?]. */
const TABLE: [string, number, KeywordInfo['kind'], string?, string?][] = [
  ['END', 0x80, 'command', 'END', 'Stop the program and return to the prompt.'],
  ['FOR', 0x81, 'command', 'FOR v=a TO b [STEP c]', 'Begin a counting loop.'],
  ['NEXT', 0x82, 'command', 'NEXT [v]', 'Close the innermost FOR loop.'],
  ['DATA', 0x83, 'command', 'DATA c1,c2,...', 'Inline constants READ reads.'],
  ['INPUT', 0x84, 'command', 'INPUT ["prompt";]v', 'Read a typed value.'],
  ['DEL', 0x85, 'command', 'DEL a,b', 'Delete a range of lines.'],
  ['DIM', 0x86, 'command', 'DIM a(n)', 'Declare an array.'],
  ['READ', 0x87, 'command', 'READ v', 'Take the next DATA constant.'],
  ['GR', 0x88, 'command', 'GR', 'Open the 40x40 lo-res screen.'],
  ['TEXT', 0x89, 'command', 'TEXT', 'Return to the 40x24 text screen.'],
  ['PR#', 0x8a, 'command', 'PR# n', 'Send output to the card in slot n.'],
  ['IN#', 0x8b, 'command', 'IN# n', 'Take input from the card in slot n.'],
  ['CALL', 0x8c, 'command', 'CALL addr', 'Call machine code; addr is signed.'],
  ['PLOT', 0x8d, 'command', 'PLOT x,y', 'Light one lo-res block.'],
  ['HLIN', 0x8e, 'command', 'HLIN x1,x2 AT y', 'Draw a lo-res row.'],
  ['VLIN', 0x8f, 'command', 'VLIN y1,y2 AT x', 'Draw a lo-res column.'],
  ['HGR2', 0x90, 'command', 'HGR2', 'Open full-screen hi-res page 2.'],
  ['HGR', 0x91, 'command', 'HGR', 'Open hi-res page 1 with four text lines.'],
  ['HCOLOR=', 0x92, 'command', 'HCOLOR= n', 'Set the hi-res colour, 0 to 7.'],
  ['HPLOT', 0x93, 'command', 'HPLOT x,y [TO x2,y2]', 'Draw in hi-res.'],
  ['DRAW', 0x94, 'command', 'DRAW n AT x,y', 'Draw a shape-table shape.'],
  ['XDRAW', 0x95, 'command', 'XDRAW n AT x,y', 'Draw a shape by inverting.'],
  ['HTAB', 0x96, 'command', 'HTAB n', 'Move the text cursor to column n.'],
  ['HOME', 0x97, 'command', 'HOME', 'Clear the text window.'],
  ['ROT=', 0x98, 'command', 'ROT= n', 'Set the shape rotation, 0 to 63.'],
  ['SCALE=', 0x99, 'command', 'SCALE= n', 'Set the shape scale, 1 to 255.'],
  ['SHLOAD', 0x9a, 'command', 'SHLOAD', 'Read a shape table from cassette.'],
  ['TRACE', 0x9b, 'command', 'TRACE', 'Print each line number as it runs.'],
  ['NOTRACE', 0x9c, 'command', 'NOTRACE', 'Stop tracing.'],
  ['NORMAL', 0x9d, 'command', 'NORMAL', 'Print in normal video.'],
  ['INVERSE', 0x9e, 'command', 'INVERSE', 'Print in inverse video.'],
  ['FLASH', 0x9f, 'command', 'FLASH', 'Print in flashing video.'],
  ['COLOR=', 0xa0, 'command', 'COLOR= n', 'Set the lo-res colour, 0 to 15.'],
  ['POP', 0xa1, 'command', 'POP', 'Forget the innermost GOSUB return.'],
  ['VTAB', 0xa2, 'command', 'VTAB n', 'Move the text cursor to row n.'],
  ['HIMEM:', 0xa3, 'command', 'HIMEM: addr', 'Set the top of BASIC memory.'],
  [
    'LOMEM:',
    0xa4,
    'command',
    'LOMEM: addr',
    'Set the bottom of the variables.',
  ],
  ['ONERR', 0xa5, 'command', 'ONERR GOTO line', 'Trap errors to a handler.'],
  [
    'RESUME',
    0xa6,
    'command',
    'RESUME',
    'Retry the line that raised the error.',
  ],
  ['RECALL', 0xa7, 'command', 'RECALL a', 'Read an array back from cassette.'],
  ['STORE', 0xa8, 'command', 'STORE a', 'Write an array to cassette.'],
  ['SPEED=', 0xa9, 'command', 'SPEED= n', 'Set the printing speed, 0 to 255.'],
  [
    'LET',
    0xaa,
    'command',
    'LET v=expr',
    'Assign a value; the word is optional.',
  ],
  ['GOTO', 0xab, 'command', 'GOTO line', 'Jump to a line number.'],
  ['RUN', 0xac, 'command', 'RUN [line]', 'Start the program.'],
  ['IF', 0xad, 'command', 'IF cond THEN ...', 'Conditional execution.'],
  ['RESTORE', 0xae, 'command', 'RESTORE', 'Rewind READ to the first DATA.'],
  ['&', 0xaf, 'command', '& ...', 'Hand the rest of the line to $03F5.'],
  ['GOSUB', 0xb0, 'command', 'GOSUB line', 'Call a subroutine.'],
  ['RETURN', 0xb1, 'command', 'RETURN', 'Return from a subroutine.'],
  [
    'REM',
    0xb2,
    'command',
    'REM text',
    'A remark; the rest of the line is text.',
  ],
  ['STOP', 0xb3, 'command', 'STOP', 'Break with BREAK IN line.'],
  ['ON', 0xb4, 'command', 'ON n GOTO l1,l2', 'Branch on a value.'],
  ['WAIT', 0xb5, 'command', 'WAIT addr,mask', 'Spin until a location changes.'],
  ['LOAD', 0xb6, 'command', 'LOAD', 'Read a program from cassette.'],
  ['SAVE', 0xb7, 'command', 'SAVE', 'Write the program to cassette.'],
  ['DEF', 0xb8, 'command', 'DEF FN n(x)=expr', 'Define a function.'],
  ['POKE', 0xb9, 'command', 'POKE addr,n', 'Write a byte; addr is signed.'],
  ['PRINT', 0xba, 'command', 'PRINT [expr][;|,]', 'Print to the screen.'],
  ['CONT', 0xbb, 'command', 'CONT', 'Continue after a STOP or BREAK.'],
  ['LIST', 0xbc, 'command', 'LIST [a[,b]]', 'List the program.'],
  ['CLEAR', 0xbd, 'command', 'CLEAR', 'Forget every variable.'],
  ['GET', 0xbe, 'command', 'GET v', 'Wait for one keypress.'],
  ['NEW', 0xbf, 'command', 'NEW', 'Erase the program and its variables.'],
  ['TAB(', 0xc0, 'function', 'TAB(n)', 'Print to column n.'],
  ['TO', 0xc1, 'operator', 'TO', 'Range keyword, in FOR and HPLOT.'],
  ['FN', 0xc2, 'function', 'FN n(x)', 'Call a function defined by DEF.'],
  ['SPC(', 0xc3, 'function', 'SPC(n)', 'Print n spaces.'],
  ['THEN', 0xc4, 'operator', 'THEN', 'Consequent of IF.'],
  ['AT', 0xc5, 'operator', 'AT', 'Position keyword, in HLIN/VLIN/DRAW.'],
  ['NOT', 0xc6, 'operator', 'NOT x', 'Logical not.'],
  ['STEP', 0xc7, 'operator', 'STEP c', 'FOR loop increment.'],
  ['+', 0xc8, 'operator', 'a + b', 'Add, or join two strings.'],
  ['-', 0xc9, 'operator', 'a - b', 'Subtract, or negate.'],
  ['*', 0xca, 'operator', 'a * b', 'Multiply.'],
  ['/', 0xcb, 'operator', 'a / b', 'Divide.'],
  ['^', 0xcc, 'operator', 'a ^ b', 'Raise to a power.'],
  ['AND', 0xcd, 'operator', 'a AND b', 'Logical and.'],
  ['OR', 0xce, 'operator', 'a OR b', 'Logical or.'],
  ['>', 0xcf, 'operator', 'a > b', 'Greater than.'],
  ['=', 0xd0, 'operator', 'a = b', 'Assign, or test for equality.'],
  ['<', 0xd1, 'operator', 'a < b', 'Less than.'],
  ['SGN', 0xd2, 'function', 'SGN(n)', 'Sign: -1, 0 or 1.'],
  ['INT', 0xd3, 'function', 'INT(n)', 'Round down to a whole number.'],
  ['ABS', 0xd4, 'function', 'ABS(n)', 'Absolute value.'],
  ['USR', 0xd5, 'function', 'USR(n)', 'Call the routine vectored at $000A.'],
  ['FRE', 0xd6, 'function', 'FRE(0)', 'Free bytes; collects string space.'],
  ['SCRN(', 0xd7, 'function', 'SCRN(x,y)', 'Colour of a lo-res block.'],
  ['PDL', 0xd8, 'function', 'PDL(n)', 'Read paddle n: 0 to 255.'],
  ['POS', 0xd9, 'function', 'POS(0)', 'The current print column.'],
  ['SQR', 0xda, 'function', 'SQR(n)', 'Square root.'],
  ['RND', 0xdb, 'function', 'RND(n)', 'Random fraction below 1.'],
  ['LOG', 0xdc, 'function', 'LOG(n)', 'Natural logarithm.'],
  ['EXP', 0xdd, 'function', 'EXP(n)', 'e raised to the power n.'],
  ['COS', 0xde, 'function', 'COS(n)', 'Cosine of n radians.'],
  ['SIN', 0xdf, 'function', 'SIN(n)', 'Sine of n radians.'],
  ['TAN', 0xe0, 'function', 'TAN(n)', 'Tangent of n radians.'],
  ['ATN', 0xe1, 'function', 'ATN(n)', 'Arc tangent, in radians.'],
  ['PEEK', 0xe2, 'function', 'PEEK(addr)', 'Read a byte; addr is signed.'],
  ['LEN', 0xe3, 'function', 'LEN(A$)', 'Length of a string.'],
  ['STR$', 0xe4, 'function', 'STR$(n)', 'A number as a string.'],
  ['VAL', 0xe5, 'function', 'VAL(A$)', 'A string as a number.'],
  ['ASC', 0xe6, 'function', 'ASC(A$)', 'Code of the first character.'],
  ['CHR$', 0xe7, 'function', 'CHR$(n)', 'The character with code n.'],
  ['LEFT$', 0xe8, 'function', 'LEFT$(A$,n)', 'The first n characters.'],
  ['RIGHT$', 0xe9, 'function', 'RIGHT$(A$,n)', 'The last n characters.'],
  ['MID$', 0xea, 'function', 'MID$(A$,s[,n])', 'n characters from position s.'],
];

/** The rest of the line, or of the statement, is stored as typed. */
const VERBATIM: Record<string, 'line' | 'statement'> = {
  REM: 'line',
  DATA: 'statement',
};

export const apple2plusKeywords: Apple2PlusKeyword[] = TABLE.map(
  ([word, token, kind, signature, doc]) => ({
    word,
    token,
    kind,
    ...(signature ? { signature } : {}),
    ...(doc ? { doc } : {}),
    ...(VERBATIM[word] ? { verbatimRest: VERBATIM[word] } : {}),
  }),
);

/**
 * Tokenizing-only synonyms.
 *
 * `?` is PRINT, and it is not in the ROM's table: the parser tests for it
 * before it scans, so it has no token of its own and never lists back. That one
 * test is this machine's whole abbreviation scheme - there is no dotted prefix
 * and no shifted letter - and the sibling next door does not even have this
 * (`?1` at its `>` prompt answers `*** SYNTAX ERR`).
 */
export const apple2plusKeywordAliases: Apple2PlusKeyword[] = [
  {
    word: '?',
    token: 0xba,
    kind: 'command',
    signature: '? [expr][;|,]',
    doc: 'PRINT, spelled short.',
    alias: true,
  },
];

/**
 * The symbolic operators, longest first so `<=` is matched before `<`.
 *
 * Only the single characters are tokens: `<=`, `>=` and `<>` are stored as
 * their two tokens in the order they were typed, which is why `A<>B` lists back
 * as `A < > B`. All six orderings parse, `=<` and `><` included.
 */
export const apple2plusOperators: readonly string[] = [
  '<=',
  '>=',
  '<>',
  '=<',
  '=>',
  '><',
  '+',
  '-',
  '*',
  '/',
  '^',
  '=',
  '<',
  '>',
];

/**
 * The table in the order the ROM's scan walks it - ascending token, which is
 * simply the table as written. Named rather than used directly, because the
 * order is the tokenizer's contract and not an accident of how this file is
 * laid out.
 */
export const apple2plusKeywordsInTokenOrder: readonly Apple2PlusKeyword[] =
  apple2plusKeywords;

/** Token byte -> the spelling LIST prints for it. */
export const apple2plusWordByToken: ReadonlyMap<number, string> = new Map(
  apple2plusKeywordsInTokenOrder.map((k) => [k.token, k.word]),
);
