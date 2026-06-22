import type { KeywordInfo } from '../types';

/**
 * The TRS-80 **Level II BASIC** keyword table. Level II is Microsoft
 * BASIC, so — unlike the later GW-/BASICA-style MS dialects that prefix function
 * tokens with 0xFF — every reserved word here is a **single byte** in the
 * 0x80–0xFA range (the values the ROM stores and that LIST decodes). The table
 * runs in ROM order from END=0x80 to MID$=0xFA; the operators (+ - * / ↑ AND OR
 * > = <) and the loop/branch words (TO, THEN, STEP, NOT) are tokenized too, the
 * same way the C64 BASIC ROM tokenizes them.
 *
 * `?` is the LIST-time abbreviation for PRINT and `'` for REM — see
 * {@link TRS80_ALIASES}; both fold onto the canonical token so a detokenize/LIST
 * shows the long form, exactly as the real ROM does.
 */
export interface Trs80Keyword extends KeywordInfo {
  /** True when REM/DATA: the rest of the line/statement is stored verbatim. */
  verbatimRest?: 'line' | 'statement';
  /** A tokenizing-only synonym (e.g. `?`/`'`); kept out of the LIST decode map. */
  alias?: boolean;
}

/** Raw table: [spelling, token, kind, signature?, doc?]. */
const TABLE: [string, number, KeywordInfo['kind'], string?, string?][] = [
  ['END', 0x80, 'command', 'END', 'Stop execution and return to READY.'],
  ['FOR', 0x81, 'command', 'FOR v=a TO b [STEP c]', 'Begin a counting loop.'],
  ['RESET', 0x82, 'command', 'RESET(x,y)', 'Clear a graphics cell (128×48).'],
  ['SET', 0x83, 'command', 'SET(x,y)', 'Light a graphics cell (128×48).'],
  ['CLS', 0x84, 'command', 'CLS', 'Clear the screen.'],
  ['CMD', 0x85, 'command', 'CMD"S"', 'Issue a system command (DOS).'],
  ['RANDOM', 0x86, 'command', 'RANDOM', 'Reseed the random generator.'],
  ['NEXT', 0x87, 'command', 'NEXT [v]', 'Close the innermost FOR loop.'],
  ['DATA', 0x88, 'command', 'DATA c1,c2,...', 'Inline constants read by READ.'],
  ['INPUT', 0x89, 'command', 'INPUT ["prompt";]v', 'Read from the keyboard.'],
  ['DIM', 0x8a, 'command', 'DIM a(n)', 'Declare an array.'],
  ['READ', 0x8b, 'command', 'READ v', 'Read the next DATA constant.'],
  ['LET', 0x8c, 'command', 'LET v=expr', 'Assign a value (optional keyword).'],
  ['GOTO', 0x8d, 'command', 'GOTO line', 'Jump to a line number.'],
  ['RUN', 0x8e, 'command', 'RUN [line]', 'Start the program.'],
  ['IF', 0x8f, 'command', 'IF cond THEN ...', 'Conditional execution.'],
  ['RESTORE', 0x90, 'command', 'RESTORE', 'Reset the DATA read pointer.'],
  ['GOSUB', 0x91, 'command', 'GOSUB line', 'Call a subroutine.'],
  ['RETURN', 0x92, 'command', 'RETURN', 'Return from a subroutine.'],
  ['REM', 0x93, 'command', 'REM text', 'A comment to end of line.'],
  ['STOP', 0x94, 'command', 'STOP', 'Halt with a BREAK message.'],
  ['ELSE', 0x95, 'command', 'ELSE ...', 'Alternative branch of IF.'],
  ['TRON', 0x96, 'command', 'TRON', 'Turn on line-number trace.'],
  ['TROFF', 0x97, 'command', 'TROFF', 'Turn off line-number trace.'],
  ['DEFSTR', 0x98, 'command', 'DEFSTR a-z', 'Default named vars to string.'],
  ['DEFINT', 0x99, 'command', 'DEFINT a-z', 'Default named vars to integer.'],
  ['DEFSNG', 0x9a, 'command', 'DEFSNG a-z', 'Default named vars to single.'],
  ['DEFDBL', 0x9b, 'command', 'DEFDBL a-z', 'Default named vars to double.'],
  ['LINE', 0x9c, 'command', 'LINE INPUT v$', 'Read a whole input line.'],
  ['EDIT', 0x9d, 'command', 'EDIT line', 'Enter the line editor.'],
  ['ERROR', 0x9e, 'command', 'ERROR n', 'Simulate error number n.'],
  ['RESUME', 0x9f, 'command', 'RESUME [line]', 'Return from error handling.'],
  ['OUT', 0xa0, 'command', 'OUT port,byte', 'Write a byte to a port.'],
  ['ON', 0xa1, 'command', 'ON expr GOTO/GOSUB l1,l2', 'Computed jump.'],
  ['OPEN', 0xa2, 'command', 'OPEN mode,f,"name"', 'Open a file (Disk BASIC).'],
  ['FIELD', 0xa3, 'command', 'FIELD f,n AS v$', 'Map a random buffer.'],
  ['GET', 0xa4, 'command', 'GET f[,rec]', 'Read a random record.'],
  ['PUT', 0xa5, 'command', 'PUT f[,rec]', 'Write a random record.'],
  ['CLOSE', 0xa6, 'command', 'CLOSE [f]', 'Close a file.'],
  ['LOAD', 0xa7, 'command', 'LOAD"name"', 'Load a program (Disk BASIC).'],
  ['MERGE', 0xa8, 'command', 'MERGE"name"', 'Merge a program from disk.'],
  ['NAME', 0xa9, 'command', 'NAME"a" AS"b"', 'Rename a disk file.'],
  ['KILL', 0xaa, 'command', 'KILL"name"', 'Delete a disk file.'],
  ['LSET', 0xab, 'command', 'LSET v$=s$', 'Left-justify into a field.'],
  ['RSET', 0xac, 'command', 'RSET v$=s$', 'Right-justify into a field.'],
  ['SAVE', 0xad, 'command', 'SAVE"name"', 'Save a program (Disk BASIC).'],
  ['SYSTEM', 0xae, 'command', 'SYSTEM', 'Enter the SYSTEM (object) loader.'],
  ['LPRINT', 0xaf, 'command', 'LPRINT [expr]', 'Print to the line printer.'],
  ['DEF', 0xb0, 'command', 'DEF FNn(v)=expr', 'Define a function.'],
  ['POKE', 0xb1, 'command', 'POKE addr,byte', 'Write a byte to memory.'],
  ['PRINT', 0xb2, 'command', 'PRINT [expr][;|,]', 'Print to the screen.'],
  ['CONT', 0xb3, 'command', 'CONT', 'Continue after STOP/BREAK.'],
  ['LIST', 0xb4, 'command', 'LIST [range]', 'List the program.'],
  ['LLIST', 0xb5, 'command', 'LLIST [range]', 'List to the line printer.'],
  ['DELETE', 0xb6, 'command', 'DELETE range', 'Delete program lines.'],
  ['AUTO', 0xb7, 'command', 'AUTO [start[,inc]]', 'Auto line numbering.'],
  ['CLEAR', 0xb8, 'command', 'CLEAR [n]', 'Clear vars / set string space.'],
  ['CLOAD', 0xb9, 'command', 'CLOAD["name"]', 'Load a program from cassette.'],
  ['CSAVE', 0xba, 'command', 'CSAVE"name"', 'Save a program to cassette.'],
  ['NEW', 0xbb, 'command', 'NEW', 'Erase the program.'],
  ['TAB(', 0xbc, 'function', 'TAB(n)', 'Move the print column (absolute).'],
  ['TO', 0xbd, 'operator', 'TO', 'Range/limit keyword.'],
  ['FN', 0xbe, 'function', 'FNn(x)', 'Call a user-defined function.'],
  ['USING', 0xbf, 'operator', 'PRINT USING fmt$;v', 'Formatted print.'],
  ['VARPTR', 0xc0, 'function', 'VARPTR(v)', 'Address of a variable.'],
  ['USR', 0xc1, 'function', 'USR(x)', 'Call the user machine-code vector.'],
  ['ERL', 0xc2, 'function', 'ERL', 'Line where the last error occurred.'],
  ['ERR', 0xc3, 'function', 'ERR', 'Code of the last error.'],
  ['STRING$', 0xc4, 'function', 'STRING$(n,c)', 'A string of n copies of c.'],
  ['INSTR', 0xc5, 'function', 'INSTR([i,]s$,t$)', 'Find t$ within s$.'],
  ['POINT', 0xc6, 'function', 'POINT(x,y)', 'True if a graphics cell is set.'],
  ['TIME$', 0xc7, 'function', 'TIME$', 'The date/time string (Disk BASIC).'],
  ['MEM', 0xc8, 'function', 'MEM', 'Free bytes of memory.'],
  ['INKEY$', 0xc9, 'function', 'INKEY$', 'Read one key without waiting.'],
  ['THEN', 0xca, 'operator', 'THEN', 'Consequent of IF.'],
  ['NOT', 0xcb, 'operator', 'NOT x', 'Bitwise/logical NOT.'],
  ['STEP', 0xcc, 'operator', 'STEP c', 'FOR loop increment.'],
  ['+', 0xcd, 'operator', 'a+b', 'Add / concatenate.'],
  ['-', 0xce, 'operator', 'a-b', 'Subtract / negate.'],
  ['*', 0xcf, 'operator', 'a*b', 'Multiply.'],
  ['/', 0xd0, 'operator', 'a/b', 'Divide.'],
  ['↑', 0xd1, 'operator', 'a↑b', 'Raise to a power (the up-arrow key).'],
  ['AND', 0xd2, 'operator', 'a AND b', 'Bitwise/logical AND.'],
  ['OR', 0xd3, 'operator', 'a OR b', 'Bitwise/logical OR.'],
  ['>', 0xd4, 'operator', 'a>b', 'Greater than.'],
  ['=', 0xd5, 'operator', 'a=b', 'Equals / assignment.'],
  ['<', 0xd6, 'operator', 'a<b', 'Less than.'],
  ['SGN', 0xd7, 'function', 'SGN(x)', 'Sign of x (-1/0/1).'],
  ['INT', 0xd8, 'function', 'INT(x)', 'Floor to integer.'],
  ['ABS', 0xd9, 'function', 'ABS(x)', 'Absolute value.'],
  ['FRE', 0xda, 'function', 'FRE(x)', 'Free string/number bytes.'],
  ['INP', 0xdb, 'function', 'INP(port)', 'Read a byte from a port.'],
  ['POS', 0xdc, 'function', 'POS(x)', 'Current print column.'],
  ['SQR', 0xdd, 'function', 'SQR(x)', 'Square root.'],
  ['RND', 0xde, 'function', 'RND(x)', 'Random number.'],
  ['LOG', 0xdf, 'function', 'LOG(x)', 'Natural logarithm.'],
  ['EXP', 0xe0, 'function', 'EXP(x)', 'e to the power x.'],
  ['COS', 0xe1, 'function', 'COS(x)', 'Cosine.'],
  ['SIN', 0xe2, 'function', 'SIN(x)', 'Sine.'],
  ['TAN', 0xe3, 'function', 'TAN(x)', 'Tangent.'],
  ['ATN', 0xe4, 'function', 'ATN(x)', 'Arctangent.'],
  ['PEEK', 0xe5, 'function', 'PEEK(addr)', 'Read a byte from memory.'],
  ['CVI', 0xe6, 'function', 'CVI(s$)', 'String to integer (Disk BASIC).'],
  ['CVS', 0xe7, 'function', 'CVS(s$)', 'String to single (Disk BASIC).'],
  ['CVD', 0xe8, 'function', 'CVD(s$)', 'String to double (Disk BASIC).'],
  ['EOF', 0xe9, 'function', 'EOF(f)', 'True at end of file.'],
  ['LOC', 0xea, 'function', 'LOC(f)', 'Current record number.'],
  ['LOF', 0xeb, 'function', 'LOF(f)', 'Highest record number.'],
  ['MKI$', 0xec, 'function', 'MKI$(n)', 'Integer to 2-byte string.'],
  ['MKS$', 0xed, 'function', 'MKS$(n)', 'Single to 4-byte string.'],
  ['MKD$', 0xee, 'function', 'MKD$(n)', 'Double to 8-byte string.'],
  ['CINT', 0xef, 'function', 'CINT(x)', 'Convert to integer.'],
  ['CSNG', 0xf0, 'function', 'CSNG(x)', 'Convert to single precision.'],
  ['CDBL', 0xf1, 'function', 'CDBL(x)', 'Convert to double precision.'],
  ['FIX', 0xf2, 'function', 'FIX(x)', 'Truncate toward zero.'],
  ['LEN', 0xf3, 'function', 'LEN(s$)', 'Length of a string.'],
  ['STR$', 0xf4, 'function', 'STR$(x)', 'Number as a string.'],
  ['VAL', 0xf5, 'function', 'VAL(s$)', 'String as a number.'],
  ['ASC', 0xf6, 'function', 'ASC(s$)', 'ASCII code of the first char.'],
  ['CHR$', 0xf7, 'function', 'CHR$(x)', 'Character for an ASCII code.'],
  ['LEFT$', 0xf8, 'function', 'LEFT$(s$,n)', 'Leftmost n characters.'],
  ['RIGHT$', 0xf9, 'function', 'RIGHT$(s$,n)', 'Rightmost n characters.'],
  ['MID$', 0xfa, 'function', 'MID$(s$,i[,n])', 'Substring from position i.'],
];

function makeKeyword(
  word: string,
  token: number,
  kind: KeywordInfo['kind'],
  signature?: string,
  doc?: string,
): Trs80Keyword {
  const kw: Trs80Keyword = { word, token, kind, signature, doc };
  if (word === 'REM') kw.verbatimRest = 'line';
  if (word === 'DATA') kw.verbatimRest = 'statement';
  return kw;
}

/**
 * The canonical keywords — what highlighting, autocomplete and the LIST decode
 * (detokenizer) use. Aliases such as `?`/`'` are deliberately excluded so the
 * decode map keeps one spelling per token.
 */
export const trs80Keywords: Trs80Keyword[] = TABLE.map(
  ([word, token, kind, signature, doc]) =>
    makeKeyword(word, token, kind, signature, doc),
);

/**
 * Tokenizing-only synonyms. `?` enters as PRINT and `'` as REM (it suspends
 * tokenizing to end of line, like REM); both decode back to the long form.
 */
export const TRS80_ALIASES: Trs80Keyword[] = [
  { word: '?', token: 0xb2, kind: 'command', alias: true },
  {
    word: "'",
    token: 0x93,
    kind: 'command',
    alias: true,
    verbatimRest: 'line',
  },
];

/**
 * Keywords (canonical + aliases) sorted longest-spelling first, for greedy
 * left-to-right matching — `DEFSTR` must beat `DEF`, `INPUT` must beat `INP`.
 */
export const trs80KeywordsByLength: Trs80Keyword[] = [
  ...trs80Keywords,
  ...TRS80_ALIASES,
].sort((a, b) => b.word.length - a.word.length);

/** token byte -> canonical spelling, for the detokenizer / LIST. */
export const trs80WordByToken = new Map<number, string>(
  trs80Keywords.map((k) => [k.token, k.word]),
);
