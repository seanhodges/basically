// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { KeywordInfo } from '../types';

/**
 * Dartmouth BASIC's vocabulary as *BASIC, Fourth Edition* defines it, section
 * by section.
 *
 * No compiler listing survives for this machine - the Dartmouth archive holds
 * the first phase of the time-sharing system, whose compiler the GE-235 in
 * this registry is built from - so the manual is the whole of the evidence and
 * every entry below names the section that specifies it. Where the manual is
 * silent this file says so rather than reaching for what the 1965 compiler
 * did.
 *
 * What this language has that the February 1965 one does not, and a program
 * coming the other way will reach for:
 *
 *  - **Strings** (2.7). Any variable plus `$` - `A$`, `Z7$` - and string
 *    vectors, so `CHANGE` can take a string apart into character codes and put
 *    one back together. There is no concatenation operator and no string
 *    function: `CHANGE` is the whole of the machinery.
 *  - **Matrices** (2.6). A `MAT` statement set, and with it `ZER`, `CON`,
 *    `IDN`, `INV`, `TRN` and the two functions `NUM` and `DET`.
 *  - **`ON ... GO TO`** (1.7.6), **`RESTORE`** and its two halves (2.5, 2.7),
 *    **`RANDOMIZE`** (2.2), **`STOP`** (2.5), **multi-line `DEF`** closed by
 *    `FNEND` (2.2), **`TAB`** inside `PRINT` (2.1), and **`SGN`** and **`COT`**
 *    in the library (1.2, 2.2).
 *
 * And what it still has not got, because a reader who knows a later Dartmouth
 * BASIC will look for it:
 *
 *  - **No file statements.** `FILES` appears once in the whole manual, in
 *    Appendix E's list of things not yet built - data files are named there
 *    beside passwords and program chaining - so there is no `READ #`, no
 *    `WRITE #` and no `IF END #`. Those arrive in the fifth edition.
 *  - **No string functions.** `LEN`, `SEG$`, `STR$`, `VAL`, `ASC`, `POS` and
 *    the `&` concatenation operator occur nowhere in the manual; they are the
 *    fifth edition's, and `CHAIN`, `SUB`, `PRINT USING` and `LINPUT` the
 *    sixth's.
 *  - **`LET` is still not optional.** Section 1.7.1: "Each LET statement is of
 *    the form: LET [variable] = [formula]." Nothing anywhere says it may be
 *    left out, and section 2.8's `ILLEGAL INSTRUCTION` is what a line opening
 *    with a variable gets: "Other than one of the legal BASIC instructions has
 *    been used following the line number."
 *
 * The `token` field is an ordinal, not a byte the machine stores. BASIC was
 * compiled here rather than tokenized: the program stayed as characters and
 * `RUN` translated it, so no keyword has a byte of its own. The shared
 * {@link KeywordInfo} type requires the field, so it holds the entry's index
 * in this table and nothing reads it as hardware.
 */

/** Raw table: [spelling, kind, signature, doc]. */
const TABLE: [string, KeywordInfo['kind'], string, string][] = [
  // Statements. The section each is specified in follows its doc line.
  ['CHANGE', 'command', 'CHANGE A$ TO A', 'String to codes, or back (2.7).'],
  [
    'DATA',
    'command',
    'DATA c1,c2,...',
    'Constants READ takes in turn (1.7.2).',
  ],
  [
    'DEF',
    'command',
    'DEF FNx(v)=expr',
    'Define a function; no = if multi-line (2.2).',
  ],
  [
    'DIM',
    'command',
    'DIM a(n[,m])',
    'Declare a list or table bigger than 10 (1.7.8).',
  ],
  ['END', 'command', 'END', 'Stop. Must be the highest-numbered line (1.7.9).'],
  ['FNEND', 'command', 'FNEND', 'Close a multi-line DEF (2.2).'],
  ['FOR', 'command', 'FOR v=a TO b [STEP c]', 'Begin a counting loop (1.7.7).'],
  ['GOSUB', 'command', 'GOSUB line', 'Call a subroutine (2.3).'],
  ['GOTO', 'command', 'GO TO line', 'Jump to a line number (1.7.4).'],
  [
    'IF',
    'command',
    'IF a<b THEN line',
    'Jump when the comparison holds (1.7.5).',
  ],
  ['INPUT', 'command', 'INPUT v1,v2,...', 'Ask the teletype for values (2.4).'],
  [
    'LET',
    'command',
    'LET v=expr',
    'Assign a value. Never optional here (1.7.1).',
  ],
  ['MAT', 'command', 'MAT a=expr', 'Operate on a whole matrix at once (2.6).'],
  ['NEXT', 'command', 'NEXT v', 'Close the innermost FOR loop (1.7.7).'],
  ['ON', 'command', 'ON expr GO TO l1,l2,...', 'Switch on a value (1.7.6).'],
  ['PRINT', 'command', 'PRINT [expr][,|;]', 'Print to the teletype (1.7.3).'],
  ['RANDOMIZE', 'command', 'RANDOMIZE', 'Reseed RND, so a run differs (2.2).'],
  [
    'READ',
    'command',
    'READ v1,v2,...',
    'Take the next DATA constants (1.7.2).',
  ],
  ['REM', 'command', 'REM text', 'A comment to end of line (2.5).'],
  ['RESTORE', 'command', 'RESTORE', 'Rewind both DATA blocks (2.5).'],
  ['RESTORE$', 'command', 'RESTORE$', 'Rewind the string DATA only (2.7).'],
  ['RESTORE*', 'command', 'RESTORE*', 'Rewind the numeric DATA only (2.7).'],
  ['RETURN', 'command', 'RETURN', 'Return from a subroutine (2.3).'],
  ['STOP', 'command', 'STOP', 'Halt, as a GO TO the END line would (2.5).'],

  // Clause words. They open no statement of their own: the expression stops
  // when it meets one.
  ['STEP', 'operator', 'STEP c', 'Amount a FOR loop adds each time (1.7.7).'],
  [
    'THEN',
    'operator',
    'THEN line',
    'Line an IF jumps to when it holds (1.7.5).',
  ],
  ['TO', 'operator', 'TO b', 'Limit of a FOR loop (1.7.7).'],

  // The words a MAT expression is built from (2.6). Not functions: they stand
  // for a whole matrix rather than returning a number, and only MAT reads them.
  ['CON', 'operator', 'MAT a=CON[(r,c)]', 'A matrix of ones (2.6).'],
  ['IDN', 'operator', 'MAT a=IDN', 'The identity matrix (2.6).'],
  ['INV', 'function', 'MAT a=INV(b)', 'The inverse of a square matrix (2.6).'],
  ['TRN', 'function', 'MAT a=TRN(b)', 'The transpose of a matrix (2.6).'],
  ['ZER', 'operator', 'MAT a=ZER[(r,c)]', 'A matrix of zeros (2.6).'],

  // The library. Nine of these are listed in 1.2; INT, RND and SGN are
  // explained in 2.2 and NUM and DET with the matrices in 2.6.
  ['ABS', 'function', 'ABS(x)', 'Absolute value (1.2).'],
  ['ATN', 'function', 'ATN(x)', 'Arctangent, in radians (1.2).'],
  ['COS', 'function', 'COS(x)', 'Cosine of an angle in radians (1.2).'],
  ['COT', 'function', 'COT(x)', 'Cotangent of an angle in radians (1.2).'],
  ['DET', 'function', 'DET', 'Determinant of the last MAT INV (2.6).'],
  ['EXP', 'function', 'EXP(x)', 'e raised to the power x (1.2).'],
  ['FN', 'function', 'FNx(v)', 'Call a function DEF defined (2.2).'],
  ['INT', 'function', 'INT(x)', 'Greatest integer not above x (2.2).'],
  ['LOG', 'function', 'LOG(x)', 'Natural logarithm (1.2).'],
  ['NUM', 'function', 'NUM', 'How many the last MAT INPUT read (2.6).'],
  [
    'RND',
    'function',
    'RND',
    'The next random number. Takes no argument (2.2).',
  ],
  ['SGN', 'function', 'SGN(x)', 'The sign of x: 1, 0 or -1 (2.2).'],
  ['SIN', 'function', 'SIN(x)', 'Sine of an angle in radians (1.2).'],
  ['SQR', 'function', 'SQR(x)', 'Square root (1.2).'],
  [
    'TAB',
    'function',
    'TAB(x)',
    'Move the carriage to a column, in PRINT (2.1).',
  ],
  ['TAN', 'function', 'TAN(x)', 'Tangent of an angle in radians (1.2).'],
];

export const ge635Keywords: KeywordInfo[] = TABLE.map(
  ([word, kind, signature, doc], token) => ({
    word,
    token,
    kind,
    signature,
    doc,
  }),
);

/**
 * The statement words, longest first - what the tokenizer matches at the head
 * of a line.
 *
 * Longest first is load-bearing rather than tidy: `RESTORE$` and `RESTORE*`
 * have to be tried before `RESTORE`, or the suffix that says which DATA block
 * to rewind would be read as the start of the rest of the line.
 */
export const ge635Statements: readonly string[] = ge635Keywords
  .filter((k) => k.kind === 'command')
  .map((k) => k.word)
  .sort((a, b) => b.length - a.length);

/**
 * The operators, which the table above cannot carry because none of them is
 * stored as anything but its own characters.
 *
 * The arithmetic five are section 1.2's table, and its priority rules put the
 * power first, then multiplication and division, then addition and
 * subtraction. `↑` is the up arrow the ASR-33 prints where a modern keyboard
 * has `^`, and it is the only way to raise to a power - there is no `**`.
 * Repeated, it goes left to right, which the manual states outright: "Given
 * A↑B↑C, the computer will raise the number A to the power B and take the
 * resulting number and raise it to the power C."
 *
 * The six relations are section 1.2's second table, and section 2.8's
 * `ILLEGAL RELATION` calls them "the six permissible relational symbols". They
 * compare strings as well as numbers from this edition on: 2.7 defines `<` as
 * "earlier in alphabetic order" and has comparison ignore trailing blanks, so
 * `"YES" = "YES "`.
 */
export const ge635Operators: readonly string[] = [
  '↑',
  '*',
  '/',
  '+',
  '-',
  '<=',
  '>=',
  '<>',
  '=',
  '<',
  '>',
];
