// Reference table data for the BBC BASIC (Micro & Master) page.
// Seeded from the dialect's keyword table by scripts/gen-reference-scaffold.mts,
// then hand-enriched (typed <…> syntax + fuller descriptions). Edit by hand;
// the generator skips this file once it exists.
import type { ReferenceTableData } from './types';

export const bbcReference: ReferenceTableData = {
  title: 'BBC BASIC (Micro & Master)',
  machines: ['BBC Micro Model B', 'BBC Master'],
  entries: [
    {
      name: 'AND',
      kind: 'operator',
      syntax: '<number> AND <number>',
      description:
        'Bitwise/logical AND of two integers; operands are coerced to 32-bit integers before the operation. Doubles as a logical AND in conditions because TRUE is -1 (all bits set) and FALSE is 0.',
    },
    {
      name: 'DIV',
      kind: 'operator',
      syntax: '<number> DIV <number>',
      description:
        'Integer division, truncating any fractional part towards zero (e.g. 7 DIV 2 is 3). Operands are first converted to integers.',
    },
    {
      name: 'EOR',
      kind: 'operator',
      syntax: '<number> EOR <number>',
      description:
        'Bitwise exclusive-OR of two integers, setting each result bit where exactly one operand bit is set. Often used to toggle or flip bits.',
    },
    {
      name: 'MOD',
      kind: 'operator',
      syntax: '<number> MOD <number>',
      description:
        'Integer remainder after division (the companion of DIV); the result takes the sign of the dividend. Operands are converted to integers first.',
    },
    {
      name: 'OR',
      kind: 'operator',
      syntax: '<number> OR <number>',
      description:
        'Bitwise/logical OR of two integers. Acts as a logical OR in conditions since any non-zero (true) operand contributes set bits.',
    },
    {
      name: 'ERROR',
      kind: 'command',
      syntax: 'ON ERROR <statement> | ON ERROR OFF',
      description:
        'Used after ON to install an error handler that runs when a runtime error is trapped; ON ERROR OFF restores the default handler. Inside a handler ERR and ERL give the error number and line.',
    },
    {
      name: 'LINE',
      kind: 'command',
      syntax: 'INPUT LINE <strvar>',
      description:
        'A modifier for INPUT: INPUT LINE reads a whole line of text into a string variable, including commas, spaces and leading punctuation that plain INPUT would treat as separators.',
    },
    {
      name: 'OFF',
      kind: 'command',
      syntax: 'OFF',
      description:
        'A keyword that switches a feature off when it follows another statement, e.g. TRACE OFF to stop line tracing or ON ERROR OFF to disable an error handler.',
    },
    {
      name: 'STEP',
      kind: 'command',
      syntax: 'FOR <numvar> = <number> TO <number> STEP <number>',
      description:
        'Optional part of a FOR statement that sets the increment added to the loop counter each pass; the step may be negative or fractional. Defaults to 1 when omitted.',
    },
    {
      name: 'SPC',
      kind: 'function',
      syntax: 'SPC(<number>)',
      description:
        'Used within PRINT or INPUT to output the given number of spaces. A convenient way to pad output without building a string.',
    },
    {
      name: 'TAB',
      kind: 'function',
      syntax: 'TAB(<number>[, <number>])',
      description:
        'Within PRINT, TAB(x) moves to text column x on the current line, while TAB(x,y) moves the cursor to column x, row y (origin top-left). Only valid inside PRINT/INPUT.',
    },
    {
      name: 'ELSE',
      kind: 'command',
      syntax: 'IF <number> THEN <statement> ELSE <statement>',
      description:
        'Introduces the alternative branch of a single-line IF…THEN, run when the condition is false. BBC BASIC supports ELSE, unlike some 8-bit dialects.',
    },
    {
      name: 'THEN',
      kind: 'command',
      syntax: 'IF <number> THEN <statement> | <line>',
      description:
        'Follows the condition in an IF statement and introduces the action taken when it is true; a bare line number after THEN is treated as a GOTO.',
    },
    {
      name: 'OPENIN',
      kind: 'function',
      syntax: 'OPENIN(<string>)',
      description:
        'Opens an existing file for reading and returns a channel number for use with BGET#, INPUT# and CLOSE#. Returns 0 if the file cannot be found.',
    },
    {
      name: 'PTR',
      kind: 'function',
      syntax: 'PTR#<channel> | PTR#<channel> = <number>',
      description:
        'Reads or sets the sequential byte pointer of an open file, allowing random access; assigning to it seeks to a given offset from the start of the file.',
    },
    {
      name: 'PAGE',
      kind: 'function',
      syntax: 'PAGE | PAGE = <number>',
      description:
        'A pseudo-variable holding the address where the BASIC program text begins; it can be read or assigned to relocate the program. Usually &E00 on a Model B.',
    },
    {
      name: 'TIME',
      kind: 'function',
      syntax: 'TIME | TIME = <number>',
      description:
        'A centisecond elapsed-time counter (100 per second) that can be read and assigned, commonly used for frame pacing and timing loops.',
    },
    {
      name: 'LOMEM',
      kind: 'function',
      syntax: 'LOMEM | LOMEM = <number>',
      description:
        'A pseudo-variable giving the address of the bottom of BASIC variable storage; it can be reassigned to move where variables are kept (normally just above the program).',
    },
    {
      name: 'HIMEM',
      kind: 'function',
      syntax: 'HIMEM | HIMEM = <number>',
      description:
        'A pseudo-variable holding the top of memory available to BASIC; lowering it reserves space above (for example for machine code), and changing screen MODE moves it.',
    },
    {
      name: 'ABS',
      kind: 'function',
      syntax: 'ABS(<number>)',
      description: 'Returns the absolute (unsigned) value of a number.',
    },
    {
      name: 'ACS',
      kind: 'function',
      syntax: 'ACS(<number>)',
      description:
        'Returns the arc cosine of a number (the argument must be between -1 and 1), giving an angle in radians.',
    },
    {
      name: 'ADVAL',
      kind: 'function',
      syntax: 'ADVAL(<number>)',
      description:
        'Reads an analogue-to-digital converter channel or, with a negative argument, the free space in a buffer (keyboard, serial, sound). Used to read joysticks and check buffer status.',
    },
    {
      name: 'ASC',
      kind: 'function',
      syntax: 'ASC(<string>)',
      description:
        'Returns the character code of the first character of a string, or -1 if the string is empty.',
    },
    {
      name: 'ASN',
      kind: 'function',
      syntax: 'ASN(<number>)',
      description:
        'Returns the arc sine of a number (the argument must be between -1 and 1), giving an angle in radians.',
    },
    {
      name: 'ATN',
      kind: 'function',
      syntax: 'ATN(<number>)',
      description:
        'Returns the arctangent of a number, giving an angle in radians.',
    },
    {
      name: 'BGET',
      kind: 'function',
      syntax: 'BGET#<channel>',
      description:
        'Reads and returns the next byte (0–255) from an open file, advancing the file pointer.',
    },
    {
      name: 'COS',
      kind: 'function',
      syntax: 'COS(<number>)',
      description: 'Returns the cosine of an angle given in radians.',
    },
    {
      name: 'COUNT',
      kind: 'function',
      syntax: 'COUNT',
      description:
        'Returns the number of characters printed to the screen since the last newline, useful for aligning columns of output.',
    },
    {
      name: 'DEG',
      kind: 'function',
      syntax: 'DEG(<number>)',
      description: 'Converts an angle from radians to degrees.',
    },
    {
      name: 'ERL',
      kind: 'function',
      syntax: 'ERL',
      description:
        'Returns the line number at which the most recent error occurred; most useful inside an ON ERROR handler.',
    },
    {
      name: 'ERR',
      kind: 'function',
      syntax: 'ERR',
      description:
        'Returns the error number of the most recent error, letting an ON ERROR handler decide how to respond.',
    },
    {
      name: 'EVAL',
      kind: 'function',
      syntax: 'EVAL(<string>)',
      description:
        'Evaluates a string as if it were a BASIC expression and returns the result, allowing formulae to be built or read in at run time.',
    },
    {
      name: 'EXP',
      kind: 'function',
      syntax: 'EXP(<number>)',
      description:
        'Returns e (about 2.718) raised to the given power — the inverse of LN.',
    },
    {
      name: 'EXT',
      kind: 'function',
      syntax: 'EXT#<channel>',
      description:
        'Returns the total length in bytes of an open file, useful for detecting how much data is available.',
    },
    {
      name: 'FALSE',
      kind: 'function',
      syntax: 'FALSE',
      description:
        'The constant 0, the value BASIC returns for a false condition.',
    },
    {
      name: 'FN',
      kind: 'function',
      syntax: 'FN<name>[(<arg>,…)]',
      description:
        'Calls a user-defined function created with DEF FN; the function returns a value via an = expression and may take parameters.',
    },
    {
      name: 'GET',
      kind: 'function',
      syntax: 'GET',
      description:
        'Waits for a key to be pressed and returns its character code; it blocks the program until a key is available.',
    },
    {
      name: 'INKEY',
      kind: 'function',
      syntax: 'INKEY(<number>)',
      description:
        'Waits up to the given number of centiseconds for a key and returns its code, or -1 if none was pressed. With a negative argument it instead tests whether a specific key is currently held down.',
    },
    {
      name: 'INSTR',
      kind: 'function',
      syntax: 'INSTR(<string>, <string>[, <number>])',
      description:
        'Returns the position of the second string within the first (1-based), or 0 if not found; an optional third argument sets the starting position for the search.',
    },
    {
      name: 'INT',
      kind: 'function',
      syntax: 'INT(<number>)',
      description:
        'Returns the integer part of a number, rounding towards minus infinity (so INT(-2.5) is -3).',
    },
    {
      name: 'LEN',
      kind: 'function',
      syntax: 'LEN(<string>)',
      description: 'Returns the number of characters in a string.',
    },
    {
      name: 'LN',
      kind: 'function',
      syntax: 'LN(<number>)',
      description:
        'Returns the natural (base-e) logarithm of a positive number.',
    },
    {
      name: 'LOG',
      kind: 'function',
      syntax: 'LOG(<number>)',
      description: 'Returns the base-10 logarithm of a positive number.',
    },
    {
      name: 'NOT',
      kind: 'operator',
      syntax: 'NOT <number>',
      description:
        "Returns the bitwise complement (one's complement) of an integer. Because TRUE is -1 and FALSE is 0, NOT also inverts a logical value.",
    },
    {
      name: 'OPENUP',
      kind: 'function',
      syntax: 'OPENUP(<string>)',
      description:
        'Opens an existing file for both reading and writing (random access) and returns a channel number. Returns 0 if the file does not exist.',
    },
    {
      name: 'OPENOUT',
      kind: 'function',
      syntax: 'OPENOUT(<string>)',
      description:
        'Creates a new file (or truncates an existing one) for writing and returns a channel number for use with BPUT#, PRINT# and CLOSE#.',
    },
    {
      name: 'PI',
      kind: 'function',
      syntax: 'PI',
      description: 'The constant π, approximately 3.14159265.',
    },
    {
      name: 'POINT',
      kind: 'function',
      syntax: 'POINT(<number>, <number>)',
      description:
        'Returns the logical colour of the pixel at the given graphics coordinates, or -1 if the point lies outside the screen.',
    },
    {
      name: 'POS',
      kind: 'function',
      syntax: 'POS',
      description:
        'Returns the current text cursor column (0 at the left edge); pair with VPOS for the row.',
    },
    {
      name: 'RAD',
      kind: 'function',
      syntax: 'RAD(<number>)',
      description: 'Converts an angle from degrees to radians.',
    },
    {
      name: 'RND',
      kind: 'function',
      syntax: 'RND[(<number>)]',
      description:
        'Returns a random number: RND(n) gives an integer from 1 to n, RND(1) gives a real between 0 and 1, bare RND gives a random 32-bit integer, and RND(0) repeats the last RND(1) value. A negative argument reseeds the generator.',
    },
    {
      name: 'SGN',
      kind: 'function',
      syntax: 'SGN(<number>)',
      description:
        'Returns the sign of a number: -1 if negative, 0 if zero, 1 if positive.',
    },
    {
      name: 'SIN',
      kind: 'function',
      syntax: 'SIN(<number>)',
      description: 'Returns the sine of an angle given in radians.',
    },
    {
      name: 'SQR',
      kind: 'function',
      syntax: 'SQR(<number>)',
      description: 'Returns the square root of a non-negative number.',
    },
    {
      name: 'TAN',
      kind: 'function',
      syntax: 'TAN(<number>)',
      description: 'Returns the tangent of an angle given in radians.',
    },
    {
      name: 'TO',
      kind: 'command',
      syntax: 'FOR <numvar> = <number> TO <number> [STEP <number>]',
      description:
        'Separates the start and limit values in a FOR statement, setting the value the loop counter runs up (or down) to.',
    },
    {
      name: 'TRUE',
      kind: 'function',
      syntax: 'TRUE',
      description:
        'The constant -1, the value BASIC returns for a true condition (all bits set).',
    },
    {
      name: 'USR',
      kind: 'function',
      syntax: 'USR(<number>)',
      description:
        'Calls a machine-code routine at the given address with the registers preset from A%, X%, Y% and the carry flag, and returns the resulting register values packed into one number.',
    },
    {
      name: 'VAL',
      kind: 'function',
      syntax: 'VAL(<string>)',
      description:
        'Returns the number at the start of a string, reading as many leading digits as form a valid number and stopping at the first non-numeric character (0 if none).',
    },
    {
      name: 'VPOS',
      kind: 'function',
      syntax: 'VPOS',
      description:
        'Returns the current text cursor row (0 at the top); pair with POS for the column.',
    },
    {
      name: 'CHR$',
      kind: 'function',
      syntax: 'CHR$(<number>)',
      description:
        'Returns the single-character string for a character code. Codes 128–159 are teletext control codes in MODE 7 (e.g. CHR$(129) for red text).',
    },
    {
      name: 'GET$',
      kind: 'function',
      syntax: 'GET$',
      description:
        'Waits for a key press and returns it as a one-character string (the string equivalent of GET).',
    },
    {
      name: 'INKEY$',
      kind: 'function',
      syntax: 'INKEY$(<number>)',
      description:
        'Waits up to the given number of centiseconds for a key and returns it as a string, or an empty string if none was pressed; INKEY$(0) is the non-blocking form used for game input.',
    },
    {
      name: 'LEFT$',
      kind: 'function',
      syntax: 'LEFT$(<string>, <number>)',
      description:
        'Returns the leftmost n characters of a string (the whole string if n exceeds its length).',
    },
    {
      name: 'MID$',
      kind: 'function',
      syntax: 'MID$(<string>, <number>[, <number>])',
      description:
        'Returns a substring starting at the given 1-based position; without a length it returns the rest of the string from that point.',
    },
    {
      name: 'RIGHT$',
      kind: 'function',
      syntax: 'RIGHT$(<string>, <number>)',
      description:
        'Returns the rightmost n characters of a string (the whole string if n exceeds its length).',
    },
    {
      name: 'STR$',
      kind: 'function',
      syntax: 'STR$(<number>)',
      description:
        'Converts a number to its string representation, using the current @% print format; prefix with ~ (STR$~) for a hexadecimal result.',
    },
    {
      name: 'STRING$',
      kind: 'function',
      syntax: 'STRING$(<number>, <string>)',
      description:
        'Returns a string made of the given string repeated n times — handy for drawing rules or padding output.',
    },
    {
      name: 'EOF',
      kind: 'function',
      syntax: 'EOF#<channel>',
      description:
        'Returns TRUE (-1) when the file pointer has reached the end of an open file, and FALSE (0) otherwise.',
    },
    {
      name: 'AUTO',
      kind: 'command',
      syntax: 'AUTO [<line>[, <number>]]',
      description:
        'An immediate-mode command that generates line numbers automatically as you type, starting at the given line and stepping by the given amount (defaults 10, 10). Press Escape to stop.',
    },
    {
      name: 'DELETE',
      kind: 'command',
      syntax: 'DELETE <line>, <line>',
      description:
        'An immediate-mode command that deletes all program lines in the given range, inclusive.',
    },
    {
      name: 'LOAD',
      kind: 'command',
      syntax: 'LOAD <string>',
      description:
        'Clears the current program and loads a tokenised BASIC program from the filing system, leaving variables cleared.',
    },
    {
      name: 'LIST',
      kind: 'command',
      syntax: 'LIST [<line>[, <line>]]',
      description:
        'Lists the program, optionally restricted to a line range; the LISTO setting controls indentation of structured loops.',
    },
    {
      name: 'NEW',
      kind: 'command',
      syntax: 'NEW',
      description:
        'Erases the current program by resetting BASIC pointers; the text remains in memory, so OLD can usually recover it if NEW was a mistake.',
    },
    {
      name: 'OLD',
      kind: 'command',
      syntax: 'OLD',
      description:
        'Recovers a program after an accidental NEW (or soft reset), provided no new program text has been entered over it.',
    },
    {
      name: 'RENUMBER',
      kind: 'command',
      syntax: 'RENUMBER [<line>[, <number>]]',
      description:
        'Renumbers the whole program and fixes up GOTO/GOSUB targets, starting at the given line and stepping by the given amount (defaults 10, 10).',
    },
    {
      name: 'SAVE',
      kind: 'command',
      syntax: 'SAVE <string>',
      description:
        'Saves the current tokenised BASIC program to the filing system under the given name.',
    },
    {
      name: 'SOUND',
      kind: 'command',
      syntax: 'SOUND <channel>, <number>, <number>, <number>',
      description:
        'Plays a note on one of four sound channels: arguments are the channel, amplitude (0 to -15, or an envelope number), pitch (0–255), and duration in twentieths of a second.',
    },
    {
      name: 'BPUT',
      kind: 'command',
      syntax: 'BPUT#<channel>, <number>',
      description:
        'Writes a single byte (0–255) to an open file at the current pointer, advancing it.',
    },
    {
      name: 'CALL',
      kind: 'command',
      syntax: 'CALL <number>[, <var>,…]',
      description:
        'Calls a machine-code routine at the given address, optionally passing parameters whose addresses are listed in a parameter block for the routine.',
    },
    {
      name: 'CHAIN',
      kind: 'command',
      syntax: 'CHAIN <string>',
      description:
        'Loads another BASIC program from the filing system and runs it immediately, clearing variables first.',
    },
    {
      name: 'CLEAR',
      kind: 'command',
      syntax: 'CLEAR',
      description:
        'Discards all variables, arrays and procedure/function definitions, and forgets any pending GOSUB, FOR and REPEAT contexts.',
    },
    {
      name: 'CLOSE',
      kind: 'command',
      syntax: 'CLOSE#<channel>',
      description:
        'Closes an open file, flushing any buffered output; CLOSE#0 closes all open files at once.',
    },
    {
      name: 'CLG',
      kind: 'command',
      syntax: 'CLG',
      description:
        'Clears the graphics area to the current graphics background colour set by GCOL.',
    },
    {
      name: 'CLS',
      kind: 'command',
      syntax: 'CLS',
      description:
        'Clears the text area to the current text background colour and moves the cursor to the top-left.',
    },
    {
      name: 'DATA',
      kind: 'command',
      syntax: 'DATA <item>[, <item>]…',
      description:
        'Holds a list of constants (numbers or strings) read sequentially by READ; leading spaces are skipped and strings need quotes only if they contain commas.',
    },
    {
      name: 'DEF',
      kind: 'command',
      syntax: 'DEF PROC<name>[(<param>,…)] | DEF FN<name>[(<param>,…)]',
      description:
        'Marks the start of a user-defined procedure (DEF PROC) or function (DEF FN); BASIC skips over DEF lines during normal flow, so place them after END.',
    },
    {
      name: 'DIM',
      kind: 'command',
      syntax: 'DIM <var>(<number>[, <number>]…) | DIM <var> <number>',
      description:
        'Dimensions an array with the given maximum subscripts (indices start at 0, so DIM A(10) gives 11 elements). The form DIM P% n instead reserves n+1 bytes of memory and returns the base address.',
    },
    {
      name: 'DRAW',
      kind: 'command',
      syntax: 'DRAW <number>, <number>',
      description:
        'Draws a line in the current graphics colour from the graphics cursor to the given coordinates, then leaves the cursor there. Coordinates run 0–1279 by 0–1023 regardless of mode.',
    },
    {
      name: 'END',
      kind: 'command',
      syntax: 'END',
      description:
        'Ends program execution cleanly and returns to the command prompt; it may appear anywhere, not just at the physical end.',
    },
    {
      name: 'ENDPROC',
      kind: 'command',
      syntax: 'ENDPROC',
      description:
        'Marks the end of a DEF PROC definition and returns control to the statement after the PROC call.',
    },
    {
      name: 'ENVELOPE',
      kind: 'command',
      syntax: 'ENVELOPE <number>, <number>,… (14 parameters)',
      description:
        'Defines one of the pitch/amplitude envelopes (numbered 1–4) that SOUND can use to shape a note over time; it takes 14 parameters controlling the attack, decay, sustain and release.',
    },
    {
      name: 'FOR',
      kind: 'command',
      syntax: 'FOR <numvar> = <number> TO <number> [STEP <number>]',
      description:
        'Begins a counted loop, repeating the statements up to the matching NEXT while the counter runs from the start value to the limit. The body always executes at least once.',
    },
    {
      name: 'GOSUB',
      kind: 'command',
      syntax: 'GOSUB <line>',
      description:
        'Calls a subroutine at the given line number, saving a return address so RETURN can resume after the call. Procedures (PROC) are preferred in structured BBC BASIC.',
    },
    {
      name: 'GOTO',
      kind: 'command',
      syntax: 'GOTO <line>',
      description: 'Jumps unconditionally to the given line number.',
    },
    {
      name: 'GCOL',
      kind: 'command',
      syntax: 'GCOL <number>, <number>',
      description:
        'Sets the graphics colour and plot action used by MOVE/DRAW/PLOT: the first argument is the plot mode (0 plot, 1 OR, 2 AND, 3 EOR, 4 invert) and the second the logical colour (add 128 for the background). Use COLOUR for text.',
    },
    {
      name: 'IF',
      kind: 'command',
      syntax: 'IF <number> THEN <statement> [ELSE <statement>]',
      description:
        'Evaluates a condition (zero is false, non-zero true) and runs the THEN part if true, otherwise the optional ELSE part. The whole statement lives on one logical line.',
    },
    {
      name: 'INPUT',
      kind: 'command',
      syntax: 'INPUT [<string>,] <var>[, <var>]…',
      description:
        'Reads typed values into one or more variables, displaying an optional prompt string and a "?" prompt; commas separate multiple values and INPUT halts the program until Return is pressed.',
    },
    {
      name: 'LET',
      kind: 'command',
      syntax: 'LET <var> = <number> | <string>',
      description:
        'Assigns a value to a variable. LET is optional in BBC BASIC, so the keyword is rarely written out.',
    },
    {
      name: 'LOCAL',
      kind: 'command',
      syntax: 'LOCAL <var>[, <var>]…',
      description:
        'Inside a DEF PROC or DEF FN, declares variables local to that routine, saving and restoring their previous values around the call so recursion works correctly.',
    },
    {
      name: 'MODE',
      kind: 'command',
      syntax: 'MODE <number>',
      description:
        'Selects a screen mode (0–7 on the Micro; the Master adds shadow modes 128–135 and extra modes), clearing the screen and resetting graphics. MODE 7 is teletext; higher-resolution modes consume more RAM.',
    },
    {
      name: 'MOVE',
      kind: 'command',
      syntax: 'MOVE <number>, <number>',
      description:
        'Moves the graphics cursor to the given coordinates without drawing, setting the start point for the next DRAW or PLOT.',
    },
    {
      name: 'NEXT',
      kind: 'command',
      syntax: 'NEXT [<numvar>]',
      description:
        'Marks the end of a FOR loop and returns to it if more iterations remain; naming the counter variable lets a single NEXT close several nested loops at once.',
    },
    {
      name: 'ON',
      kind: 'command',
      syntax:
        'ON <number> GOTO <line>,… | ON <number> GOSUB <line>,… | ON ERROR <statement>',
      description:
        'Computed branch: ON n GOTO/GOSUB jumps to the nth line number in the list, and ON ERROR installs an error handler. An optional ELSE clause handles an out-of-range index.',
    },
    {
      name: 'VDU',
      kind: 'command',
      syntax: 'VDU <number>[, <number>]…',
      description:
        'Sends raw bytes to the VDU (screen) driver to perform operations like setting colours, defining characters (VDU 23) or window areas; a trailing semicolon sends a value as two bytes (a 16-bit word).',
    },
    {
      name: 'PLOT',
      kind: 'command',
      syntax: 'PLOT <number>, <number>, <number>',
      description:
        'The general graphics primitive: the first argument selects an action (line, point, filled triangle, circle and so on) at the given coordinates. MOVE, DRAW and others are shorthands for particular PLOT codes.',
    },
    {
      name: 'PRINT',
      kind: 'command',
      syntax:
        "PRINT [TAB(<number>[, <number>])] [<number> | <string>] [; , ']…",
      description:
        'Outputs numbers and strings to the screen; "," tabs to the next field, ";" suppresses the trailing newline and column spacing, and "\'" forces a newline. The @% variable controls numeric formatting.',
    },
    {
      name: 'PROC',
      kind: 'command',
      syntax: 'PROC<name>[(<arg>,…)]',
      description:
        'Calls a user-defined procedure created with DEF PROC, optionally passing arguments; execution returns to the statement after the call when ENDPROC is reached.',
    },
    {
      name: 'READ',
      kind: 'command',
      syntax: 'READ <var>[, <var>]…',
      description:
        'Reads the next item(s) from DATA statements into variables, advancing the DATA pointer; RESTORE resets where reading resumes.',
    },
    {
      name: 'REM',
      kind: 'command',
      syntax: 'REM <comment>',
      description:
        'Marks the rest of the line as a comment that BASIC ignores. Comments still occupy program memory.',
    },
    {
      name: 'REPEAT',
      kind: 'command',
      syntax: 'REPEAT',
      description:
        'Marks the top of a REPEAT…UNTIL loop, whose body always runs at least once and repeats until the UNTIL condition becomes true.',
    },
    {
      name: 'REPORT',
      kind: 'command',
      syntax: 'REPORT',
      description:
        'Prints the text message of the most recent error, typically used within an ON ERROR handler alongside ERR and ERL.',
    },
    {
      name: 'RESTORE',
      kind: 'command',
      syntax: 'RESTORE [<line>]',
      description:
        'Resets the DATA read pointer so the next READ starts again from the first DATA statement, or from the DATA on the given line if one is supplied.',
    },
    {
      name: 'RETURN',
      kind: 'command',
      syntax: 'RETURN',
      description: 'Returns from a GOSUB to the statement following the call.',
    },
    {
      name: 'RUN',
      kind: 'command',
      syntax: 'RUN',
      description:
        'Clears variables and runs the current program from its first line.',
    },
    {
      name: 'STOP',
      kind: 'command',
      syntax: 'STOP',
      description:
        'Halts the program and reports "STOP at line n", chiefly for debugging; unlike END it produces an error-style message.',
    },
    {
      name: 'COLOUR',
      kind: 'command',
      syntax: 'COLOUR <number>',
      description:
        'Sets the logical colour used for subsequently PRINTed text; adding 128 to the argument sets the text background instead. Use GCOL for graphics colours. The Master also supports COLOUR to redefine the palette.',
    },
    {
      name: 'TRACE',
      kind: 'command',
      syntax: 'TRACE ON | TRACE OFF | TRACE <line>',
      description:
        'Turns line-number tracing on or off for debugging, printing each line number in braces as it runs; TRACE n traces only lines below number n.',
    },
    {
      name: 'UNTIL',
      kind: 'command',
      syntax: 'UNTIL <number>',
      description:
        'Marks the end of a REPEAT loop; the loop repeats until the condition is true (non-zero).',
    },
    {
      name: 'WIDTH',
      kind: 'command',
      syntax: 'WIDTH <number>',
      description:
        'Sets the print line width so output wraps to a new line after that many characters; WIDTH 0 disables the automatic wrap.',
    },
    {
      name: 'OSCLI',
      kind: 'command',
      syntax: 'OSCLI <string>',
      description:
        'Passes a string to the operating-system command-line interpreter (the same as a * command), letting commands be built at run time from variables.',
    },
  ],
};
