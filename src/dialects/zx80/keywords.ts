import type { EditorKeyword, KeywordInfo } from '../types';

/**
 * The ZX80 BASIC keyword/token table.
 *
 * Unlike the ZX81 (whose operators are character codes), the ZX80 stores every
 * operator, separator and command as a single token in the 0xD5-0xFE range. The
 * values below were reverse-engineered from the real 4K ROM: the keyword decode
 * routine at 0x05A9 walks a string table based at 0x00BA, and each token was
 * confirmed on the live machine (e.g. `PRINT 2+3` only yields 5 when `+` is
 * stored as 0xDD, and typing on the emulated keyboard stores PRINT as 0xF4).
 *
 * Numbers are stored as their digit characters (0x1C-0x25) with no hidden binary
 * value — the ZX80 is an integer-only BASIC and re-parses literals at run time,
 * so there is no ZX81-style NUMBER_MARKER + 5-byte float.
 *
 * Tokens 0xF1, 0xF2, 0xF5 and 0xFF are unused "?" slots in the ROM table.
 */
export const zx80Keywords: KeywordInfo[] = [
  // Operators and separators (stored as tokens, not character codes)
  {
    word: 'THEN',
    token: 0xd5,
    kind: 'operator',
    signature: 'IF cond THEN statement',
    doc: 'One statement only — the ZX80 has no ELSE and no multi-statement lines.',
  },
  {
    word: 'TO',
    token: 0xd6,
    kind: 'operator',
    signature: 'FOR v=a TO b',
    doc: 'FOR loop range.',
  },
  {
    word: ';',
    token: 0xd7,
    kind: 'operator',
    doc: 'PRINT separator (no gap).',
  },
  {
    word: ',',
    token: 0xd8,
    kind: 'operator',
    doc: 'PRINT separator (next tab field).',
  },
  { word: ')', token: 0xd9, kind: 'operator', doc: 'Close parenthesis.' },
  { word: '(', token: 0xda, kind: 'operator', doc: 'Open parenthesis.' },
  {
    word: 'NOT',
    token: 0xdb,
    kind: 'function',
    signature: 'NOT x',
    doc: 'Logical not: 1 if x=0, else 0.',
  },
  { word: '-', token: 0xdc, kind: 'operator', doc: 'Subtract / negate.' },
  { word: '+', token: 0xdd, kind: 'operator', doc: 'Add.' },
  { word: '*', token: 0xde, kind: 'operator', doc: 'Multiply.' },
  { word: '/', token: 0xdf, kind: 'operator', doc: 'Integer divide.' },
  { word: 'AND', token: 0xe0, kind: 'operator', doc: 'Logical and.' },
  { word: 'OR', token: 0xe1, kind: 'operator', doc: 'Logical or.' },
  {
    word: '**',
    token: 0xe2,
    kind: 'operator',
    doc: 'Power. The ZX80 uses ** rather than ^.',
  },
  { word: '=', token: 0xe3, kind: 'operator', doc: 'Equals / assignment.' },
  { word: '>', token: 0xe4, kind: 'operator', doc: 'Greater than.' },
  { word: '<', token: 0xe5, kind: 'operator', doc: 'Less than.' },

  // Commands (may start a statement)
  {
    word: 'LIST',
    token: 0xe6,
    kind: 'command',
    signature: 'LIST [line]',
    doc: 'List the program.',
  },
  {
    word: 'RETURN',
    token: 0xe7,
    kind: 'command',
    signature: 'RETURN',
    doc: 'Return from GOSUB.',
  },
  {
    word: 'CLS',
    token: 0xe8,
    kind: 'command',
    signature: 'CLS',
    doc: 'Clear the screen.',
  },
  {
    word: 'DIM',
    token: 0xe9,
    kind: 'command',
    signature: 'DIM A(n)',
    doc: 'Declare a numeric array. Array names are a single letter.',
  },
  {
    word: 'SAVE',
    token: 0xea,
    kind: 'command',
    signature: 'SAVE',
    doc: 'Save the program to tape. The ZX80 has no named files.',
  },
  {
    word: 'FOR',
    token: 0xeb,
    kind: 'command',
    signature: 'FOR v=a TO b',
    doc: 'Loop. Control variable is a single letter. The ZX80 has no STEP.',
  },
  {
    word: 'GOTO',
    token: 0xec,
    kind: 'command',
    signature: 'GOTO line',
    doc: 'Jump to line number (computed targets allowed).',
  },
  {
    word: 'POKE',
    token: 0xed,
    kind: 'command',
    signature: 'POKE addr,byte',
    doc: 'Write a byte of memory.',
  },
  {
    word: 'INPUT',
    token: 0xee,
    kind: 'command',
    signature: 'INPUT v',
    doc: 'Read a value from the keyboard (stops the program).',
  },
  {
    word: 'RANDOMISE',
    token: 0xef,
    kind: 'command',
    signature: 'RANDOMISE [n]',
    doc: 'Seed RND; RANDOMISE 0 seeds from the frame counter.',
  },
  {
    word: 'LET',
    token: 0xf0,
    kind: 'command',
    signature: 'LET v=expr',
    doc: 'Assignment — LET is mandatory on the ZX80.',
  },
  {
    word: 'NEXT',
    token: 0xf3,
    kind: 'command',
    signature: 'NEXT v',
    doc: 'End of FOR loop.',
  },
  {
    word: 'PRINT',
    token: 0xf4,
    kind: 'command',
    signature: 'PRINT items',
    doc: 'Print to the screen; , tabs to the next field, ; concatenates.',
  },
  {
    word: 'NEW',
    token: 0xf6,
    kind: 'command',
    signature: 'NEW',
    doc: 'Erase the program.',
  },
  {
    word: 'RUN',
    token: 0xf7,
    kind: 'command',
    signature: 'RUN [line]',
    doc: 'Clear variables and run.',
  },
  {
    word: 'STOP',
    token: 0xf8,
    kind: 'command',
    signature: 'STOP',
    doc: 'Halt the program.',
  },
  {
    word: 'CONTINUE',
    token: 0xf9,
    kind: 'command',
    signature: 'CONTINUE',
    doc: 'Continue after STOP/BREAK.',
  },
  {
    word: 'IF',
    token: 0xfa,
    kind: 'command',
    signature: 'IF cond THEN statement',
    doc: 'Conditional; condition uses =, <, >, AND, OR, NOT.',
  },
  {
    word: 'GOSUB',
    token: 0xfb,
    kind: 'command',
    signature: 'GOSUB line',
    doc: 'Call subroutine; RETURN comes back.',
  },
  {
    word: 'LOAD',
    token: 0xfc,
    kind: 'command',
    signature: 'LOAD',
    doc: 'Load a program from tape.',
  },
  {
    word: 'CLEAR',
    token: 0xfd,
    kind: 'command',
    signature: 'CLEAR',
    doc: 'Delete all variables.',
  },
  {
    word: 'REM',
    token: 0xfe,
    kind: 'command',
    signature: 'REM comment',
    doc: 'Comment line.',
  },
];

/**
 * The ZX80's "integral functions" (the 4K manual's own term). Unlike every
 * keyword above, these have NO one-byte token: on the real machine they were
 * typed in letter by letter, always with parentheses, and the ROM matched them
 * by name at run time (via a string table at 0x0BBA). We list them so the
 * editor highlights and autocompletes them, but they deliberately carry no
 * token — the tokenizer leaves them as their literal characters, which is
 * exactly what the unmodified ROM expects to parse.
 */
export const zx80IntegralFunctions: EditorKeyword[] = [
  {
    word: 'RND',
    kind: 'function',
    signature: 'RND(n)',
    doc: 'Pseudo-random number. On the ZX80 RND takes an argument and parentheses (unlike the ZX81). Seed it with RANDOMISE.',
  },
  {
    word: 'PEEK',
    kind: 'function',
    signature: 'PEEK(addr)',
    doc: 'The byte (0-255) stored at a memory address.',
  },
  {
    word: 'USR',
    kind: 'function',
    signature: 'USR(addr)',
    doc: 'Call machine code at an address; returns the BC register pair.',
  },
  {
    word: 'ABS',
    kind: 'function',
    signature: 'ABS(n)',
    doc: 'Absolute (unsigned) value of n.',
  },
  {
    word: 'CODE',
    kind: 'function',
    signature: 'CODE(a$)',
    doc: 'The ZX80 character code of the first character of a string.',
  },
  {
    word: 'CHR$',
    kind: 'function',
    signature: 'CHR$(n)',
    doc: 'The one-character string for a ZX80 character code (inverse of CODE).',
  },
  {
    word: 'STR$',
    kind: 'function',
    signature: 'STR$(n)',
    doc: 'The number n formatted as a string, as PRINT would show it.',
  },
  {
    word: 'TL$',
    kind: 'function',
    signature: 'TL$(a$)',
    doc: 'Tail of a string: everything after the first character.',
  },
];

/**
 * Every keyword the editor highlights and autocompletes: the tokenized keywords
 * plus the token-less integral functions. The tokenizer and detokenizer use
 * {@link zx80Keywords} only, so the integral functions are never tokenized.
 */
export const zx80EditorKeywords: EditorKeyword[] = [
  ...zx80Keywords,
  ...zx80IntegralFunctions,
];

/** Keywords sorted longest-first for greedy tokenizer matching. */
export const keywordsByLength: KeywordInfo[] = [...zx80Keywords].sort(
  (a, b) => b.word.length - a.word.length,
);

export const keywordByToken = new Map<number, KeywordInfo>(
  zx80Keywords.map((k) => [k.token, k]),
);

/** Statement keywords that may legally start a ZX80 BASIC line. */
export const statementKeywords = new Set(
  zx80Keywords.filter((k) => k.kind === 'command').map((k) => k.word),
);
