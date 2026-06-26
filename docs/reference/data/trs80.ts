// Reference table data for the TRS-80 Level II BASIC page.
// Seeded from the dialect's keyword table by scripts/gen-reference-scaffold.mts,
// then hand-enriched (typed <…> syntax + fuller descriptions). Edit by hand;
// the generator skips this file once it exists.
import type { ReferenceTableData } from './types';

export const trs80Reference: ReferenceTableData = {
  title: 'TRS-80 Level II BASIC',
  machines: ['TRS-80 Model I (Level II BASIC)'],
  entries: [
    {
      name: 'END',
      kind: 'command',
      syntax: 'END',
      description:
        'Stops the program cleanly and returns to READY without printing a BREAK message; unlike STOP, execution cannot be resumed with CONT.',
    },
    {
      name: 'FOR',
      kind: 'command',
      syntax: 'FOR <numvar> = <number> TO <number> [STEP <number>]',
      description:
        'Opens a counting loop that runs up to the matching NEXT; STEP sets the increment (default 1, may be negative or fractional). The body always runs at least once.',
    },
    {
      name: 'RESET',
      kind: 'command',
      syntax: 'RESET(<number>, <number>)',
      description:
        'Clears the block-graphics cell at (x, y) — x 0–127, y 0–47 on the 128×48 grid. SET lights it; POINT tests it.',
    },
    {
      name: 'SET',
      kind: 'command',
      syntax: 'SET(<number>, <number>)',
      description:
        'Lights the block-graphics cell at (x, y) — x 0–127, y 0–47 on the 128×48 grid (each 64×16 text cell is a 2×3 block). RESET clears it; POINT tests it.',
    },
    {
      name: 'CLS',
      kind: 'command',
      syntax: 'CLS',
      description:
        'Clears the whole 64×16 screen and homes the cursor to the top-left (cell 0).',
    },
    {
      name: 'CMD',
      kind: 'command',
      syntax: 'CMD<string>',
      description:
        'Passes a command to the disk operating system (Disk BASIC); e.g. CMD"S" exits to DOS. Has no effect without a DOS present.',
    },
    {
      name: 'RANDOM',
      kind: 'command',
      syntax: 'RANDOM',
      description:
        'Reseeds the random-number generator from a hardware timer so RND produces a different sequence each run.',
    },
    {
      name: 'NEXT',
      kind: 'command',
      syntax: 'NEXT [<numvar>[, <numvar>]…]',
      description:
        'Marks the end of a FOR loop, adding STEP and testing the limit. The variable is optional; listing several closes nested loops in one statement.',
    },
    {
      name: 'DATA',
      kind: 'command',
      syntax: 'DATA <constant>[, <constant>]…',
      description:
        'Stores a list of numeric or string constants in the program for READ to consume in order; the values are held verbatim to the end of the statement.',
    },
    {
      name: 'INPUT',
      kind: 'command',
      syntax: 'INPUT [<string>;] <var>[, <var>]…',
      description:
        'Prints a "?" prompt (with optional message) and halts until the user types values and presses ENTER. Multiple variables are filled from comma-separated input.',
    },
    {
      name: 'DIM',
      kind: 'command',
      syntax: 'DIM <var>(<int>[, <int>]…)[, …]',
      description:
        'Declares one or more arrays with the given upper bounds; subscripts start at 0, so DIM A(10) gives 11 elements. Undeclared arrays default to a bound of 10.',
    },
    {
      name: 'READ',
      kind: 'command',
      syntax: 'READ <var>[, <var>]…',
      description:
        'Assigns the next constant(s) from DATA statements to the given variables, advancing the data pointer; runs out with an Out of Data error.',
    },
    {
      name: 'LET',
      kind: 'command',
      syntax: '[LET] <var> = <number>|<string>',
      description:
        'Assigns a value to a variable. The keyword is optional in Level II, so X=5 and LET X=5 are equivalent.',
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
        'Clears all variables and starts the program, optionally from a given line number instead of the first.',
    },
    {
      name: 'IF',
      kind: 'command',
      syntax: 'IF <number> THEN <statement>|<line> [ELSE <statement>|<line>]',
      description:
        'Tests a condition (any non-zero value is true); runs the THEN branch when true and the optional ELSE branch when false. Level II supports ELSE, unlike Commodore BASIC.',
    },
    {
      name: 'RESTORE',
      kind: 'command',
      syntax: 'RESTORE',
      description:
        'Resets the DATA read pointer to the first DATA item so subsequent READs start again from the beginning.',
    },
    {
      name: 'GOSUB',
      kind: 'command',
      syntax: 'GOSUB <line>',
      description:
        'Calls the subroutine at the given line, saving the return address so a later RETURN resumes after the GOSUB.',
    },
    {
      name: 'RETURN',
      kind: 'command',
      syntax: 'RETURN',
      description:
        'Returns from a subroutine to the statement following the most recent GOSUB.',
    },
    {
      name: 'REM',
      kind: 'command',
      syntax: 'REM <text>',
      description:
        "Marks a comment; everything to the end of the line is ignored. The apostrophe ' is a shorthand for REM.",
    },
    {
      name: 'STOP',
      kind: 'command',
      syntax: 'STOP',
      description:
        'Halts the program and prints a "BREAK IN <line>" message; execution can be resumed with CONT.',
    },
    {
      name: 'ELSE',
      kind: 'command',
      syntax: 'ELSE <statement>|<line>',
      description:
        'Supplies the alternative branch of an IF…THEN, run when the condition is false.',
    },
    {
      name: 'TRON',
      kind: 'command',
      syntax: 'TRON',
      description:
        'Turns on the trace, printing each line number in brackets as it executes — useful for debugging flow.',
    },
    {
      name: 'TROFF',
      kind: 'command',
      syntax: 'TROFF',
      description: 'Turns off the line-number trace enabled by TRON.',
    },
    {
      name: 'DEFSTR',
      kind: 'command',
      syntax: 'DEFSTR <letter>[-<letter>]',
      description:
        'Makes variables whose names begin with the given letter(s) default to the string type, removing the need for a $ suffix.',
    },
    {
      name: 'DEFINT',
      kind: 'command',
      syntax: 'DEFINT <letter>[-<letter>]',
      description:
        'Makes variables whose names begin with the given letter(s) default to integer (%), which is faster and more compact than floating point.',
    },
    {
      name: 'DEFSNG',
      kind: 'command',
      syntax: 'DEFSNG <letter>[-<letter>]',
      description:
        'Makes variables whose names begin with the given letter(s) default to single precision (!) — the normal numeric type.',
    },
    {
      name: 'DEFDBL',
      kind: 'command',
      syntax: 'DEFDBL <letter>[-<letter>]',
      description:
        'Makes variables whose names begin with the given letter(s) default to double precision (#) for ~16-digit accuracy.',
    },
    {
      name: 'LINE',
      kind: 'command',
      syntax: 'LINE INPUT [<string>;] <strvar>',
      description:
        'Reads an entire input line into a string variable, including commas and leading spaces, without printing a "?" prompt.',
    },
    {
      name: 'EDIT',
      kind: 'command',
      syntax: 'EDIT <line>',
      description:
        'Enters the ROM line editor on the given program line for character-by-character editing.',
    },
    {
      name: 'ERROR',
      kind: 'command',
      syntax: 'ERROR <int>',
      description:
        'Forces the error with the given code, as if it had really occurred — handy for testing an ON ERROR routine.',
    },
    {
      name: 'RESUME',
      kind: 'command',
      syntax: 'RESUME [<line>|0|NEXT]',
      description:
        'Ends an error-handling routine and continues the program — at the line that erred (default or 0), the line after it (NEXT), or a specified line.',
    },
    {
      name: 'OUT',
      kind: 'command',
      syntax: 'OUT <int>, <int>',
      description:
        'Sends a byte (0–255) to the given Z80 I/O port (0–255) for direct hardware access.',
    },
    {
      name: 'ON',
      kind: 'command',
      syntax: 'ON <number> GOTO|GOSUB <line>[, <line>]…',
      description:
        'Branches to the n-th line in the list based on the value of the expression (1 selects the first); falls through if the value is 0 or past the end. ON ERROR GOTO sets an error handler.',
    },
    {
      name: 'OPEN',
      kind: 'command',
      syntax: 'OPEN <string>, <file>, <string>',
      description:
        'Opens a disk file under a buffer number for input, output, or random access (Disk BASIC); the mode is "I", "O", or "R".',
    },
    {
      name: 'FIELD',
      kind: 'command',
      syntax: 'FIELD <file>, <int> AS <strvar>[, <int> AS <strvar>]…',
      description:
        'Divides a random-access file buffer into named string fields of fixed width for GET/PUT (Disk BASIC).',
    },
    {
      name: 'GET',
      kind: 'command',
      syntax: 'GET <file>[, <int>]',
      description:
        'Reads a record from a random-access file into its buffer; an optional record number selects which (Disk BASIC).',
    },
    {
      name: 'PUT',
      kind: 'command',
      syntax: 'PUT <file>[, <int>]',
      description:
        'Writes the buffer of a random-access file out as a record; an optional record number selects which (Disk BASIC).',
    },
    {
      name: 'CLOSE',
      kind: 'command',
      syntax: 'CLOSE [<file>[, <file>]…]',
      description:
        'Closes the listed open files (or all of them if none is given), flushing any buffered data (Disk BASIC).',
    },
    {
      name: 'LOAD',
      kind: 'command',
      syntax: 'LOAD <string>',
      description:
        'Loads a BASIC program from disk, replacing the current program (Disk BASIC).',
    },
    {
      name: 'MERGE',
      kind: 'command',
      syntax: 'MERGE <string>',
      description:
        'Loads a program from disk and merges its lines into the program in memory, overwriting any with matching line numbers (Disk BASIC).',
    },
    {
      name: 'NAME',
      kind: 'command',
      syntax: 'NAME <string> AS <string>',
      description:
        'Renames a disk file from the first name to the second (Disk BASIC).',
    },
    {
      name: 'KILL',
      kind: 'command',
      syntax: 'KILL <string>',
      description: 'Deletes the named file from disk (Disk BASIC).',
    },
    {
      name: 'LSET',
      kind: 'command',
      syntax: 'LSET <strvar> = <string>',
      description:
        'Stores a string into a random-file field, left-justified and padded or truncated to the field width (Disk BASIC).',
    },
    {
      name: 'RSET',
      kind: 'command',
      syntax: 'RSET <strvar> = <string>',
      description:
        'Stores a string into a random-file field, right-justified and padded or truncated to the field width (Disk BASIC).',
    },
    {
      name: 'SAVE',
      kind: 'command',
      syntax: 'SAVE <string>',
      description:
        'Saves the current program to disk; add ,A to save as plain ASCII text (Disk BASIC).',
    },
    {
      name: 'SYSTEM',
      kind: 'command',
      syntax: 'SYSTEM',
      description:
        'Enters the SYSTEM monitor to load machine-code (object) programs from cassette by file name.',
    },
    {
      name: 'LPRINT',
      kind: 'command',
      syntax: 'LPRINT [<expr>][;|,]…',
      description:
        'Prints to the line printer; takes the same item list, "," print-zone spacing, and ";" joining as PRINT.',
    },
    {
      name: 'DEF',
      kind: 'command',
      syntax: 'DEF FN<name>(<var>) = <expr>',
      description:
        'Defines a single-line user function called as FNname(x); the parameter is local to the expression. Also forms DEFINT/DEFSNG/DEFDBL/DEFSTR and DEF USR.',
    },
    {
      name: 'POKE',
      kind: 'command',
      syntax: 'POKE <int>, <int>',
      description:
        'Writes a byte (0–255) to the given memory address (0–65535) for direct memory or hardware manipulation.',
    },
    {
      name: 'PRINT',
      kind: 'command',
      syntax: 'PRINT [@ <number>,] [<expr>][;|,]…',
      description:
        'Writes to the screen; "PRINT @ n," positions output at screen cell n (0–1023 on the 64×16 display). "," advances to the next print zone, ";" joins items. "?" is shorthand for PRINT.',
    },
    {
      name: 'CONT',
      kind: 'command',
      syntax: 'CONT',
      description:
        'Resumes a program halted by STOP or a BREAK key, continuing from where it stopped (provided the program was not edited).',
    },
    {
      name: 'LIST',
      kind: 'command',
      syntax: 'LIST [<line>][-[<line>]]',
      description:
        'Lists program lines to the screen — all of them, a single line, or a range; keywords are shown detokenized in their long form.',
    },
    {
      name: 'LLIST',
      kind: 'command',
      syntax: 'LLIST [<line>][-[<line>]]',
      description:
        'Lists program lines to the line printer, like LIST but on paper.',
    },
    {
      name: 'DELETE',
      kind: 'command',
      syntax: 'DELETE <line>[-<line>]',
      description:
        'Removes a line or an inclusive range of lines from the program.',
    },
    {
      name: 'AUTO',
      kind: 'command',
      syntax: 'AUTO [<int>][, <int>]',
      description:
        'Turns on automatic line numbering, generating numbers from a start value by an increment (both default to 10) as you type; BREAK stops it.',
    },
    {
      name: 'CLEAR',
      kind: 'command',
      syntax: 'CLEAR [<int>]',
      description:
        'Erases all variables and arrays; an optional argument sets how many bytes are reserved for string storage (default 50).',
    },
    {
      name: 'CLOAD',
      kind: 'command',
      syntax: 'CLOAD [<string>]',
      description:
        'Loads a BASIC program from cassette; an optional one-letter file name selects which program on the tape.',
    },
    {
      name: 'CSAVE',
      kind: 'command',
      syntax: 'CSAVE <string>',
      description:
        'Saves the current program to cassette under a one-letter file name.',
    },
    {
      name: 'NEW',
      kind: 'command',
      syntax: 'NEW',
      description:
        'Erases the program in memory and clears all variables, leaving a blank workspace.',
    },
    {
      name: 'TAB(',
      kind: 'function',
      syntax: 'TAB(<number>)',
      description:
        'Used inside PRINT to advance to absolute print column n (0-based); it never moves the cursor backwards on the current line.',
    },
    {
      name: 'TO',
      kind: 'operator',
      syntax: 'TO',
      description:
        'Separates the start and limit values in FOR…TO (and the byte range in some commands); not used on its own.',
    },
    {
      name: 'FN',
      kind: 'function',
      syntax: 'FN<name>(<number>)',
      description:
        'Calls a single-line user function previously created with DEF FN, substituting the argument for the parameter.',
    },
    {
      name: 'USING',
      kind: 'operator',
      syntax: 'PRINT USING <string>; <expr>[, <expr>]…',
      description:
        'Formats output against a template string using markers such as # for digit positions, "." for the decimal point, and "$" for currency.',
    },
    {
      name: 'VARPTR',
      kind: 'function',
      syntax: 'VARPTR(<var>)',
      description:
        "Returns the memory address of a variable's value, used to reach its bytes via PEEK/POKE or to pass data to machine code.",
    },
    {
      name: 'USR',
      kind: 'function',
      syntax: 'USR(<number>)',
      description:
        'Calls a user machine-code routine at the address set up by POKE/DEF USR, passing the argument and returning its result.',
    },
    {
      name: 'ERL',
      kind: 'function',
      syntax: 'ERL',
      description:
        'Returns the line number where the most recent error occurred, for use inside an ON ERROR handler.',
    },
    {
      name: 'ERR',
      kind: 'function',
      syntax: 'ERR',
      description:
        'Returns a value related to the most recent error code (ERR/2+1 gives the error number), for use inside an ON ERROR handler.',
    },
    {
      name: 'STRING$',
      kind: 'function',
      syntax: 'STRING$(<number>, <number>|<string>)',
      description:
        'Builds a string of n copies of a character, given either as an ASCII code or as the first character of a string — handy for drawing bars and rules.',
    },
    {
      name: 'INSTR',
      kind: 'function',
      syntax: 'INSTR([<number>,] <string>, <string>)',
      description:
        'Returns the position of the first occurrence of the second string within the first (starting at an optional offset), or 0 if not found.',
    },
    {
      name: 'POINT',
      kind: 'function',
      syntax: 'POINT(<number>, <number>)',
      description:
        'Returns true (-1) if the block-graphics cell at (x, y) is lit, false (0) otherwise — used for reading the screen back, e.g. collision detection.',
    },
    {
      name: 'TIME$',
      kind: 'function',
      syntax: 'TIME$',
      description:
        'Returns the current date and time as a string ("MM/DD/YY HH:MM:SS") maintained by the system clock (Disk BASIC).',
    },
    {
      name: 'MEM',
      kind: 'function',
      syntax: 'MEM',
      description:
        'Returns the number of free bytes of program/variable memory remaining.',
    },
    {
      name: 'INKEY$',
      kind: 'function',
      syntax: 'INKEY$',
      description:
        'Returns the character of a key pressed at that instant, or an empty string if none is down. It never waits, making it the input of choice for games.',
    },
    {
      name: 'THEN',
      kind: 'operator',
      syntax: 'THEN',
      description:
        'Introduces the consequent of an IF; a line number after THEN acts as a GOTO.',
    },
    {
      name: 'NOT',
      kind: 'operator',
      syntax: 'NOT <number>',
      description:
        'Bitwise/logical NOT on a 16-bit integer; note NOT 0 is -1 (true) and NOT -1 is 0 (false).',
    },
    {
      name: 'STEP',
      kind: 'operator',
      syntax: 'STEP <number>',
      description:
        'Sets the increment added to the FOR variable at each NEXT; may be negative to count down or fractional.',
    },
    {
      name: '+',
      kind: 'operator',
      syntax: '<number> + <number> | <string> + <string>',
      description:
        'Adds two numbers, or concatenates (joins) two strings end to end.',
    },
    {
      name: '-',
      kind: 'operator',
      syntax: '<number> - <number>',
      description:
        'Subtracts the second number from the first, or negates a value.',
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
        'Divides the first number by the second, giving a floating-point result.',
    },
    {
      name: '↑',
      kind: 'operator',
      syntax: '<number> ↑ <number>',
      description:
        'Raises the first number to the power of the second; entered with the up-arrow key on the TRS-80 keyboard.',
    },
    {
      name: 'AND',
      kind: 'operator',
      syntax: '<number> AND <number>',
      description:
        'Bitwise/logical AND on 16-bit integers; in conditions both operands must be true (non-zero) for the result to be true.',
    },
    {
      name: 'OR',
      kind: 'operator',
      syntax: '<number> OR <number>',
      description:
        'Bitwise/logical OR on 16-bit integers; in conditions the result is true if either operand is true (non-zero).',
    },
    {
      name: '>',
      kind: 'operator',
      syntax: '<number> > <number>',
      description:
        'Greater-than comparison, returning -1 for true and 0 for false; also compares strings by character code.',
    },
    {
      name: '=',
      kind: 'operator',
      syntax: '<var> = <expr> | <expr> = <expr>',
      description:
        'Assigns a value to a variable, or in a comparison tests for equality (returning -1 for true, 0 for false).',
    },
    {
      name: '<',
      kind: 'operator',
      syntax: '<number> < <number>',
      description:
        'Less-than comparison, returning -1 for true and 0 for false; also compares strings by character code.',
    },
    {
      name: 'SGN',
      kind: 'function',
      syntax: 'SGN(<number>)',
      description:
        'Returns the sign of a number: -1 if negative, 0 if zero, 1 if positive.',
    },
    {
      name: 'INT',
      kind: 'function',
      syntax: 'INT(<number>)',
      description:
        'Returns the largest integer not greater than x (rounds toward minus infinity, so INT(-1.5) is -2).',
    },
    {
      name: 'ABS',
      kind: 'function',
      syntax: 'ABS(<number>)',
      description: 'Returns the absolute (unsigned) value of a number.',
    },
    {
      name: 'FRE',
      kind: 'function',
      syntax: 'FRE(<number>|<string>)',
      description:
        'Returns free memory: with a numeric argument the free bytes, with a string argument the free string space (also forces string garbage collection).',
    },
    {
      name: 'INP',
      kind: 'function',
      syntax: 'INP(<int>)',
      description:
        'Reads and returns a byte (0–255) from the given Z80 I/O port (0–255).',
    },
    {
      name: 'POS',
      kind: 'function',
      syntax: 'POS(<number>)',
      description:
        'Returns the current cursor column (0–63) on the screen; the argument is a required dummy value.',
    },
    {
      name: 'SQR',
      kind: 'function',
      syntax: 'SQR(<number>)',
      description: 'Returns the square root of a non-negative number.',
    },
    {
      name: 'RND',
      kind: 'function',
      syntax: 'RND(<number>)',
      description:
        'RND(0) returns a fraction 0 ≤ r < 1; RND(n) with n ≥ 1 returns a whole number from 1 to n. Use RANDOM to reseed.',
    },
    {
      name: 'LOG',
      kind: 'function',
      syntax: 'LOG(<number>)',
      description:
        'Returns the natural (base-e) logarithm of a positive number.',
    },
    {
      name: 'EXP',
      kind: 'function',
      syntax: 'EXP(<number>)',
      description: 'Returns e raised to the power of x, the inverse of LOG.',
    },
    {
      name: 'COS',
      kind: 'function',
      syntax: 'COS(<number>)',
      description: 'Returns the cosine of an angle given in radians.',
    },
    {
      name: 'SIN',
      kind: 'function',
      syntax: 'SIN(<number>)',
      description: 'Returns the sine of an angle given in radians.',
    },
    {
      name: 'TAN',
      kind: 'function',
      syntax: 'TAN(<number>)',
      description: 'Returns the tangent of an angle given in radians.',
    },
    {
      name: 'ATN',
      kind: 'function',
      syntax: 'ATN(<number>)',
      description: 'Returns the arctangent of x, as an angle in radians.',
    },
    {
      name: 'PEEK',
      kind: 'function',
      syntax: 'PEEK(<int>)',
      description:
        'Returns the byte (0–255) stored at the given memory address (0–65535).',
    },
    {
      name: 'CVI',
      kind: 'function',
      syntax: 'CVI(<string>)',
      description:
        'Converts a 2-byte string (as stored by MKI$) back into an integer, for reading random-file fields (Disk BASIC).',
    },
    {
      name: 'CVS',
      kind: 'function',
      syntax: 'CVS(<string>)',
      description:
        'Converts a 4-byte string (as stored by MKS$) back into a single-precision number, for reading random-file fields (Disk BASIC).',
    },
    {
      name: 'CVD',
      kind: 'function',
      syntax: 'CVD(<string>)',
      description:
        'Converts an 8-byte string (as stored by MKD$) back into a double-precision number, for reading random-file fields (Disk BASIC).',
    },
    {
      name: 'EOF',
      kind: 'function',
      syntax: 'EOF(<file>)',
      description:
        'Returns true (-1) when the end of the given file has been reached, so a read loop can stop (Disk BASIC).',
    },
    {
      name: 'LOC',
      kind: 'function',
      syntax: 'LOC(<file>)',
      description:
        'Returns the current record number last read or written on the given file (Disk BASIC).',
    },
    {
      name: 'LOF',
      kind: 'function',
      syntax: 'LOF(<file>)',
      description:
        'Returns the number of the last (highest) record in the given file — its length in records (Disk BASIC).',
    },
    {
      name: 'MKI$',
      kind: 'function',
      syntax: 'MKI$(<number>)',
      description:
        'Packs an integer into a 2-byte string for storage in a random-file field; CVI reverses it (Disk BASIC).',
    },
    {
      name: 'MKS$',
      kind: 'function',
      syntax: 'MKS$(<number>)',
      description:
        'Packs a single-precision number into a 4-byte string for storage in a random-file field; CVS reverses it (Disk BASIC).',
    },
    {
      name: 'MKD$',
      kind: 'function',
      syntax: 'MKD$(<number>)',
      description:
        'Packs a double-precision number into an 8-byte string for storage in a random-file field; CVD reverses it (Disk BASIC).',
    },
    {
      name: 'CINT',
      kind: 'function',
      syntax: 'CINT(<number>)',
      description:
        'Rounds a number to the nearest integer and returns it as the integer type; errors if outside the range -32768 to 32767.',
    },
    {
      name: 'CSNG',
      kind: 'function',
      syntax: 'CSNG(<number>)',
      description:
        'Converts a number to single precision (about 6 significant digits).',
    },
    {
      name: 'CDBL',
      kind: 'function',
      syntax: 'CDBL(<number>)',
      description:
        'Converts a number to double precision (about 16 significant digits) for higher-accuracy arithmetic.',
    },
    {
      name: 'FIX',
      kind: 'function',
      syntax: 'FIX(<number>)',
      description:
        'Truncates a number toward zero, dropping the fractional part (FIX(-1.5) is -1, unlike INT).',
    },
    {
      name: 'LEN',
      kind: 'function',
      syntax: 'LEN(<string>)',
      description:
        'Returns the number of characters in a string (0 for an empty string).',
    },
    {
      name: 'STR$',
      kind: 'function',
      syntax: 'STR$(<number>)',
      description:
        'Returns the string form of a number, as PRINT would show it (with a leading space for non-negative values); VAL reverses it.',
    },
    {
      name: 'VAL',
      kind: 'function',
      syntax: 'VAL(<string>)',
      description:
        'Reads a number from the start of a string, returning 0 if it does not begin with a numeric value.',
    },
    {
      name: 'ASC',
      kind: 'function',
      syntax: 'ASC(<string>)',
      description:
        'Returns the ASCII code of the first character of a string; errors on an empty string. CHR$ reverses it.',
    },
    {
      name: 'CHR$',
      kind: 'function',
      syntax: 'CHR$(<number>)',
      description:
        'Returns the one-character string for an ASCII or control code (0–255); codes 128–191 select block-graphics characters.',
    },
    {
      name: 'LEFT$',
      kind: 'function',
      syntax: 'LEFT$(<string>, <number>)',
      description: 'Returns the leftmost n characters of a string.',
    },
    {
      name: 'RIGHT$',
      kind: 'function',
      syntax: 'RIGHT$(<string>, <number>)',
      description: 'Returns the rightmost n characters of a string.',
    },
    {
      name: 'MID$',
      kind: 'function',
      syntax: 'MID$(<string>, <number>[, <number>])',
      description:
        'Returns a substring starting at position i (1-based) for n characters; without n it returns the rest of the string.',
    },
  ],
};
