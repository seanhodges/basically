import type { KeywordInfo } from '../types';

/**
 * The complete Commodore BASIC v2 keyword table. Tokens are the genuine byte
 * values the BASIC ROM stores (and that LIST decodes): commands/functions/
 * operators run $80–$CB, with π at $FF. Print formatters keep the trailing '('
 * that is part of the token ("TAB(", "SPC("); the editor view strips it (see
 * {@link c64Keywords}).
 *
 * The ROM tokenizes greedily and position-independently — `FORI=1TO5` becomes
 * FOR I =1 TO 5 — so the tokenizer matches the longest keyword at each point
 * (see {@link c64KeywordsByLength}); there is no BBC-style `conditional` flag.
 */
export interface C64Keyword extends KeywordInfo {
  /** True when REM/DATA: the rest of the statement is stored verbatim. */
  verbatimRest?: 'line' | 'statement';
}

/** Raw table: [spelling, token, kind, signature?, doc?]. */
const TABLE: [string, number, KeywordInfo['kind'], string?, string?][] = [
  ['END', 0x80, 'command', 'END', 'Stop execution and return to READY.'],
  ['FOR', 0x81, 'command', 'FOR v=a TO b [STEP c]', 'Begin a counting loop.'],
  ['NEXT', 0x82, 'command', 'NEXT [v]', 'Close the innermost FOR loop.'],
  ['DATA', 0x83, 'command', 'DATA c1,c2,...', 'Inline constants read by READ.'],
  ['INPUT#', 0x84, 'command', 'INPUT# f,v', 'Read variables from a file.'],
  [
    'INPUT',
    0x85,
    'command',
    'INPUT ["prompt";]v',
    'Read input from the keyboard.',
  ],
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
  ['ON', 0x91, 'command', 'ON expr GOTO/GOSUB l1,l2', 'Computed jump.'],
  [
    'WAIT',
    0x92,
    'command',
    'WAIT addr,mask[,xor]',
    'Wait on a memory location.',
  ],
  ['LOAD', 0x93, 'command', 'LOAD ["name"[,dev]]', 'Load a program.'],
  ['SAVE', 0x94, 'command', 'SAVE ["name"[,dev]]', 'Save a program.'],
  ['VERIFY', 0x95, 'command', 'VERIFY ["name"]', 'Verify a saved program.'],
  ['DEF', 0x96, 'command', 'DEF FN n(v)=expr', 'Define a function.'],
  ['POKE', 0x97, 'command', 'POKE addr,byte', 'Write a byte to memory.'],
  ['PRINT#', 0x98, 'command', 'PRINT# f,...', 'Write to a file.'],
  ['PRINT', 0x99, 'command', 'PRINT [expr][;|,]', 'Print to the screen.'],
  ['CONT', 0x9a, 'command', 'CONT', 'Continue after STOP/BREAK.'],
  ['LIST', 0x9b, 'command', 'LIST [range]', 'List the program.'],
  ['CLR', 0x9c, 'command', 'CLR', 'Clear variables.'],
  ['CMD', 0x9d, 'command', 'CMD f', 'Redirect output to a file.'],
  ['SYS', 0x9e, 'command', 'SYS addr', 'Call a machine-code routine.'],
  ['OPEN', 0x9f, 'command', 'OPEN f,dev,sa,"name"', 'Open a file/channel.'],
  ['CLOSE', 0xa0, 'command', 'CLOSE f', 'Close a file/channel.'],
  ['GET', 0xa1, 'command', 'GET v', 'Read one key without waiting.'],
  ['NEW', 0xa2, 'command', 'NEW', 'Erase the program.'],
  ['TAB(', 0xa3, 'function', 'TAB(n)', 'Move the print column (absolute).'],
  ['TO', 0xa4, 'operator', 'TO', 'Range/limit keyword.'],
  ['FN', 0xa5, 'function', 'FN n(x)', 'Call a user-defined function.'],
  ['SPC(', 0xa6, 'function', 'SPC(n)', 'Print n spaces.'],
  ['THEN', 0xa7, 'operator', 'THEN', 'Consequent of IF.'],
  ['NOT', 0xa8, 'operator', 'NOT x', 'Bitwise/logical NOT.'],
  ['STEP', 0xa9, 'operator', 'STEP c', 'FOR loop increment.'],
  ['+', 0xaa, 'operator', 'a+b', 'Add / concatenate.'],
  ['-', 0xab, 'operator', 'a-b', 'Subtract / negate.'],
  ['*', 0xac, 'operator', 'a*b', 'Multiply.'],
  ['/', 0xad, 'operator', 'a/b', 'Divide.'],
  ['↑', 0xae, 'operator', 'a↑b', 'Raise to a power.'],
  ['AND', 0xaf, 'operator', 'a AND b', 'Bitwise/logical AND.'],
  ['OR', 0xb0, 'operator', 'a OR b', 'Bitwise/logical OR.'],
  ['>', 0xb1, 'operator', 'a>b', 'Greater than.'],
  ['=', 0xb2, 'operator', 'a=b', 'Equals / assignment.'],
  ['<', 0xb3, 'operator', 'a<b', 'Less than.'],
  ['SGN', 0xb4, 'function', 'SGN(x)', 'Sign of x (-1/0/1).'],
  ['INT', 0xb5, 'function', 'INT(x)', 'Floor to integer.'],
  ['ABS', 0xb6, 'function', 'ABS(x)', 'Absolute value.'],
  ['USR', 0xb7, 'function', 'USR(x)', 'Call the user vector.'],
  ['FRE', 0xb8, 'function', 'FRE(x)', 'Free BASIC bytes.'],
  ['POS', 0xb9, 'function', 'POS(x)', 'Current print column.'],
  ['SQR', 0xba, 'function', 'SQR(x)', 'Square root.'],
  ['RND', 0xbb, 'function', 'RND(x)', 'Random number.'],
  ['LOG', 0xbc, 'function', 'LOG(x)', 'Natural logarithm.'],
  ['EXP', 0xbd, 'function', 'EXP(x)', 'e to the power x.'],
  ['COS', 0xbe, 'function', 'COS(x)', 'Cosine.'],
  ['SIN', 0xbf, 'function', 'SIN(x)', 'Sine.'],
  ['TAN', 0xc0, 'function', 'TAN(x)', 'Tangent.'],
  ['ATN', 0xc1, 'function', 'ATN(x)', 'Arctangent.'],
  ['PEEK', 0xc2, 'function', 'PEEK(addr)', 'Read a byte from memory.'],
  ['LEN', 0xc3, 'function', 'LEN(s$)', 'Length of a string.'],
  ['STR$', 0xc4, 'function', 'STR$(x)', 'Number as a string.'],
  ['VAL', 0xc5, 'function', 'VAL(s$)', 'String as a number.'],
  ['ASC', 0xc6, 'function', 'ASC(s$)', 'PETSCII code of first char.'],
  ['CHR$', 0xc7, 'function', 'CHR$(x)', 'Character for a PETSCII code.'],
  ['LEFT$', 0xc8, 'function', 'LEFT$(s$,n)', 'Leftmost n characters.'],
  ['RIGHT$', 0xc9, 'function', 'RIGHT$(s$,n)', 'Rightmost n characters.'],
  ['MID$', 0xca, 'function', 'MID$(s$,i[,n])', 'Substring from position i.'],
  ['GO', 0xcb, 'command', 'GO TO line', 'GO TO (spaced form of GOTO).'],
  ['π', 0xff, 'function', 'π', 'The constant pi (3.14159265).'],
];

export const c64Keywords: C64Keyword[] = TABLE.map(
  ([word, token, kind, signature, doc]) => {
    const kw: C64Keyword = { word, token, kind, signature, doc };
    if (word === 'REM') kw.verbatimRest = 'line';
    if (word === 'DATA') kw.verbatimRest = 'statement';
    return kw;
  },
);

/** Keywords sorted longest-spelling first, for greedy left-to-right matching. */
export const c64KeywordsByLength: C64Keyword[] = [...c64Keywords].sort(
  (a, b) => b.word.length - a.word.length,
);

/** token byte -> canonical spelling, for the detokenizer / LIST. */
export const c64WordByToken = new Map<number, string>(
  c64Keywords.map((k) => [k.token, k.word]),
);
