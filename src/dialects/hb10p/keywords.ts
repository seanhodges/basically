// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { KeywordInfo } from '../types';

/**
 * MSX BASIC 1.0's keyword table.
 *
 * Statements and most functions are single bytes in 0x81-0xFC; the remaining
 * functions are two bytes, a 0xFF prefix followed by a second byte in
 * 0x81-0xB0. {@link Hb10pKeyword.token} holds the whole token, so a two-byte
 * function reads as 0xFF81 and the tokenizer emits its high byte first.
 *
 * Two words are never stored as their bare token. `ELSE` carries an implicit
 * leading `:` (0x3A 0xA1) and the `'` comment is the three bytes `:REM'`
 * (0x3A 0x8F 0xE6), exactly as the rest of the Microsoft family stores them;
 * LIST hides the colon in both cases. {@link HB10P_PREFIXED} names them.
 */
export interface Hb10pKeyword extends KeywordInfo {
  /** True when REM/DATA: the rest of the line/statement is stored verbatim. */
  verbatimRest?: 'line' | 'statement';
  /** A tokenizing-only synonym (`?`, `'`); kept out of the LIST decode map. */
  alias?: boolean;
  /** Numbers after this word are line references, not constants. */
  lineRefs?: true;
}

/** Raw table: [spelling, token, kind, signature?, doc?]. */
const TABLE: [string, number, KeywordInfo['kind'], string?, string?][] = [
  ['END', 0x81, 'command', 'END', 'Stop execution and return to Ok.'],
  ['FOR', 0x82, 'command', 'FOR v=a TO b [STEP c]', 'Begin a counting loop.'],
  ['NEXT', 0x83, 'command', 'NEXT [v]', 'Close the innermost FOR loop.'],
  ['DATA', 0x84, 'command', 'DATA c1,c2,...', 'Inline constants read by READ.'],
  ['INPUT', 0x85, 'command', 'INPUT ["prompt";]v', 'Read from the keyboard.'],
  ['DIM', 0x86, 'command', 'DIM a(n)', 'Declare an array.'],
  ['READ', 0x87, 'command', 'READ v', 'Read the next DATA constant.'],
  ['LET', 0x88, 'command', 'LET v=expr', 'Assign a value (optional keyword).'],
  ['GOTO', 0x89, 'command', 'GOTO line', 'Jump to a line number.'],
  ['RUN', 0x8a, 'command', 'RUN [line]', 'Start the program.'],
  ['IF', 0x8b, 'command', 'IF cond THEN ...', 'Conditional execution.'],
  ['RESTORE', 0x8c, 'command', 'RESTORE [line]', 'Reset the DATA pointer.'],
  ['GOSUB', 0x8d, 'command', 'GOSUB line', 'Call a subroutine.'],
  ['RETURN', 0x8e, 'command', 'RETURN [line]', 'Return from a subroutine.'],
  ['REM', 0x8f, 'command', 'REM text', 'A comment to end of line.'],
  ['STOP', 0x90, 'command', 'STOP', 'Halt with Break in nn.'],
  ['PRINT', 0x91, 'command', 'PRINT [expr][;|,]', 'Print to the screen.'],
  [
    'CLEAR',
    0x92,
    'command',
    'CLEAR [s[,top]]',
    'Clear vars / set string space.',
  ],
  ['LIST', 0x93, 'command', 'LIST [range]', 'List the program.'],
  ['NEW', 0x94, 'command', 'NEW', 'Erase the program.'],
  ['ON', 0x95, 'command', 'ON expr GOTO l1,l2', 'Computed jump or event trap.'],
  ['WAIT', 0x96, 'command', 'WAIT port,and[,xor]', 'Wait on an input port.'],
  [
    'DEF',
    0x97,
    'command',
    'DEF FNn(v)=expr',
    'Define a function or USR entry.',
  ],
  ['POKE', 0x98, 'command', 'POKE addr,byte', 'Write a byte to memory.'],
  ['CONT', 0x99, 'command', 'CONT', 'Continue after STOP/Break.'],
  [
    'CSAVE',
    0x9a,
    'command',
    'CSAVE"name"[,baud]',
    'Save a program to cassette.',
  ],
  ['CLOAD', 0x9b, 'command', 'CLOAD["name"]', 'Load a program from cassette.'],
  ['OUT', 0x9c, 'command', 'OUT port,byte', 'Write a byte to a port.'],
  ['LPRINT', 0x9d, 'command', 'LPRINT [expr]', 'Print to the printer.'],
  ['LLIST', 0x9e, 'command', 'LLIST [range]', 'List to the printer.'],
  ['CLS', 0x9f, 'command', 'CLS', 'Clear the screen.'],
  ['WIDTH', 0xa0, 'command', 'WIDTH n', 'Set the text width.'],
  ['ELSE', 0xa1, 'command', 'ELSE ...', 'Alternative branch of IF.'],
  ['TRON', 0xa2, 'command', 'TRON', 'Turn on line-number trace.'],
  ['TROFF', 0xa3, 'command', 'TROFF', 'Turn off line-number trace.'],
  ['SWAP', 0xa4, 'command', 'SWAP v1,v2', 'Exchange two variables.'],
  ['ERASE', 0xa5, 'command', 'ERASE a[,b]', 'Discard an array.'],
  ['ERROR', 0xa6, 'command', 'ERROR n', 'Raise error number n.'],
  [
    'RESUME',
    0xa7,
    'command',
    'RESUME [line|NEXT]',
    'Return from error handling.',
  ],
  ['DELETE', 0xa8, 'command', 'DELETE range', 'Delete program lines.'],
  ['AUTO', 0xa9, 'command', 'AUTO [start[,inc]]', 'Auto line numbering.'],
  [
    'RENUM',
    0xaa,
    'command',
    'RENUM [new[,old[,inc]]]',
    'Renumber the program.',
  ],
  ['DEFSTR', 0xab, 'command', 'DEFSTR a-z', 'Default named vars to string.'],
  ['DEFINT', 0xac, 'command', 'DEFINT a-z', 'Default named vars to integer.'],
  ['DEFSNG', 0xad, 'command', 'DEFSNG a-z', 'Default named vars to single.'],
  ['DEFDBL', 0xae, 'command', 'DEFDBL a-z', 'Default named vars to double.'],
  ['LINE', 0xaf, 'command', 'LINE (x1,y1)-(x2,y2),c', 'Draw a line or box.'],
  ['OPEN', 0xb0, 'command', 'OPEN "dev:name" FOR mode AS #f', 'Open a file.'],
  ['FIELD', 0xb1, 'command', 'FIELD #f,n AS v$', 'Map a random buffer.'],
  ['GET', 0xb2, 'command', 'GET #f[,rec]', 'Read a random record.'],
  ['PUT', 0xb3, 'command', 'PUT #f[,rec]', 'Write a random record.'],
  ['CLOSE', 0xb4, 'command', 'CLOSE [#f]', 'Close a file.'],
  [
    'LOAD',
    0xb5,
    'command',
    'LOAD"dev:name"[,R]',
    'Load a program from a device.',
  ],
  ['MERGE', 0xb6, 'command', 'MERGE"dev:name"', 'Merge an ASCII program in.'],
  ['FILES', 0xb7, 'command', 'FILES', 'List the files on a device.'],
  ['LSET', 0xb8, 'command', 'LSET v$=s$', 'Left-justify into a field.'],
  ['RSET', 0xb9, 'command', 'RSET v$=s$', 'Right-justify into a field.'],
  [
    'SAVE',
    0xba,
    'command',
    'SAVE"dev:name"[,A]',
    'Save the program to a device.',
  ],
  ['LFILES', 0xbb, 'command', 'LFILES', 'List the files on the printer.'],
  ['CIRCLE', 0xbc, 'command', 'CIRCLE (x,y),r[,c]', 'Draw a circle or arc.'],
  ['COLOR', 0xbd, 'command', 'COLOR [fg][,bg][,bd]', 'Set the screen colours.'],
  [
    'DRAW',
    0xbe,
    'command',
    'DRAW "cmds"',
    'Draw from a graphics macro string.',
  ],
  ['PAINT', 0xbf, 'command', 'PAINT (x,y)[,c]', 'Flood-fill from a point.'],
  ['BEEP', 0xc0, 'command', 'BEEP', 'Sound the console beep.'],
  [
    'PLAY',
    0xc1,
    'command',
    'PLAY "a"[,"b"[,"c"]]',
    'Play music macro strings.',
  ],
  ['PSET', 0xc2, 'command', 'PSET (x,y)[,c]', 'Set a graphics pixel.'],
  ['PRESET', 0xc3, 'command', 'PRESET (x,y)[,c]', 'Reset a graphics pixel.'],
  ['SOUND', 0xc4, 'command', 'SOUND reg,value', 'Write a PSG register.'],
  ['SCREEN', 0xc5, 'command', 'SCREEN mode[,sprite]', 'Select a screen mode.'],
  ['VPOKE', 0xc6, 'command', 'VPOKE addr,byte', 'Write a byte to video RAM.'],
  ['SPRITE', 0xc7, 'command', 'SPRITE$(n)=pat$', 'Define or trap a sprite.'],
  ['VDP', 0xc8, 'command', 'VDP(n)[=v]', 'Read or write a VDP register.'],
  ['BASE', 0xc9, 'command', 'BASE(n)[=v]', 'Read or set a VRAM table address.'],
  ['CALL', 0xca, 'command', 'CALL name[(args)]', 'Call a cartridge extension.'],
  ['TIME', 0xcb, 'command', 'TIME[=n]', 'The interrupt tick counter.'],
  ['KEY', 0xcc, 'command', 'KEY n,"text"', 'Set or display a function key.'],
  ['MAX', 0xcd, 'command', 'MAXFILES=n', 'Set the number of file buffers.'],
  ['MOTOR', 0xce, 'command', 'MOTOR [ON|OFF]', 'Drive the cassette motor.'],
  ['BLOAD', 0xcf, 'command', 'BLOAD"dev:name"[,R]', 'Load a binary image.'],
  ['BSAVE', 0xd0, 'command', 'BSAVE"dev:name",s,e[,x]', 'Save a memory range.'],
  ['DSKO$', 0xd1, 'command', 'DSKO$ drive,sector', 'Write a disk sector.'],
  ['SET', 0xd2, 'command', 'SET PASSWORD "p"', 'Set a disk option.'],
  ['NAME', 0xd3, 'command', 'NAME "a" AS "b"', 'Rename a disk file.'],
  ['KILL', 0xd4, 'command', 'KILL "name"', 'Delete a disk file.'],
  ['IPL', 0xd5, 'command', 'IPL "cmd"', 'Set the boot command.'],
  ['COPY', 0xd6, 'command', 'COPY "a" TO "b"', 'Copy a file.'],
  ['CMD', 0xd7, 'command', 'CMD name', 'Issue an extension command.'],
  ['LOCATE', 0xd8, 'command', 'LOCATE x,y[,cursor]', 'Move the text cursor.'],
  ['TO', 0xd9, 'operator', 'TO', 'Range/limit keyword.'],
  ['THEN', 0xda, 'operator', 'THEN', 'Consequent of IF.'],
  ['TAB(', 0xdb, 'function', 'TAB(n)', 'Move the print column (absolute).'],
  ['STEP', 0xdc, 'operator', 'STEP c', 'FOR loop increment.'],
  ['USR', 0xdd, 'function', 'USR[n](x)', 'Call a machine-code routine.'],
  ['FN', 0xde, 'function', 'FNn(x)', 'Call a user-defined function.'],
  ['SPC(', 0xdf, 'function', 'SPC(n)', 'Print n spaces.'],
  ['NOT', 0xe0, 'operator', 'NOT x', 'Bitwise/logical NOT.'],
  ['ERL', 0xe1, 'function', 'ERL', 'Line where the last error occurred.'],
  ['ERR', 0xe2, 'function', 'ERR', 'Code of the last error.'],
  ['STRING$', 0xe3, 'function', 'STRING$(n,c)', 'A string of n copies of c.'],
  ['USING', 0xe4, 'operator', 'PRINT USING fmt$;v', 'Formatted print.'],
  ['INSTR', 0xe5, 'function', 'INSTR([i,]s$,t$)', 'Find t$ within s$.'],
  ['VARPTR', 0xe7, 'function', 'VARPTR(v)', 'Address of a variable.'],
  ['CSRLIN', 0xe8, 'function', 'CSRLIN', 'Current cursor row.'],
  ['ATTR$', 0xe9, 'function', 'ATTR$', 'Attributes of the last file found.'],
  ['DSKI$', 0xea, 'function', 'DSKI$(drive,sector)', 'Read a disk sector.'],
  ['OFF', 0xeb, 'operator', 'KEY(n) OFF', 'Disable an event trap.'],
  ['INKEY$', 0xec, 'function', 'INKEY$', 'Read one key without waiting.'],
  ['POINT', 0xed, 'function', 'POINT(x,y)', 'Colour of a graphics pixel.'],
  ['>', 0xee, 'operator', 'a>b', 'Greater than.'],
  ['=', 0xef, 'operator', 'a=b', 'Equals / assignment.'],
  ['<', 0xf0, 'operator', 'a<b', 'Less than.'],
  ['+', 0xf1, 'operator', 'a+b', 'Add / concatenate.'],
  ['-', 0xf2, 'operator', 'a-b', 'Subtract / negate.'],
  ['*', 0xf3, 'operator', 'a*b', 'Multiply.'],
  ['/', 0xf4, 'operator', 'a/b', 'Divide.'],
  ['^', 0xf5, 'operator', 'a^b', 'Raise to a power.'],
  ['AND', 0xf6, 'operator', 'a AND b', 'Bitwise AND.'],
  ['OR', 0xf7, 'operator', 'a OR b', 'Bitwise OR.'],
  ['XOR', 0xf8, 'operator', 'a XOR b', 'Bitwise exclusive OR.'],
  ['EQV', 0xf9, 'operator', 'a EQV b', 'Bitwise equivalence.'],
  ['IMP', 0xfa, 'operator', 'a IMP b', 'Bitwise implication.'],
  ['MOD', 0xfb, 'operator', 'a MOD b', 'Remainder of integer division.'],
  ['\\', 0xfc, 'operator', 'a\\b', 'Integer division.'],
  ['LEFT$', 0xff81, 'function', 'LEFT$(s$,n)', 'The leftmost n characters.'],
  ['RIGHT$', 0xff82, 'function', 'RIGHT$(s$,n)', 'The rightmost n characters.'],
  ['MID$', 0xff83, 'function', 'MID$(s$,i[,n])', 'A substring of s$.'],
  ['SGN', 0xff84, 'function', 'SGN(x)', 'Sign of x (-1/0/1).'],
  ['INT', 0xff85, 'function', 'INT(x)', 'Floor to a whole number.'],
  ['ABS', 0xff86, 'function', 'ABS(x)', 'Absolute value.'],
  ['SQR', 0xff87, 'function', 'SQR(x)', 'Square root.'],
  ['RND', 0xff88, 'function', 'RND(x)', 'Random number.'],
  ['SIN', 0xff89, 'function', 'SIN(x)', 'Sine of x radians.'],
  ['LOG', 0xff8a, 'function', 'LOG(x)', 'Natural logarithm.'],
  ['EXP', 0xff8b, 'function', 'EXP(x)', 'e raised to x.'],
  ['COS', 0xff8c, 'function', 'COS(x)', 'Cosine of x radians.'],
  ['TAN', 0xff8d, 'function', 'TAN(x)', 'Tangent of x radians.'],
  ['ATN', 0xff8e, 'function', 'ATN(x)', 'Arctangent, in radians.'],
  ['FRE', 0xff8f, 'function', 'FRE(x)', 'Free program or string bytes.'],
  ['INP', 0xff90, 'function', 'INP(port)', 'Read a byte from a port.'],
  ['POS', 0xff91, 'function', 'POS(x)', 'Current print column.'],
  ['LEN', 0xff92, 'function', 'LEN(s$)', 'Length of a string.'],
  ['STR$', 0xff93, 'function', 'STR$(x)', 'A number as a string.'],
  ['VAL', 0xff94, 'function', 'VAL(s$)', 'A string as a number.'],
  ['ASC', 0xff95, 'function', 'ASC(s$)', 'Code of the first character.'],
  ['CHR$', 0xff96, 'function', 'CHR$(n)', 'The character with code n.'],
  ['PEEK', 0xff97, 'function', 'PEEK(addr)', 'Read a byte of memory.'],
  ['VPEEK', 0xff98, 'function', 'VPEEK(addr)', 'Read a byte of video RAM.'],
  ['SPACE$', 0xff99, 'function', 'SPACE$(n)', 'A string of n spaces.'],
  ['OCT$', 0xff9a, 'function', 'OCT$(x)', 'A number as octal digits.'],
  ['HEX$', 0xff9b, 'function', 'HEX$(x)', 'A number as hex digits.'],
  ['LPOS', 0xff9c, 'function', 'LPOS(x)', 'Current printer column.'],
  ['BIN$', 0xff9d, 'function', 'BIN$(x)', 'A number as binary digits.'],
  ['CINT', 0xff9e, 'function', 'CINT(x)', 'Convert to integer.'],
  ['CSNG', 0xff9f, 'function', 'CSNG(x)', 'Convert to single precision.'],
  ['CDBL', 0xffa0, 'function', 'CDBL(x)', 'Convert to double precision.'],
  ['FIX', 0xffa1, 'function', 'FIX(x)', 'Truncate towards zero.'],
  ['STICK', 0xffa2, 'function', 'STICK(n)', 'Joystick or cursor direction.'],
  ['STRIG', 0xffa3, 'function', 'STRIG(n)', 'Trigger or space-bar state.'],
  ['PDL', 0xffa4, 'function', 'PDL(n)', 'Read a paddle.'],
  ['PAD', 0xffa5, 'function', 'PAD(n)', 'Read the touch pad.'],
  ['DSKF', 0xffa6, 'function', 'DSKF(drive)', 'Free clusters on a disk.'],
  ['FPOS', 0xffa7, 'function', 'FPOS(#f)', 'Position within a file.'],
  ['CVI', 0xffa8, 'function', 'CVI(s$)', 'Two bytes back to an integer.'],
  ['CVS', 0xffa9, 'function', 'CVS(s$)', 'Four bytes back to a single.'],
  ['CVD', 0xffaa, 'function', 'CVD(s$)', 'Eight bytes back to a double.'],
  ['EOF', 0xffab, 'function', 'EOF(#f)', 'True at end of file.'],
  ['LOC', 0xffac, 'function', 'LOC(#f)', 'Current record number.'],
  ['LOF', 0xffad, 'function', 'LOF(#f)', 'Length of a file.'],
  ['MKI$', 0xffae, 'function', 'MKI$(x)', 'An integer as two bytes.'],
  ['MKS$', 0xffaf, 'function', 'MKS$(x)', 'A single as four bytes.'],
  ['MKD$', 0xffb0, 'function', 'MKD$(x)', 'A double as eight bytes.'],
];

/** Words after which a number is a line reference rather than a constant. */
const LINE_REF_WORDS = new Set([
  'GOTO',
  'GOSUB',
  'THEN',
  'ELSE',
  'RESTORE',
  'RESUME',
  'RETURN',
  'RUN',
  'LIST',
  'LLIST',
  'DELETE',
  'AUTO',
  'RENUM',
  'ERL',
]);

/** Words after which the rest of the line or statement is stored verbatim. */
const VERBATIM: Record<string, 'line' | 'statement'> = {
  REM: 'line',
  DATA: 'statement',
};

export const hb10pKeywords: Hb10pKeyword[] = TABLE.map(
  ([word, token, kind, signature, doc]) => ({
    word,
    token,
    kind,
    ...(signature ? { signature } : {}),
    ...(doc ? { doc } : {}),
    ...(VERBATIM[word] ? { verbatimRest: VERBATIM[word] } : {}),
    ...(LINE_REF_WORDS.has(word) ? { lineRefs: true as const } : {}),
  }),
);

/**
 * Entry-only synonyms. `?` is PRINT and `'` is a REM to end of line, both of
 * which LIST gives back in their stored form - `?` as PRINT, `'` as itself.
 */
export const HB10P_ALIASES: Hb10pKeyword[] = [
  { word: '?', token: 0x91, kind: 'command', alias: true },
  {
    word: "'",
    token: 0xe6,
    kind: 'command',
    alias: true,
    verbatimRest: 'line',
  },
];

/**
 * Tokens stored behind a leading 0x3A that LIST does not show. The colon is
 * genuinely in the program bytes, so a CSAVE from here matches one from the
 * machine; the detokenizer folds each sequence back to the bare word.
 */
export const HB10P_PREFIXED: { word: string; bytes: number[] }[] = [
  { word: 'ELSE', bytes: [0x3a, 0xa1] },
  { word: "'", bytes: [0x3a, 0x8f, 0xe6] },
];

/**
 * The relational spellings MSX BASIC accepts but does not tokenize as one
 * byte: the ROM stores `<=` as the `<` and `=` tokens side by side.
 */
export const hb10pOperators = ['<=', '=<', '>=', '=>', '<>', '><'] as const;

/** Keywords (canonical + aliases) sorted longest-spelling first, for greedy
 *  left-to-right matching. */
export const hb10pKeywordsByLength: Hb10pKeyword[] = [
  ...hb10pKeywords,
  ...HB10P_ALIASES,
].sort((a, b) => b.word.length - a.word.length);

/** Token -> canonical spelling, for the detokenizer / LIST. */
export const hb10pWordByToken = new Map<number, Hb10pKeyword>(
  hb10pKeywords.map((k) => [k.token, k]),
);
