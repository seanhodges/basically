// Reference table data for the Commodore BASIC page.
// Seeded from the dialect's keyword table by scripts/gen-reference-scaffold.mts,
// then hand-enriched (typed <…> syntax + fuller descriptions). Edit by hand;
// the generator skips this file once it exists.
//
// This one table covers all three Commodore machines: the C64 and VIC-20 run
// BASIC V2, and the PET runs BASIC 4.0 — the same V2 core plus the fifteen disk
// commands appended at the end and tagged 'BASIC 4.0'. The PET's keyword table
// (src/dialects/pet/keywords.ts) is the union checked by keyword-crosscheck.
import type { BasicReferenceTableData } from './types';
import { withAbbreviations } from './abbreviations';

const commodoreTable: BasicReferenceTableData = {
  title: 'Commodore 64, VIC-20 & PET BASIC',
  machines: ['Commodore 64', 'Commodore VIC-20', 'Commodore PET'],
  placeholders: [
    { id: 'drive', meaning: 'a drive number, written after a literal D' },
    { id: 'device', meaning: 'a device number: 1 for tape, 8 for disc' },
    { id: 'secondary', meaning: 'a secondary address' },
    { id: 'id', meaning: 'a two-character disk id, written after a literal I' },
  ],
  entries: [
    {
      name: 'END',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'END',
      description:
        'Stops the program cleanly and returns to the READY prompt without printing a BREAK message; execution can be resumed with CONT.',
    },
    {
      name: 'FOR',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'FOR <numvar> = <number> TO <number> [STEP <number>]',
      description:
        'Opens a counting loop that runs until NEXT, stepping the variable by 1 (or by STEP). The body always executes at least once because the limit is tested at NEXT.',
    },
    {
      name: 'NEXT',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'NEXT [<numvar>[, <numvar>]…]',
      description:
        'Closes the innermost FOR loop, or a named one. Several loop variables can be listed to close nested loops at once.',
    },
    {
      name: 'DATA',
      kind: 'command',
      domain: 'data',
      syntax: 'DATA <constant>[, <constant>]…',
      description:
        'Holds a list of inline numeric or string constants consumed in order by READ; the rest of the statement is stored verbatim, so unquoted text is allowed.',
    },
    {
      name: 'INPUT#',
      kind: 'command',
      domain: 'storage',
      syntax: 'INPUT#<file>, <var>[, <var>]…',
      description:
        'Reads comma- or newline-separated values from an open file or device into the listed variables. The file must first be opened with OPEN.',
    },
    {
      name: 'INPUT',
      kind: 'command',
      domain: 'input',
      syntax: 'INPUT [<prompt>;] <var>[, <var>]…',
      description:
        'Prints the optional prompt followed by a "? " and reads one or more comma-separated values from the keyboard. It halts the program, so games use GET instead.',
    },
    {
      name: 'DIM',
      kind: 'command',
      domain: 'data',
      syntax: 'DIM <var>(<number>[, <number>]…)',
      description:
        'Declares one or more arrays with the given maximum subscripts; indices run from 0, so DIM A(10) gives 11 elements. Undimensioned arrays default to a size of 10.',
    },
    {
      name: 'READ',
      kind: 'command',
      domain: 'data',
      syntax: 'READ <var>[, <var>]…',
      description:
        'Assigns the next unread DATA constants to the listed variables, advancing the read pointer. Running past the last DATA gives ?OUT OF DATA ERROR.',
    },
    {
      name: 'LET',
      kind: 'command',
      domain: 'data',
      syntax: 'LET <var> = <number> | <string>',
      description:
        'Assigns a value to a variable. The keyword is optional on the C64, so X=5 and LET X=5 are identical.',
    },
    {
      name: 'GOTO',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'GOTO <line>',
      description: 'Jumps unconditionally to the given line number.',
    },
    {
      name: 'RUN',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'RUN [<line>]',
      description:
        'Clears all variables and starts the program from the lowest line, or from the given line number if one is supplied.',
    },
    {
      name: 'IF',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'IF <number> THEN <line> | <statement>',
      description:
        'Evaluates the condition (zero is false, non-zero is true) and runs the THEN part only when true. There is no ELSE; THEN <line> is shorthand for THEN GOTO <line>.',
    },
    {
      name: 'RESTORE',
      kind: 'command',
      domain: 'data',
      syntax: 'RESTORE',
      description:
        'Resets the DATA read pointer back to the first DATA statement so READ can re-read the constants from the start.',
    },
    {
      name: 'GOSUB',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'GOSUB <line>',
      description:
        'Calls the subroutine at the given line, saving the return address so a later RETURN comes back to the following statement.',
    },
    {
      name: 'RETURN',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'RETURN',
      description:
        'Returns from a subroutine to the statement after the matching GOSUB; without a pending GOSUB it gives ?RETURN WITHOUT GOSUB ERROR.',
    },
    {
      name: 'REM',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'REM [<comment>]',
      description:
        'Marks a comment; the rest of the line is stored verbatim and ignored when the program runs.',
    },
    {
      name: 'STOP',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'STOP',
      description:
        'Halts the program and prints BREAK with the line number; execution can be resumed with CONT.',
    },
    {
      name: 'ON',
      kind: 'command',
      domain: 'control-flow',
      syntax:
        'ON <number> GOTO <line>[, <line>]… | ON <number> GOSUB <line>[, <line>]…',
      description:
        'Uses the rounded value as a 1-based index to pick which line to GOTO or GOSUB. If the index is 0 or larger than the list, execution falls through to the next statement.',
    },
    {
      name: 'WAIT',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'WAIT <addr>, <mask>[, <mask>]',
      description:
        'Pauses until a memory location, ANDed with the mask and optionally XORed, is non-zero. Misuse can hang the machine since BASIC stops polling anything else.',
    },
    {
      name: 'LOAD',
      kind: 'command',
      domain: 'storage',
      syntax: 'LOAD [<filename> [, <device> [, <number>]]]',
      description:
        'Loads a program from tape (device 1, the default) or disk (device 8), optionally with a secondary address. A secondary address of 1 loads to the original address.',
    },
    {
      name: 'SAVE',
      kind: 'command',
      domain: 'storage',
      syntax: 'SAVE [<filename> [, <device> [, <number>]]]',
      description:
        'Saves the current program to tape or the named device, optionally with a secondary address that selects, for example, an end-of-tape marker.',
    },
    {
      name: 'VERIFY',
      kind: 'command',
      domain: 'storage',
      syntax: 'VERIFY [<filename> [, <device>]]',
      description:
        'Compares a saved program against the one in memory and reports ?VERIFY ERROR if they differ.',
    },
    {
      name: 'DEF',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'DEF FN <name>(<numvar>) = <number>',
      description:
        'Defines a single-argument numeric user function, later called as FN name(x); the parameter is local to the formula.',
    },
    {
      name: 'POKE',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'POKE <addr>, <byte>',
      description:
        'Writes a byte (0–255) to a memory address (0–65535). The C64 has no graphics or sound keywords, so screen, colour, sprite and SID effects are all done by POKEing VIC-II and SID registers.',
    },
    {
      name: 'PRINT#',
      kind: 'command',
      domain: 'storage',
      syntax: 'PRINT#<file>[, <expr>[;|, <expr>]…]',
      description:
        'Writes data to an open file or device instead of the screen, using the same formatting rules as PRINT.',
    },
    {
      name: 'PRINT',
      kind: 'command',
      domain: 'text-screen',
      syntax: 'PRINT [<expr>][;|, <expr>]…',
      description:
        'Prints values to the screen; a trailing semicolon suppresses the newline and a comma tabs to the next 10-column field. Printed CHR$ codes also control colour and cursor movement.',
    },
    {
      name: 'CONT',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'CONT',
      description:
        'Resumes a program halted by STOP, END or the RUN/STOP key, provided the program was not edited in the meantime.',
    },
    {
      name: 'LIST',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'LIST [<line>][-[<line>]]',
      description:
        'Displays program lines, optionally restricted to a single line or a range; with no argument it lists the whole program.',
    },
    {
      name: 'CLR',
      kind: 'command',
      domain: 'data',
      syntax: 'CLR',
      description:
        'Clears all variables, arrays and strings and resets the FOR/GOSUB stacks, but leaves the program itself intact.',
    },
    {
      name: 'CMD',
      kind: 'command',
      domain: 'storage',
      syntax: 'CMD <file>[, <expr>]',
      description:
        'Redirects normal PRINT output to an open file or device (such as a printer) until a PRINT# or CLOSE restores the screen.',
    },
    {
      name: 'SYS',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'SYS <addr>',
      description:
        'Jumps to a machine-code routine at the given address, returning to BASIC on RTS; the A, X, Y and status registers are taken from page-zero locations.',
    },
    {
      name: 'OPEN',
      kind: 'command',
      domain: 'storage',
      syntax: 'OPEN <file>, <device> [, <secondary> [, <string>]]',
      description:
        'Opens a logical file, given its file number, device number, optional secondary address and optional name, for later use by PRINT#, INPUT#, GET# or CMD.',
    },
    {
      name: 'CLOSE',
      kind: 'command',
      domain: 'storage',
      syntax: 'CLOSE <file>',
      description:
        'Closes the logical file with the given number, flushing any buffered output to the device.',
    },
    {
      name: 'GET',
      kind: 'command',
      domain: 'input',
      syntax: 'GET <var>',
      description:
        'Reads a single keypress from the keyboard buffer without waiting, returning an empty string (or 0) if no key is pending. This is the standard way to read controls in games.',
    },
    {
      name: 'NEW',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'NEW',
      description:
        'Erases the current program and clears all variables, leaving BASIC empty.',
    },
    {
      name: 'TAB(',
      kind: 'function',
      domain: 'text-screen',
      syntax: 'TAB(<number>)',
      description:
        'Within PRINT, moves the cursor to the given absolute column counting from 0. It only moves forward, so it has no effect once the cursor is already past that column.',
    },
    {
      name: 'TO',
      kind: 'operator',
      domain: 'control-flow',
      syntax: 'TO',
      description:
        'Separates the start and limit values in a FOR loop (FOR I=1 TO 10) and follows GO in the spaced GO TO form.',
    },
    {
      name: 'FN',
      kind: 'function',
      domain: 'control-flow',
      syntax: 'FN <name>(<number>)',
      description:
        'Calls a user-defined function previously created with DEF FN, substituting the argument into its formula.',
    },
    {
      name: 'SPC(',
      kind: 'function',
      domain: 'text-screen',
      syntax: 'SPC(<number>)',
      description:
        'Within PRINT, outputs the given number of spaces relative to the current cursor position.',
    },
    {
      name: 'THEN',
      kind: 'operator',
      domain: 'control-flow',
      syntax: 'THEN <line> | <statement>',
      description:
        'Introduces the action of an IF; THEN followed by a line number is treated as a GOTO to that line.',
    },
    {
      name: 'NOT',
      kind: 'operator',
      domain: 'numeric',
      syntax: 'NOT <number>',
      description:
        'Bitwise NOT on a 16-bit signed integer, so NOT X equals -(X+1); used on truth values it logically negates them.',
    },
    {
      name: 'STEP',
      kind: 'operator',
      domain: 'control-flow',
      syntax: 'STEP <number>',
      description:
        'Sets the increment added to the loop variable each NEXT in a FOR loop; a negative step counts down.',
    },
    {
      name: '+',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> + <number> | <string> + <string>',
      description: 'Adds two numbers, or joins (concatenates) two strings.',
    },
    {
      name: '-',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> - <number> | -<number>',
      description:
        'Subtracts the right operand from the left, or negates a value when used as a unary prefix.',
    },
    {
      name: '*',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> * <number>',
      description: 'Multiplies two numbers.',
    },
    {
      name: '/',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> / <number>',
      description:
        'Divides the left operand by the right; dividing by zero gives ?DIVISION BY ZERO ERROR.',
    },
    {
      name: '↑',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> ↑ <number>',
      description:
        'Raises the left operand to the power of the right (the C64 up-arrow key); has higher precedence than multiply and divide.',
    },
    {
      name: 'AND',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> AND <number>',
      description:
        'Bitwise AND of two 16-bit integers, also used to combine truth values where false is 0 and true is -1.',
    },
    {
      name: 'OR',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> OR <number>',
      description:
        'Bitwise OR of two 16-bit integers, also used to combine truth values where false is 0 and true is -1.',
    },
    {
      name: '>',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> > <number> | <string> > <string>',
      description:
        'Greater-than comparison; returns -1 for true and 0 for false. Strings compare by PETSCII code.',
    },
    {
      name: '=',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<var> = <expr> | <expr> = <expr>',
      description:
        'Assigns a value in a statement, or tests equality in an expression (returning -1 for true and 0 for false).',
    },
    {
      name: '<',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> < <number> | <string> < <string>',
      description:
        'Less-than comparison; returns -1 for true and 0 for false. Strings compare by PETSCII code.',
    },
    {
      name: 'SGN',
      kind: 'function',
      domain: 'numeric',
      syntax: 'SGN(<number>)',
      description:
        'Returns the sign of the argument: -1 if negative, 0 if zero, 1 if positive.',
    },
    {
      name: 'INT',
      kind: 'function',
      domain: 'numeric',
      syntax: 'INT(<number>)',
      description:
        'Returns the largest integer not greater than the argument (rounds toward negative infinity), so INT(-1.5) is -2.',
    },
    {
      name: 'ABS',
      kind: 'function',
      domain: 'numeric',
      syntax: 'ABS(<number>)',
      description: 'Returns the absolute (unsigned) value of the argument.',
    },
    {
      name: 'USR',
      kind: 'function',
      domain: 'memory-hardware',
      syntax: 'USR(<addr>)',
      description:
        'Passes the argument in the floating-point accumulator to the machine-code routine whose address is stored in the USR vector ($0311) and returns its result.',
    },
    {
      name: 'FRE',
      kind: 'function',
      domain: 'memory-hardware',
      syntax: 'FRE(<number>)',
      description:
        'Returns the number of free BASIC bytes after forcing string garbage collection; the argument is ignored. Results above 32767 appear negative, so add 65536.',
    },
    {
      name: 'POS',
      kind: 'function',
      domain: 'text-screen',
      syntax: 'POS(<number>)',
      description:
        'Returns the current cursor column (0-based) on the logical screen line; the argument is ignored.',
    },
    {
      name: 'SQR',
      kind: 'function',
      domain: 'numeric',
      syntax: 'SQR(<number>)',
      description:
        'Returns the square root of the argument; a negative argument gives ?ILLEGAL QUANTITY ERROR.',
    },
    {
      name: 'RND',
      kind: 'function',
      domain: 'numeric',
      syntax: 'RND(<number>)',
      description:
        'Returns a random number from 0 to just under 1. A positive argument continues the sequence, 0 reseeds from the system timers, and a negative argument seeds a repeatable sequence.',
    },
    {
      name: 'LOG',
      kind: 'function',
      domain: 'numeric',
      syntax: 'LOG(<number>)',
      description:
        'Returns the natural (base-e) logarithm; the argument must be greater than 0.',
    },
    {
      name: 'EXP',
      kind: 'function',
      domain: 'numeric',
      syntax: 'EXP(<number>)',
      description: 'Returns e raised to the power of the argument.',
    },
    {
      name: 'COS',
      kind: 'function',
      domain: 'numeric',
      syntax: 'COS(<number>)',
      description:
        'Returns the cosine of the argument, which is given in radians.',
    },
    {
      name: 'SIN',
      kind: 'function',
      domain: 'numeric',
      syntax: 'SIN(<number>)',
      description:
        'Returns the sine of the argument, which is given in radians.',
    },
    {
      name: 'TAN',
      kind: 'function',
      domain: 'numeric',
      syntax: 'TAN(<number>)',
      description:
        'Returns the tangent of the argument, which is given in radians.',
    },
    {
      name: 'ATN',
      kind: 'function',
      domain: 'numeric',
      syntax: 'ATN(<number>)',
      description:
        'Returns the arctangent of the argument, in radians, between -π/2 and π/2.',
    },
    {
      name: 'PEEK',
      kind: 'function',
      domain: 'memory-hardware',
      syntax: 'PEEK(<addr>)',
      description:
        'Returns the byte (0–255) stored at the given memory address (0–65535); the counterpart to POKE for reading hardware and memory.',
    },
    {
      name: 'LEN',
      kind: 'function',
      domain: 'strings',
      syntax: 'LEN(<string>)',
      description: 'Returns the number of characters in the string (0–255).',
    },
    {
      name: 'STR$',
      kind: 'function',
      domain: 'strings',
      syntax: 'STR$(<number>)',
      description:
        'Returns the number formatted as a string, exactly as PRINT would show it, with a leading space for non-negative values.',
    },
    {
      name: 'VAL',
      kind: 'function',
      domain: 'strings',
      syntax: 'VAL(<string>)',
      description:
        'Parses the leading numeric part of the string and returns it as a number, returning 0 if it does not start with a number.',
    },
    {
      name: 'ASC',
      kind: 'function',
      domain: 'strings',
      syntax: 'ASC(<string>)',
      description:
        'Returns the PETSCII code of the first character of the string; an empty string gives ?ILLEGAL QUANTITY ERROR.',
    },
    {
      name: 'CHR$',
      kind: 'function',
      domain: 'strings',
      syntax: 'CHR$(<number>)',
      description:
        'Returns the one-character string for a PETSCII code (0–255). Many codes are control codes when printed, such as CHR$(147) to clear the screen.',
    },
    {
      name: 'LEFT$',
      kind: 'function',
      domain: 'strings',
      syntax: 'LEFT$(<string>, <length>)',
      description:
        'Returns the leftmost n characters of the string, or the whole string if n is at least its length.',
    },
    {
      name: 'RIGHT$',
      kind: 'function',
      domain: 'strings',
      syntax: 'RIGHT$(<string>, <length>)',
      description:
        'Returns the rightmost n characters of the string, or the whole string if n is at least its length.',
    },
    {
      name: 'MID$',
      kind: 'function',
      domain: 'strings',
      syntax: 'MID$(<string>, <start>[, <length>])',
      description:
        'Returns a substring starting at the 1-based position for the optional length (default: to the end of the string).',
    },
    {
      name: 'GO',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'GO TO <line>',
      description:
        'The spaced-out form of GOTO; GO TO and GOTO behave identically.',
    },
    {
      name: 'π',
      kind: 'function',
      domain: 'numeric',
      syntax: 'π',
      description:
        'The built-in constant pi (3.14159265), entered as the single π token.',
    },
    // The fifteen BASIC 4.0 disk commands ($CC–$DA) the PET adds to the V2 core
    // above; the C64 and VIC-20 run V2 without them.
    {
      name: 'CONCAT',
      kind: 'command',
      domain: 'storage',
      syntax: 'CONCAT <string> TO <string> [, D<drive>]',
      description:
        'Appends one sequential disk file onto the end of another, leaving the source unchanged.',
      tag: 'BASIC 4.0',
      onlyOn: ['pet'],
    },
    {
      name: 'DOPEN',
      kind: 'command',
      domain: 'storage',
      syntax: 'DOPEN#<file>, <string> [, D<drive>] [, W]',
      description:
        'Opens a disk file to a logical file number for reading, or for writing with W.',
      tag: 'BASIC 4.0',
      onlyOn: ['pet'],
    },
    {
      name: 'DCLOSE',
      kind: 'command',
      domain: 'storage',
      syntax: 'DCLOSE [#<file>]',
      description:
        'Closes a disk file opened with DOPEN, or all open files when no logical file number is given.',
      tag: 'BASIC 4.0',
      onlyOn: ['pet'],
    },
    {
      name: 'RECORD',
      kind: 'command',
      domain: 'storage',
      syntax: 'RECORD#<file>, <number> [, <number>]',
      description:
        'Positions to a record (and optional byte) within an open relative file.',
      tag: 'BASIC 4.0',
      onlyOn: ['pet'],
    },
    {
      name: 'HEADER',
      kind: 'command',
      domain: 'storage',
      syntax: 'HEADER <string>, D<drive>, I<id>',
      description:
        'Formats (news) a disk, writing a name and two-character id.',
      tag: 'BASIC 4.0',
      onlyOn: ['pet'],
    },
    {
      name: 'COLLECT',
      kind: 'command',
      domain: 'storage',
      syntax: 'COLLECT [D<drive>]',
      description:
        'Validates the disk, reclaiming space allocated to improperly closed files.',
      tag: 'BASIC 4.0',
      onlyOn: ['pet'],
    },
    {
      name: 'BACKUP',
      kind: 'command',
      domain: 'storage',
      syntax: 'BACKUP D<drive> TO D<drive>',
      description:
        'Duplicates an entire disk from one drive to another on a dual-drive unit.',
      tag: 'BASIC 4.0',
      onlyOn: ['pet'],
    },
    {
      name: 'COPY',
      kind: 'command',
      domain: 'storage',
      syntax: 'COPY <string> TO <string>',
      description:
        'Copies a single disk file to a new name (or another drive).',
      tag: 'BASIC 4.0',
      onlyOn: ['pet'],
    },
    {
      name: 'APPEND',
      kind: 'command',
      domain: 'storage',
      syntax: 'APPEND#<file>, <string> [, D<drive>]',
      description:
        'Opens an existing sequential file positioned at its end so PRINT# adds to it.',
      tag: 'BASIC 4.0',
      onlyOn: ['pet'],
    },
    {
      name: 'DSAVE',
      kind: 'command',
      domain: 'storage',
      syntax: 'DSAVE <string> [, D<drive>]',
      description:
        'Saves the BASIC program to disk by name — the disk equivalent of SAVE.',
      tag: 'BASIC 4.0',
      onlyOn: ['pet'],
    },
    {
      name: 'DLOAD',
      kind: 'command',
      domain: 'storage',
      syntax: 'DLOAD <string> [, D<drive>]',
      description:
        'Loads a BASIC program from disk by name — the disk equivalent of LOAD.',
      tag: 'BASIC 4.0',
      onlyOn: ['pet'],
    },
    {
      name: 'CATALOG',
      kind: 'command',
      domain: 'storage',
      syntax: 'CATALOG [D<drive>]',
      description:
        'Displays the disk directory without disturbing the program in memory (synonym of DIRECTORY).',
      tag: 'BASIC 4.0',
      onlyOn: ['pet'],
    },
    {
      name: 'RENAME',
      kind: 'command',
      domain: 'storage',
      syntax: 'RENAME <string> TO <string>',
      description: 'Renames a file on the disk.',
      tag: 'BASIC 4.0',
      onlyOn: ['pet'],
    },
    {
      name: 'SCRATCH',
      kind: 'command',
      domain: 'storage',
      syntax: 'SCRATCH <string> [, D<drive>]',
      description: 'Deletes (scratches) a file from the disk.',
      tag: 'BASIC 4.0',
      onlyOn: ['pet'],
    },
    {
      name: 'DIRECTORY',
      kind: 'command',
      domain: 'storage',
      syntax: 'DIRECTORY [D<drive>]',
      description:
        'Displays the disk directory without disturbing the program in memory.',
      tag: 'BASIC 4.0',
      onlyOn: ['pet'],
    },
    {
      name: '<=',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> <= <number> | <string> <= <string>',
      description: 'Less than or equal.',
    },
    {
      name: '>=',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> >= <number> | <string> >= <string>',
      description: 'Greater than or equal.',
    },
    {
      name: '<>',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> <> <number> | <string> <> <string>',
      description: 'Not equal.',
    },
  ],
};

/**
 * The page as it renders: each row carries the short spellings its keyword can
 * be typed as, derived from the machine's own resolution order rather than
 * authored above. See ./abbreviations.
 */
export const commodoreReference: BasicReferenceTableData = withAbbreviations(
  'commodore',
  commodoreTable,
);
