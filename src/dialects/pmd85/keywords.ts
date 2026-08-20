// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { KeywordInfo } from '../types';

/**
 * BASIC-G's keyword table - the token byte the tokenizer emits for each
 * reserved word, plus the signature and one-line doc the editor shows.
 *
 * Transcribed from the reserved-word table inside the BASIC-G V2.0 interpreter
 * image this project ships, at run-time addresses 0x1995-0x1B14
 * (`RESERVED_WORDS_BASE`/`_END` in `addresses.ts`): each entry is its spelling
 * with bit 7 set on the first character, entries run back to back, and a lone
 * 0x80 byte ends the list. The token numbering is the crunch routine's own -
 * it starts a counter at 0x7F and bumps it once per entry - so END is 0x80 and
 * DEG, the 106th word, is 0xE9, with no gaps. Crosschecked against Roman
 * Bórik's annotated disassembly of BASIC-G V2.A, which labels the same table
 * with the same tokens.
 *
 * The first 71 words are Microsoft 8K BASIC's list almost verbatim, in
 * Microsoft's order: statements END..NEW, then TAB(/TO/FNC/SPC(/THEN/NOT/STEP,
 * the operators, and the functions SGN..MID$. BASIC-G's own contribution is the
 * 36 words after MID$ - the graphics, tape and I/O-channel statements - plus
 * four substitutions inside the Microsoft block (BIT for one of the unused
 * slots, ERR where CONT sat, and LLIST/RAD where CLOAD/CSAVE did; CONT itself
 * moved to 0xDD).
 *
 * Three of the differences from a Microsoft BASIC matter to a reader:
 *
 *  - The user-defined-function keyword is **FNC**, not FN, so a call is
 *    `FNC A(X)`.
 *  - `?` is not the PRINT abbreviation it is everywhere else in this project.
 *    The crunch routine stores it as 0xCE, whose spelling is `_` and whose
 *    statement prints its arguments into the dialogue line and then waits for a
 *    key. A `?` typed into a PMD 85 lists back as `_`.
 *  - Nine of the words are not statements at all, and the interpreter says so:
 *    its statement dispatch sends BIT, ERR, STATUS, INKEY, INK(, APEEK, ADR,
 *    AT and HEX$ to the syntax-error handler, because each is a function or a
 *    PRINT-list modifier that only ever appears inside an expression.
 */
export interface Pmd85Keyword extends KeywordInfo {
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
  ['INPUT', 0x84, 'command', 'INPUT ["prompt";]v', 'Read from the keyboard.'],
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
  ['STOP', 0x8f, 'command', 'STOP', 'Halt with a Stop message.'],
  ['BIT', 0x90, 'function', 'BIT(n,b)', 'Bit b of n, as 0 or 1.'],
  ['ON', 0x91, 'command', 'ON expr GOTO/GOSUB l1,l2', 'Computed jump.'],
  ['NULL', 0x92, 'command', 'NULL n', 'Nulls sent after each line end.'],
  [
    'WAIT',
    0x93,
    'command',
    'WAIT port[,mask],value',
    'Spin until a port matches.',
  ],
  ['DEF', 0x94, 'command', 'DEF FNC n(v)=expr', 'Define a function.'],
  ['POKE', 0x95, 'command', 'POKE addr,byte[,byte]', 'Write bytes to memory.'],
  ['PRINT', 0x96, 'command', 'PRINT [expr][;|,]', 'Print to the screen.'],
  ['ERR', 0x97, 'operator', 'ON ERR GOTO line', 'Error trap (with ON).'],
  ['LIST', 0x98, 'command', 'LIST [line]', 'List the program.'],
  ['CLEAR', 0x99, 'command', 'CLEAR', 'Erase the variables.'],
  ['LLIST', 0x9a, 'command', 'LLIST [line]', 'List a line ready for editing.'],
  ['RAD', 0x9b, 'command', 'RAD', 'Take angles in radians.'],
  ['NEW', 0x9c, 'command', 'NEW', 'Erase the program.'],
  ['TAB(', 0x9d, 'function', 'TAB(n)', 'Move the print column (absolute).'],
  ['TO', 0x9e, 'operator', 'TO', 'Range/limit keyword.'],
  ['FNC', 0x9f, 'function', 'FNC n(x)', 'Call a user-defined function.'],
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
  ['USR', 0xb1, 'function', 'USR(addr)', 'Call machine code at addr.'],
  ['FRE', 0xb2, 'function', 'FRE(x)', 'Free bytes of memory.'],
  ['INP', 0xb3, 'function', 'INP(port)', 'Read a byte from a port.'],
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
  ['STR$', 0xbf, 'function', 'STR$(n)', 'Number formatted as a string.'],
  ['VAL', 0xc0, 'function', 'VAL(s$)', 'Number parsed from a string.'],
  ['ASC', 0xc1, 'function', 'ASC(s$)', 'Code of the first character.'],
  ['CHR$', 0xc2, 'function', 'CHR$(n)', 'One-character string of code n.'],
  ['LEFT$', 0xc3, 'function', 'LEFT$(s$,n)', 'Leftmost n characters.'],
  ['RIGHT$', 0xc4, 'function', 'RIGHT$(s$,n)', 'Rightmost n characters.'],
  ['MID$', 0xc5, 'function', 'MID$(s$,i[,n])', 'Substring from position i.'],
  ['SCALE', 0xc6, 'command', 'SCALE x1,x2,y1,y2', 'Set the plotting window.'],
  [
    'PLOT',
    0xc7,
    'command',
    'PLOT x,y[,n][;x,y]',
    'Draw to (x,y) from the last point.',
  ],
  [
    'MOVE',
    0xc8,
    'command',
    'MOVE x,y',
    'Move the plotting point, drawing nothing.',
  ],
  ['BEEP', 0xc9, 'command', 'BEEP', 'Sound a short beep.'],
  ['AXES', 0xca, 'command', 'AXES x,y', 'Draw both axes through (x,y).'],
  ['GCLEAR', 0xcb, 'command', 'GCLEAR', 'Clear the screen.'],
  ['PAUSE', 0xcc, 'command', 'PAUSE [n]', 'Wait about n milliseconds (n<256).'],
  [
    'DISP',
    0xcd,
    'command',
    'DISP [expr][;|,]',
    'Print into the dialogue line.',
  ],
  [
    '_',
    0xce,
    'command',
    '_ [expr][;|,]',
    'DISP, then wait for a key (types as ?).',
  ],
  ['BMOVE', 0xcf, 'command', 'BMOVE x,y', 'Set the screen-memory cursor.'],
  [
    'BPLOT',
    0xd0,
    'command',
    'BPLOT s$,n',
    'Write string bytes to screen memory.',
  ],
  ['LOAD', 0xd1, 'command', 'LOAD [CODE] n', 'Load a program from tape.'],
  ['SAVE', 0xd2, 'command', 'SAVE n', 'Save the program to tape.'],
  ['DLOAD', 0xd3, 'command', 'DLOAD n,v', 'Load an array from tape.'],
  ['DSAVE', 0xd4, 'command', 'DSAVE n,v', 'Save an array to tape.'],
  [
    'LABEL',
    0xd5,
    'command',
    'LABEL x,y;expr',
    'Plot text at the drawing scale.',
  ],
  ['FILL', 0xd6, 'command', 'FILL x,y;byte', 'Plot an enlarged bit pattern.'],
  [
    'AUTO',
    0xd7,
    'command',
    'AUTO [start[,step]]',
    'Number entered lines automatically.',
  ],
  ['OUTPUT', 0xd8, 'command', 'OUTPUT ch;expr', 'Print to an I/O channel.'],
  [
    'STATUS',
    0xd9,
    'function',
    'STATUS(ch,reg)',
    'Read an I/O device register.',
  ],
  ['ENTER', 0xda, 'command', 'ENTER ch;v', 'Read from an I/O channel.'],
  [
    'CONTROL',
    0xdb,
    'command',
    'CONTROL a,b,v[,v]',
    'Write bytes to a device port.',
  ],
  ['CHECK', 0xdc, 'command', 'CHECK n', 'Verify a tape file against memory.'],
  ['CONT', 0xdd, 'command', 'CONT', 'Continue after STOP.'],
  ['OUT', 0xde, 'command', 'OUT port,byte', 'Write a byte to a port.'],
  ['INKEY', 0xdf, 'function', 'INKEY', 'Function key K0-K11 held, else 255.'],
  [
    'CODE',
    0xe0,
    'command',
    'CODE s$[,s$]',
    'Assemble hex machine code and call it.',
  ],
  ['ROM', 0xe1, 'command', 'ROM n', 'Run block n of the ROM module.'],
  [
    'APOKE',
    0xe2,
    'command',
    'APOKE addr,w[,w]',
    'Write 16-bit words to memory.',
  ],
  ['PEN', 0xe3, 'command', 'PEN n', 'Set the drawing colour and mode.'],
  ['INK(', 0xe4, 'function', 'INK(n)', 'Set the printing colour (in PRINT).'],
  ['APEEK', 0xe5, 'function', 'APEEK(addr)', 'Read a 16-bit word from memory.'],
  ['ADR', 0xe6, 'function', 'ADR(v)', 'Address of a variable value.'],
  [
    'AT',
    0xe7,
    'operator',
    'AT row,col',
    'Position the print cursor (in PRINT).',
  ],
  ['HEX$', 0xe8, 'function', 'HEX$(n)', 'Number as four hex digits.'],
  ['DEG', 0xe9, 'command', 'DEG', 'Take angles in degrees.'],
];

function makeKeyword(
  word: string,
  token: number,
  kind: KeywordInfo['kind'],
  signature?: string,
  doc?: string,
): Pmd85Keyword {
  const kw: Pmd85Keyword = { word, token, kind, signature, doc };
  if (word === 'REM') kw.verbatimRest = 'line';
  if (word === 'DATA') kw.verbatimRest = 'statement';
  return kw;
}

/**
 * The canonical keywords - what highlighting, autocomplete and the LIST decode
 * (detokenizer) use. The `?` alias is deliberately excluded so the decode map
 * keeps one spelling per token.
 */
export const pmd85Keywords: Pmd85Keyword[] = TABLE.map(
  ([word, token, kind, signature, doc]) =>
    makeKeyword(word, token, kind, signature, doc),
);

/**
 * Tokenizing-only synonyms. `?` is the only one, and it does not mean PRINT
 * here: the crunch routine substitutes token 0xCE for it before it looks
 * anything up, and 0xCE is `_`.
 */
export const PMD85_ALIASES: Pmd85Keyword[] = [
  { word: '?', token: 0xce, kind: 'command', alias: true },
];

/**
 * The relational spellings BASIC-G has but does not tokenize: two operator
 * tokens side by side, as on every Microsoft BASIC here.
 */
export const pmd85Operators = ['<=', '>=', '<>'] as const;

/**
 * Keywords (canonical + aliases) sorted longest-spelling first, for greedy
 * left-to-right matching.
 *
 * The interpreter's own crunch routine instead takes the *first* table entry
 * that matches at the cursor, which is token order. The two rules can disagree
 * only where one keyword is a prefix of another, and BASIC-G has exactly four
 * such pairs - INP/INPUT, CONT/CONTROL, OUT/OUTPUT and AT/ATN. In every one the
 * longer word holds the *lower* token, so token order reaches it first and the
 * two rules agree; `keywords.test.ts` enumerates the pairs and pins that.
 */
export const pmd85KeywordsByLength: Pmd85Keyword[] = [
  ...pmd85Keywords,
  ...PMD85_ALIASES,
].sort((a, b) => b.word.length - a.word.length);

/** token byte -> canonical spelling, for the detokenizer / LIST. */
export const pmd85WordByToken = new Map<number, string>(
  pmd85Keywords.map((k) => [k.token, k.word]),
);
