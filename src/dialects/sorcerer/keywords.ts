// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { KeywordInfo } from '../types';

/**
 * Exidy Standard BASIC's reserved words and the token byte each is stored as.
 *
 * Exidy Standard BASIC is a Microsoft 8K BASIC, so the *shape* is the Altair's -
 * single high-bit tokens from 0x80 up, in the interpreter's own reserved-word
 * order - but the bytes are this ROM's. The table below is transcribed from the
 * reserved-word list inside the ROM PAC itself, between the bounds
 * `addresses.ts` names (`RESERVED_WORDS_BASE`/`_END`): each entry is its
 * spelling with bit 7 set on the first character, entries run back to back in
 * token order from END = 0x80, and a lone 0x80 closes the list after MID$.
 *
 * The numbering has a second reading behind it, because an off-by-one in a
 * table like this is invisible until a program runs. The ROM's CRUNCH routine
 * walks the same table with `B` counting up from 0x7F, and the statement
 * dispatch table that follows it gives BYE the address 0xE003 - an entry in the
 * *Monitor's* jump table, which is the one token whose destination identifies
 * itself.
 *
 * 71 words, tokens 0x80-0xC6 with no gaps. It is the Altair's set almost
 * exactly - the 4K one plus strings, `PEEK`/`POKE`, `OUT`/`INP`, `DEF FN`,
 * `CSAVE`/`CLOAD` and the full maths library, with no `ELSE`, no `INSTR`, no
 * `&H` literal and no `%`/`!`/`#` type tag. What Exidy added is `BYE`, and
 * adding it at 0x84 is why **every token from INPUT up differs from the
 * Altair's by one**: reading a byte off the Altair's table here would give the
 * wrong keyword for all but the first four words.
 */
export interface SorcererKeyword extends KeywordInfo {
  /** True when REM/DATA: the rest of the line/statement is stored verbatim. */
  verbatimRest?: 'line' | 'statement';
  /** A tokenizing-only synonym (`?`); kept out of the LIST decode map. */
  alias?: boolean;
}

/** Raw table: [spelling, token, kind, signature?, doc?]. */
const TABLE: [string, number, KeywordInfo['kind'], string?, string?][] = [
  ['END', 0x80, 'command', 'END', 'Stop execution and return to READY.'],
  ['FOR', 0x81, 'command', 'FOR v=a TO b [STEP c]', 'Begin a counting loop.'],
  ['NEXT', 0x82, 'command', 'NEXT [v]', 'Close the innermost FOR loop.'],
  ['DATA', 0x83, 'command', 'DATA c1,c2,...', 'Inline constants read by READ.'],
  ['BYE', 0x84, 'command', 'BYE', 'Leave BASIC and re-enter the Monitor.'],
  ['INPUT', 0x85, 'command', 'INPUT ["prompt";]v', 'Read from the keyboard.'],
  ['DIM', 0x86, 'command', 'DIM a(n)', 'Declare an array.'],
  ['READ', 0x87, 'command', 'READ v', 'Read the next DATA constant.'],
  ['LET', 0x88, 'command', 'LET v=expr', 'Assign a value (optional keyword).'],
  ['GOTO', 0x89, 'command', 'GOTO line', 'Jump to a line number.'],
  ['RUN', 0x8a, 'command', 'RUN [line]', 'Start the program.'],
  ['IF', 0x8b, 'command', 'IF cond THEN ...', 'Conditional execution.'],
  ['RESTORE', 0x8c, 'command', 'RESTORE', 'Reset the DATA read pointer.'],
  ['GOSUB', 0x8d, 'command', 'GOSUB line', 'Call a subroutine.'],
  ['RETURN', 0x8e, 'command', 'RETURN', 'Return from a subroutine.'],
  ['REM', 0x8f, 'command', 'REM text', 'A comment to end of line.'],
  ['STOP', 0x90, 'command', 'STOP', 'Halt with a BREAK message.'],
  ['OUT', 0x91, 'command', 'OUT port,byte', 'Write a byte to an I/O port.'],
  ['ON', 0x92, 'command', 'ON expr GOTO/GOSUB l1,l2', 'Computed jump.'],
  ['NULL', 0x93, 'command', 'NULL n', 'Nulls printed after each line.'],
  [
    'WAIT',
    0x94,
    'command',
    'WAIT port,mask[,xor]',
    'Spin until a port matches.',
  ],
  ['DEF', 0x95, 'command', 'DEF FNn(v)=expr', 'Define a function.'],
  ['POKE', 0x96, 'command', 'POKE addr,byte', 'Write a byte to memory.'],
  ['PRINT', 0x97, 'command', 'PRINT [expr][;|,]', 'Print to the screen.'],
  ['CONT', 0x98, 'command', 'CONT', 'Continue after STOP/BREAK.'],
  ['LIST', 0x99, 'command', 'LIST [line]', 'List the program.'],
  ['CLEAR', 0x9a, 'command', 'CLEAR [n]', 'Clear vars / set string space.'],
  ['CLOAD', 0x9b, 'command', 'CLOAD"n"', 'Load a program from cassette.'],
  ['CSAVE', 0x9c, 'command', 'CSAVE"n"', 'Save a program to cassette.'],
  ['NEW', 0x9d, 'command', 'NEW', 'Erase the program.'],
  ['TAB(', 0x9e, 'function', 'TAB(n)', 'Move the print column (absolute).'],
  ['TO', 0x9f, 'operator', 'TO', 'Range/limit keyword.'],
  ['FN', 0xa0, 'function', 'FNn(x)', 'Call a user-defined function.'],
  ['SPC(', 0xa1, 'function', 'SPC(n)', 'Print n spaces.'],
  ['THEN', 0xa2, 'operator', 'THEN', 'Consequent of IF.'],
  ['NOT', 0xa3, 'operator', 'NOT x', 'Bitwise/logical NOT.'],
  ['STEP', 0xa4, 'operator', 'STEP c', 'FOR loop increment.'],
  ['+', 0xa5, 'operator', 'a+b', 'Add / concatenate.'],
  ['-', 0xa6, 'operator', 'a-b', 'Subtract / negate.'],
  ['*', 0xa7, 'operator', 'a*b', 'Multiply.'],
  ['/', 0xa8, 'operator', 'a/b', 'Divide.'],
  ['^', 0xa9, 'operator', 'a^b', 'Raise to a power.'],
  ['AND', 0xaa, 'operator', 'a AND b', 'Bitwise/logical AND.'],
  ['OR', 0xab, 'operator', 'a OR b', 'Bitwise/logical OR.'],
  ['>', 0xac, 'operator', 'a>b', 'Greater than.'],
  ['=', 0xad, 'operator', 'a=b', 'Equals / assignment.'],
  ['<', 0xae, 'operator', 'a<b', 'Less than.'],
  ['SGN', 0xaf, 'function', 'SGN(x)', 'Sign of x (-1/0/1).'],
  ['INT', 0xb0, 'function', 'INT(x)', 'Floor to integer.'],
  ['ABS', 0xb1, 'function', 'ABS(x)', 'Absolute value.'],
  ['USR', 0xb2, 'function', 'USR(x)', 'Call the user machine-code vector.'],
  ['FRE', 0xb3, 'function', 'FRE(x)', 'Free memory / free string space.'],
  ['INP', 0xb4, 'function', 'INP(port)', 'Read a byte from an I/O port.'],
  ['POS', 0xb5, 'function', 'POS(x)', 'Current print column.'],
  ['SQR', 0xb6, 'function', 'SQR(x)', 'Square root.'],
  ['RND', 0xb7, 'function', 'RND(x)', 'Random number.'],
  ['LOG', 0xb8, 'function', 'LOG(x)', 'Natural logarithm.'],
  ['EXP', 0xb9, 'function', 'EXP(x)', 'e to the power x.'],
  ['COS', 0xba, 'function', 'COS(x)', 'Cosine.'],
  ['SIN', 0xbb, 'function', 'SIN(x)', 'Sine.'],
  ['TAN', 0xbc, 'function', 'TAN(x)', 'Tangent.'],
  ['ATN', 0xbd, 'function', 'ATN(x)', 'Arctangent.'],
  ['PEEK', 0xbe, 'function', 'PEEK(addr)', 'Read a byte from memory.'],
  ['LEN', 0xbf, 'function', 'LEN(s$)', 'Length of a string.'],
  ['STR$', 0xc0, 'function', 'STR$(x)', 'Number as a string.'],
  ['VAL', 0xc1, 'function', 'VAL(s$)', 'String as a number.'],
  ['ASC', 0xc2, 'function', 'ASC(s$)', 'Code of the first character.'],
  ['CHR$', 0xc3, 'function', 'CHR$(x)', 'Character for a code.'],
  ['LEFT$', 0xc4, 'function', 'LEFT$(s$,n)', 'Leftmost n characters.'],
  ['RIGHT$', 0xc5, 'function', 'RIGHT$(s$,n)', 'Rightmost n characters.'],
  ['MID$', 0xc6, 'function', 'MID$(s$,i[,n])', 'Substring from position i.'],
];

function makeKeyword(
  word: string,
  token: number,
  kind: KeywordInfo['kind'],
  signature?: string,
  doc?: string,
): SorcererKeyword {
  const kw: SorcererKeyword = { word, token, kind, signature, doc };
  if (word === 'REM') kw.verbatimRest = 'line';
  if (word === 'DATA') kw.verbatimRest = 'statement';
  return kw;
}

/**
 * The canonical keywords - what highlighting, autocomplete and the LIST decode
 * (detokenizer) use. The `?` alias is deliberately excluded so the decode map
 * keeps one spelling per token.
 */
export const sorcererKeywords: SorcererKeyword[] = TABLE.map(
  ([word, token, kind, signature, doc]) =>
    makeKeyword(word, token, kind, signature, doc),
);

/**
 * Tokenizing-only synonyms. `?` enters as PRINT: CRUNCH compares the character
 * against 0x3F and substitutes 0x97 before it ever reaches the reserved-word
 * walk. There is no `'` comment synonym and no `↑`/`^` split - this
 * interpreter's power operator *is* `^` (0xA9), so it sits in the table above.
 */
export const SORCERER_ALIASES: SorcererKeyword[] = [
  { word: '?', token: 0x97, kind: 'command', alias: true },
];

/**
 * The relational spellings the interpreter has but does not tokenize: two
 * operator tokens side by side, as on every Microsoft BASIC here. The table
 * above holds `<`, `=` and `>` and nothing else relational, which is what makes
 * `<=` two bytes rather than one.
 */
export const sorcererOperators = ['<=', '>=', '<>'] as const;

/**
 * Keywords (canonical + aliases) sorted longest-spelling first, for greedy
 * left-to-right matching. The interpreter's own CRUNCH routine instead takes
 * the *first* table entry that matches at the cursor, which gives the same
 * answer here because the table holds exactly one prefix pair - INP (0xB4)
 * prefixes INPUT (0x85) - and lists the longer word first. `keywords.test.ts`
 * pins that property, so a future edit that broke it would stop the two rules
 * agreeing loudly rather than silently.
 */
export const sorcererKeywordsByLength: SorcererKeyword[] = [
  ...sorcererKeywords,
  ...SORCERER_ALIASES,
].sort((a, b) => b.word.length - a.word.length);

/** token byte -> canonical spelling, for the detokenizer / LIST. */
export const sorcererWordByToken = new Map<number, string>(
  sorcererKeywords.map((k) => [k.token, k.word]),
);
