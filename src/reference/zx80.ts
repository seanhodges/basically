// Reference table data for the ZX80 integer BASIC page.
// Seeded from the dialect's keyword table by scripts/gen-reference-scaffold.mts,
// then hand-enriched (typed <…> syntax + fuller descriptions). Edit by hand;
// the generator skips this file once it exists.
import type { BasicReferenceTableData } from './types';
import { withAbbreviations } from './abbreviations';

const zx80Table: BasicReferenceTableData = {
  title: 'ZX80 integer BASIC',
  machines: ['Sinclair ZX80'],
  // Nothing beyond the shared vocabulary.
  placeholders: [],
  entries: [
    {
      name: 'RND',
      kind: 'function',
      domain: 'numeric',
      syntax: 'RND(<number>)',
      tag: 'integral function',
      description:
        'Returns a pseudo-random number. On the ZX80, RND takes an argument and must be written with parentheses (unlike the later ZX81). Seed the sequence with RANDOMISE.',
    },
    {
      name: 'PEEK',
      kind: 'function',
      domain: 'memory-hardware',
      syntax: 'PEEK(<addr>)',
      tag: 'integral function',
      description:
        'Returns the byte (0–255) stored at the given memory address.',
    },
    {
      name: 'USR',
      kind: 'function',
      domain: 'memory-hardware',
      syntax: 'USR(<addr>)',
      tag: 'integral function',
      description:
        'Calls machine code at the given address and returns the value of the BC register pair on RET.',
    },
    {
      name: 'ABS',
      kind: 'function',
      domain: 'numeric',
      syntax: 'ABS(<number>)',
      tag: 'integral function',
      description: 'Returns the absolute (unsigned) value of the argument.',
    },
    {
      name: 'CODE',
      kind: 'function',
      domain: 'strings',
      syntax: 'CODE(<string>)',
      tag: 'integral function',
      description:
        "Returns the ZX80 character code of the first character of the string (0 for the empty string) - the machine's own codes, not ASCII. The inverse of CHR$.",
    },
    {
      name: 'CHR$',
      kind: 'function',
      domain: 'strings',
      syntax: 'CHR$(<number>)',
      tag: 'integral function',
      description:
        'Returns the single-character string for the given ZX80 character code. The inverse of CODE.',
    },
    {
      name: 'STR$',
      kind: 'function',
      domain: 'strings',
      syntax: 'STR$(<number>)',
      tag: 'integral function',
      description:
        'Returns the number formatted as a string, exactly as PRINT would display it.',
    },
    {
      name: 'TL$',
      kind: 'function',
      domain: 'strings',
      syntax: 'TL$(<string>)',
      tag: 'integral function',
      description:
        'Returns the "tail" of a string: everything after the first character (the ZX80 equivalent of MID$(a$, 2) on other machines).',
    },
    {
      name: 'THEN',
      kind: 'operator',
      domain: 'control-flow',
      syntax: 'IF <number> THEN <statement>',
      description:
        'Introduces the single statement run when the IF condition is true. The ZX80 has no ELSE and no multi-statement lines, so exactly one statement may follow.',
    },
    {
      name: 'TO',
      kind: 'operator',
      domain: 'control-flow',
      syntax: 'FOR <numvar> = <number> TO <number>',
      description:
        'Separates the start and end values of a FOR loop. Both bounds are integers, since ZX80 BASIC has no fractional numbers, and there is no STEP clause.',
    },
    {
      name: ';',
      kind: 'operator',
      domain: 'text-screen',
      syntax: 'PRINT <expr>;<expr>',
      description:
        'PRINT separator that joins items together with no spacing, printing the next value immediately after the previous one.',
    },
    {
      name: ',',
      kind: 'operator',
      domain: 'text-screen',
      syntax: 'PRINT <expr>, <expr>',
      description:
        'PRINT separator that moves the cursor to the next tab field before printing the following item, lining output up into columns.',
    },
    {
      name: ')',
      kind: 'operator',
      domain: 'numeric',
      syntax: ')',
      description:
        'Closes a parenthesised group, such as an array subscript or a bracketed sub-expression.',
    },
    {
      name: '(',
      kind: 'operator',
      domain: 'numeric',
      syntax: '(',
      description:
        'Opens a parenthesised group, used to control evaluation order or to index an array element.',
    },
    {
      name: 'NOT',
      kind: 'function',
      domain: 'numeric',
      syntax: 'NOT <number>',
      description:
        'Logical negation: yields 1 when its argument is 0 and 0 for any non-zero value. Useful for building comparisons the ZX80 lacks, e.g. NOT A<B for A>=B.',
    },
    {
      name: '-',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> - <number> | -<number>',
      description:
        'Subtracts one integer from another, or negates a single value. All arithmetic is integer-only with no fractional part.',
    },
    {
      name: '+',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> + <number>',
      description: 'Adds two integers together.',
    },
    {
      name: '*',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> * <number>',
      description: 'Multiplies two integers together.',
    },
    {
      name: '/',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> / <number>',
      description:
        'Integer division: the result is truncated to a whole number, since the ZX80 has no floating point and discards any remainder.',
    },
    {
      name: 'AND',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> AND <number>',
      description:
        'Logical AND of two conditions, giving a non-zero (true) result only when both operands are non-zero.',
    },
    {
      name: 'OR',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> OR <number>',
      description:
        'Logical OR of two conditions, giving a non-zero (true) result when either operand is non-zero.',
    },
    {
      name: '**',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> ** <number>',
      description:
        'Raises one integer to the power of another. The ZX80 spells exponentiation as ** rather than ^, and the result is an integer.',
    },
    {
      name: '=',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> = <number>',
      description:
        'Tests two values for equality in conditions, and also assigns a value in a LET statement.',
    },
    {
      name: '>',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> > <number>',
      description:
        'Greater-than comparison. There is no >= operator; combine with AND/OR/NOT instead.',
    },
    {
      name: '<',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> < <number>',
      description:
        'Less-than comparison. There is no <= operator; combine with AND/OR/NOT instead.',
    },
    {
      name: 'LIST',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'LIST [<line>]',
      description:
        'Lists the program to the screen, optionally starting from a given line number.',
    },
    {
      name: 'RETURN',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'RETURN',
      description:
        'Returns from a subroutine, resuming execution at the statement after the matching GOSUB.',
    },
    {
      name: 'CLS',
      kind: 'command',
      domain: 'text-screen',
      syntax: 'CLS',
      description: 'Clears the display, leaving a blank screen.',
    },
    {
      name: 'DIM',
      kind: 'command',
      domain: 'data',
      syntax: 'DIM <numvar>(<number>)',
      description:
        'Declares a numeric array with the given number of elements. Array names are a single letter, and elements hold integers only.',
    },
    {
      name: 'SAVE',
      kind: 'command',
      domain: 'storage',
      syntax: 'SAVE',
      description:
        'Saves the current program to cassette tape. The ZX80 has no named files, so the dump is anonymous.',
    },
    {
      name: 'FOR',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'FOR <numvar> = <number> TO <number>',
      description:
        'Begins a counting loop. The control variable is a single letter, the bounds are integers, and there is no STEP, so the counter always increments by one.',
    },
    {
      name: 'GOTO',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'GOTO <number>',
      description:
        'Jumps to a line number. The target may be a computed expression, not just a literal line number.',
    },
    {
      name: 'POKE',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'POKE <addr>, <byte>',
      description:
        'Writes a single byte (0–255) directly into memory at the given address.',
    },
    {
      name: 'INPUT',
      kind: 'command',
      domain: 'input',
      syntax: 'INPUT <var>',
      description:
        'Pauses the program to read a value typed at the keyboard into the given variable.',
    },
    {
      name: 'RANDOMISE',
      kind: 'command',
      domain: 'numeric',
      syntax: 'RANDOMISE [<number>]',
      description:
        'Seeds the random number generator that the ZX80 RND function draws on. RANDOMISE 0 (or with no argument) seeds it from the frame counter for an unpredictable start.',
    },
    {
      name: 'LET',
      kind: 'command',
      domain: 'data',
      syntax: 'LET <var> = <expr>',
      description:
        'Assigns a value to a variable. LET is mandatory on the ZX80 - assignment cannot be written without it.',
    },
    {
      name: 'NEXT',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'NEXT <numvar>',
      description:
        'Marks the end of a FOR loop, incrementing the named control variable and looping back until its limit is passed.',
    },
    {
      name: 'PRINT',
      kind: 'command',
      domain: 'text-screen',
      syntax: 'PRINT [<expr>][;|,]…',
      description:
        'Writes to the display. ZX80 BASIC is integer-only, so numeric values print without a fractional part; ; joins items tightly and , tabs to the next field.',
    },
    {
      name: 'NEW',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'NEW',
      description:
        'Erases the current program and all variables, leaving an empty workspace.',
    },
    {
      name: 'RUN',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'RUN [<line>]',
      description:
        'Clears all variables and runs the program, optionally starting from a given line number.',
    },
    {
      name: 'STOP',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'STOP',
      description:
        'Halts the program, reporting where it stopped so it can be resumed with CONTINUE.',
    },
    {
      name: 'CONTINUE',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'CONTINUE',
      description: 'Resumes a program that was halted by STOP or by BREAK.',
    },
    {
      name: 'IF',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'IF <number> THEN <statement>',
      description:
        'Runs the statement after THEN when the condition is true. Conditions use =, <, >, AND, OR and NOT; there is no ELSE.',
    },
    {
      name: 'GOSUB',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'GOSUB <number>',
      description:
        'Calls a subroutine at the given line number; a later RETURN comes back to the statement after the GOSUB.',
    },
    {
      name: 'LOAD',
      kind: 'command',
      domain: 'storage',
      syntax: 'LOAD',
      description:
        'Loads a program from cassette tape. As with SAVE, tapes are anonymous since the ZX80 has no named files.',
    },
    {
      name: 'CLEAR',
      kind: 'command',
      domain: 'data',
      syntax: 'CLEAR',
      description:
        'Deletes all variables while leaving the program itself intact.',
    },
    {
      name: 'REM',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'REM <comment>',
      description:
        'Marks the rest of the line as a comment, which is ignored when the program runs.',
    },
  ],
};

/**
 * The page as it renders: each row carries the short spellings its keyword can
 * be typed as, derived from the machine's own resolution order rather than
 * authored above. See ./abbreviations.
 */
export const zx80Reference: BasicReferenceTableData = withAbbreviations(
  'zx80',
  zx80Table,
);
