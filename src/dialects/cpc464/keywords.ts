import type { KeywordInfo } from '../types';

/**
 * Which Locomotive BASIC the keyword table targets: 1.0 (CPC 464) or 1.1
 * (CPC 664/6128). The variant seam mirrors bbcmicro's BASIC_II/BASIC_IV flag
 * so the cpc6128 dialect is one import away. See
 * docs/contributing/dialect-plans/cpc464.md Stage 1.
 */
export type LocoBasicVariant = 'basic10' | 'basic11';

/**
 * One Locomotive BASIC keyword, with the extra data the native tokenizer
 * needs on top of the editor-facing {@link KeywordInfo}. Token values are the
 * genuine Locomotive BASIC bytes from the CPCWiki token table (see the plan's
 * primary references); byte-exactness against the real ROM is re-verified when
 * the emulator lands in Stage 2.
 */
export interface LocoKeyword extends KeywordInfo {
  /**
   * Token byte sequence the tokenizer emits: one byte for the statement/
   * operator tokens in `&80-&FE`, or `[0xff, n]` for the two-byte function
   * tokens. Absent for editor-only phrase sugar (`SPEED WRITE`,
   * `SYMBOL AFTER`, …) that tokenizes word by word - those entries exist for
   * autocomplete/docs and never match as a unit.
   */
  bytes?: number[];
  /** Present on Locomotive BASIC 1.1 additions (absent = in 1.0 too). */
  since?: 'basic11';
  /**
   * After this keyword the tokenizer encodes following integer constants in
   * the `&1E` 16-bit line-number form (GOTO/GOSUB/THEN/ELSE/RUN/LIST/…).
   */
  lino?: boolean;
}

/** Identity value for {@link KeywordInfo.token} (editor-facing only). */
const id = (bytes: number[]): number =>
  bytes.length === 1 ? bytes[0]! : (bytes[0]! << 8) | bytes[1]!;

const cmd = (
  word: string,
  bytes: number[],
  doc: string,
  extra: Partial<LocoKeyword> = {},
): LocoKeyword => ({
  word,
  token: id(bytes),
  bytes,
  kind: 'command',
  doc,
  ...extra,
});

const op = (word: string, byte: number, doc: string): LocoKeyword => ({
  word,
  token: byte,
  bytes: [byte],
  kind: 'operator',
  doc,
});

const fn = (
  word: string,
  bytes: number[],
  doc: string,
  extra: Partial<LocoKeyword> = {},
): LocoKeyword => ({
  word,
  token: id(bytes),
  bytes,
  kind: 'function',
  doc,
  ...extra,
});

/** Editor-only phrase sugar: tokenizes word by word, listed for completion. */
const phrase = (
  word: string,
  tokenOf: number,
  doc: string,
  extra: Partial<LocoKeyword> = {},
): LocoKeyword => ({
  word,
  token: 0x10000 | tokenOf,
  kind: 'command',
  doc,
  ...extra,
});

/**
 * The complete Locomotive BASIC keyword table (1.0 plus the 1.1 additions
 * tagged `since: 'basic11'`). Single-byte statement/operator tokens
 * `&80-&FE`, two-byte `&FF`-prefixed function tokens. Ordered by token.
 */
export const locoKeywordTable: LocoKeyword[] = [
  cmd('AFTER', [0x80], 'Call a subroutine after a delay (1/50s units).', {
    signature: 'AFTER delay[,timer] GOSUB line',
  }),
  cmd('AUTO', [0x81], 'Automatic line numbering (editor command).', {
    signature: 'AUTO [start][,step]',
    lino: true,
  }),
  cmd('BORDER', [0x82], 'Set the border colour (two colours flash).', {
    signature: 'BORDER colour[,colour]',
  }),
  cmd('CALL', [0x83], 'Call a machine-code routine.', {
    signature: 'CALL addr[,params]',
  }),
  cmd('CAT', [0x84], 'Catalogue the cassette/disc.'),
  cmd('CHAIN', [0x85], 'Load and run another program.', {
    signature: 'CHAIN "name"[,line]',
  }),
  cmd('CLEAR', [0x86], 'Clear all variables.'),
  cmd('CLG', [0x87], 'Clear the graphics screen.', { signature: 'CLG [ink]' }),
  cmd('CLOSEIN', [0x88], 'Close the input file.'),
  cmd('CLOSEOUT', [0x89], 'Close the output file.'),
  cmd('CLS', [0x8a], 'Clear the screen (or a window).', {
    signature: 'CLS [#stream]',
  }),
  cmd('CONT', [0x8b], 'Continue after break or STOP.'),
  cmd('DATA', [0x8c], 'Inline data for READ.', {
    signature: 'DATA item[,item]…',
  }),
  cmd('DEF', [0x8d], 'Define a function.', {
    signature: 'DEF FNname[(args)]=expr',
  }),
  cmd('DEFINT', [0x8e], 'Default listed initial letters to integer type.', {
    signature: 'DEFINT letter[-letter]',
  }),
  cmd('DEFREAL', [0x8f], 'Default listed initial letters to real type.', {
    signature: 'DEFREAL letter[-letter]',
  }),
  cmd('DEFSTR', [0x90], 'Default listed initial letters to string type.', {
    signature: 'DEFSTR letter[-letter]',
  }),
  cmd('DEG', [0x91], 'Degrees mode for trigonometry.'),
  cmd('DELETE', [0x92], 'Delete a range of lines (editor command).', {
    signature: 'DELETE start-end',
    lino: true,
  }),
  cmd('DIM', [0x93], 'Dimension an array.', { signature: 'DIM a(n[,m]…)' }),
  cmd('DRAW', [0x94], 'Draw a line to graphics point x,y.', {
    signature: 'DRAW x,y[,ink]',
  }),
  cmd('DRAWR', [0x95], 'Draw a line relative to the graphics cursor.', {
    signature: 'DRAWR dx,dy[,ink]',
  }),
  cmd('EDIT', [0x96], 'Edit a program line (editor command).', {
    signature: 'EDIT line',
    lino: true,
  }),
  cmd('ELSE', [0x97], 'Alternative branch of IF…THEN.', { lino: true }),
  cmd('END', [0x98], 'End the program.'),
  cmd('ENT', [0x99], 'Define a tone envelope.', {
    signature: 'ENT n,…(up to 5 sections)',
  }),
  cmd('ENV', [0x9a], 'Define a volume envelope.', {
    signature: 'ENV n,…(up to 5 sections)',
  }),
  cmd('ERASE', [0x9b], 'Erase arrays.', { signature: 'ERASE a[,b]…' }),
  cmd('ERROR', [0x9c], 'Raise an error.', { signature: 'ERROR n' }),
  cmd('EVERY', [0x9d], 'Call a subroutine repeatedly (1/50s units).', {
    signature: 'EVERY period[,timer] GOSUB line',
  }),
  cmd('FOR', [0x9e], 'Start a counted loop.', {
    signature: 'FOR v=a TO b [STEP s]',
  }),
  cmd('GOSUB', [0x9f], 'Call a subroutine by line number.', {
    signature: 'GOSUB line',
    lino: true,
  }),
  cmd('GOTO', [0xa0], 'Jump to a line number.', {
    signature: 'GOTO line',
    lino: true,
  }),
  cmd('IF', [0xa1], 'Conditional execution.', {
    signature: 'IF cond THEN … [ELSE …]',
  }),
  cmd('INK', [0xa2], 'Assign a colour to a pen (two colours flash).', {
    signature: 'INK pen,colour[,colour]',
  }),
  cmd('INPUT', [0xa3], 'Read values from the keyboard or a file.', {
    signature: 'INPUT [#s,]["prompt";]var[,var]…',
  }),
  cmd('KEY', [0xa4], 'Define an expansion (function-key) string.', {
    signature: 'KEY n,a$',
  }),
  cmd('LET', [0xa5], 'Assignment (LET is optional).', {
    signature: 'LET v=expr',
  }),
  cmd('LINE', [0xa6], 'LINE INPUT reads a whole line of text.', {
    signature: 'LINE INPUT [#s,]a$',
  }),
  cmd('LIST', [0xa7], 'List the program.', {
    signature: 'LIST [start-end][,#stream]',
    lino: true,
  }),
  cmd('LOAD', [0xa8], 'Load a program.', { signature: 'LOAD "name"[,addr]' }),
  cmd('LOCATE', [0xa9], 'Move the text cursor.', {
    signature: 'LOCATE [#s,]x,y',
  }),
  cmd('MEMORY', [0xaa], 'Set the top of BASIC memory (HIMEM).', {
    signature: 'MEMORY addr',
  }),
  cmd('MERGE', [0xab], 'Merge a program from tape/disc.', {
    signature: 'MERGE "name"',
  }),
  // Statement-position assignable (MID$(a$,p[,n])="…") as well as a function,
  // which is why it lives in the single-byte statement range.
  fn('MID$', [0xac], 'Substring (also assignable as a statement).', {
    signature: 'MID$(a$,start[,len])',
  }),
  cmd('MODE', [0xad], 'Select screen mode 0-2.', { signature: 'MODE n' }),
  cmd('MOVE', [0xae], 'Move the graphics cursor.', { signature: 'MOVE x,y' }),
  cmd('MOVER', [0xaf], 'Move the graphics cursor relatively.', {
    signature: 'MOVER dx,dy',
  }),
  cmd('NEXT', [0xb0], 'End of a FOR loop.', { signature: 'NEXT [v]' }),
  cmd('NEW', [0xb1], 'Erase the current program.'),
  cmd('ON', [0xb2], 'Computed jump.', { signature: 'ON n GOSUB/GOTO line,…' }),
  // A single token covering the two words (likewise ON ERROR GOTO below).
  cmd('ON BREAK', [0xb3], 'Trap the ESC (break) key.', {
    signature: 'ON BREAK GOSUB line',
  }),
  cmd('ON ERROR GOTO', [0xb4], 'Trap runtime errors.', {
    signature: 'ON ERROR GOTO line',
    lino: true,
  }),
  // &B5 is SQ in statement position ("ON SQ(n) GOSUB"); the expression form is
  // the &FF &17 function below. The tokenizer picks by context, so the editor
  // table carries only the function entry (see SQ_STATEMENT_TOKEN).
  cmd('OPENIN', [0xb6], 'Open a file for input.', {
    signature: 'OPENIN "name"',
  }),
  cmd('OPENOUT', [0xb7], 'Open a file for output.', {
    signature: 'OPENOUT "name"',
  }),
  cmd('ORIGIN', [0xb8], 'Set the graphics origin (and window).', {
    signature: 'ORIGIN x,y[,left,right,top,bottom]',
  }),
  cmd('OUT', [0xb9], 'Write a byte to an I/O port.', {
    signature: 'OUT port,n',
  }),
  cmd('PAPER', [0xba], 'Set the text background pen.', {
    signature: 'PAPER [#s,]pen',
  }),
  cmd('PEN', [0xbb], 'Set the text foreground pen.', {
    signature: 'PEN [#s,]pen',
  }),
  cmd('PLOT', [0xbc], 'Plot a graphics point.', {
    signature: 'PLOT x,y[,ink]',
  }),
  cmd('PLOTR', [0xbd], 'Plot relative to the graphics cursor.', {
    signature: 'PLOTR dx,dy[,ink]',
  }),
  cmd('POKE', [0xbe], 'Write a byte of memory.', { signature: 'POKE addr,n' }),
  cmd('PRINT', [0xbf], 'Print to the screen or a stream.', {
    signature: 'PRINT [#s,][expr][;|,]…',
  }),
  cmd("'", [0xc0], 'Comment shorthand (same as REM).'),
  cmd('RAD', [0xc1], 'Radians mode for trigonometry.'),
  cmd('RANDOMIZE', [0xc2], 'Seed the random number generator.', {
    signature: 'RANDOMIZE [n]',
  }),
  cmd('READ', [0xc3], 'Read the next DATA item(s).', {
    signature: 'READ var[,var]…',
  }),
  cmd('RELEASE', [0xc4], 'Release held sound channels.', {
    signature: 'RELEASE channels',
  }),
  cmd('REM', [0xc5], 'Comment line.', { signature: 'REM comment' }),
  cmd('RENUM', [0xc6], 'Renumber the program.', {
    signature: 'RENUM [new][,old][,step]',
    lino: true,
  }),
  cmd('RESTORE', [0xc7], 'Reset the DATA pointer.', {
    signature: 'RESTORE [line]',
    lino: true,
  }),
  cmd('RESUME', [0xc8], 'Resume after an error.', {
    signature: 'RESUME [line|NEXT]',
    lino: true,
  }),
  cmd('RETURN', [0xc9], 'Return from a GOSUB.'),
  cmd('RUN', [0xca], 'Run the program (or load and run).', {
    signature: 'RUN [line | "name"]',
    lino: true,
  }),
  cmd('SAVE', [0xcb], 'Save the program.', {
    signature: 'SAVE "name"[,type]',
  }),
  cmd('SOUND', [0xcc], 'Make a sound.', {
    signature: 'SOUND channel,period[,dur[,vol[,env[,ent[,noise]]]]]',
  }),
  cmd('SPEED', [0xcd], 'SPEED WRITE / INK / KEY settings.', {
    signature: 'SPEED WRITE n',
  }),
  cmd('STOP', [0xce], 'Stop with a break report.'),
  cmd('SYMBOL', [0xcf], 'Redefine a character shape.', {
    signature: 'SYMBOL code,row,…',
  }),
  cmd('TAG', [0xd0], 'Write text at the graphics cursor.', {
    signature: 'TAG [#s]',
  }),
  cmd('TAGOFF', [0xd1], 'Return text to the text cursor.', {
    signature: 'TAGOFF [#s]',
  }),
  cmd('TROFF', [0xd2], 'Turn off line tracing.'),
  cmd('TRON', [0xd3], 'Trace line numbers as they execute.'),
  cmd('WAIT', [0xd4], 'Wait for an I/O port state.', {
    signature: 'WAIT port,mask[,inversion]',
  }),
  cmd('WEND', [0xd5], 'End of a WHILE loop.'),
  cmd('WHILE', [0xd6], 'Loop while a condition holds.', {
    signature: 'WHILE cond',
  }),
  cmd('WIDTH', [0xd7], 'Set the printer line width.', {
    signature: 'WIDTH n',
  }),
  cmd('WINDOW', [0xd8], 'Define a text window.', {
    signature: 'WINDOW [#s,]left,right,top,bottom',
  }),
  cmd('WRITE', [0xd9], 'Write values to the screen or a file.', {
    signature: 'WRITE [#s,]expr[,expr]…',
  }),
  cmd('ZONE', [0xda], 'Set the print comma-column width.', {
    signature: 'ZONE n',
  }),
  cmd('DI', [0xdb], 'Disable timer interrupts.'),
  cmd('EI', [0xdc], 'Enable timer interrupts.'),
  cmd('FILL', [0xdd], 'Flood-fill from the graphics cursor.', {
    signature: 'FILL ink',
    since: 'basic11',
  }),
  cmd('GRAPHICS', [0xde], 'GRAPHICS PEN / PAPER prefix.', {
    signature: 'GRAPHICS PEN [ink][,mode]',
    since: 'basic11',
  }),
  cmd('MASK', [0xdf], 'Set the line-drawing dot pattern.', {
    signature: 'MASK [pattern][,first]',
    since: 'basic11',
  }),
  cmd('FRAME', [0xe0], 'Wait for a display frame flyback.', {
    since: 'basic11',
  }),
  cmd('CURSOR', [0xe1], 'Switch the text cursor on or off.', {
    signature: 'CURSOR [system][,user]',
    since: 'basic11',
  }),
  fn('ERL', [0xe3], 'Line number of the last error.'),
  fn('FN', [0xe4], 'Call a user-defined function.', {
    signature: 'FNname[(args)]',
  }),
  fn('SPC', [0xe5], 'Print n spaces.', { signature: 'SPC(n)' }),
  cmd('STEP', [0xe6], 'Loop increment in FOR.'),
  cmd('SWAP', [0xe7], 'WINDOW SWAP - exchange two streams.', {
    signature: 'WINDOW SWAP s,s',
  }),
  fn('TAB', [0xea], 'Position the cursor within PRINT.', {
    signature: 'TAB(x)',
  }),
  cmd('THEN', [0xeb], 'Follows the condition in IF.', { lino: true }),
  cmd('TO', [0xec], 'Loop limit in FOR.'),
  cmd('USING', [0xed], 'Format printed values.', {
    signature: 'PRINT USING format;expr',
  }),
  op('>', 0xee, 'Greater than.'),
  op('=', 0xef, 'Assignment / equality.'),
  op('>=', 0xf0, 'Greater than or equal.'),
  op('<', 0xf1, 'Less than.'),
  op('<>', 0xf2, 'Not equal.'),
  op('<=', 0xf3, 'Less than or equal.'),
  op('+', 0xf4, 'Addition / concatenation.'),
  op('-', 0xf5, 'Subtraction / negation.'),
  op('*', 0xf6, 'Multiplication.'),
  op('/', 0xf7, 'Division.'),
  op('^', 0xf8, 'Exponentiation.'),
  op('\\', 0xf9, 'Integer division.'),
  op('AND', 0xfa, 'Bitwise/logical AND.'),
  op('MOD', 0xfb, 'Integer remainder.'),
  op('OR', 0xfc, 'Bitwise/logical OR.'),
  op('XOR', 0xfd, 'Bitwise/logical exclusive OR.'),
  op('NOT', 0xfe, 'Bitwise/logical NOT.'),

  // Two-byte &FF-prefixed function tokens.
  fn('ABS', [0xff, 0x00], 'Absolute value.', { signature: 'ABS(n)' }),
  fn('ASC', [0xff, 0x01], 'Character code of the first character.', {
    signature: 'ASC(a$)',
  }),
  fn('ATN', [0xff, 0x02], 'Arctangent.', { signature: 'ATN(n)' }),
  fn('CHR$', [0xff, 0x03], 'Character with code n.', { signature: 'CHR$(n)' }),
  fn('CINT', [0xff, 0x04], 'Round to a 16-bit integer.', {
    signature: 'CINT(n)',
  }),
  fn('COS', [0xff, 0x05], 'Cosine.', { signature: 'COS(n)' }),
  fn('CREAL', [0xff, 0x06], 'Convert to a real number.', {
    signature: 'CREAL(n)',
  }),
  fn('EXP', [0xff, 0x07], 'e to the power n.', { signature: 'EXP(n)' }),
  fn('FIX', [0xff, 0x08], 'Truncate towards zero.', { signature: 'FIX(n)' }),
  fn('FRE', [0xff, 0x09], 'Free BASIC memory.', {
    signature: 'FRE(0) | FRE("")',
  }),
  fn('INKEY', [0xff, 0x0a], 'Test a key by key number (-1 if up).', {
    signature: 'INKEY(n)',
  }),
  fn('INP', [0xff, 0x0b], 'Read a byte from an I/O port.', {
    signature: 'INP(port)',
  }),
  fn('INT', [0xff, 0x0c], 'Round towards minus infinity.', {
    signature: 'INT(n)',
  }),
  fn('JOY', [0xff, 0x0d], 'Read a joystick (bit mask).', {
    signature: 'JOY(n)',
  }),
  fn('LEN', [0xff, 0x0e], 'String length.', { signature: 'LEN(a$)' }),
  fn('LOG', [0xff, 0x0f], 'Natural logarithm.', { signature: 'LOG(n)' }),
  fn('LOG10', [0xff, 0x10], 'Base-10 logarithm.', { signature: 'LOG10(n)' }),
  fn('LOWER$', [0xff, 0x11], 'Lower-case copy of a string.', {
    signature: 'LOWER$(a$)',
  }),
  fn('PEEK', [0xff, 0x12], 'Read a byte of memory.', {
    signature: 'PEEK(addr)',
  }),
  fn('REMAIN', [0xff, 0x13], 'Read and disable a delay timer.', {
    signature: 'REMAIN(timer)',
  }),
  fn('SGN', [0xff, 0x14], 'Sign of n (-1, 0, 1).', { signature: 'SGN(n)' }),
  fn('SIN', [0xff, 0x15], 'Sine.', { signature: 'SIN(n)' }),
  fn('SPACE$', [0xff, 0x16], 'A string of n spaces.', {
    signature: 'SPACE$(n)',
  }),
  fn('SQ', [0xff, 0x17], 'Sound-queue state of a channel.', {
    signature: 'SQ(channel)',
  }),
  fn('SQR', [0xff, 0x18], 'Square root.', { signature: 'SQR(n)' }),
  fn('STR$', [0xff, 0x19], 'Number as a string.', { signature: 'STR$(n)' }),
  fn('TAN', [0xff, 0x1a], 'Tangent.', { signature: 'TAN(n)' }),
  fn('UNT', [0xff, 0x1b], 'Address as a signed integer.', {
    signature: 'UNT(addr)',
  }),
  fn('UPPER$', [0xff, 0x1c], 'Upper-case copy of a string.', {
    signature: 'UPPER$(a$)',
  }),
  fn('VAL', [0xff, 0x1d], 'Numeric value of a string.', {
    signature: 'VAL(a$)',
  }),
  fn('EOF', [0xff, 0x40], 'True at end of the input file.'),
  fn('ERR', [0xff, 0x41], 'Error number of the last error.'),
  fn('HIMEM', [0xff, 0x42], 'Top of BASIC memory.'),
  fn('INKEY$', [0xff, 0x43], 'Read a key as a string ("" if none).'),
  fn('PI', [0xff, 0x44], 'The constant π.'),
  fn('RND', [0xff, 0x45], 'Random number 0..1.', { signature: 'RND[(n)]' }),
  fn('TIME', [0xff, 0x46], 'Elapsed time (1/300s units).'),
  fn('XPOS', [0xff, 0x47], 'Graphics cursor x position.'),
  fn('YPOS', [0xff, 0x48], 'Graphics cursor y position.'),
  fn('DERR', [0xff, 0x49], 'Disc error number of the last error.', {
    since: 'basic11',
  }),
  fn('BIN$', [0xff, 0x71], 'Number as a binary string.', {
    signature: 'BIN$(n[,digits])',
  }),
  fn('DEC$', [0xff, 0x72], 'Number formatted to a template.', {
    signature: 'DEC$(n,format)',
    since: 'basic11',
  }),
  fn('HEX$', [0xff, 0x73], 'Number as a hex string.', {
    signature: 'HEX$(n[,digits])',
  }),
  fn('INSTR', [0xff, 0x74], 'Find b$ within a$.', {
    signature: 'INSTR([start,]a$,b$)',
  }),
  fn('LEFT$', [0xff, 0x75], 'Leftmost n characters.', {
    signature: 'LEFT$(a$,n)',
  }),
  fn('MAX', [0xff, 0x76], 'Largest of its arguments.', {
    signature: 'MAX(n[,n]…)',
  }),
  fn('MIN', [0xff, 0x77], 'Smallest of its arguments.', {
    signature: 'MIN(n[,n]…)',
  }),
  fn('POS', [0xff, 0x78], 'Text cursor column.', { signature: 'POS(#s)' }),
  fn('RIGHT$', [0xff, 0x79], 'Rightmost n characters.', {
    signature: 'RIGHT$(a$,n)',
  }),
  fn('ROUND', [0xff, 0x7a], 'Round to a number of decimals.', {
    signature: 'ROUND(n[,decimals])',
  }),
  fn('STRING$', [0xff, 0x7b], 'A character repeated n times.', {
    signature: 'STRING$(n,char)',
  }),
  fn('TEST', [0xff, 0x7c], 'Ink at graphics point x,y.', {
    signature: 'TEST(x,y)',
  }),
  fn('TESTR', [0xff, 0x7d], 'Ink at a relative graphics point.', {
    signature: 'TESTR(dx,dy)',
  }),
  fn('COPYCHR$', [0xff, 0x7e], 'Character under the text cursor.', {
    signature: 'COPYCHR$(#s)',
    since: 'basic11',
  }),
  fn('VPOS', [0xff, 0x7f], 'Text cursor row.', { signature: 'VPOS(#s)' }),

  // Editor-only phrase sugar: each word tokenizes on its own (spaces are
  // stored verbatim on the CPC), listed so autocomplete offers the idiom.
  phrase('SYMBOL AFTER', 0xcf, 'Reserve memory for redefined characters.', {
    signature: 'SYMBOL AFTER code',
  }),
  phrase('SPEED WRITE', 0xcd, 'Set the cassette write speed (0 or 1).', {
    signature: 'SPEED WRITE n',
  }),
  phrase('SPEED INK', 0xcd, 'Set the flash rate of flashing colours.', {
    signature: 'SPEED INK on,off',
  }),
  phrase('SPEED KEY', 0xcd, 'Set the keyboard auto-repeat rates.', {
    signature: 'SPEED KEY delay,repeat',
  }),
  phrase('KEY DEF', 0xa4, 'Redefine a key of the keyboard.', {
    signature: 'KEY DEF key,repeat[,normal[,shift[,ctrl]]]',
  }),
  phrase('LINE INPUT', 0xa6, 'Read a whole line of text.', {
    signature: 'LINE INPUT [#s,]a$',
  }),
  phrase('CHAIN MERGE', 0x85, 'Load and merge another program, then run.', {
    signature: 'CHAIN MERGE "name"[,line]',
  }),
  phrase('ON BREAK GOSUB', 0xb3, 'Call a subroutine when ESC breaks.', {
    signature: 'ON BREAK GOSUB line',
  }),
  phrase('ON BREAK STOP', 0xb3, 'Restore normal ESC (break) handling.'),
  phrase('WINDOW SWAP', 0xd8, 'Exchange two text streams.', {
    signature: 'WINDOW SWAP s,s',
  }),
  phrase('CLEAR INPUT', 0x86, 'Discard pending keyboard input.', {
    since: 'basic11',
  }),
  phrase('GRAPHICS PEN', 0xde, 'Set the graphics drawing ink.', {
    signature: 'GRAPHICS PEN [ink][,mode]',
    since: 'basic11',
  }),
  phrase('GRAPHICS PAPER', 0xde, 'Set the graphics background ink.', {
    signature: 'GRAPHICS PAPER ink',
    since: 'basic11',
  }),
  phrase('ON BREAK CONT', 0xb3, 'Ignore the ESC (break) key.', {
    since: 'basic11',
  }),
];

/** The SQ statement-position token ("ON SQ(n) GOSUB"); context-picked. */
export const SQ_STATEMENT_TOKEN = 0xb5;

/**
 * Spelling aliases the tokenizer accepts on top of the canonical table
 * (the ROM itself takes both forms).
 */
export const locoAliases: Record<string, string> = {
  'GO TO': 'GOTO',
  'GO SUB': 'GOSUB',
};

const forVariant = (variant: LocoBasicVariant): LocoKeyword[] =>
  locoKeywordTable.filter(
    (k) => variant === 'basic11' || k.since === undefined,
  );

/** The Locomotive BASIC editor-facing keyword table for one variant. */
export function locoKeywords(variant: LocoBasicVariant): KeywordInfo[] {
  return forVariant(variant).map((k) => ({
    word: k.word,
    token: k.token,
    kind: k.kind,
    ...(k.signature ? { signature: k.signature } : {}),
    ...(k.doc ? { doc: k.doc } : {}),
  }));
}

/**
 * A variant-specific view of the keyword table, pre-derived for the
 * tokenizer/detokenizer. The cpc6128 dialect gets its 1.1 tables through the
 * same call (the bbcmicro BASIC_II/BASIC_IV pattern).
 */
export interface LocoVariant {
  variant: LocoBasicVariant;
  /** Emitting keywords sorted longest spelling first, for greedy matching. */
  matchersByLength: { word: string; kw: LocoKeyword }[];
  /** Single-byte token -> canonical spelling, for detokenizing. */
  wordBySingleToken: Map<number, string>;
  /** `&FF`-prefixed second byte -> canonical spelling, for detokenizing. */
  wordByFfToken: Map<number, string>;
  /**
   * Words that exist only in BASIC 1.1, for the 1.0 gate: using one earns a
   * clear (non-fatal - the name is a legal 1.0 variable) TokenizeError.
   */
  missingWords: Set<string>;
}

const variantCache = new Map<LocoBasicVariant, LocoVariant>();

/** The tokenizer/detokenizer tables for one Locomotive BASIC variant. */
export function locoVariant(variant: LocoBasicVariant): LocoVariant {
  const cached = variantCache.get(variant);
  if (cached) return cached;

  const table = forVariant(variant).filter((k) => k.bytes !== undefined);
  const matchersByLength = [
    ...table.map((k) => ({ word: k.word, kw: k })),
    ...Object.entries(locoAliases)
      .map(([alias, canonical]) => ({
        alias,
        kw: table.find((k) => k.word === canonical),
      }))
      .filter(
        (e): e is { alias: string; kw: LocoKeyword } => e.kw !== undefined,
      )
      .map((e) => ({ word: e.alias, kw: e.kw })),
  ].sort((a, b) => b.word.length - a.word.length);

  const wordBySingleToken = new Map<number, string>();
  const wordByFfToken = new Map<number, string>();
  for (const k of table) {
    const bytes = k.bytes!;
    if (bytes.length === 1) wordBySingleToken.set(bytes[0]!, k.word);
    else wordByFfToken.set(bytes[1]!, k.word);
  }
  wordBySingleToken.set(SQ_STATEMENT_TOKEN, 'SQ');

  const missingWords = new Set(
    variant === 'basic10'
      ? locoKeywordTable
          .filter((k) => k.since === 'basic11' && !k.word.includes(' '))
          .map((k) => k.word)
      : [],
  );

  const built: LocoVariant = {
    variant,
    matchersByLength,
    wordBySingleToken,
    wordByFfToken,
    missingWords,
  };
  variantCache.set(variant, built);
  return built;
}

/** Locomotive BASIC 1.0 keywords (CPC 464), as the editor sees them. */
export const cpc464Keywords: KeywordInfo[] = locoKeywords('basic10');
