// Reference table data for the ZX Spectrum BASIC (48K & 128K) page.
// Seeded from the dialect's keyword table by scripts/gen-reference-scaffold.mts,
// then hand-enriched (typed <…> syntax + fuller descriptions). Edit by hand;
// the generator skips this file once it exists.
import type { ReferenceTableData } from './types';

export const zxspectrumReference: ReferenceTableData = {
  title: 'ZX Spectrum BASIC (48K & 128K)',
  machines: ['Sinclair ZX Spectrum 48K', 'Sinclair ZX Spectrum 128K'],
  entries: [
    {
      name: 'RND',
      kind: 'function',
      syntax: 'RND',
      description:
        'Returns a pseudo-random number from 0 to just under 1; combine with INT for whole numbers, e.g. INT(RND*6)+1 for a dice roll.',
    },
    {
      name: 'INKEY$',
      kind: 'function',
      syntax: 'INKEY$',
      description:
        'Returns the key currently held down as a one-character string, or "" if none. Non-blocking, so it is the standard way to read controls inside a game loop without halting.',
    },
    {
      name: 'PI',
      kind: 'function',
      syntax: 'PI',
      description:
        'The constant pi (3.14159…), useful for trigonometry and circle calculations.',
    },
    {
      name: 'FN',
      kind: 'function',
      syntax: 'FN <var>(<number>[, …])',
      description:
        'Calls a user function previously declared with DEF FN, passing the given arguments. The function name is a single letter (add $ for a string-valued function).',
    },
    {
      name: 'POINT',
      kind: 'function',
      syntax: 'POINT (<number>, <number>)',
      description:
        'Returns 1 if the pixel at x,y is set to ink, or 0 if it is paper (the origin is bottom-left).',
    },
    {
      name: 'SCREEN$',
      kind: 'function',
      syntax: 'SCREEN$ (<number>, <number>)',
      description:
        'Returns the character shown at a text row,col position, recognising the standard font; gives "" when the cell holds graphics it cannot match.',
    },
    {
      name: 'ATTR',
      kind: 'function',
      syntax: 'ATTR (<number>, <number>)',
      description:
        'Returns the attribute byte at a text cell, encoding its ink, paper, bright and flash settings as a single number.',
    },
    {
      name: 'AT',
      kind: 'operator',
      syntax: 'PRINT AT <number>, <number>;',
      description:
        'Used inside PRINT to position the cursor at a given row (0-21) and column (0-31) before the following item.',
    },
    {
      name: 'TAB',
      kind: 'operator',
      syntax: 'PRINT TAB <number>;',
      description:
        'Used inside PRINT to move the print position to a given column, wrapping to the next line if it has already passed it.',
    },
    {
      name: 'VAL$',
      kind: 'function',
      syntax: 'VAL$ <string>',
      description:
        'Evaluates the text held in a string as a string expression and returns the resulting string; errors if it is not a valid expression.',
    },
    {
      name: 'CODE',
      kind: 'function',
      syntax: 'CODE <string>',
      description:
        'Returns the character code of the first character of the string, or 0 for an empty string.',
    },
    {
      name: 'VAL',
      kind: 'function',
      syntax: 'VAL <string>',
      description:
        'Evaluates the text held in a string as a numeric expression and returns the number; errors if it is not valid.',
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
      description: 'Returns the sine of an angle given in radians.',
    },
    {
      name: 'COS',
      kind: 'function',
      syntax: 'COS <number>',
      description: 'Returns the cosine of an angle given in radians.',
    },
    {
      name: 'TAN',
      kind: 'function',
      syntax: 'TAN <number>',
      description: 'Returns the tangent of an angle given in radians.',
    },
    {
      name: 'ASN',
      kind: 'function',
      syntax: 'ASN <number>',
      description:
        'Returns the arcsine (in radians) of x, which must be -1 to 1.',
    },
    {
      name: 'ACS',
      kind: 'function',
      syntax: 'ACS <number>',
      description:
        'Returns the arccosine (in radians) of x, which must be -1 to 1.',
    },
    {
      name: 'ATN',
      kind: 'function',
      syntax: 'ATN <number>',
      description: 'Returns the arctangent of x as an angle in radians.',
    },
    {
      name: 'LN',
      kind: 'function',
      syntax: 'LN <number>',
      description:
        'Returns the natural (base-e) logarithm of x; errors when x is zero or negative.',
    },
    {
      name: 'EXP',
      kind: 'function',
      syntax: 'EXP <number>',
      description: 'Returns e raised to the power x, the inverse of LN.',
    },
    {
      name: 'INT',
      kind: 'function',
      syntax: 'INT <number>',
      description:
        'Returns the largest integer not greater than x, so it rounds toward negative infinity (INT(-1.5) gives -2).',
    },
    {
      name: 'SQR',
      kind: 'function',
      syntax: 'SQR <number>',
      description:
        'Returns the square root of x; errors on negative arguments.',
    },
    {
      name: 'SGN',
      kind: 'function',
      syntax: 'SGN <number>',
      description:
        'Returns the sign of x: -1 if negative, 0 if zero, 1 if positive.',
    },
    {
      name: 'ABS',
      kind: 'function',
      syntax: 'ABS <number>',
      description:
        'Returns the absolute value (magnitude) of x without its sign.',
    },
    {
      name: 'PEEK',
      kind: 'function',
      syntax: 'PEEK <number>',
      description:
        'Reads and returns the byte (0-255) stored at the given memory address.',
    },
    {
      name: 'IN',
      kind: 'function',
      syntax: 'IN <number>',
      description:
        'Reads a byte from the given Z80 I/O port, used for hardware access and keyboard scanning.',
    },
    {
      name: 'USR',
      kind: 'function',
      syntax: 'USR <number> | USR <string>',
      description:
        'With a numeric address, calls machine code there and returns the BC register; with a single-letter string it returns the address of that user-defined graphic (UDG).',
    },
    {
      name: 'STR$',
      kind: 'function',
      syntax: 'STR$ <number>',
      description:
        'Converts a number to its string form, exactly as it would be PRINTed.',
    },
    {
      name: 'CHR$',
      kind: 'function',
      syntax: 'CHR$ <number>',
      description:
        'Returns the single-character string for the given character code.',
    },
    {
      name: 'NOT',
      kind: 'function',
      syntax: 'NOT <number>',
      description: 'Logical negation: returns 1 when x is 0, otherwise 0.',
    },
    {
      name: 'BIN',
      kind: 'function',
      syntax: 'BIN <int>',
      description:
        'Interprets the following binary digits as a number, e.g. BIN 1010 is 10; handy for POKEing bit patterns.',
    },
    {
      name: 'OR',
      kind: 'operator',
      syntax: '<number> OR <number>',
      description:
        'Logical or with a Sinclair twist: a OR b yields 1 when b is non-zero (true), otherwise it yields a.',
    },
    {
      name: 'AND',
      kind: 'operator',
      syntax: '<number> AND <number>',
      description:
        'Logical and: a AND b yields a when b is non-zero (true), otherwise 0 (or "" when a is a string).',
    },
    {
      name: '<=',
      kind: 'operator',
      syntax: '<=',
      description:
        'Comparison operator, true (1) when the left value is less than or equal to the right.',
    },
    {
      name: '>=',
      kind: 'operator',
      syntax: '>=',
      description:
        'Comparison operator, true (1) when the left value is greater than or equal to the right.',
    },
    {
      name: '<>',
      kind: 'operator',
      syntax: '<>',
      description:
        'Comparison operator, true (1) when the two values are not equal.',
    },
    {
      name: 'LINE',
      kind: 'operator',
      syntax: 'SAVE <string> LINE <line> | INPUT LINE <strvar>',
      description:
        'In SAVE … LINE it sets the line a reloaded program auto-runs from; in INPUT LINE it reads a whole line of text into a string without needing quotes.',
    },
    {
      name: 'THEN',
      kind: 'operator',
      syntax: 'IF <number> THEN …',
      description:
        'Introduces the statements run when an IF condition is true; everything after THEN on the line (including further ":"-separated statements) is conditional.',
    },
    {
      name: 'TO',
      kind: 'operator',
      syntax:
        'FOR <numvar> = <number> TO <number> | <string>(<number> TO <number>)',
      description:
        'Marks the bounds of a FOR loop range, or selects a slice of a string, as in a$(2 TO 4).',
    },
    {
      name: 'STEP',
      kind: 'operator',
      syntax: 'FOR <numvar> = <number> TO <number> STEP <number>',
      description:
        'Sets the amount added to the FOR control variable each pass; may be negative or fractional, and defaults to 1 when omitted.',
    },
    {
      name: 'DEF FN',
      kind: 'command',
      syntax: 'DEF FN <var>(<var>[, …]) = <number>',
      description:
        'Defines a user function with a single-letter name and optional parameters; the body is one expression, evaluated when called with FN. Add a $ suffix for a string function.',
    },
    {
      name: 'CAT',
      kind: 'command',
      syntax: 'CAT',
      description: 'Catalogues the files on a Microdrive (or other storage).',
    },
    {
      name: 'FORMAT',
      kind: 'command',
      syntax: 'FORMAT <string>; <number>',
      description:
        'Formats a Microdrive cartridge or configures a channel, such as setting the RS232 port baud rate.',
    },
    {
      name: 'MOVE',
      kind: 'command',
      syntax: 'MOVE <string> TO <string>',
      description: 'Renames or moves a file between Microdrive channels.',
    },
    {
      name: 'ERASE',
      kind: 'command',
      syntax: 'ERASE <string>; <string>',
      description: 'Deletes a named file from a Microdrive cartridge.',
    },
    {
      name: 'OPEN #',
      kind: 'command',
      syntax: 'OPEN #<number>, <string>',
      description:
        'Attaches a stream number to a channel (such as "s" screen, "p" printer, or a Microdrive file) so PRINT and INPUT can use it.',
    },
    {
      name: 'CLOSE #',
      kind: 'command',
      syntax: 'CLOSE #<number>',
      description: 'Closes a previously opened stream, freeing it for reuse.',
    },
    {
      name: 'MERGE',
      kind: 'command',
      syntax: 'MERGE <string>',
      description:
        'Loads a program from tape and merges its lines into the current program rather than replacing it; lines with matching numbers are overwritten.',
    },
    {
      name: 'VERIFY',
      kind: 'command',
      syntax: 'VERIFY <string>',
      description:
        'Compares a recording on tape against memory to confirm that a SAVE was written correctly.',
    },
    {
      name: 'BEEP',
      kind: 'command',
      syntax: 'BEEP <number>, <number>',
      description:
        'Produces a tone through the speaker; the first value is the duration in seconds and the second the pitch in semitones above (or below) middle C.',
    },
    {
      name: 'CIRCLE',
      kind: 'command',
      syntax: 'CIRCLE <number>, <number>, <number>',
      description:
        'Draws a circle in the current ink centred at x,y with the given radius.',
    },
    {
      name: 'INK',
      kind: 'command',
      syntax: 'INK <number>',
      description:
        'Sets the ink (foreground) colour 0-7 for following output; 8 keeps the existing colour and 9 picks black or white for contrast.',
    },
    {
      name: 'PAPER',
      kind: 'command',
      syntax: 'PAPER <number>',
      description:
        'Sets the paper (background) colour 0-7 for following output; 8 and 9 behave like INK’s transparent and contrast options.',
    },
    {
      name: 'FLASH',
      kind: 'command',
      syntax: 'FLASH <number>',
      description:
        'Turns the flashing attribute on (1) or off (0) for following output, or 8 to leave it unchanged.',
    },
    {
      name: 'BRIGHT',
      kind: 'command',
      syntax: 'BRIGHT <number>',
      description:
        'Turns the bright (high-intensity) attribute on (1) or off (0) for following output, or 8 to leave it unchanged.',
    },
    {
      name: 'INVERSE',
      kind: 'command',
      syntax: 'INVERSE <number>',
      description:
        'When set to 1, swaps ink and paper for printed characters; 0 restores normal printing.',
    },
    {
      name: 'OVER',
      kind: 'command',
      syntax: 'OVER <number>',
      description:
        'When set to 1, combines new output with existing pixels using XOR (so printing twice erases); 0 restores normal overwriting.',
    },
    {
      name: 'OUT',
      kind: 'command',
      syntax: 'OUT <number>, <number>',
      description:
        'Writes a byte to the given Z80 I/O port, used to drive hardware directly.',
    },
    {
      name: 'LPRINT',
      kind: 'command',
      syntax: 'LPRINT …',
      description: 'Like PRINT, but sends its output to the ZX Printer.',
    },
    {
      name: 'LLIST',
      kind: 'command',
      syntax: 'LLIST [<line>]',
      description:
        'Lists the program (optionally from a given line) to the ZX Printer instead of the screen.',
    },
    {
      name: 'STOP',
      kind: 'command',
      syntax: 'STOP',
      description:
        'Halts the program with report 9; CONTINUE then resumes at the next statement.',
    },
    {
      name: 'READ',
      kind: 'command',
      syntax: 'READ <var>[, <var>…]',
      description:
        'Assigns the next unread DATA items, in order, to the listed variables.',
    },
    {
      name: 'DATA',
      kind: 'command',
      syntax: 'DATA <number> | <string>[, …]',
      description:
        'Holds a list of constants that READ consumes in sequence; the statement does nothing when execution runs over it.',
    },
    {
      name: 'RESTORE',
      kind: 'command',
      syntax: 'RESTORE [<line>]',
      description:
        'Resets the DATA read pointer so the next READ starts again, optionally from the DATA at a given line.',
    },
    {
      name: 'NEW',
      kind: 'command',
      syntax: 'NEW',
      description: 'Wipes the program and all variables, resetting BASIC.',
    },
    {
      name: 'BORDER',
      kind: 'command',
      syntax: 'BORDER <number>',
      description:
        'Sets the colour 0-7 of the screen border surrounding the main display area.',
    },
    {
      name: 'CONTINUE',
      kind: 'command',
      syntax: 'CONTINUE',
      description:
        'Resumes the program after a STOP, an error, or a break, picking up where it left off.',
    },
    {
      name: 'DIM',
      kind: 'command',
      syntax: 'DIM <numvar>(<number>[, …]) | DIM <strvar>(<number>[, …])',
      description:
        'Creates an array of the given dimensions, clearing any earlier array of that name; numeric subscripts start at 1 and a string array’s last dimension fixes the character length of each entry.',
    },
    {
      name: 'REM',
      kind: 'command',
      syntax: 'REM …',
      description:
        'Marks the rest of the line as a comment that is ignored when the program runs.',
    },
    {
      name: 'FOR',
      kind: 'command',
      syntax: 'FOR <numvar> = <number> TO <number> [STEP <number>]',
      description:
        'Begins a counting loop, initialising the single-letter control variable and looping back from the matching NEXT until it passes the TO limit.',
    },
    {
      name: 'GO TO',
      kind: 'command',
      syntax: 'GO TO <line>',
      description:
        'Jumps execution to the given line number, which may be a calculated expression. GOTO is also accepted.',
    },
    {
      name: 'GO SUB',
      kind: 'command',
      syntax: 'GO SUB <line>',
      description:
        'Calls the subroutine at the given line, remembering where to return; the matching RETURN resumes after the call. GOSUB is also accepted.',
    },
    {
      name: 'INPUT',
      kind: 'command',
      syntax: 'INPUT [<string>;] <var>',
      description:
        'Pauses the program to read typed values into the listed variables, optionally showing a prompt; numeric variables reject non-numeric input.',
    },
    {
      name: 'LOAD',
      kind: 'command',
      syntax: 'LOAD <string>',
      description:
        'Loads a program (or data block) of the given name from tape into memory.',
    },
    {
      name: 'LIST',
      kind: 'command',
      syntax: 'LIST [<line>]',
      description:
        'Displays the program listing, optionally starting from a given line.',
    },
    {
      name: 'LET',
      kind: 'command',
      syntax: 'LET <var> = <number> | <string>',
      description:
        'Assigns the value of an expression to a variable; on the Spectrum LET is mandatory and cannot be omitted.',
    },
    {
      name: 'PAUSE',
      kind: 'command',
      syntax: 'PAUSE <number>',
      description:
        'Pauses for the given number of 50ths-of-a-second frames, or until a key is pressed; PAUSE 0 waits indefinitely for a keypress.',
    },
    {
      name: 'NEXT',
      kind: 'command',
      syntax: 'NEXT <numvar>',
      description:
        'Marks the end of a FOR loop, advancing its control variable and looping back while the limit has not been passed.',
    },
    {
      name: 'POKE',
      kind: 'command',
      syntax: 'POKE <number>, <number>',
      description:
        'Writes a byte (0-255) directly to the given memory address.',
    },
    {
      name: 'PRINT',
      kind: 'command',
      syntax: 'PRINT [AT <number>, <number>;] …',
      description:
        'Outputs text and numbers to the screen; ";" joins items directly, "," tabs to the next half-screen field, and AT/TAB set the position.',
    },
    {
      name: 'PLOT',
      kind: 'command',
      syntax: 'PLOT <number>, <number>',
      description:
        'Sets (or with INVERSE clears) a single pixel at x,y, where x runs 0-255 and y 0-175 from the bottom-left.',
    },
    {
      name: 'RUN',
      kind: 'command',
      syntax: 'RUN [<line>]',
      description:
        'Clears the variables and starts the program, optionally from a given line.',
    },
    {
      name: 'SAVE',
      kind: 'command',
      syntax: 'SAVE <string> [LINE <line>]',
      description:
        'Saves the program to tape under the given name; adding LINE makes it auto-run from that line when reloaded.',
    },
    {
      name: 'RANDOMIZE',
      kind: 'command',
      syntax: 'RANDOMIZE [<number>]',
      description:
        'Seeds the random number generator; with no argument (or 0) it seeds unpredictably from the frame counter, while a non-zero value gives a repeatable sequence.',
    },
    {
      name: 'IF',
      kind: 'command',
      syntax: 'IF <number> THEN …',
      description:
        'Tests a condition (0 is false, non-zero true) and runs the statements after THEN when it holds; there is no ELSE.',
    },
    {
      name: 'CLS',
      kind: 'command',
      syntax: 'CLS',
      description:
        'Clears the screen to the current paper colour and homes the cursor.',
    },
    {
      name: 'DRAW',
      kind: 'command',
      syntax: 'DRAW <number>, <number>[, <number>]',
      description:
        'Draws a line from the last plotted point by the given x,y offset; a third value bends it into an arc turning through that many radians.',
    },
    {
      name: 'CLEAR',
      kind: 'command',
      syntax: 'CLEAR [<number>]',
      description:
        'Deletes all variables and resets the screen; an optional address lowers RAMTOP to reserve space (e.g. for machine code).',
    },
    {
      name: 'RETURN',
      kind: 'command',
      syntax: 'RETURN',
      description: 'Returns from a GO SUB to the statement after the call.',
    },
    {
      name: 'COPY',
      kind: 'command',
      syntax: 'COPY',
      description: 'Sends a copy of the current screen to the ZX Printer.',
    },
    {
      name: 'SPECTRUM',
      kind: 'command',
      syntax: 'SPECTRUM',
      description:
        'Switches a 128K machine back into 48 BASIC mode. Only meaningful on the 128K models.',
      tag: '128K only',
    },
    {
      name: 'PLAY',
      kind: 'command',
      syntax: 'PLAY <string>[, <string>…]',
      description:
        'Plays music strings on the AY-3-8912 sound chip, one string per channel. Only available in 128K mode.',
      tag: '128K only',
    },
  ],
};
