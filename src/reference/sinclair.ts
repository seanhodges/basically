// Reference table data for the Sinclair BASIC page, which covers the ZX81 and
// both Spectrums.
// Seeded from the dialects' keyword tables by scripts/gen-reference-scaffold.mts,
// then hand-enriched (typed <…> syntax + fuller descriptions). Edit by hand;
// the generator skips this file once it exists.
//
// Three machines and two quite different vocabularies. The ZX81's nine words of
// its own - the glued GOTO and GOSUB, CONT, RAND, FAST, SLOW, SCROLL, UNPLOT
// and ** - are scoped to `zx81` and badged; the Spectrums' thirty-eight are
// scoped to the pair and badged, and the two the 128 alone has keep the 128K
// badge they already carried. keyword-crosscheck.test.ts holds each machine's
// selected rows against its own keyword table, so a row scoped to the wrong
// machines fails rather than merely reading oddly.
//
// Where all three have a row and behave differently, the row says how rather
// than answering for one of them: PLOT is a 64x44 block grid on the ZX81 and
// 256x175 pixels on the Spectrums, THEN takes one statement on the ZX81 and the
// rest of the line on the Spectrums, and CLEAR, INPUT, SAVE and USR each take
// an argument on the Spectrums that the ZX81 has no form for.
import type { BasicReferenceTableData } from './types';
import { withAbbreviations } from './abbreviations';

const sinclairTable: BasicReferenceTableData = {
  title: 'Sinclair BASIC',
  machines: [
    'Sinclair ZX81',
    'Sinclair ZX Spectrum 48K',
    'Sinclair ZX Spectrum 128K',
  ],
  placeholders: [{ id: 'bits', meaning: 'a binary literal, such as 10011' }],
  entries: [
    {
      name: 'RND',
      kind: 'function',
      domain: 'numeric',
      syntax: 'RND',
      description:
        'Returns a pseudo-random number in [0,1). Takes no argument; for a whole number use INT (RND*n)+1, e.g. INT (RND*6)+1 for a dice roll. Seed the generator with RAND on the ZX81 and RANDOMIZE on the Spectrums.',
    },
    {
      name: 'INKEY$',
      kind: 'function',
      domain: 'input',
      syntax: 'INKEY$',
      description:
        'Returns the key currently held down as a one-character string, or "" if none. Non-blocking, so it is the heart of every real-time game loop, e.g. IF INKEY$="8" THEN LET X=X+1.',
    },
    {
      name: 'PI',
      kind: 'function',
      domain: 'numeric',
      syntax: 'PI',
      description:
        'The constant pi (3.14159265…). Handy for trigonometry, since SIN/COS/TAN work in radians.',
    },
    {
      name: 'FN',
      kind: 'function',
      domain: 'control-flow',
      syntax: 'FN <name>([<number>[, <number>]…])',
      description:
        'Calls a user function previously declared with DEF FN, passing the given arguments. The function name is a single letter (add $ for a string-valued function).',
      tag: 'Spectrum only',
      onlyOn: ['zxspectrum', 'zxspectrum128'],
    },
    {
      name: 'POINT',
      kind: 'function',
      domain: 'graphics',
      syntax: 'POINT (<x>, <y>)',
      description:
        'Returns 1 if the pixel at x,y is set to ink, or 0 if it is paper (the origin is bottom-left).',
      tag: 'Spectrum only',
      onlyOn: ['zxspectrum', 'zxspectrum128'],
    },
    {
      name: 'SCREEN$',
      kind: 'function',
      domain: 'text-screen',
      syntax: 'SCREEN$ (<row>, <col>)',
      description:
        'Returns the character shown at a text row,col position, recognising the standard font; gives "" when the cell holds graphics it cannot match.',
      tag: 'Spectrum only',
      onlyOn: ['zxspectrum', 'zxspectrum128'],
    },
    {
      name: 'ATTR',
      kind: 'function',
      domain: 'colour',
      syntax: 'ATTR (<row>, <col>)',
      description:
        'Returns the attribute byte at a text cell, encoding its ink, paper, bright and flash settings as a single number.',
      tag: 'Spectrum only',
      onlyOn: ['zxspectrum', 'zxspectrum128'],
    },
    {
      name: 'AT',
      kind: 'operator',
      domain: 'text-screen',
      syntax: 'PRINT AT <row>, <col>;',
      description:
        'Used inside PRINT to position the cursor before printing: AT row,col with row 0-21 and column 0-31. Out-of-range coordinates raise an error.',
    },
    {
      name: 'TAB',
      kind: 'operator',
      domain: 'text-screen',
      syntax: 'PRINT TAB <number>;',
      description:
        'Used inside PRINT to move the print position to a given column (taken modulo 32, wrapping to the next line if already past it). Only moves forward within the print position.',
    },
    {
      name: 'VAL$',
      kind: 'function',
      domain: 'strings',
      syntax: 'VAL$ <string>',
      description:
        'Evaluates the text held in a string as a string expression and returns the resulting string; errors if it is not a valid expression.',
      tag: 'Spectrum only',
      onlyOn: ['zxspectrum', 'zxspectrum128'],
    },
    {
      name: 'CODE',
      kind: 'function',
      domain: 'strings',
      syntax: 'CODE <string>',
      description:
        "Returns the character code of the first character of the string, or 0 for the empty string. The inverse of CHR$, and in the machine's own codes — see CHR$.",
    },
    {
      name: 'VAL',
      kind: 'function',
      domain: 'strings',
      syntax: 'VAL <string>',
      description:
        'Evaluates the string as a numeric expression and returns the result, so VAL "2+3" gives 5. A malformed expression stops the program with an error.',
    },
    {
      name: 'LEN',
      kind: 'function',
      domain: 'strings',
      syntax: 'LEN <string>',
      description: 'Returns the number of characters in the string.',
    },
    {
      name: 'SIN',
      kind: 'function',
      domain: 'numeric',
      syntax: 'SIN <number>',
      description: 'Returns the sine of the angle, which is given in radians.',
    },
    {
      name: 'COS',
      kind: 'function',
      domain: 'numeric',
      syntax: 'COS <number>',
      description:
        'Returns the cosine of the angle, which is given in radians.',
    },
    {
      name: 'TAN',
      kind: 'function',
      domain: 'numeric',
      syntax: 'TAN <number>',
      description:
        'Returns the tangent of the angle, which is given in radians.',
    },
    {
      name: 'ASN',
      kind: 'function',
      domain: 'numeric',
      syntax: 'ASN <number>',
      description:
        'Returns the arcsine (inverse sine) in radians. The argument must be in the range -1 to 1.',
    },
    {
      name: 'ACS',
      kind: 'function',
      domain: 'numeric',
      syntax: 'ACS <number>',
      description:
        'Returns the arccosine (inverse cosine) in radians. The argument must be in the range -1 to 1.',
    },
    {
      name: 'ATN',
      kind: 'function',
      domain: 'numeric',
      syntax: 'ATN <number>',
      description:
        'Returns the arctangent (inverse tangent) in radians, in the range -pi/2 to pi/2.',
    },
    {
      name: 'LN',
      kind: 'function',
      domain: 'numeric',
      syntax: 'LN <number>',
      description:
        'Returns the natural (base-e) logarithm. The argument must be positive, otherwise the program stops with an error.',
    },
    {
      name: 'EXP',
      kind: 'function',
      domain: 'numeric',
      syntax: 'EXP <number>',
      description: 'Returns e raised to the given power, the inverse of LN.',
    },
    {
      name: 'INT',
      kind: 'function',
      domain: 'numeric',
      syntax: 'INT <number>',
      description:
        'Returns the largest integer not greater than the argument, so it floors towards negative infinity: INT -2.5 is -3, not -2.',
    },
    {
      name: 'SQR',
      kind: 'function',
      domain: 'numeric',
      syntax: 'SQR <number>',
      description:
        'Returns the square root. The argument must not be negative, or the program stops with an error.',
    },
    {
      name: 'SGN',
      kind: 'function',
      domain: 'numeric',
      syntax: 'SGN <number>',
      description:
        'Returns the sign of the argument: -1 if negative, 0 if zero, 1 if positive.',
    },
    {
      name: 'ABS',
      kind: 'function',
      domain: 'numeric',
      syntax: 'ABS <number>',
      description:
        'Returns the absolute value (magnitude) of the argument, without its sign.',
    },
    {
      name: 'PEEK',
      kind: 'function',
      domain: 'memory-hardware',
      syntax: 'PEEK <addr>',
      description:
        'Reads and returns the byte (0-255) stored at the given memory address. On a ZX81, PEEK 16396+256*PEEK 16397 gives the start of the display file (D_FILE).',
    },
    {
      name: 'IN',
      kind: 'function',
      domain: 'memory-hardware',
      syntax: 'IN <number>',
      description:
        'Reads a byte from the given Z80 I/O port, used for hardware access and keyboard scanning.',
      tag: 'Spectrum only',
      onlyOn: ['zxspectrum', 'zxspectrum128'],
    },
    {
      name: 'USR',
      kind: 'function',
      domain: 'memory-hardware',
      syntax: 'USR <addr> | USR <string>',
      description:
        'Calls machine code at the given address and returns the value of the BC register pair on RET — commonly as LET X=USR addr. The string form is the Spectrums’: a single-letter string gives the address of that user-defined graphic instead.',
    },
    {
      name: 'STR$',
      kind: 'function',
      domain: 'strings',
      syntax: 'STR$ <number>',
      description:
        'Returns the number formatted as a string, exactly as PRINT would display it. The inverse of VAL.',
    },
    {
      name: 'CHR$',
      kind: 'function',
      domain: 'strings',
      syntax: 'CHR$ <number>',
      description:
        "Returns the single-character string for the given character code (0-255). The inverse of CODE. The codes are the machine's own: the ZX81's are nothing like ASCII, while the Spectrums follow ASCII from 32 to 126 and put the block graphics, user-defined graphics and keyword tokens above it.",
    },
    {
      name: 'NOT',
      kind: 'function',
      domain: 'numeric',
      syntax: 'NOT <number>',
      description:
        'Logical negation: returns 1 if the argument is 0, otherwise 0. Binds more tightly than the comparison operators.',
    },
    {
      name: 'BIN',
      kind: 'function',
      domain: 'numeric',
      syntax: 'BIN <bits>',
      description:
        'Interprets the following binary digits as a number, e.g. BIN 1010 is 10; handy for POKEing bit patterns.',
      tag: 'Spectrum only',
      onlyOn: ['zxspectrum', 'zxspectrum128'],
    },
    {
      name: 'OR',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> OR <number>',
      description:
        'Logical or with a Sinclair twist: a OR b yields 1 when b is non-zero (true), otherwise it yields a. In practice a OR b is true if either operand is.',
    },
    {
      name: 'AND',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> AND <number>',
      description:
        'Logical and: a AND b yields a when b is non-zero (true), otherwise 0 — or "" where a is a string, on the Spectrums, the ZX81 having no string operands here. So a AND b is true only when both operands are.',
    },
    {
      name: '<=',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> <= <number>',
      description:
        'Comparison operator, true (1) when the left value is less than or equal to the right. Tokenizes to a single byte, so type it without a space between the symbols.',
    },
    {
      name: '>=',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> >= <number>',
      description:
        'Comparison operator, true (1) when the left value is greater than or equal to the right. Tokenizes to a single byte, so type it without a space between the symbols.',
    },
    {
      name: '<>',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> <> <number>',
      description:
        'Comparison operator, true (1) when the two values are not equal. Tokenizes to a single byte, so type it without a space between the symbols.',
    },
    {
      name: 'LINE',
      kind: 'operator',
      domain: 'storage',
      syntax: 'SAVE <string> LINE <line> | INPUT LINE <strvar>',
      description:
        'In SAVE … LINE it sets the line a reloaded program auto-runs from; in INPUT LINE it reads a whole line of text into a string without needing quotes.',
      tag: 'Spectrum only',
      onlyOn: ['zxspectrum', 'zxspectrum128'],
    },
    {
      name: 'THEN',
      kind: 'operator',
      domain: 'control-flow',
      syntax: 'IF <number> THEN <statement>',
      description:
        'Introduces what runs when an IF condition is true, and the two machines differ in how much that is: the ZX81 allows one statement and has no multi-statement lines at all, while on the Spectrums everything after THEN on the line — including further ":"-separated statements — is conditional. Neither has ELSE.',
    },
    {
      name: 'TO',
      kind: 'operator',
      domain: 'control-flow',
      syntax:
        'FOR <numvar> = <number> TO <number> | <string>(<number> TO <number>)',
      description:
        'Gives the upper bound of a FOR loop range, and also slices strings, so A$(2 TO 4) returns the 2nd-to-4th characters. Either slice index may be omitted to mean the start or end of the string.',
    },
    {
      name: 'STEP',
      kind: 'operator',
      domain: 'control-flow',
      syntax: 'FOR <numvar> = <number> TO <number> STEP <number>',
      description:
        'Sets the amount added to a FOR loop variable each pass (default 1). May be negative or fractional, to count down or by partial steps.',
    },
    {
      name: 'DEF FN',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'DEF FN <name>([<param>[, <param>]…]) = <expr>',
      description:
        'Defines a user function with a single-letter name and optional parameters; the body is one expression, evaluated when called with FN. Add a $ suffix for a string function.',
      tag: 'Spectrum only',
      onlyOn: ['zxspectrum', 'zxspectrum128'],
    },
    {
      name: 'CAT',
      kind: 'command',
      domain: 'storage',
      syntax: 'CAT',
      description: 'Catalogues the files on a Microdrive (or other storage).',
      tag: 'Spectrum only',
      onlyOn: ['zxspectrum', 'zxspectrum128'],
    },
    {
      name: 'FORMAT',
      kind: 'command',
      domain: 'storage',
      syntax: 'FORMAT <string>; <number>',
      description:
        'Formats a Microdrive cartridge or configures a channel, such as setting the RS232 port baud rate.',
      tag: 'Spectrum only',
      onlyOn: ['zxspectrum', 'zxspectrum128'],
    },
    {
      name: 'MOVE',
      kind: 'command',
      domain: 'storage',
      syntax: 'MOVE <string> TO <string>',
      description: 'Renames or moves a file between Microdrive channels.',
      tag: 'Spectrum only',
      onlyOn: ['zxspectrum', 'zxspectrum128'],
    },
    {
      name: 'ERASE',
      kind: 'command',
      domain: 'storage',
      syntax: 'ERASE <string>; <string>',
      description: 'Deletes a named file from a Microdrive cartridge.',
      tag: 'Spectrum only',
      onlyOn: ['zxspectrum', 'zxspectrum128'],
    },
    {
      name: 'OPEN #',
      kind: 'command',
      domain: 'storage',
      syntax: 'OPEN #<number>, <string>',
      description:
        'Attaches a stream number to a channel (such as "s" screen, "p" printer, or a Microdrive file) so PRINT and INPUT can use it.',
      tag: 'Spectrum only',
      onlyOn: ['zxspectrum', 'zxspectrum128'],
    },
    {
      name: 'CLOSE #',
      kind: 'command',
      domain: 'storage',
      syntax: 'CLOSE #<number>',
      description: 'Closes a previously opened stream, freeing it for reuse.',
      tag: 'Spectrum only',
      onlyOn: ['zxspectrum', 'zxspectrum128'],
    },
    {
      name: 'MERGE',
      kind: 'command',
      domain: 'storage',
      syntax: 'MERGE <filename>',
      description:
        'Loads a program from tape and merges its lines into the current program rather than replacing it; lines with matching numbers are overwritten.',
      tag: 'Spectrum only',
      onlyOn: ['zxspectrum', 'zxspectrum128'],
    },
    {
      name: 'VERIFY',
      kind: 'command',
      domain: 'storage',
      syntax: 'VERIFY <filename>',
      description:
        'Compares a recording on tape against memory to confirm that a SAVE was written correctly.',
      tag: 'Spectrum only',
      onlyOn: ['zxspectrum', 'zxspectrum128'],
    },
    {
      name: 'BEEP',
      kind: 'command',
      domain: 'sound',
      syntax: 'BEEP <duration>, <pitch>',
      description:
        'Produces a tone through the speaker; the first value is the duration in seconds and the second the pitch in semitones above (or below) middle C.',
      tag: 'Spectrum only',
      onlyOn: ['zxspectrum', 'zxspectrum128'],
    },
    {
      name: 'CIRCLE',
      kind: 'command',
      domain: 'graphics',
      syntax: 'CIRCLE <x>, <y>, <number>',
      description:
        'Draws a circle in the current ink centred at x,y with the given radius.',
      tag: 'Spectrum only',
      onlyOn: ['zxspectrum', 'zxspectrum128'],
    },
    {
      name: 'INK',
      kind: 'command',
      domain: 'colour',
      syntax: 'INK <colour>',
      description:
        'Sets the ink (foreground) colour 0-7 for following output; 8 keeps the existing colour and 9 picks black or white for contrast.',
      tag: 'Spectrum only',
      onlyOn: ['zxspectrum', 'zxspectrum128'],
    },
    {
      name: 'PAPER',
      kind: 'command',
      domain: 'colour',
      syntax: 'PAPER <colour>',
      description:
        'Sets the paper (background) colour 0-7 for following output; 8 and 9 behave like INK’s transparent and contrast options.',
      tag: 'Spectrum only',
      onlyOn: ['zxspectrum', 'zxspectrum128'],
    },
    {
      name: 'FLASH',
      kind: 'command',
      domain: 'colour',
      syntax: 'FLASH <number>',
      description:
        'Turns the flashing attribute on (1) or off (0) for following output, or 8 to leave it unchanged.',
      tag: 'Spectrum only',
      onlyOn: ['zxspectrum', 'zxspectrum128'],
    },
    {
      name: 'BRIGHT',
      kind: 'command',
      domain: 'colour',
      syntax: 'BRIGHT <number>',
      description:
        'Turns the bright (high-intensity) attribute on (1) or off (0) for following output, or 8 to leave it unchanged.',
      tag: 'Spectrum only',
      onlyOn: ['zxspectrum', 'zxspectrum128'],
    },
    {
      name: 'INVERSE',
      kind: 'command',
      domain: 'colour',
      syntax: 'INVERSE <number>',
      description:
        'When set to 1, swaps ink and paper for printed characters; 0 restores normal printing.',
      tag: 'Spectrum only',
      onlyOn: ['zxspectrum', 'zxspectrum128'],
    },
    {
      name: 'OVER',
      kind: 'command',
      domain: 'graphics',
      syntax: 'OVER <number>',
      description:
        'When set to 1, combines new output with existing pixels using XOR (so printing twice erases); 0 restores normal overwriting.',
      tag: 'Spectrum only',
      onlyOn: ['zxspectrum', 'zxspectrum128'],
    },
    {
      name: 'OUT',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'OUT <port>, <byte>',
      description:
        'Writes a byte to the given Z80 I/O port, used to drive hardware directly.',
      tag: 'Spectrum only',
      onlyOn: ['zxspectrum', 'zxspectrum128'],
    },
    {
      name: 'LPRINT',
      kind: 'command',
      domain: 'text-screen',
      syntax: 'LPRINT [<expr>][;|,]…',
      description:
        'Like PRINT but sends output to the ZX Printer instead of the screen, using the same ; and , separators.',
    },
    {
      name: 'LLIST',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'LLIST [<line>]',
      description:
        'Lists the program to the ZX Printer, optionally starting at the given line number.',
    },
    {
      name: 'STOP',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'STOP',
      description:
        'Halts the program with report 9. Execution can be resumed at the following statement — with CONT on the ZX81 and CONTINUE on the Spectrums.',
    },
    {
      name: 'READ',
      kind: 'command',
      domain: 'data',
      syntax: 'READ <var>[, <var>]…',
      description:
        'Assigns the next unread DATA items, in order, to the listed variables.',
      tag: 'Spectrum only',
      onlyOn: ['zxspectrum', 'zxspectrum128'],
    },
    {
      name: 'DATA',
      kind: 'command',
      domain: 'data',
      syntax: 'DATA <expr>[, <expr>]…',
      description:
        'Holds a list of constants that READ consumes in sequence; the statement does nothing when execution runs over it.',
      tag: 'Spectrum only',
      onlyOn: ['zxspectrum', 'zxspectrum128'],
    },
    {
      name: 'RESTORE',
      kind: 'command',
      domain: 'data',
      syntax: 'RESTORE [<line>]',
      description:
        'Resets the DATA read pointer so the next READ starts again, optionally from the DATA at a given line.',
      tag: 'Spectrum only',
      onlyOn: ['zxspectrum', 'zxspectrum128'],
    },
    {
      name: 'NEW',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'NEW',
      description:
        'Erases the current program and all variables, resetting BASIC ready for a fresh program.',
    },
    {
      name: 'BORDER',
      kind: 'command',
      domain: 'colour',
      syntax: 'BORDER <colour>',
      description:
        'Sets the colour 0-7 of the screen border surrounding the main display area.',
      tag: 'Spectrum only',
      onlyOn: ['zxspectrum', 'zxspectrum128'],
    },
    {
      name: 'CONTINUE',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'CONTINUE',
      description:
        'Resumes the program after a STOP, an error, or a break, picking up where it left off.',
      tag: 'Spectrum only',
      onlyOn: ['zxspectrum', 'zxspectrum128'],
    },
    {
      name: 'DIM',
      kind: 'command',
      domain: 'data',
      syntax: 'DIM <var>(<number>[, <number>]…)',
      description:
        'Declares a numeric or string array with the given dimensions, clearing any earlier array of that name; the name is a single letter and subscripts start at 1. A string array DIM A$(n,m) holds n fixed-length strings of m characters, space-padded.',
    },
    {
      name: 'REM',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'REM <comment>',
      description:
        'Marks the rest of the line as a comment, ignored when the program runs. On the ZX81 it is also the usual container for machine-code bytes; the Spectrums keep code in a separate CODE block instead.',
    },
    {
      name: 'FOR',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'FOR <numvar> = <number> TO <number> [STEP <number>]',
      description:
        'Begins a counting loop, initialising the single-letter control variable and running the lines up to the matching NEXT, which loops back until the TO limit is passed. The body always runs at least once.',
    },
    {
      name: 'GO TO',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'GO TO <line>',
      description:
        'Jumps execution to the given line number, which may be a calculated expression. GOTO is also accepted.',
      tag: 'Spectrum only',
      onlyOn: ['zxspectrum', 'zxspectrum128'],
    },
    {
      name: 'GO SUB',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'GO SUB <line>',
      description:
        'Calls the subroutine at the given line, remembering where to return; the matching RETURN resumes after the call. GOSUB is also accepted.',
      tag: 'Spectrum only',
      onlyOn: ['zxspectrum', 'zxspectrum128'],
    },
    {
      name: 'INPUT',
      kind: 'command',
      domain: 'input',
      syntax: 'INPUT [<prompt>;] <var>',
      description:
        'Stops and waits for a value to be typed, assigning it to the variable; a numeric variable rejects non-numeric input, and on the ZX81 a string variable expects a quoted entry. The prompt is the Spectrums’: the ZX81’s INPUT takes a variable and nothing else. It halts the program either way, so use INKEY$ in real-time game loops instead.',
    },
    {
      name: 'LOAD',
      kind: 'command',
      domain: 'storage',
      syntax: 'LOAD <filename>',
      description:
        'Loads a program of the given name from tape into memory, replacing whatever is there; LOAD "" loads the first program found.',
    },
    {
      name: 'LIST',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'LIST [<line>]',
      description:
        'Lists the program to the screen, optionally starting at the given line number, and sets that line as the current edit line.',
    },
    {
      name: 'LET',
      kind: 'command',
      domain: 'data',
      syntax: 'LET <var> = <expr>',
      description:
        'Assigns the value of an expression to a variable. LET is mandatory on both machines — an assignment without it is a syntax error.',
    },
    {
      name: 'PAUSE',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'PAUSE <number>',
      description:
        'Pauses for the given number of frames (50 per second), or until a key is pressed. Waiting indefinitely is PAUSE 0 on the Spectrums and any value of 32768 or more on the ZX81, where it is also worth following with POKE 16437,255 to avoid a known display glitch on real hardware.',
    },
    {
      name: 'NEXT',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'NEXT <numvar>',
      description:
        'Marks the end of the FOR loop using the named control variable, adding the STEP and looping back if the limit has not been passed.',
    },
    {
      name: 'POKE',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'POKE <addr>, <byte>',
      description:
        'Writes a byte value (0-255) directly to the given memory address. Useful for system pokes, but easy to crash the machine with if misused.',
    },
    {
      name: 'PRINT',
      kind: 'command',
      domain: 'text-screen',
      syntax: 'PRINT [AT <row>, <col>;] [<expr>][;|,]…',
      description:
        'Writes text and numbers to the display. ";" joins items with no gap, "," tabs to the next 16-column field, and a trailing ";" suppresses the newline. AT positions the cursor at row 0-21, column 0-31, and TAB sets the column.',
    },
    {
      name: 'PLOT',
      kind: 'command',
      domain: 'graphics',
      syntax: 'PLOT <x>, <y>',
      description:
        'Sets a single point at x,y with the origin at the bottom-left. The grid is the machine’s: 64x44 character-block pixels on the ZX81, where UNPLOT clears one, and 256x175 real pixels on the Spectrums, where OVER 1 or INVERSE 1 clears one instead.',
    },
    {
      name: 'RUN',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'RUN [<line>]',
      description:
        'Clears all variables and runs the program from the start, or from the given line number if one is supplied.',
    },
    {
      name: 'SAVE',
      kind: 'command',
      domain: 'storage',
      syntax: 'SAVE <filename> [LINE <line>]',
      description:
        'Saves the current program to tape under the given name. The LINE clause is the Spectrums’, and makes the program auto-run from that line when reloaded; a ZX81 image always restarts and runs by itself.',
    },
    {
      name: 'RANDOMIZE',
      kind: 'command',
      domain: 'numeric',
      syntax: 'RANDOMIZE [<number>]',
      description:
        'Seeds the random number generator; with no argument (or 0) it seeds unpredictably from the frame counter, while a non-zero value gives a repeatable sequence.',
      tag: 'Spectrum only',
      onlyOn: ['zxspectrum', 'zxspectrum128'],
    },
    {
      name: 'IF',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'IF <number> THEN <statement>',
      description:
        'Runs what follows THEN when the condition is non-zero (true). Conditions use =, <, >, <=, >=, <>, AND, OR and NOT; there is no ELSE. How much of the line is conditional differs — see THEN.',
    },
    {
      name: 'CLS',
      kind: 'command',
      domain: 'text-screen',
      syntax: 'CLS',
      description:
        'Clears the screen and homes the cursor — to blank on the ZX81, and to the current paper colour on the Spectrums. In games, prefer erasing single cells with PRINT AT rather than clearing every frame.',
    },
    {
      name: 'DRAW',
      kind: 'command',
      domain: 'graphics',
      syntax: 'DRAW <dx>, <dy>[, <number>]',
      description:
        'Draws a line from the last plotted point by the given x,y offset; a third value bends it into an arc turning through that many radians.',
      tag: 'Spectrum only',
      onlyOn: ['zxspectrum', 'zxspectrum128'],
    },
    {
      name: 'CLEAR',
      kind: 'command',
      domain: 'data',
      syntax: 'CLEAR [<number>]',
      description:
        'Deletes all variables and arrays, freeing their memory, and leaves the program itself intact. The optional address is the Spectrums’: it lowers RAMTOP to reserve space (for machine code, say) and clears the screen with it. The ZX81’s CLEAR takes no argument.',
    },
    {
      name: 'RETURN',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'RETURN',
      description:
        'Returns from a subroutine to the statement following the matching call. Calling it without a pending call stops the program with report 7.',
    },
    {
      name: 'COPY',
      kind: 'command',
      domain: 'text-screen',
      syntax: 'COPY',
      description:
        'Prints a copy of the current screen contents to the ZX Printer.',
    },
    {
      name: 'SPECTRUM',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'SPECTRUM',
      description:
        'Switches a 128K machine back into 48 BASIC mode. Only meaningful on the 128K models.',
      tag: '128K only',
      onlyOn: ['zxspectrum128'],
    },
    {
      name: 'PLAY',
      kind: 'command',
      domain: 'sound',
      syntax: 'PLAY <string>[, <string>]…',
      description:
        'Plays music strings on the AY-3-8912 sound chip, one string per channel. Only available in 128K mode.',
      tag: '128K only',
      onlyOn: ['zxspectrum128'],
    },
    {
      name: '↑',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> ↑ <number>',
      description:
        'Raises to a power. Typed with the caret key, and shown as an up arrow; folds left to right, so 2↑3↑2 is 64.',
      tag: 'Spectrum only',
      onlyOn: ['zxspectrum', 'zxspectrum128'],
    },
    {
      name: '+',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> + <number> | <string> + <string>',
      description: 'Addition / string concatenation.',
    },
    {
      name: '-',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> - <number> | -<number>',
      description: 'Subtraction / negation.',
    },
    {
      name: '*',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> * <number>',
      description: 'Multiplication.',
    },
    {
      name: '/',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> / <number>',
      description: 'Division.',
    },
    {
      name: '=',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<var> = <expr> | <expr> = <expr>',
      description: 'Assignment / equality. A true comparison is 1.',
    },
    {
      name: '<',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> < <number> | <string> < <string>',
      description: 'Less than.',
    },
    {
      name: '>',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> > <number> | <string> > <string>',
      description: 'Greater than.',
    },
    {
      name: '**',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> ** <number>',
      description:
        'Raises the left value to the power of the right. The ZX81 uses ** for exponentiation, not the ^ found on other machines.',
      tag: 'ZX81 only',
      onlyOn: ['zx81'],
    },
    {
      name: 'SLOW',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'SLOW',
      description:
        'Switches to SLOW mode: the display stays on continuously but the CPU runs at about a quarter speed. Use FAST to blank the screen for full-speed computation.',
      tag: 'ZX81 only',
      onlyOn: ['zx81'],
    },
    {
      name: 'FAST',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'FAST',
      description:
        'Switches to FAST mode: the CPU runs at full speed with the screen blanked, flickering on only during INPUT or PAUSE. Use SLOW to keep a steady picture.',
      tag: 'ZX81 only',
      onlyOn: ['zx81'],
    },
    {
      name: 'SCROLL',
      kind: 'command',
      domain: 'text-screen',
      syntax: 'SCROLL',
      description:
        'Scrolls the whole display up by one line, losing the top line and freeing the bottom one. Must be called before printing when the screen is full, or the program stops with report 5.',
      tag: 'ZX81 only',
      onlyOn: ['zx81'],
    },
    {
      name: 'CONT',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'CONT',
      description:
        'Resumes a program that was halted by STOP or by the BREAK key, continuing from where it left off.',
      tag: 'ZX81 only',
      onlyOn: ['zx81'],
    },
    {
      name: 'GOTO',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'GOTO <number>',
      description:
        'Jumps to the given line number. The target can be a computed expression, e.g. GOTO 100+10*L; if no line matches, execution continues at the next existing line.',
      tag: 'ZX81 only',
      onlyOn: ['zx81'],
    },
    {
      name: 'GOSUB',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'GOSUB <number>',
      description:
        'Calls the subroutine starting at the given line number; a RETURN sends control back to the statement after the GOSUB. Calls may be nested.',
      tag: 'ZX81 only',
      onlyOn: ['zx81'],
    },
    {
      name: 'RAND',
      kind: 'command',
      domain: 'numeric',
      syntax: 'RAND [<number>]',
      description:
        'Seeds the RND generator. RAND n with the same n gives a repeatable sequence; RAND 0 (or RAND with no argument) seeds from the frame counter for unpredictable results.',
      tag: 'ZX81 only',
      onlyOn: ['zx81'],
    },
    {
      name: 'UNPLOT',
      kind: 'command',
      domain: 'graphics',
      syntax: 'UNPLOT <x>, <y>',
      description:
        'Clears a single block pixel set by PLOT, using the same coordinate range: x 0–63, y 0–43, origin bottom-left.',
      tag: 'ZX81 only',
      onlyOn: ['zx81'],
    },
  ],
};

/**
 * The page as it renders: each row carries the short spellings its keyword can
 * be typed as, derived from the machine's own resolution order rather than
 * authored above. See ./abbreviations. The Sinclair machines take their
 * keywords by keystroke rather than by spelling, so in practice every row here
 * comes back without any.
 */
export const sinclairReference: BasicReferenceTableData = withAbbreviations(
  'sinclair',
  sinclairTable,
);
