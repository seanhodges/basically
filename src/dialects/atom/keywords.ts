import type { KeywordInfo } from '../types';

/**
 * Acorn Atom BASIC keyword table.
 *
 * Unlike the BBC, the Atom barely tokenises: a program line is stored as ASCII
 * text (see {@link import('./tokenizer').tokenizeProgram}), so these entries do
 * **not** drive byte output. They exist purely for editor highlighting and
 * autocomplete, which key off {@link KeywordInfo.word} and {@link KeywordInfo.kind};
 * the {@link KeywordInfo.token} field is unused here, so it carries a unique
 * sequential value only to satisfy the type.
 *
 * Covers the resident BASIC plus the floating-point ROM words available on the
 * `Atom-Tape-FP` machine this dialect targets. Many keywords have the canonical
 * single-letter-plus-`.` abbreviation (`P.` for `PRINT`); those are expanded by
 * the ROM and pass through the tokenizer as literal text, so only the full
 * spellings are listed.
 */
const table: Omit<KeywordInfo, 'token'>[] = [
  // ---- Statements / commands ----
  {
    word: 'PRINT',
    kind: 'command',
    signature: 'PRINT [expr][,|;|$|!|&|"…"]',
    doc: 'Print to the screen. Abbreviate as P. — "," tabs, ";" no-gap, & prints hex, $ prints a string.',
  },
  {
    word: 'INPUT',
    kind: 'command',
    signature: 'INPUT ["prompt",] var',
    doc: 'Read a number (or string with $) from the keyboard into a variable.',
  },
  {
    word: 'IF',
    kind: 'command',
    signature: 'IF expr THEN statement',
    doc: 'Conditional. Atom BASIC has no ELSE.',
  },
  {
    word: 'THEN',
    kind: 'command',
    signature: 'IF expr THEN …',
    doc: 'Introduces the statement run when an IF condition is true.',
  },
  {
    word: 'GOTO',
    kind: 'command',
    signature: 'GOTO line',
    doc: 'Jump to a line number (or computed expression). Abbreviate as G.',
  },
  {
    word: 'GOSUB',
    kind: 'command',
    signature: 'GOSUB line',
    doc: 'Call a subroutine; RETURN comes back. Abbreviate as GOS.',
  },
  {
    word: 'RETURN',
    kind: 'command',
    signature: 'RETURN',
    doc: 'Return from a GOSUB.',
  },
  {
    word: 'FOR',
    kind: 'command',
    signature: 'FOR v=start TO end [STEP s]',
    doc: 'Begin a counted loop closed by NEXT.',
  },
  {
    word: 'TO',
    kind: 'operator',
    signature: 'FOR v=a TO b',
    doc: 'Loop bound separator in FOR.',
  },
  {
    word: 'STEP',
    kind: 'operator',
    signature: 'FOR v=a TO b STEP s',
    doc: 'Loop increment (may be negative).',
  },
  {
    word: 'NEXT',
    kind: 'command',
    signature: 'NEXT [v]',
    doc: 'Close the innermost FOR loop.',
  },
  {
    word: 'DO',
    kind: 'command',
    signature: 'DO … UNTIL expr',
    doc: 'Begin a loop that repeats UNTIL a condition is true.',
  },
  {
    word: 'UNTIL',
    kind: 'command',
    signature: 'UNTIL expr',
    doc: 'Close a DO loop; repeat until the expression is true.',
  },
  {
    word: 'REM',
    kind: 'command',
    signature: 'REM text',
    doc: 'A comment; the rest of the line is ignored.',
  },
  {
    word: 'LET',
    kind: 'command',
    signature: 'LET v=expr',
    doc: 'Assign a value (optional — v=expr works too).',
  },
  {
    word: 'DIM',
    kind: 'command',
    signature: 'DIM name(size)',
    doc: 'Reserve space for an array or byte buffer.',
  },
  {
    word: 'LINK',
    kind: 'command',
    signature: 'LINK addr',
    doc: 'Call a machine-code routine at a hex/decimal address.',
  },
  {
    word: 'WAIT',
    kind: 'command',
    signature: 'WAIT',
    doc: 'Pause for one frame (≈1/50 s); used to pace animation.',
  },
  {
    word: 'CLEAR',
    kind: 'command',
    signature: 'CLEAR n',
    doc: 'Select a graphics mode (CLEAR 0–4) and clear the screen.',
  },
  {
    word: 'MOVE',
    kind: 'command',
    signature: 'MOVE x,y',
    doc: 'Move the graphics cursor without drawing.',
  },
  {
    word: 'DRAW',
    kind: 'command',
    signature: 'DRAW x,y',
    doc: 'Draw a line from the graphics cursor to x,y.',
  },
  {
    word: 'PLOT',
    kind: 'command',
    signature: 'PLOT mode,x,y',
    doc: 'Plot/draw with a mode controlling set/clear/invert.',
  },
  {
    word: 'END',
    kind: 'command',
    signature: 'END',
    doc: 'Stop the program cleanly.',
  },
  {
    word: 'RUN',
    kind: 'command',
    signature: 'RUN',
    doc: 'Run the program from the lowest line.',
  },
  {
    word: 'LIST',
    kind: 'command',
    signature: 'LIST [a,b]',
    doc: 'List the program.',
  },
  {
    word: 'NEW',
    kind: 'command',
    signature: 'NEW',
    doc: 'Erase the program in memory.',
  },
  {
    word: 'OLD',
    kind: 'command',
    signature: 'OLD',
    doc: 'Recover a program after NEW (if intact).',
  },
  {
    word: 'LOAD',
    kind: 'command',
    signature: 'LOAD "name"',
    doc: 'Load a program from cassette.',
  },
  {
    word: 'SAVE',
    kind: 'command',
    signature: 'SAVE "name"',
    doc: 'Save the program to cassette.',
  },
  {
    word: 'SHUT',
    kind: 'command',
    signature: 'SHUT',
    doc: 'Close all open cassette/disc files.',
  },
  {
    word: 'PUT',
    kind: 'command',
    signature: 'PUT port,value',
    doc: 'Write a value to an I/O port.',
  },
  {
    word: 'STOP',
    kind: 'command',
    signature: 'STOP',
    doc: 'Halt with a STOP report.',
  },

  // ---- Functions ----
  {
    word: 'ABS',
    kind: 'function',
    signature: 'ABS(n)',
    doc: 'Absolute value.',
  },
  { word: 'RND', kind: 'function', signature: 'RND', doc: 'A random number.' },
  {
    word: 'TOP',
    kind: 'function',
    signature: 'TOP',
    doc: 'Address of the byte just past the program text.',
  },
  {
    word: 'CH',
    kind: 'function',
    signature: 'CH n',
    doc: 'Read a character / key code.',
  },
  {
    word: 'GET',
    kind: 'function',
    signature: 'GET port',
    doc: 'Read a value from an I/O port.',
  },
  {
    word: 'SGN',
    kind: 'function',
    signature: 'SGN(n)',
    doc: 'Sign of n: -1, 0 or 1.',
  },
  {
    word: 'SQR',
    kind: 'function',
    signature: 'SQR(n)',
    doc: 'Square root (floating-point ROM).',
  },
  {
    word: 'SIN',
    kind: 'function',
    signature: 'SIN(n)',
    doc: 'Sine, radians (floating-point ROM).',
  },
  {
    word: 'COS',
    kind: 'function',
    signature: 'COS(n)',
    doc: 'Cosine, radians (floating-point ROM).',
  },
  {
    word: 'TAN',
    kind: 'function',
    signature: 'TAN(n)',
    doc: 'Tangent, radians (floating-point ROM).',
  },
  {
    word: 'ATN',
    kind: 'function',
    signature: 'ATN(n)',
    doc: 'Arctangent (floating-point ROM).',
  },
  {
    word: 'EXP',
    kind: 'function',
    signature: 'EXP(n)',
    doc: 'e to the power n (floating-point ROM).',
  },
  {
    word: 'LN',
    kind: 'function',
    signature: 'LN(n)',
    doc: 'Natural logarithm (floating-point ROM).',
  },
  {
    word: 'LOG',
    kind: 'function',
    signature: 'LOG(n)',
    doc: 'Base-10 logarithm (floating-point ROM).',
  },
  {
    word: 'PI',
    kind: 'function',
    signature: 'PI',
    doc: '3.14159265 (floating-point ROM).',
  },

  // ---- Operators ----
  {
    word: 'AND',
    kind: 'operator',
    signature: 'a AND b',
    doc: 'Bitwise/logical AND.',
  },
  {
    word: 'OR',
    kind: 'operator',
    signature: 'a OR b',
    doc: 'Bitwise/logical OR.',
  },
  {
    word: 'DIV',
    kind: 'operator',
    signature: 'a DIV b',
    doc: 'Integer division.',
  },
  {
    word: 'MOD',
    kind: 'operator',
    signature: 'a MOD b',
    doc: 'Integer remainder.',
  },
];

export const atomKeywords: KeywordInfo[] = table.map((k, i) => ({
  ...k,
  token: i,
}));
