// Reference table data for the Altair 8K BASIC page.
// Seeded from the dialect's keyword table by scripts/gen-reference-scaffold.mts,
// then hand-enriched (typed <…> syntax + fuller descriptions). Edit by hand;
// the generator skips this file once it exists.
//
// Every row is a word in src/dialects/altair8800/keywords.ts, which was read off
// the 8K BASIC 4.0 object tape itself; keyword-crosscheck.test.ts holds the two
// in exact agreement in both directions.
import type { BasicReferenceTableData } from './types';

export const altair8800Reference: BasicReferenceTableData = {
  title: 'Altair 8K BASIC',
  machines: ['MITS Altair 8800'],
  entries: [
    {
      name: 'END',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'END',
      description:
        'Stops the program and returns to the OK prompt without printing a BREAK message; unlike STOP, execution cannot then be resumed with CONT.',
    },
    {
      name: 'FOR',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'FOR <numvar> = <number> TO <number> [STEP <number>]',
      description:
        'Opens a counting loop that runs up to the matching NEXT. STEP sets the increment (default 1, may be negative or fractional); the body always runs at least once.',
    },
    {
      name: 'NEXT',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'NEXT [<numvar>[, <numvar>]…]',
      description:
        'Closes the innermost FOR loop and jumps back to it. Naming the variable closes that loop specifically, and several may be closed in one statement.',
    },
    {
      name: 'DATA',
      kind: 'command',
      domain: 'data',
      syntax: 'DATA <constant>[, <constant>]…',
      description:
        'Inline constants for READ to consume in program order. Strings may be quoted; the rest of the statement is stored exactly as typed.',
    },
    {
      name: 'INPUT',
      kind: 'command',
      domain: 'input',
      syntax: 'INPUT ["<string>";] <var>[, <var>]…',
      description:
        "Prints the prompt (or ? when there is none) and waits for a whole line to be typed at the terminal. This is the machine's only key read - 8K BASIC has no INKEY$ - so an interactive program takes one turn per typed line.",
    },
    {
      name: 'DIM',
      kind: 'command',
      domain: 'data',
      syntax: 'DIM <var>(<number>[, <number>]…)',
      description:
        'Declares an array and its bounds. Subscripts start at 0, so DIM A(10) has eleven elements; an undeclared array is created with bound 10 on first use.',
    },
    {
      name: 'READ',
      kind: 'command',
      domain: 'data',
      syntax: 'READ <var>[, <var>]…',
      description:
        'Takes the next constant from the DATA statements, in program order. RESTORE winds the pointer back to the first.',
    },
    {
      name: 'LET',
      kind: 'command',
      domain: 'data',
      syntax: '[LET] <var> = <expression>',
      description:
        'Assigns a value. The keyword is optional and almost always left out; it costs a byte of program text and nothing else.',
    },
    {
      name: 'GOTO',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'GOTO <line>',
      description:
        'Jumps to a line number. Written GO TO with a space as well, which crunches to the same token.',
    },
    {
      name: 'RUN',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'RUN [<line>]',
      description:
        'Clears the variables and starts the program, from the given line where one is named.',
    },
    {
      name: 'IF',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'IF <expression> THEN <line> | <statement>',
      description:
        'Runs the rest of the line when the expression is non-zero. There is no ELSE in 8K BASIC: write a second IF, or jump.',
    },
    {
      name: 'RESTORE',
      kind: 'command',
      domain: 'data',
      syntax: 'RESTORE',
      description:
        'Winds the READ pointer back to the first DATA statement in the program.',
    },
    {
      name: 'GOSUB',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'GOSUB <line>',
      description:
        'Calls a subroutine, remembering where to come back to. RETURN comes back.',
    },
    {
      name: 'RETURN',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'RETURN',
      description:
        'Returns to the statement after the GOSUB that called this subroutine.',
    },
    {
      name: 'REM',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'REM <text>',
      description:
        'A comment. Everything after it to the end of the line is stored verbatim and never executed - including a colon, so no statement can follow one.',
    },
    {
      name: 'STOP',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'STOP',
      description:
        'Halts with BREAK IN <line>. Unlike END the program can be resumed from that point with CONT.',
    },
    {
      name: 'OUT',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'OUT <number>, <number>',
      description:
        "Writes a byte to an 8080 I/O port (0-255). The console is the 88-2SIO at ports 16 and 17; writing to those interferes with BASIC's own terminal.",
    },
    {
      name: 'ON',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'ON <expression> GOTO | GOSUB <line>[, <line>]…',
      description:
        'Computed jump: the expression picks the first, second, third… line in the list. A value of 0 or one past the end falls through to the next statement.',
    },
    {
      name: 'NULL',
      kind: 'command',
      domain: 'text-screen',
      syntax: 'NULL <number>',
      description:
        'Sets how many null characters are sent after each line - the delay a printing terminal needed for its carriage to return. 0 for a glass terminal.',
    },
    {
      name: 'WAIT',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'WAIT <number>, <number>[, <number>]',
      description:
        'Spins until an input port, exclusive-ORed with the third argument and masked with the second, is non-zero. Nothing but a reset breaks the wait if the condition never comes true.',
    },
    {
      name: 'DEF',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'DEF FN<letter>(<numvar>) = <expression>',
      description:
        'Defines a single-expression numeric function. The name is FN plus one letter, and the definition must be executed before the function is called.',
    },
    {
      name: 'POKE',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'POKE <number>, <number>',
      description:
        'Writes a byte to a decimal address. BASIC itself lives in RAM here, from address 0 up, so a wrong address can corrupt the interpreter.',
    },
    {
      name: 'PRINT',
      kind: 'command',
      domain: 'text-screen',
      syntax: 'PRINT [<expression>][; | ,]…',
      description:
        'Prints to the terminal. A comma moves to the next 14-column zone, a semicolon stays put, and a trailing separator suppresses the newline. ? is shorthand for it.',
    },
    {
      name: 'CONT',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'CONT',
      description:
        'Resumes a program stopped by STOP or CTRL-C, from where it stopped. Editing any line makes it impossible.',
    },
    {
      name: 'LIST',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'LIST [<line>]',
      description:
        'Lists the program to the terminal, from the given line onwards where one is named. CTRL-C stops a listing.',
    },
    {
      name: 'CLEAR',
      kind: 'command',
      domain: 'data',
      syntax: 'CLEAR [<number>]',
      description:
        'Sets every variable to zero and discards arrays. With an argument it also sets the number of bytes reserved for strings, which is 50 until a program says otherwise.',
    },
    {
      name: 'CLOAD',
      kind: 'command',
      domain: 'storage',
      syntax: 'CLOAD "<string>"',
      description:
        'Loads a program from cassette through the 88-ACR board, matching the one-character name.',
    },
    {
      name: 'CSAVE',
      kind: 'command',
      domain: 'storage',
      syntax: 'CSAVE "<string>"',
      description:
        'Saves the program to cassette through the 88-ACR board under a one-character name.',
    },
    {
      name: 'NEW',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'NEW',
      description: 'Erases the program and all variables.',
    },
    {
      name: 'TAB(',
      kind: 'function',
      domain: 'text-screen',
      syntax: 'TAB(<number>)',
      description:
        'Moves the print position to that column, counted from 0. Only valid inside PRINT, and it can only move forwards.',
    },
    {
      name: 'TO',
      kind: 'operator',
      domain: 'control-flow',
      syntax: 'TO',
      description:
        'The upper limit of a FOR loop, and the second half of GO TO.',
    },
    {
      name: 'FN',
      kind: 'function',
      domain: 'control-flow',
      syntax: 'FN<letter>(<number>)',
      description: 'Calls a function defined by DEF.',
    },
    {
      name: 'SPC(',
      kind: 'function',
      domain: 'text-screen',
      syntax: 'SPC(<number>)',
      description:
        'Prints that many spaces. Only valid inside PRINT; unlike TAB( it is relative to where the print position already is.',
    },
    {
      name: 'THEN',
      kind: 'operator',
      domain: 'control-flow',
      syntax: 'THEN <line> | <statement>',
      description:
        'Introduces what an IF does when its condition holds. A bare line number means GOTO.',
    },
    {
      name: 'NOT',
      kind: 'operator',
      domain: 'numeric',
      syntax: 'NOT <number>',
      description:
        'Bitwise complement of the 16-bit integer value, so NOT 0 is -1 and NOT -1 is 0.',
    },
    {
      name: 'STEP',
      kind: 'operator',
      domain: 'control-flow',
      syntax: 'STEP <number>',
      description:
        'The increment of a FOR loop. Negative counts down; fractional steps are allowed.',
    },
    {
      name: '+',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> + <number> | <string> + <string>',
      description: 'Adds two numbers, or joins two strings.',
    },
    {
      name: '-',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> - <number> | -<number>',
      description: 'Subtracts, or negates.',
    },
    {
      name: '*',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> * <number>',
      description: 'Multiplies.',
    },
    {
      name: '/',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> / <number>',
      description: 'Divides. Dividing by zero gives ?/0 ERROR.',
    },
    {
      name: '^',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> ^ <number>',
      description:
        'Raises to a power, computed through EXP and LOG. This is the only power operator - there is no up-arrow spelling.',
    },
    {
      name: 'AND',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> AND <number>',
      description:
        'Bitwise AND of two 16-bit integers. Comparisons yield -1 or 0, so it doubles as the logical AND - but both sides are always evaluated.',
    },
    {
      name: 'OR',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> OR <number>',
      description:
        'Bitwise OR of two 16-bit integers, and so also the logical OR.',
    },
    {
      name: '>',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> > <number>',
      description:
        'Greater than. Combines with = and < to make >= and <>, which are stored as two tokens.',
    },
    {
      name: '=',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<var> = <expression> | <number> = <number>',
      description:
        'Assignment in a statement, equality in an expression. True is -1 and false is 0.',
    },
    {
      name: '<',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> < <number>',
      description: 'Less than. Combines with = and > to make <= and <>.',
    },
    {
      name: 'SGN',
      kind: 'function',
      domain: 'numeric',
      syntax: 'SGN(<number>)',
      description: 'The sign of the argument: -1, 0 or 1.',
    },
    {
      name: 'INT',
      kind: 'function',
      domain: 'numeric',
      syntax: 'INT(<number>)',
      description:
        'The largest whole number not greater than the argument, so INT(-1.5) is -2.',
    },
    {
      name: 'ABS',
      kind: 'function',
      domain: 'numeric',
      syntax: 'ABS(<number>)',
      description: 'The argument without its sign.',
    },
    {
      name: 'USR',
      kind: 'function',
      domain: 'memory-hardware',
      syntax: 'USR(<number>)',
      description:
        'Calls the machine-code routine whose address is held in the USR vector, passing the argument and returning its result.',
    },
    {
      name: 'FRE',
      kind: 'function',
      domain: 'memory-hardware',
      syntax: 'FRE(<number>)',
      description:
        'The number of bytes left for the program and its variables. The argument is ignored.',
    },
    {
      name: 'INP',
      kind: 'function',
      domain: 'memory-hardware',
      syntax: 'INP(<number>)',
      description:
        'Reads a byte from an 8080 I/O port (0-255). Polling the console ports for a keystroke does not work: BASIC checks them for CTRL-C between statements and takes the character first.',
    },
    {
      name: 'POS',
      kind: 'function',
      domain: 'text-screen',
      syntax: 'POS(<number>)',
      description:
        'The current print column, counted from 0. The argument is ignored.',
    },
    {
      name: 'SQR',
      kind: 'function',
      domain: 'numeric',
      syntax: 'SQR(<number>)',
      description: 'Square root. A negative argument gives ?FC ERROR.',
    },
    {
      name: 'RND',
      kind: 'function',
      domain: 'numeric',
      syntax: 'RND(<number>)',
      description:
        'A random number between 0 and 1. A positive argument gives the next in the sequence, 0 repeats the last one, and a negative argument reseeds.',
    },
    {
      name: 'LOG',
      kind: 'function',
      domain: 'numeric',
      syntax: 'LOG(<number>)',
      description:
        'Natural logarithm. Zero or a negative argument gives ?FC ERROR.',
    },
    {
      name: 'EXP',
      kind: 'function',
      domain: 'numeric',
      syntax: 'EXP(<number>)',
      description: 'e raised to the power of the argument.',
    },
    {
      name: 'COS',
      kind: 'function',
      domain: 'numeric',
      syntax: 'COS(<number>)',
      description:
        'Cosine of an angle in radians. Present only when the cold-start dialogue was answered Y to WANT SIN-COS-TAN-ATN, which is how this IDE starts the machine.',
    },
    {
      name: 'SIN',
      kind: 'function',
      domain: 'numeric',
      syntax: 'SIN(<number>)',
      description: 'Sine of an angle in radians.',
    },
    {
      name: 'TAN',
      kind: 'function',
      domain: 'numeric',
      syntax: 'TAN(<number>)',
      description: 'Tangent of an angle in radians.',
    },
    {
      name: 'ATN',
      kind: 'function',
      domain: 'numeric',
      syntax: 'ATN(<number>)',
      description: 'Arctangent, in radians.',
    },
    {
      name: 'PEEK',
      kind: 'function',
      domain: 'memory-hardware',
      syntax: 'PEEK(<number>)',
      description:
        'The byte at a decimal address. The whole 64K is readable, including the interpreter itself.',
    },
    {
      name: 'LEN',
      kind: 'function',
      domain: 'strings',
      syntax: 'LEN(<string>)',
      description: 'The number of characters in a string.',
    },
    {
      name: 'STR$',
      kind: 'function',
      domain: 'strings',
      syntax: 'STR$(<number>)',
      description:
        'The string PRINT would produce for a number, leading space and all.',
    },
    {
      name: 'VAL',
      kind: 'function',
      domain: 'strings',
      syntax: 'VAL(<string>)',
      description:
        'The number at the front of a string, or 0 where there is none.',
    },
    {
      name: 'ASC',
      kind: 'function',
      domain: 'strings',
      syntax: 'ASC(<string>)',
      description:
        'The ASCII code of the first character. An empty string gives ?FC ERROR.',
    },
    {
      name: 'CHR$',
      kind: 'function',
      domain: 'strings',
      syntax: 'CHR$(<number>)',
      description: 'The one-character string for an ASCII code, 0-255.',
    },
    {
      name: 'LEFT$',
      kind: 'function',
      domain: 'strings',
      syntax: 'LEFT$(<string>, <number>)',
      description: 'The leftmost n characters.',
    },
    {
      name: 'RIGHT$',
      kind: 'function',
      domain: 'strings',
      syntax: 'RIGHT$(<string>, <number>)',
      description: 'The rightmost n characters.',
    },
    {
      name: 'MID$',
      kind: 'function',
      domain: 'strings',
      syntax: 'MID$(<string>, <number>[, <number>])',
      description:
        'The substring starting at position n (counted from 1), of the given length or to the end. It is a function only - unlike later Microsoft BASICs it cannot be assigned to.',
    },
  ],
};
