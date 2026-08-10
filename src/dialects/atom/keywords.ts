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
    doc: 'Print to the screen. Abbreviate as P. - "," tabs, ";" no-gap, & prints hex, $ prints a string.',
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
    doc: 'Assign a value (optional - v=expr works too).',
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
    word: 'BPUT',
    kind: 'command',
    signature: 'BPUT handle,expr',
    doc: "Write the low byte of expr to an output file opened with FOUT. In the IDE these bytes go to the emulator's virtual filesystem (see the Emulator files viewer).",
  },
  {
    word: 'SPUT',
    kind: 'command',
    signature: 'SPUT handle,$addr',
    doc: 'Write a string (the characters at addr, up to a carriage return) to an output file opened with FOUT — the string companion of BPUT.',
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

  // ---- Floating-point ROM statements ----
  // The FP ROM adds F-prefixed statement forms that operate on the FP variables
  // %A–%Z (see the FP notes in aiProfile). They are stored as text like every
  // other Atom keyword; listed here so the statement-head check accepts them and
  // the editor highlights them.
  {
    word: 'FPRINT',
    kind: 'command',
    signature: 'FPRINT expr',
    doc: 'Print a floating-point value (FP ROM). Abbreviate FP.',
  },
  {
    word: 'FINPUT',
    kind: 'command',
    signature: 'FINPUT %v',
    doc: 'Read a floating-point value into an FP variable (FP ROM).',
  },
  {
    word: 'FDIM',
    kind: 'command',
    signature: 'FDIM %a(n)',
    doc: 'Declare a floating-point array (FP ROM).',
  },
  {
    word: 'FIF',
    kind: 'command',
    signature: 'FIF expr THEN …',
    doc: 'Conditional on a floating-point comparison (FP ROM).',
  },
  {
    word: 'FUNTIL',
    kind: 'command',
    signature: 'FUNTIL expr',
    doc: 'Close a DO loop on a floating-point condition (FP ROM).',
  },
  {
    word: 'FPUT',
    kind: 'command',
    signature: 'FPUT handle,%v',
    doc: 'Write a floating-point value to an open file (FP ROM).',
  },
  {
    word: 'FGET',
    kind: 'command',
    signature: 'FGET handle,%v',
    doc: 'Read a floating-point value from an open file (FP ROM).',
  },

  // ---- Functions ----
  {
    word: 'LEN',
    kind: 'function',
    signature: 'LEN str',
    doc: 'Length of the string at the given address, up to its terminating carriage return.',
  },
  {
    word: 'COUNT',
    kind: 'function',
    signature: 'COUNT',
    doc: 'The current text cursor column (characters printed since the last newline), like POS on other dialects.',
  },
  {
    word: 'PTR',
    kind: 'function',
    signature: 'PTR handle',
    doc: 'The read/write pointer of an open file — the number of bytes read or written so far. May also be assigned to seek within the file.',
  },
  {
    word: 'EXT',
    kind: 'function',
    signature: 'EXT handle',
    doc: 'The length (extent) in bytes of an open file.',
  },
  {
    word: 'SGET',
    kind: 'function',
    signature: 'SGET handle',
    doc: 'Read a string (up to a carriage return) from an input file opened with FIN — the string companion of BGET.',
  },
  {
    word: 'ABS',
    kind: 'function',
    signature: 'ABS(n)',
    doc: 'Absolute value.',
  },
  { word: 'RND', kind: 'function', signature: 'RND', doc: 'A random number.' },
  {
    word: 'FOUT',
    kind: 'function',
    signature: 'FOUT "name"',
    doc: "Open a file for output and return its handle (for BPUT). In the IDE the file lives in the emulator's virtual filesystem.",
  },
  {
    word: 'FIN',
    kind: 'function',
    signature: 'FIN "name"',
    doc: "Open a file for input and return its handle (for BGET), or 0 if it doesn't exist. Reads from the emulator's virtual filesystem in the IDE.",
  },
  {
    word: 'BGET',
    kind: 'function',
    signature: 'BGET handle',
    doc: 'Read and return the next byte from an input file opened with FIN.',
  },
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
  // AND and OR combine their operands bit by bit rather than reducing them to a
  // condition - 5 AND 3 is 1 - so & duplicates AND rather than adding anything.
  // A true comparison here is 1, not the -1 the BBC that succeeded this machine
  // yields; both facts are read off the running machine by operatorBattery.test.ts.
  {
    word: 'AND',
    kind: 'operator',
    signature: 'a AND b',
    doc: 'Bitwise AND (the & operator is the same thing).',
  },
  {
    word: 'OR',
    kind: 'operator',
    signature: 'a OR b',
    doc: 'Bitwise OR. There is no symbolic spelling.',
  },
  {
    word: '^',
    kind: 'operator',
    signature: '%v = a ^ b',
    doc: 'Raise to a power, computed through logs. Floating point only: %A=2^3 works, an integer expression rejects it. Shown as ↑ on screen.',
  },

  // ---- Symbolic operators ----
  // Stored verbatim like every Atom keyword. The editor highlighter/completion
  // only key off alphabetic words, so these drive neither directly (highlighting
  // for '!'/'%'/'&' comes from the language's extraOperators); they are
  // listed so the reference table stays in step with the language (see the
  // keyword-crosscheck test) and to document the indirection/bitwise operators.
  {
    word: '?',
    kind: 'operator',
    signature: '?addr | ?addr=n',
    doc: 'Byte indirection: read or write the byte at addr (the Atom PEEK/POKE).',
  },
  {
    word: '!',
    kind: 'operator',
    signature: '!addr | !addr=n',
    doc: 'Word indirection: read or write the 4-byte word at addr, low byte first.',
  },
  {
    word: '$',
    kind: 'operator',
    signature: '$addr | $addr="…"',
    doc: 'String indirection: the string stored at addr, terminated by a carriage return.',
  },
  {
    word: '%',
    kind: 'operator',
    signature: 'a % b',
    doc: 'Remainder after integer division (e.g. 7%3 is 1). Not the FP-variable prefix %A–%Z.',
  },
  {
    word: '&',
    kind: 'operator',
    signature: 'a & b',
    doc: 'Bitwise AND, the same operation as the AND keyword.',
  },
  {
    word: ':',
    kind: 'operator',
    signature: 'a : b',
    doc: 'Bitwise exclusive-OR (XOR). The Atom has no exclusive-OR keyword.',
  },
];

export const atomKeywords: KeywordInfo[] = table.map((k, i) => ({
  ...k,
  token: i,
}));

/**
 * The arithmetic and relational operators, which the table above does not list
 * because nothing about them is Atom-specific enough to document one by one.
 * They are declared so the editor colours them and the reference page lists
 * them: the Atom's `<=` and `<>` are as real as the BBC's, and `/` truncating
 * rather than dividing is exactly the sort of thing a porter needs the row for.
 */
export const atomOperators = [
  '+',
  '-',
  '*',
  '/',
  '=',
  '<',
  '>',
  '<=',
  '>=',
  '<>',
] as const;
