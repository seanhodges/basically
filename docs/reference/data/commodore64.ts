// Reference table data for the Commodore BASIC v2 page.
// Seeded from the dialect's keyword table by scripts/gen-reference-scaffold.mts,
// then hand-enriched (typed <…> syntax + fuller descriptions). Edit by hand;
// the generator skips this file once it exists.
import type { ReferenceTableData } from './types';

export const commodore64Reference: ReferenceTableData = {
  title: 'Commodore BASIC v2',
  machines: ['Commodore 64'],
  entries: [
    {
      name: 'END',
      kind: 'command',
      syntax: 'END',
      description:
        'Stops the program cleanly and returns to the READY prompt without printing a BREAK message; execution can be resumed with CONT.',
    },
    {
      name: 'FOR',
      kind: 'command',
      syntax: 'FOR <numvar> = <number> TO <number> [STEP <number>]',
      description:
        'Opens a counting loop that runs until NEXT, stepping the variable by 1 (or by STEP). The body always executes at least once because the limit is tested at NEXT.',
    },
    {
      name: 'NEXT',
      kind: 'command',
      syntax: 'NEXT [<numvar>[, <numvar>…]]',
      description:
        'Closes the innermost FOR loop, or a named one. Several loop variables can be listed to close nested loops at once.',
    },
    {
      name: 'DATA',
      kind: 'command',
      syntax: 'DATA <constant>[, <constant>…]',
      description:
        'Holds a list of inline numeric or string constants consumed in order by READ; the rest of the statement is stored verbatim, so unquoted text is allowed.',
    },
    {
      name: 'INPUT#',
      kind: 'command',
      syntax: 'INPUT# <file>, <var>[, <var>…]',
      description:
        'Reads comma- or newline-separated values from an open file or device into the listed variables. The file must first be opened with OPEN.',
    },
    {
      name: 'INPUT',
      kind: 'command',
      syntax: 'INPUT [<string>;] <var>[, <var>…]',
      description:
        'Prints the optional prompt followed by a "? " and reads one or more comma-separated values from the keyboard. It halts the program, so games use GET instead.',
    },
    {
      name: 'DIM',
      kind: 'command',
      syntax: 'DIM <var>(<number>[, <number>…])[, <var>(…)…]',
      description:
        'Declares one or more arrays with the given maximum subscripts; indices run from 0, so DIM A(10) gives 11 elements. Undimensioned arrays default to a size of 10.',
    },
    {
      name: 'READ',
      kind: 'command',
      syntax: 'READ <var>[, <var>…]',
      description:
        'Assigns the next unread DATA constants to the listed variables, advancing the read pointer. Running past the last DATA gives ?OUT OF DATA ERROR.',
    },
    {
      name: 'LET',
      kind: 'command',
      syntax: 'LET <var> = <number> | <string>',
      description:
        'Assigns a value to a variable. The keyword is optional on the C64, so X=5 and LET X=5 are identical.',
    },
    {
      name: 'GOTO',
      kind: 'command',
      syntax: 'GOTO <line>',
      description: 'Jumps unconditionally to the given line number.',
    },
    {
      name: 'RUN',
      kind: 'command',
      syntax: 'RUN [<line>]',
      description:
        'Clears all variables and starts the program from the lowest line, or from the given line number if one is supplied.',
    },
    {
      name: 'IF',
      kind: 'command',
      syntax: 'IF <number> THEN <line> | <statement>',
      description:
        'Evaluates the condition (zero is false, non-zero is true) and runs the THEN part only when true. There is no ELSE; THEN <line> is shorthand for THEN GOTO <line>.',
    },
    {
      name: 'RESTORE',
      kind: 'command',
      syntax: 'RESTORE',
      description:
        'Resets the DATA read pointer back to the first DATA statement so READ can re-read the constants from the start.',
    },
    {
      name: 'GOSUB',
      kind: 'command',
      syntax: 'GOSUB <line>',
      description:
        'Calls the subroutine at the given line, saving the return address so a later RETURN comes back to the following statement.',
    },
    {
      name: 'RETURN',
      kind: 'command',
      syntax: 'RETURN',
      description:
        'Returns from a subroutine to the statement after the matching GOSUB; without a pending GOSUB it gives ?RETURN WITHOUT GOSUB ERROR.',
    },
    {
      name: 'REM',
      kind: 'command',
      syntax: 'REM [<text>]',
      description:
        'Marks a comment; the rest of the line is stored verbatim and ignored when the program runs.',
    },
    {
      name: 'STOP',
      kind: 'command',
      syntax: 'STOP',
      description:
        'Halts the program and prints BREAK with the line number; execution can be resumed with CONT.',
    },
    {
      name: 'ON',
      kind: 'command',
      syntax: 'ON <number> GOTO | GOSUB <line>[, <line>…]',
      description:
        'Uses the rounded value as a 1-based index to pick which line to GOTO or GOSUB. If the index is 0 or larger than the list, execution falls through to the next statement.',
    },
    {
      name: 'WAIT',
      kind: 'command',
      syntax: 'WAIT <number>, <number> [, <number>]',
      description:
        'Pauses until a memory location, ANDed with the mask and optionally XORed, is non-zero. Misuse can hang the machine since BASIC stops polling anything else.',
    },
    {
      name: 'LOAD',
      kind: 'command',
      syntax: 'LOAD [<string> [, <number> [, <number>]]]',
      description:
        'Loads a program from tape (device 1, the default) or disk (device 8), optionally with a secondary address. A secondary address of 1 loads to the original address.',
    },
    {
      name: 'SAVE',
      kind: 'command',
      syntax: 'SAVE [<string> [, <number> [, <number>]]]',
      description:
        'Saves the current program to tape or the named device, optionally with a secondary address that selects, for example, an end-of-tape marker.',
    },
    {
      name: 'VERIFY',
      kind: 'command',
      syntax: 'VERIFY [<string> [, <number>]]',
      description:
        'Compares a saved program against the one in memory and reports ?VERIFY ERROR if they differ.',
    },
    {
      name: 'DEF',
      kind: 'command',
      syntax: 'DEF FN <name>(<numvar>) = <number>',
      description:
        'Defines a single-argument numeric user function, later called as FN name(x); the parameter is local to the formula.',
    },
    {
      name: 'POKE',
      kind: 'command',
      syntax: 'POKE <number>, <number>',
      description:
        'Writes a byte (0–255) to a memory address (0–65535). The C64 has no graphics or sound keywords, so screen, colour, sprite and SID effects are all done by POKEing VIC-II and SID registers.',
    },
    {
      name: 'PRINT#',
      kind: 'command',
      syntax: 'PRINT# <file>[, <expr>[;|, <expr>…]]',
      description:
        'Writes data to an open file or device instead of the screen, using the same formatting rules as PRINT.',
    },
    {
      name: 'PRINT',
      kind: 'command',
      syntax: 'PRINT [<expr>][;|, <expr>…]',
      description:
        'Prints values to the screen; a trailing semicolon suppresses the newline and a comma tabs to the next 10-column field. Printed CHR$ codes also control colour and cursor movement.',
    },
    {
      name: 'CONT',
      kind: 'command',
      syntax: 'CONT',
      description:
        'Resumes a program halted by STOP, END or the RUN/STOP key, provided the program was not edited in the meantime.',
    },
    {
      name: 'LIST',
      kind: 'command',
      syntax: 'LIST [<line>][-[<line>]]',
      description:
        'Displays program lines, optionally restricted to a single line or a range; with no argument it lists the whole program.',
    },
    {
      name: 'CLR',
      kind: 'command',
      syntax: 'CLR',
      description:
        'Clears all variables, arrays and strings and resets the FOR/GOSUB stacks, but leaves the program itself intact.',
    },
    {
      name: 'CMD',
      kind: 'command',
      syntax: 'CMD <file>[, <expr>]',
      description:
        'Redirects normal PRINT output to an open file or device (such as a printer) until a PRINT# or CLOSE restores the screen.',
    },
    {
      name: 'SYS',
      kind: 'command',
      syntax: 'SYS <number>',
      description:
        'Jumps to a machine-code routine at the given address, returning to BASIC on RTS; the A, X, Y and status registers are taken from page-zero locations.',
    },
    {
      name: 'OPEN',
      kind: 'command',
      syntax: 'OPEN <file>, <number> [, <number> [, <string>]]',
      description:
        'Opens a logical file, given its file number, device number, optional secondary address and optional name, for later use by PRINT#, INPUT#, GET# or CMD.',
    },
    {
      name: 'CLOSE',
      kind: 'command',
      syntax: 'CLOSE <file>',
      description:
        'Closes the logical file with the given number, flushing any buffered output to the device.',
    },
    {
      name: 'GET',
      kind: 'command',
      syntax: 'GET <var>',
      description:
        'Reads a single keypress from the keyboard buffer without waiting, returning an empty string (or 0) if no key is pending. This is the standard way to read controls in games.',
    },
    {
      name: 'NEW',
      kind: 'command',
      syntax: 'NEW',
      description:
        'Erases the current program and clears all variables, leaving BASIC empty.',
    },
    {
      name: 'TAB(',
      kind: 'function',
      syntax: 'TAB(<number>)',
      description:
        'Within PRINT, moves the cursor to the given absolute column counting from 0. It only moves forward, so it has no effect once the cursor is already past that column.',
    },
    {
      name: 'TO',
      kind: 'operator',
      syntax: 'TO',
      description:
        'Separates the start and limit values in a FOR loop (FOR I=1 TO 10) and follows GO in the spaced GO TO form.',
    },
    {
      name: 'FN',
      kind: 'function',
      syntax: 'FN <name>(<number>)',
      description:
        'Calls a user-defined function previously created with DEF FN, substituting the argument into its formula.',
    },
    {
      name: 'SPC(',
      kind: 'function',
      syntax: 'SPC(<number>)',
      description:
        'Within PRINT, outputs the given number of spaces relative to the current cursor position.',
    },
    {
      name: 'THEN',
      kind: 'operator',
      syntax: 'THEN <line> | <statement>',
      description:
        'Introduces the action of an IF; THEN followed by a line number is treated as a GOTO to that line.',
    },
    {
      name: 'NOT',
      kind: 'operator',
      syntax: 'NOT <number>',
      description:
        'Bitwise NOT on a 16-bit signed integer, so NOT X equals -(X+1); used on truth values it logically negates them.',
    },
    {
      name: 'STEP',
      kind: 'operator',
      syntax: 'STEP <number>',
      description:
        'Sets the increment added to the loop variable each NEXT in a FOR loop; a negative step counts down.',
    },
    {
      name: '+',
      kind: 'operator',
      syntax: '<number> + <number> | <string> + <string>',
      description: 'Adds two numbers, or joins (concatenates) two strings.',
    },
    {
      name: '-',
      kind: 'operator',
      syntax: '<number> - <number> | -<number>',
      description:
        'Subtracts the right operand from the left, or negates a value when used as a unary prefix.',
    },
    {
      name: '*',
      kind: 'operator',
      syntax: '<number> * <number>',
      description: 'Multiplies two numbers.',
    },
    {
      name: '/',
      kind: 'operator',
      syntax: '<number> / <number>',
      description:
        'Divides the left operand by the right; dividing by zero gives ?DIVISION BY ZERO ERROR.',
    },
    {
      name: '↑',
      kind: 'operator',
      syntax: '<number> ↑ <number>',
      description:
        'Raises the left operand to the power of the right (the C64 up-arrow key); has higher precedence than multiply and divide.',
    },
    {
      name: 'AND',
      kind: 'operator',
      syntax: '<number> AND <number>',
      description:
        'Bitwise AND of two 16-bit integers, also used to combine truth values where false is 0 and true is -1.',
    },
    {
      name: 'OR',
      kind: 'operator',
      syntax: '<number> OR <number>',
      description:
        'Bitwise OR of two 16-bit integers, also used to combine truth values where false is 0 and true is -1.',
    },
    {
      name: '>',
      kind: 'operator',
      syntax: '<number> > <number> | <string> > <string>',
      description:
        'Greater-than comparison; returns -1 for true and 0 for false. Strings compare by PETSCII code.',
    },
    {
      name: '=',
      kind: 'operator',
      syntax: '<var> = <expr> | <expr> = <expr>',
      description:
        'Assigns a value in a statement, or tests equality in an expression (returning -1 for true and 0 for false).',
    },
    {
      name: '<',
      kind: 'operator',
      syntax: '<number> < <number> | <string> < <string>',
      description:
        'Less-than comparison; returns -1 for true and 0 for false. Strings compare by PETSCII code.',
    },
    {
      name: 'SGN',
      kind: 'function',
      syntax: 'SGN(<number>)',
      description:
        'Returns the sign of the argument: -1 if negative, 0 if zero, 1 if positive.',
    },
    {
      name: 'INT',
      kind: 'function',
      syntax: 'INT(<number>)',
      description:
        'Returns the largest integer not greater than the argument (rounds toward negative infinity), so INT(-1.5) is -2.',
    },
    {
      name: 'ABS',
      kind: 'function',
      syntax: 'ABS(<number>)',
      description: 'Returns the absolute (unsigned) value of the argument.',
    },
    {
      name: 'USR',
      kind: 'function',
      syntax: 'USR(<number>)',
      description:
        'Passes the argument in the floating-point accumulator to the machine-code routine whose address is stored in the USR vector ($0311) and returns its result.',
    },
    {
      name: 'FRE',
      kind: 'function',
      syntax: 'FRE(<number>)',
      description:
        'Returns the number of free BASIC bytes after forcing string garbage collection; the argument is ignored. Results above 32767 appear negative, so add 65536.',
    },
    {
      name: 'POS',
      kind: 'function',
      syntax: 'POS(<number>)',
      description:
        'Returns the current cursor column (0-based) on the logical screen line; the argument is ignored.',
    },
    {
      name: 'SQR',
      kind: 'function',
      syntax: 'SQR(<number>)',
      description:
        'Returns the square root of the argument; a negative argument gives ?ILLEGAL QUANTITY ERROR.',
    },
    {
      name: 'RND',
      kind: 'function',
      syntax: 'RND(<number>)',
      description:
        'Returns a random number from 0 to just under 1. A positive argument continues the sequence, 0 reseeds from the system timers, and a negative argument seeds a repeatable sequence.',
    },
    {
      name: 'LOG',
      kind: 'function',
      syntax: 'LOG(<number>)',
      description:
        'Returns the natural (base-e) logarithm; the argument must be greater than 0.',
    },
    {
      name: 'EXP',
      kind: 'function',
      syntax: 'EXP(<number>)',
      description: 'Returns e raised to the power of the argument.',
    },
    {
      name: 'COS',
      kind: 'function',
      syntax: 'COS(<number>)',
      description:
        'Returns the cosine of the argument, which is given in radians.',
    },
    {
      name: 'SIN',
      kind: 'function',
      syntax: 'SIN(<number>)',
      description:
        'Returns the sine of the argument, which is given in radians.',
    },
    {
      name: 'TAN',
      kind: 'function',
      syntax: 'TAN(<number>)',
      description:
        'Returns the tangent of the argument, which is given in radians.',
    },
    {
      name: 'ATN',
      kind: 'function',
      syntax: 'ATN(<number>)',
      description:
        'Returns the arctangent of the argument, in radians, between -π/2 and π/2.',
    },
    {
      name: 'PEEK',
      kind: 'function',
      syntax: 'PEEK(<number>)',
      description:
        'Returns the byte (0–255) stored at the given memory address (0–65535); the counterpart to POKE for reading hardware and memory.',
    },
    {
      name: 'LEN',
      kind: 'function',
      syntax: 'LEN(<string>)',
      description: 'Returns the number of characters in the string (0–255).',
    },
    {
      name: 'STR$',
      kind: 'function',
      syntax: 'STR$(<number>)',
      description:
        'Returns the number formatted as a string, exactly as PRINT would show it, with a leading space for non-negative values.',
    },
    {
      name: 'VAL',
      kind: 'function',
      syntax: 'VAL(<string>)',
      description:
        'Parses the leading numeric part of the string and returns it as a number, returning 0 if it does not start with a number.',
    },
    {
      name: 'ASC',
      kind: 'function',
      syntax: 'ASC(<string>)',
      description:
        'Returns the PETSCII code of the first character of the string; an empty string gives ?ILLEGAL QUANTITY ERROR.',
    },
    {
      name: 'CHR$',
      kind: 'function',
      syntax: 'CHR$(<number>)',
      description:
        'Returns the one-character string for a PETSCII code (0–255). Many codes are control codes when printed, such as CHR$(147) to clear the screen.',
    },
    {
      name: 'LEFT$',
      kind: 'function',
      syntax: 'LEFT$(<string>, <number>)',
      description:
        'Returns the leftmost n characters of the string, or the whole string if n is at least its length.',
    },
    {
      name: 'RIGHT$',
      kind: 'function',
      syntax: 'RIGHT$(<string>, <number>)',
      description:
        'Returns the rightmost n characters of the string, or the whole string if n is at least its length.',
    },
    {
      name: 'MID$',
      kind: 'function',
      syntax: 'MID$(<string>, <number> [, <number>])',
      description:
        'Returns a substring starting at the 1-based position for the optional length (default: to the end of the string).',
    },
    {
      name: 'GO',
      kind: 'command',
      syntax: 'GO TO <line>',
      description:
        'The spaced-out form of GOTO; GO TO and GOTO behave identically.',
    },
    {
      name: 'π',
      kind: 'function',
      syntax: 'π',
      description:
        'The built-in constant pi (3.14159265), entered as the single π token.',
    },
  ],
};
