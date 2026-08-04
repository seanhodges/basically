// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { KeywordInfo } from '../types';

/**
 * Altair 8K BASIC's keyword table - the token byte the tokenizer emits for each
 * reserved word, plus the signature and one-line doc the editor shows.
 *
 * Altair BASIC is the ancestor of every Microsoft BASIC in this project, so the
 * *shape* is familiar - single high-bit tokens from 0x80 up, in the
 * interpreter's own reserved-word order - but the exact byte for each word
 * differs from the C64's and the TRS-80's. This table is transcribed from the
 * reserved-word list inside the 8K BASIC 4.0 object tape itself, at image
 * offsets 0x0073-0x0159 (`RESERVED_WORDS_BASE`/`_END` in `addresses.ts`): each
 * entry is its spelling with bit 7 set on the first character, entries run back
 * to back in token order from END = 0x80, and a lone 0x80 byte ends the list
 * after MID$ = 0xC5. Every byte below was then confirmed a second way, by typing
 * the keyword at the interpreter's console and reading the stored program text
 * back out of memory.
 *
 * 70 words, tokens 0x80-0xC5 with no gaps. The set is the 4K one plus strings,
 * `PEEK`/`POKE`, `OUT`/`INP`, `DEF FN`, `CSAVE`/`CLOAD` and the full maths
 * library; there is no `ELSE`, no `INSTR`, no `&H` literal and no `%`/`!`/`#`
 * type tag - those all belong to later, larger Microsoft BASICs.
 */
export interface Altair8800Keyword extends KeywordInfo {
  /** True when REM/DATA: the rest of the line/statement is stored verbatim. */
  verbatimRest?: 'line' | 'statement';
  /** A tokenizing-only synonym (`?`); kept out of the LIST decode map. */
  alias?: boolean;
}

/** Raw table: [spelling, token, kind, signature?, doc?]. */
const TABLE: [string, number, KeywordInfo['kind'], string?, string?][] = [
  ['END', 0x80, 'command', 'END', 'Stop execution and return to OK.'],
  ['FOR', 0x81, 'command', 'FOR v=a TO b [STEP c]', 'Begin a counting loop.'],
  ['NEXT', 0x82, 'command', 'NEXT [v]', 'Close the innermost FOR loop.'],
  ['DATA', 0x83, 'command', 'DATA c1,c2,...', 'Inline constants read by READ.'],
  ['INPUT', 0x84, 'command', 'INPUT ["prompt";]v', 'Read from the terminal.'],
  ['DIM', 0x85, 'command', 'DIM a(n)', 'Declare an array.'],
  ['READ', 0x86, 'command', 'READ v', 'Read the next DATA constant.'],
  ['LET', 0x87, 'command', 'LET v=expr', 'Assign a value (optional keyword).'],
  ['GOTO', 0x88, 'command', 'GOTO line', 'Jump to a line number.'],
  ['RUN', 0x89, 'command', 'RUN [line]', 'Start the program.'],
  ['IF', 0x8a, 'command', 'IF cond THEN ...', 'Conditional execution.'],
  ['RESTORE', 0x8b, 'command', 'RESTORE', 'Reset the DATA read pointer.'],
  ['GOSUB', 0x8c, 'command', 'GOSUB line', 'Call a subroutine.'],
  ['RETURN', 0x8d, 'command', 'RETURN', 'Return from a subroutine.'],
  ['REM', 0x8e, 'command', 'REM text', 'A comment to end of line.'],
  ['STOP', 0x8f, 'command', 'STOP', 'Halt with a BREAK message.'],
  ['OUT', 0x90, 'command', 'OUT port,byte', 'Write a byte to an I/O port.'],
  ['ON', 0x91, 'command', 'ON expr GOTO/GOSUB l1,l2', 'Computed jump.'],
  ['NULL', 0x92, 'command', 'NULL n', 'Nulls printed after each line.'],
  [
    'WAIT',
    0x93,
    'command',
    'WAIT port,mask[,xor]',
    'Spin until a port matches.',
  ],
  ['DEF', 0x94, 'command', 'DEF FNn(v)=expr', 'Define a function.'],
  ['POKE', 0x95, 'command', 'POKE addr,byte', 'Write a byte to memory.'],
  ['PRINT', 0x96, 'command', 'PRINT [expr][;|,]', 'Print to the terminal.'],
  ['CONT', 0x97, 'command', 'CONT', 'Continue after STOP/BREAK.'],
  ['LIST', 0x98, 'command', 'LIST [line]', 'List the program.'],
  ['CLEAR', 0x99, 'command', 'CLEAR [n]', 'Clear vars / set string space.'],
  ['CLOAD', 0x9a, 'command', 'CLOAD"n"', 'Load a program from cassette.'],
  ['CSAVE', 0x9b, 'command', 'CSAVE"n"', 'Save a program to cassette.'],
  ['NEW', 0x9c, 'command', 'NEW', 'Erase the program.'],
  ['TAB(', 0x9d, 'function', 'TAB(n)', 'Move the print column (absolute).'],
  ['TO', 0x9e, 'operator', 'TO', 'Range/limit keyword.'],
  ['FN', 0x9f, 'function', 'FNn(x)', 'Call a user-defined function.'],
  ['SPC(', 0xa0, 'function', 'SPC(n)', 'Print n spaces.'],
  ['THEN', 0xa1, 'operator', 'THEN', 'Consequent of IF.'],
  ['NOT', 0xa2, 'operator', 'NOT x', 'Bitwise/logical NOT.'],
  ['STEP', 0xa3, 'operator', 'STEP c', 'FOR loop increment.'],
  ['+', 0xa4, 'operator', 'a+b', 'Add / concatenate.'],
  ['-', 0xa5, 'operator', 'a-b', 'Subtract / negate.'],
  ['*', 0xa6, 'operator', 'a*b', 'Multiply.'],
  ['/', 0xa7, 'operator', 'a/b', 'Divide.'],
  ['^', 0xa8, 'operator', 'a^b', 'Raise to a power.'],
  ['AND', 0xa9, 'operator', 'a AND b', 'Bitwise/logical AND.'],
  ['OR', 0xaa, 'operator', 'a OR b', 'Bitwise/logical OR.'],
  ['>', 0xab, 'operator', 'a>b', 'Greater than.'],
  ['=', 0xac, 'operator', 'a=b', 'Equals / assignment.'],
  ['<', 0xad, 'operator', 'a<b', 'Less than.'],
  ['SGN', 0xae, 'function', 'SGN(x)', 'Sign of x (-1/0/1).'],
  ['INT', 0xaf, 'function', 'INT(x)', 'Floor to integer.'],
  ['ABS', 0xb0, 'function', 'ABS(x)', 'Absolute value.'],
  ['USR', 0xb1, 'function', 'USR(x)', 'Call the user machine-code vector.'],
  ['FRE', 0xb2, 'function', 'FRE(x)', 'Free memory / free string space.'],
  ['INP', 0xb3, 'function', 'INP(port)', 'Read a byte from an I/O port.'],
  ['POS', 0xb4, 'function', 'POS(x)', 'Current print column.'],
  ['SQR', 0xb5, 'function', 'SQR(x)', 'Square root.'],
  ['RND', 0xb6, 'function', 'RND(x)', 'Random number.'],
  ['LOG', 0xb7, 'function', 'LOG(x)', 'Natural logarithm.'],
  ['EXP', 0xb8, 'function', 'EXP(x)', 'e to the power x.'],
  ['COS', 0xb9, 'function', 'COS(x)', 'Cosine.'],
  ['SIN', 0xba, 'function', 'SIN(x)', 'Sine.'],
  ['TAN', 0xbb, 'function', 'TAN(x)', 'Tangent.'],
  ['ATN', 0xbc, 'function', 'ATN(x)', 'Arctangent.'],
  ['PEEK', 0xbd, 'function', 'PEEK(addr)', 'Read a byte from memory.'],
  ['LEN', 0xbe, 'function', 'LEN(s$)', 'Length of a string.'],
  ['STR$', 0xbf, 'function', 'STR$(x)', 'Number as a string.'],
  ['VAL', 0xc0, 'function', 'VAL(s$)', 'String as a number.'],
  ['ASC', 0xc1, 'function', 'ASC(s$)', 'Code of the first character.'],
  ['CHR$', 0xc2, 'function', 'CHR$(x)', 'Character for a code.'],
  ['LEFT$', 0xc3, 'function', 'LEFT$(s$,n)', 'Leftmost n characters.'],
  ['RIGHT$', 0xc4, 'function', 'RIGHT$(s$,n)', 'Rightmost n characters.'],
  ['MID$', 0xc5, 'function', 'MID$(s$,i[,n])', 'Substring from position i.'],
];

function makeKeyword(
  word: string,
  token: number,
  kind: KeywordInfo['kind'],
  signature?: string,
  doc?: string,
): Altair8800Keyword {
  const kw: Altair8800Keyword = { word, token, kind, signature, doc };
  if (word === 'REM') kw.verbatimRest = 'line';
  if (word === 'DATA') kw.verbatimRest = 'statement';
  return kw;
}

/**
 * The canonical keywords - what highlighting, autocomplete and the LIST decode
 * (detokenizer) use. The `?` alias is deliberately excluded so the decode map
 * keeps one spelling per token.
 */
export const altair8800Keywords: Altair8800Keyword[] = TABLE.map(
  ([word, token, kind, signature, doc]) =>
    makeKeyword(word, token, kind, signature, doc),
);

/**
 * Tokenizing-only synonyms. `?` enters as PRINT - confirmed by typing `10 ? 1`
 * at the console, which stores 0x96 and LISTs back as `10 PRINT 1`. Unlike the
 * TRS-80 there is no `'` comment synonym and no `↑`/`^` split: 8K BASIC's power
 * operator *is* `^` (0xA8), so it sits in the canonical table above.
 */
export const ALTAIR8800_ALIASES: Altair8800Keyword[] = [
  { word: '?', token: 0x96, kind: 'command', alias: true },
];

/**
 * Keywords (canonical + aliases) sorted longest-spelling first, for greedy
 * left-to-right matching. The interpreter's own CRUNCH routine instead takes the
 * *first* table entry that matches at the cursor, which gives the same answer
 * here because the table holds exactly one prefix pair - INP (0xB3) prefixes
 * INPUT (0x84) - and lists the longer word first. `keywords.test.ts` pins that
 * property, so a future edit that broke it would stop the two rules agreeing
 * loudly rather than silently.
 */
export const altair8800KeywordsByLength: Altair8800Keyword[] = [
  ...altair8800Keywords,
  ...ALTAIR8800_ALIASES,
].sort((a, b) => b.word.length - a.word.length);

/** token byte -> canonical spelling, for the detokenizer / LIST. */
export const altair8800WordByToken = new Map<number, string>(
  altair8800Keywords.map((k) => [k.token, k.word]),
);
