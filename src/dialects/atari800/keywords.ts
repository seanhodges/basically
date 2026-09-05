// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { KeywordInfo } from '../types';

/**
 * The Atari BASIC keyword tables.
 *
 * Atari BASIC is unusual among the machines here: it has **two disjoint token
 * spaces**, and the same byte means different things in each.
 *
 *  - **Statement tokens** (`$00`-`$37`) open a statement. One of these is
 *    always the first byte of a statement, and nothing else can appear there.
 *  - **Expression tokens** (`$0E`-`$54`) make up everything after it -
 *    operators, punctuation, functions, and the two constant introducers.
 *
 * So `$20` is PRINT as a statement token and `<` as an expression token, and
 * `$28` is the `?` spelling of PRINT in one space and `NOT` in the other. The
 * parser never has to guess which it is looking at, because the position
 * decides: the byte after a statement's end marker is a statement token, every
 * other byte is an expression token. {@link AtariKeyword.space} carries that
 * distinction so a flat {@link KeywordInfo}`[]` can hold both without the two
 * `$20`s being read as one keyword.
 *
 * Variables are not in either space: they are `$80 + index` into the variable
 * name table, which is why a program may hold at most 128 of them.
 *
 * Three token values in each space have no spelling and so are absent from the
 * table below: `$36`/`$37` in the statement space (the implied `LET` that opens
 * an unprefixed assignment, and the syntax-error marker the ROM stores for a
 * line it could not parse), and `$0E`/`$0F`/`$16` in the expression space (the
 * numeric-constant and string-constant introducers, and the end-of-statement
 * marker). {@link ATARI_TOKENS} names them for the tokenizer instead.
 */
export interface AtariKeyword extends KeywordInfo {
  /** Which of the two token spaces {@link KeywordInfo.token} is a byte in. */
  space: 'statement' | 'expression';
  /** A tokenizing-only synonym (`?`); kept out of the LIST decode map. */
  alias?: boolean;
}

/**
 * Token values that carry no keyword spelling, named rather than written as
 * bare numbers wherever the tokenizer and detokenizer handle them.
 */
export const ATARI_TOKENS = {
  /** Statement: an assignment written without the optional `LET`. */
  IMPLIED_LET: 0x36,
  /** Statement: the ROM's marker for a line it could not parse. */
  SYNTAX_ERROR: 0x37,
  /** Expression: a 6-byte BCD float follows. */
  NUMERIC_CONSTANT: 0x0e,
  /** Expression: a length byte and that many ATASCII characters follow. */
  STRING_CONSTANT: 0x0f,
  /** Expression: end of statement. */
  END_OF_STATEMENT: 0x16,
  /** Lowest variable token; the index into the variable name table is `t - $80`. */
  VARIABLE_BASE: 0x80,
} as const;

/** The most variables one program may hold - `$80`..`$FF` is 128 tokens. */
export const ATARI_MAX_VARIABLES = 128;

/** Raw table row: [spelling, token, kind, signature?, doc?]. */
type Row = [string, number, KeywordInfo['kind'], string?, string?];

/**
 * Statement tokens, `$00` to `$35`, in ROM table order.
 *
 * The order is load-bearing beyond documentation: it is the order the ROM scans
 * when resolving an abbreviation, so `L.` lands on LIST (`$04`) rather than
 * LET (`$06`), LOAD (`$18`) or LOCATE (`$31`).
 */
const STATEMENTS: Row[] = [
  ['REM', 0x00, 'command', 'REM text', 'A comment to end of line.'],
  ['DATA', 0x01, 'command', 'DATA c1,c2,…', 'Inline constants read by READ.'],
  [
    'INPUT',
    0x02,
    'command',
    'INPUT [#chan;]var',
    'Read a value from the keyboard or a channel.',
  ],
  [
    'COLOR',
    0x03,
    'command',
    'COLOR n',
    'Choose the colour register later PLOTs draw in.',
  ],
  ['LIST', 0x04, 'command', 'LIST [range]', 'List the program.'],
  [
    'ENTER',
    0x05,
    'command',
    'ENTER "device"',
    'Merge an untokenized listing into the program.',
  ],
  [
    'LET',
    0x06,
    'command',
    'LET var=expr',
    'Assign a value (optional keyword).',
  ],
  ['IF', 0x07, 'command', 'IF cond THEN …', 'Conditional execution.'],
  ['FOR', 0x08, 'command', 'FOR v=a TO b [STEP c]', 'Begin a counting loop.'],
  ['NEXT', 0x09, 'command', 'NEXT v', 'Close the innermost FOR loop.'],
  ['GOTO', 0x0a, 'command', 'GOTO line', 'Jump to a line number.'],
  ['GO TO', 0x0b, 'command', 'GO TO line', 'Jump to a line number (spaced).'],
  ['GOSUB', 0x0c, 'command', 'GOSUB line', 'Call a subroutine.'],
  [
    'TRAP',
    0x0d,
    'command',
    'TRAP line',
    'Send the next error to a line instead of stopping.',
  ],
  ['BYE', 0x0e, 'command', 'BYE', 'Leave BASIC for the self-test / Memo Pad.'],
  ['CONT', 0x0f, 'command', 'CONT', 'Resume after STOP or BREAK.'],
  ['COM', 0x10, 'command', 'COM a(n)', 'Declare an array (a synonym for DIM).'],
  ['CLOSE', 0x11, 'command', 'CLOSE #chan', 'Close an I/O channel.'],
  ['CLR', 0x12, 'command', 'CLR', 'Clear all variables and arrays.'],
  ['DEG', 0x13, 'command', 'DEG', 'Switch the trig functions to degrees.'],
  ['DIM', 0x14, 'command', 'DIM a(n)', 'Declare an array or string.'],
  ['END', 0x15, 'command', 'END', 'Stop execution and close channels.'],
  ['NEW', 0x16, 'command', 'NEW', 'Erase the program and its variables.'],
  [
    'OPEN',
    0x17,
    'command',
    'OPEN #chan,aux1,aux2,"device"',
    'Open an I/O channel.',
  ],
  ['LOAD', 0x18, 'command', 'LOAD "device"', 'Load a tokenized program.'],
  ['SAVE', 0x19, 'command', 'SAVE "device"', 'Save the program tokenized.'],
  [
    'STATUS',
    0x1a,
    'command',
    'STATUS #chan,var',
    'Read a channel’s status byte.',
  ],
  [
    'NOTE',
    0x1b,
    'command',
    'NOTE #chan,sec,byte',
    'Read the current disk position.',
  ],
  [
    'POINT',
    0x1c,
    'command',
    'POINT #chan,sec,byte',
    'Set the current disk position.',
  ],
  [
    'XIO',
    0x1d,
    'command',
    'XIO cmd,#chan,aux1,aux2,"device"',
    'Issue a general CIO command.',
  ],
  ['ON', 0x1e, 'command', 'ON expr GOTO/GOSUB l1,l2', 'Computed jump.'],
  ['POKE', 0x1f, 'command', 'POKE addr,byte', 'Write a byte to memory.'],
  [
    'PRINT',
    0x20,
    'command',
    'PRINT [#chan;]expr',
    'Print to screen or channel.',
  ],
  ['RAD', 0x21, 'command', 'RAD', 'Switch the trig functions to radians.'],
  ['READ', 0x22, 'command', 'READ var', 'Read the next DATA constant.'],
  [
    'RESTORE',
    0x23,
    'command',
    'RESTORE [line]',
    'Reset the DATA read pointer.',
  ],
  ['RETURN', 0x24, 'command', 'RETURN', 'Return from a subroutine.'],
  ['RUN', 0x25, 'command', 'RUN ["device"]', 'Start the program.'],
  ['STOP', 0x26, 'command', 'STOP', 'Halt and report the line.'],
  [
    'POP',
    0x27,
    'command',
    'POP',
    'Discard the innermost GOSUB/FOR return entry.',
  ],
  ['?', 0x28, 'command', '? expr', 'Print to the screen (short for PRINT).'],
  ['GET', 0x29, 'command', 'GET [#chan,]var', 'Read one byte.'],
  ['PUT', 0x2a, 'command', 'PUT [#chan,]expr', 'Write one byte.'],
  ['GRAPHICS', 0x2b, 'command', 'GRAPHICS n', 'Select a display mode.'],
  ['PLOT', 0x2c, 'command', 'PLOT x,y', 'Plot a point in the current COLOR.'],
  ['POSITION', 0x2d, 'command', 'POSITION x,y', 'Move the cursor.'],
  ['DOS', 0x2e, 'command', 'DOS', 'Exit to the disk operating system.'],
  ['DRAWTO', 0x2f, 'command', 'DRAWTO x,y', 'Draw a line to a point.'],
  [
    'SETCOLOR',
    0x30,
    'command',
    'SETCOLOR reg,hue,lum',
    'Set one of the five colour registers.',
  ],
  [
    'LOCATE',
    0x31,
    'command',
    'LOCATE x,y,var',
    'Read the pixel or character at a point.',
  ],
  [
    'SOUND',
    0x32,
    'command',
    'SOUND voice,pitch,dist,vol',
    'Play a tone on one of four voices.',
  ],
  ['LPRINT', 0x33, 'command', 'LPRINT expr', 'Print to the printer.'],
  ['CSAVE', 0x34, 'command', 'CSAVE', 'Save the program to cassette.'],
  ['CLOAD', 0x35, 'command', 'CLOAD', 'Load a program from cassette.'],
];

/**
 * Expression tokens, `$12` to `$54`.
 *
 * Atari BASIC resolves an operator's meaning while parsing rather than while
 * running, so several spellings appear more than once with different bytes: `=`
 * is comparison (`$22`), numeric assignment (`$2D`) or string assignment
 * (`$2E`); the relational operators have a second, string-comparing set at
 * `$2F`-`$34`; `+`/`-` have unary forms at `$35`/`$36`; and `(` has six bytes,
 * one per thing it can open. The tokenizer picks the byte from the parse, and
 * the detokenizer maps every one of them back onto the one spelling - so the
 * table keeps them all, and the LIST-decode map is built from `spelling`,
 * which collapses them.
 */
const EXPRESSIONS: Row[] = [
  [',', 0x12, 'operator', ',', 'Separates arguments and print fields.'],
  ['$', 0x13, 'operator', '$', 'Reserved; not produced by the tokenizer.'],
  [':', 0x14, 'operator', ':', 'Separates two statements on one line.'],
  [';', 0x15, 'operator', ';', 'Joins print items without spacing.'],
  ['GOTO', 0x17, 'command', 'ON expr GOTO l1,l2', 'The GOTO inside ON.'],
  ['GOSUB', 0x18, 'command', 'ON expr GOSUB l1,l2', 'The GOSUB inside ON.'],
  ['TO', 0x19, 'command', 'FOR v=a TO b', 'The limit clause of FOR.'],
  ['STEP', 0x1a, 'command', 'FOR v=a TO b STEP c', 'The stride clause of FOR.'],
  ['THEN', 0x1b, 'command', 'IF cond THEN …', 'The consequent clause of IF.'],
  ['#', 0x1c, 'operator', '#chan', 'Introduces an I/O channel number.'],
  ['<=', 0x1d, 'operator', 'a<=b', 'Less than or equal.'],
  ['<>', 0x1e, 'operator', 'a<>b', 'Not equal.'],
  ['>=', 0x1f, 'operator', 'a>=b', 'Greater than or equal.'],
  ['<', 0x20, 'operator', 'a<b', 'Less than.'],
  ['>', 0x21, 'operator', 'a>b', 'Greater than.'],
  ['=', 0x22, 'operator', 'a=b', 'Equal.'],
  ['^', 0x23, 'operator', 'a^b', 'Raise to a power.'],
  ['*', 0x24, 'operator', 'a*b', 'Multiply.'],
  ['+', 0x25, 'operator', 'a+b', 'Add.'],
  ['-', 0x26, 'operator', 'a-b', 'Subtract.'],
  ['/', 0x27, 'operator', 'a/b', 'Divide.'],
  ['NOT', 0x28, 'operator', 'NOT a', 'Logical negation.'],
  ['OR', 0x29, 'operator', 'a OR b', 'Logical or.'],
  ['AND', 0x2a, 'operator', 'a AND b', 'Logical and.'],
  ['(', 0x2b, 'operator', '(expr)', 'Open a grouping bracket.'],
  [')', 0x2c, 'operator', ')', 'Close a bracket.'],
  ['=', 0x2d, 'operator', 'v=expr', 'Numeric assignment.'],
  ['=', 0x2e, 'operator', 'v$=expr$', 'String assignment.'],
  ['<=', 0x2f, 'operator', 'a$<=b$', 'String less than or equal.'],
  ['<>', 0x30, 'operator', 'a$<>b$', 'String not equal.'],
  ['>=', 0x31, 'operator', 'a$>=b$', 'String greater than or equal.'],
  ['<', 0x32, 'operator', 'a$<b$', 'String less than.'],
  ['>', 0x33, 'operator', 'a$>b$', 'String greater than.'],
  ['=', 0x34, 'operator', 'a$=b$', 'String equal.'],
  ['+', 0x35, 'operator', '+a', 'Unary plus.'],
  ['-', 0x36, 'operator', '-a', 'Unary minus.'],
  ['(', 0x37, 'operator', 'a$(i[,j])', 'Open a string subscript.'],
  ['(', 0x38, 'operator', 'a(i[,j])', 'Open an array subscript.'],
  ['(', 0x39, 'operator', 'DIM a(n)', 'Open an array dimension.'],
  ['(', 0x3a, 'operator', 'FN(x)', 'Open a function argument.'],
  ['(', 0x3b, 'operator', 'DIM a$(n)', 'Open a string dimension.'],
  [',', 0x3c, 'operator', 'a(i,j)', 'Separates two array subscripts.'],
  ['STR$', 0x3d, 'function', 'STR$(n)', 'The number n as a string.'],
  ['CHR$', 0x3e, 'function', 'CHR$(n)', 'The character with ATASCII code n.'],
  ['USR', 0x3f, 'function', 'USR(addr[,args])', 'Call machine code.'],
  ['ASC', 0x40, 'function', 'ASC(a$)', 'ATASCII code of the first character.'],
  ['VAL', 0x41, 'function', 'VAL(a$)', 'The number a string spells.'],
  ['LEN', 0x42, 'function', 'LEN(a$)', 'Length of a string.'],
  ['ADR', 0x43, 'function', 'ADR(a$)', 'Address of a string’s data.'],
  ['ATN', 0x44, 'function', 'ATN(n)', 'Arctangent.'],
  ['COS', 0x45, 'function', 'COS(n)', 'Cosine.'],
  ['PEEK', 0x46, 'function', 'PEEK(addr)', 'The byte at an address.'],
  ['SIN', 0x47, 'function', 'SIN(n)', 'Sine.'],
  ['RND', 0x48, 'function', 'RND(n)', 'A random number in [0,1).'],
  ['FRE', 0x49, 'function', 'FRE(0)', 'Bytes of free memory.'],
  ['EXP', 0x4a, 'function', 'EXP(n)', 'e raised to n.'],
  ['LOG', 0x4b, 'function', 'LOG(n)', 'Natural logarithm.'],
  ['CLOG', 0x4c, 'function', 'CLOG(n)', 'Base-10 logarithm.'],
  ['SQR', 0x4d, 'function', 'SQR(n)', 'Square root.'],
  ['SGN', 0x4e, 'function', 'SGN(n)', 'Sign: -1, 0 or 1.'],
  ['ABS', 0x4f, 'function', 'ABS(n)', 'Absolute value.'],
  ['INT', 0x50, 'function', 'INT(n)', 'Largest integer not above n.'],
  ['PADDLE', 0x51, 'function', 'PADDLE(n)', 'A paddle controller’s position.'],
  ['STICK', 0x52, 'function', 'STICK(n)', 'A joystick’s direction.'],
  ['PTRIG', 0x53, 'function', 'PTRIG(n)', 'A paddle trigger, 0 when pressed.'],
  [
    'STRIG',
    0x54,
    'function',
    'STRIG(n)',
    'A joystick trigger, 0 when pressed.',
  ],
];

function build(rows: Row[], space: AtariKeyword['space']): AtariKeyword[] {
  return rows.map(([word, token, kind, signature, doc]) => ({
    word,
    token,
    kind,
    space,
    ...(signature ? { signature } : {}),
    ...(doc ? { doc } : {}),
  }));
}

/** Statement tokens `$00`-`$35`, in the ROM's own table order. */
export const atariStatements: AtariKeyword[] = build(STATEMENTS, 'statement');

/** Expression tokens `$12`-`$54`. */
export const atariExpressions: AtariKeyword[] = build(
  EXPRESSIONS,
  'expression',
);

/**
 * REM and DATA store the rest of the statement verbatim rather than tokenizing
 * it, so the tokenizer stops looking for keywords after either.
 */
export const ATARI_VERBATIM = new Set(['REM', 'DATA']);

/**
 * `?` is the entry spelling of PRINT and has a statement token of its own, so
 * unlike the Microsoft machines' `?` it is not a fold onto PRINT's byte. It is
 * still an abbreviation as far as a listing is concerned: the ROM lists it back
 * as PRINT.
 */
export const ATARI_ALIASES: AtariKeyword[] = atariStatements
  .filter((k) => k.word === '?')
  .map((k) => ({ ...k, alias: true }));

/**
 * The spelled keywords the editor sees: both token spaces, with the duplicate
 * spellings the parse creates collapsed to their first entry.
 *
 * Words only. The symbolic operators are in {@link atariOperators} and the
 * punctuation in neither, because the editor colours and completes a spelling
 * once - it needs `=` styled, not offered four times - while the tokenizer
 * keeps the full tables above and picks each byte from the parse. `?` is left
 * out too: it is an entry spelling the ROM lists back as PRINT, so it belongs
 * with {@link ATARI_ALIASES}.
 */
export const atariKeywords: AtariKeyword[] = (() => {
  const seen = new Set<string>();
  const out: AtariKeyword[] = [];
  for (const k of [...atariStatements, ...atariExpressions]) {
    if (!/^[A-Z]/.test(k.word)) continue;
    const key = `${k.word} ${k.kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(k);
  }
  return out;
})();

/**
 * The symbolic operators, which {@link atariKeywords} deliberately does not
 * carry: `NOT`, `AND` and `OR` are spelled words and stay in the keyword table,
 * and these are the ones the editor must colour instead of complete.
 *
 * Longest first, so `<=` is matched before `<`.
 */
export const atariOperators: readonly string[] = [
  '<=',
  '<>',
  '>=',
  '<',
  '>',
  '=',
  '^',
  '*',
  '+',
  '-',
  '/',
  '#',
];
