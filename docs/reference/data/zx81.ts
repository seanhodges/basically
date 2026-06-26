// Reference table data for the ZX81 BASIC page.
// Seeded from the dialect's keyword table by scripts/gen-reference-scaffold.mts,
// then hand-enriched (typed <…> syntax + fuller descriptions). Edit by hand;
// the generator skips this file once it exists.
import type { ReferenceTableData } from './types';

export const zx81Reference: ReferenceTableData = {
  title: 'ZX81 BASIC',
  machines: ['Sinclair ZX81'],
  entries: [
    {
      name: 'RND',
      kind: 'function',
      syntax: 'RND',
      description:
        'Returns a pseudo-random number in [0,1). Takes no argument; for a whole number use INT (RND*n)+1. Seed the generator with RAND, or RAND 0 to seed from the frame counter.',
    },
    {
      name: 'INKEY$',
      kind: 'function',
      syntax: 'INKEY$',
      description:
        'Returns the currently held-down key as a single-character string, or "" if none is pressed. Non-blocking, so it is the heart of every real-time game loop, e.g. IF INKEY$="8" THEN LET X=X+1.',
    },
    {
      name: 'PI',
      kind: 'function',
      syntax: 'PI',
      description:
        'Returns the constant pi (3.14159265…). Handy for trigonometry, since SIN/COS/TAN work in radians.',
    },
    {
      name: 'AT',
      kind: 'operator',
      syntax: 'PRINT AT <number>,<number>;',
      description:
        'Used inside PRINT to position the cursor before printing: AT row,col with row 0–21 and column 0–31. Out-of-range coordinates raise an error.',
    },
    {
      name: 'TAB',
      kind: 'operator',
      syntax: 'PRINT TAB <number>;',
      description:
        'Used inside PRINT to move the cursor to a given column (taken modulo 32, wrapping to the next line if already past it). Only moves forward within the print position.',
    },
    {
      name: 'CODE',
      kind: 'function',
      syntax: 'CODE <string>',
      description:
        "Returns the ZX81 character code of the first character of the string (0 for the empty string). These are the machine's own codes, not ASCII — the inverse of CHR$.",
    },
    {
      name: 'VAL',
      kind: 'function',
      syntax: 'VAL <string>',
      description:
        'Evaluates the string as a numeric expression and returns the result, so VAL "2+3" gives 5. A malformed expression stops the program with an error.',
    },
    {
      name: 'LEN',
      kind: 'function',
      syntax: 'LEN <string>',
      description: 'Returns the number of characters in the string.',
    },
    {
      name: 'SIN',
      kind: 'function',
      syntax: 'SIN <number>',
      description: 'Returns the sine of the angle, which is given in radians.',
    },
    {
      name: 'COS',
      kind: 'function',
      syntax: 'COS <number>',
      description:
        'Returns the cosine of the angle, which is given in radians.',
    },
    {
      name: 'TAN',
      kind: 'function',
      syntax: 'TAN <number>',
      description:
        'Returns the tangent of the angle, which is given in radians.',
    },
    {
      name: 'ASN',
      kind: 'function',
      syntax: 'ASN <number>',
      description:
        'Returns the arcsine (inverse sine) in radians. The argument must be in the range -1 to 1.',
    },
    {
      name: 'ACS',
      kind: 'function',
      syntax: 'ACS <number>',
      description:
        'Returns the arccosine (inverse cosine) in radians. The argument must be in the range -1 to 1.',
    },
    {
      name: 'ATN',
      kind: 'function',
      syntax: 'ATN <number>',
      description:
        'Returns the arctangent (inverse tangent) in radians, in the range -pi/2 to pi/2.',
    },
    {
      name: 'LN',
      kind: 'function',
      syntax: 'LN <number>',
      description:
        'Returns the natural logarithm (base e). The argument must be positive, otherwise the program stops with an error.',
    },
    {
      name: 'EXP',
      kind: 'function',
      syntax: 'EXP <number>',
      description: 'Returns e raised to the given power (the inverse of LN).',
    },
    {
      name: 'INT',
      kind: 'function',
      syntax: 'INT <number>',
      description:
        'Returns the largest integer less than or equal to the argument, so it floors towards negative infinity (INT -2.5 is -3, not -2).',
    },
    {
      name: 'SQR',
      kind: 'function',
      syntax: 'SQR <number>',
      description:
        'Returns the square root. The argument must not be negative or the program stops with an error.',
    },
    {
      name: 'SGN',
      kind: 'function',
      syntax: 'SGN <number>',
      description:
        'Returns the sign of the argument: -1 if negative, 0 if zero, 1 if positive.',
    },
    {
      name: 'ABS',
      kind: 'function',
      syntax: 'ABS <number>',
      description: 'Returns the absolute (unsigned) value of the argument.',
    },
    {
      name: 'PEEK',
      kind: 'function',
      syntax: 'PEEK <number>',
      description:
        'Reads and returns the byte (0–255) stored at the given memory address. For example, PEEK 16396+256*PEEK 16397 gives the start of the display file (D_FILE).',
    },
    {
      name: 'USR',
      kind: 'function',
      syntax: 'USR <number>',
      description:
        'Calls machine code at the given address and returns the value of the BC register pair on RET. Commonly used as LET X=USR addr to invoke routines stashed in a REM line.',
    },
    {
      name: 'STR$',
      kind: 'function',
      syntax: 'STR$ <number>',
      description:
        'Returns the number formatted as a string, exactly as PRINT would display it. The inverse of VAL.',
    },
    {
      name: 'CHR$',
      kind: 'function',
      syntax: 'CHR$ <number>',
      description:
        "Returns the single-character string for the given ZX81 character code (0–255) — these are the machine's own codes, not ASCII. The inverse of CODE.",
    },
    {
      name: 'NOT',
      kind: 'function',
      syntax: 'NOT <number>',
      description:
        'Logical negation: returns 1 if the argument is 0, otherwise 0. Binds more tightly than the comparison operators.',
    },
    {
      name: '**',
      kind: 'operator',
      syntax: '<number> ** <number>',
      description:
        'Raises the left value to the power of the right. The ZX81 uses ** for exponentiation, not the ^ found on other machines.',
    },
    {
      name: 'OR',
      kind: 'operator',
      syntax: '<number> OR <number>',
      description:
        'Logical OR: returns the left value if it is non-zero, otherwise the right value. In practice a OR b is non-zero (true) if either operand is non-zero.',
    },
    {
      name: 'AND',
      kind: 'operator',
      syntax: '<number> AND <number>',
      description:
        'Logical AND: returns the left value if the right is non-zero, otherwise 0. So a AND b is non-zero (true) only when both operands are non-zero.',
    },
    {
      name: '<=',
      kind: 'operator',
      syntax: '<number> <= <number>',
      description:
        'Less-than-or-equal comparison, returning 1 (true) or 0 (false). Tokenizes to a single ZX81 byte, so type it without a space between the symbols.',
    },
    {
      name: '>=',
      kind: 'operator',
      syntax: '<number> >= <number>',
      description:
        'Greater-than-or-equal comparison, returning 1 (true) or 0 (false). Tokenizes to a single ZX81 byte, so type it without a space between the symbols.',
    },
    {
      name: '<>',
      kind: 'operator',
      syntax: '<number> <> <number>',
      description:
        'Not-equal comparison, returning 1 (true) or 0 (false). Tokenizes to a single ZX81 byte, so type it without a space between the symbols.',
    },
    {
      name: 'THEN',
      kind: 'operator',
      syntax: 'IF <number> THEN <statement>',
      description:
        'Introduces the single statement run when an IF condition is true. The ZX81 allows only one statement here and has no ELSE and no multi-statement lines.',
    },
    {
      name: 'TO',
      kind: 'operator',
      syntax:
        'FOR <numvar> = <number> TO <number> | <strvar>(<number> TO <number>)',
      description:
        'Gives the upper bound of a FOR loop range, and also slices strings, so A$(2 TO 4) returns the 2nd-to-4th characters. Either slice index may be omitted to mean the start or end of the string.',
    },
    {
      name: 'STEP',
      kind: 'operator',
      syntax: 'FOR <numvar> = <number> TO <number> STEP <number>',
      description:
        'Sets the amount added to a FOR loop variable each pass (default 1). May be negative or fractional to count down or by partial steps.',
    },
    {
      name: 'LPRINT',
      kind: 'command',
      syntax: 'LPRINT [<expr>][;|,]…',
      description:
        'Like PRINT but sends output to the ZX printer instead of the screen, using the same ; and , separators.',
    },
    {
      name: 'LLIST',
      kind: 'command',
      syntax: 'LLIST [<line>]',
      description:
        'Lists the program to the ZX printer, optionally starting at the given line number.',
    },
    {
      name: 'STOP',
      kind: 'command',
      syntax: 'STOP',
      description:
        'Halts the program with report code 9. Execution can be resumed at the following statement with CONT.',
    },
    {
      name: 'SLOW',
      kind: 'command',
      syntax: 'SLOW',
      description:
        'Switches to SLOW mode: the display stays on continuously but the CPU runs at about a quarter speed. Use FAST to blank the screen for full-speed computation.',
    },
    {
      name: 'FAST',
      kind: 'command',
      syntax: 'FAST',
      description:
        'Switches to FAST mode: the CPU runs at full speed with the screen blanked, flickering on only during INPUT or PAUSE. Use SLOW to keep a steady picture.',
    },
    {
      name: 'NEW',
      kind: 'command',
      syntax: 'NEW',
      description:
        'Erases the current program and all variables, resetting the machine ready for a fresh program.',
    },
    {
      name: 'SCROLL',
      kind: 'command',
      syntax: 'SCROLL',
      description:
        'Scrolls the whole display up by one line, losing the top line and freeing the bottom one. Must be called before printing when the screen is full, or the program stops with report 5.',
    },
    {
      name: 'CONT',
      kind: 'command',
      syntax: 'CONT',
      description:
        'Resumes a program that was halted by STOP or by the BREAK key, continuing from where it left off.',
    },
    {
      name: 'DIM',
      kind: 'command',
      syntax: 'DIM <var>(<int>[,<int>]…)',
      description:
        'Declares (and clears) a numeric or string array with the given dimensions; the name is a single letter. A string array DIM A$(n,m) holds n fixed-length strings of m characters, space-padded.',
    },
    {
      name: 'REM',
      kind: 'command',
      syntax: 'REM <text>',
      description:
        'Marks the rest of the line as a comment, ignored when the program runs. Often also used as a container to stash machine code bytes.',
    },
    {
      name: 'FOR',
      kind: 'command',
      syntax: 'FOR <numvar> = <number> TO <number> [STEP <number>]',
      description:
        'Begins a counting loop, running the lines up to the matching NEXT. The control variable must be a single letter, and the loop body always runs at least once.',
    },
    {
      name: 'GOTO',
      kind: 'command',
      syntax: 'GOTO <number>',
      description:
        'Jumps to the given line number. The target can be a computed expression, e.g. GOTO 100+10*L; if no line matches, execution continues at the next existing line.',
    },
    {
      name: 'GOSUB',
      kind: 'command',
      syntax: 'GOSUB <number>',
      description:
        'Calls the subroutine starting at the given line number; a RETURN sends control back to the statement after the GOSUB. Calls may be nested.',
    },
    {
      name: 'INPUT',
      kind: 'command',
      syntax: 'INPUT <var>',
      description:
        'Stops and waits for the user to type a value, assigning it to the variable (string variables expect a quoted entry). It halts the program, so use INKEY$ in real-time game loops instead.',
    },
    {
      name: 'LOAD',
      kind: 'command',
      syntax: 'LOAD <string>',
      description:
        'Loads a program from tape by name; LOAD "" loads the first program found. The named program replaces whatever is in memory.',
    },
    {
      name: 'LIST',
      kind: 'command',
      syntax: 'LIST [<line>]',
      description:
        'Lists the program to the screen, optionally starting at the given line number, and sets that line as the current edit line.',
    },
    {
      name: 'LET',
      kind: 'command',
      syntax: 'LET <var> = <expr>',
      description:
        'Assigns a value to a variable. LET is mandatory on the ZX81 — assignment without it is a syntax error.',
    },
    {
      name: 'PAUSE',
      kind: 'command',
      syntax: 'PAUSE <number>',
      description:
        'Pauses for the given number of frames (50 per second) or until a key is pressed; a value of 32768 or more waits indefinitely. Follow it with POKE 16437,255 to avoid a known display glitch on real hardware.',
    },
    {
      name: 'NEXT',
      kind: 'command',
      syntax: 'NEXT <numvar>',
      description:
        'Marks the end of the FOR loop using the named control variable, adding the STEP and looping back if the limit has not been passed.',
    },
    {
      name: 'POKE',
      kind: 'command',
      syntax: 'POKE <number>,<number>',
      description:
        'Writes a byte value (0–255) directly to the given memory address. Useful for system pokes but easy to crash the machine with if misused.',
    },
    {
      name: 'PRINT',
      kind: 'command',
      syntax: 'PRINT [AT <number>,<number>;] [<expr>][;|,]…',
      description:
        'Writes text and numbers to the display. "," tabs to the next 16-column field; ";" joins items with no gap; a trailing ";" suppresses the newline. PRINT AT positions the cursor at row 0–21, column 0–31.',
    },
    {
      name: 'PLOT',
      kind: 'command',
      syntax: 'PLOT <number>,<number>',
      description:
        'Sets a single block pixel on the low-resolution grid: x 0–63, y 0–43, with the origin at the bottom-left. UNPLOT clears one.',
    },
    {
      name: 'RUN',
      kind: 'command',
      syntax: 'RUN [<line>]',
      description:
        'Clears all variables and runs the program from the start, or from the given line number if one is supplied.',
    },
    {
      name: 'SAVE',
      kind: 'command',
      syntax: 'SAVE <string>',
      description:
        'Saves the current program to tape under the given name. On the ZX81 the saved image also restarts and runs automatically when reloaded.',
    },
    {
      name: 'RAND',
      kind: 'command',
      syntax: 'RAND [<number>]',
      description:
        'Seeds the RND generator. RAND n with the same n gives a repeatable sequence; RAND 0 (or RAND with no argument) seeds from the frame counter for unpredictable results.',
    },
    {
      name: 'IF',
      kind: 'command',
      syntax: 'IF <number> THEN <statement>',
      description:
        'Runs the single statement after THEN when the condition is non-zero (true). Conditions use =, <, >, <=, >=, <>, AND, OR and NOT; there is no ELSE.',
    },
    {
      name: 'CLS',
      kind: 'command',
      syntax: 'CLS',
      description:
        'Clears the screen to blank. In games, prefer erasing single cells with PRINT AT rather than clearing every frame.',
    },
    {
      name: 'UNPLOT',
      kind: 'command',
      syntax: 'UNPLOT <number>,<number>',
      description:
        'Clears a single block pixel set by PLOT, using the same coordinate range: x 0–63, y 0–43, origin bottom-left.',
    },
    {
      name: 'CLEAR',
      kind: 'command',
      syntax: 'CLEAR',
      description:
        'Deletes all variables and arrays, freeing their memory, while leaving the program itself intact.',
    },
    {
      name: 'RETURN',
      kind: 'command',
      syntax: 'RETURN',
      description:
        'Returns from a subroutine to the statement following the matching GOSUB. Calling it without a pending GOSUB stops the program with report 7.',
    },
    {
      name: 'COPY',
      kind: 'command',
      syntax: 'COPY',
      description:
        'Prints a copy of the current screen contents to the ZX printer.',
    },
  ],
};
