// Reference table data for the BASIC-G page.
// Seeded from the dialect's keyword table by scripts/gen-reference-scaffold.mts,
// then hand-enriched (typed <…> syntax + fuller descriptions). Edit by hand;
// the generator skips this file once it exists.
//
// Every row is a word in src/dialects/pmd85/keywords.ts, which was read out of
// the BASIC-G V2.0 interpreter's own reserved-word table; keyword-crosscheck.
// test.ts holds the two in exact agreement in both directions.
//
// The first seventy-odd rows are Microsoft 8K BASIC's vocabulary, because that
// is what BASIC-G is built on. What is not Microsoft, and what a reader arriving
// from another machine here will trip over:
//
//  - the user-function keyword is FNC, not FN;
//  - `?` is not PRINT - it stores the token whose spelling is `_`, which prints
//    into the dialogue line and then waits for a key;
//  - the tape commands take a NUMBER, not a filename: `SAVE "A"` answers
//    "Type conv." and `SAVE 1` is what the machine means (checked by running it);
//  - the graphics set - PLOT, MOVE, FILL, LABEL, BPLOT - has no equivalent in
//    any Microsoft BASIC of this vintage, and is the "G".
import type { BasicReferenceTableData } from './types';
import { withAbbreviations } from './abbreviations';

const pmd85Table: BasicReferenceTableData = {
  title: 'BASIC-G',
  machines: ['Tesla PMD 85-2'],
  placeholders: [
    { id: 'bit', meaning: 'a bit position, counting from 0' },
    { id: 'penmode', meaning: 'a drawing colour and mode, as PEN sets it' },
    {
      id: 'tapefile',
      meaning: 'a tape file, by the number it is recorded under',
    },
    {
      id: 'channelno',
      meaning: 'an input/output channel on the expansion board, by number',
    },
  ],
  entries: [
    {
      name: 'END',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'END',
      description:
        'Stops the program and returns to the OK prompt without a message; unlike STOP, the run cannot then be resumed with CONT.',
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
        'Inline constants for READ to consume in program order. The rest of the statement is stored exactly as typed, spaces included.',
    },
    {
      name: 'INPUT',
      kind: 'command',
      domain: 'input',
      syntax: 'INPUT [<prompt>;] <var>[, <var>]…',
      description:
        'Prints the prompt (or ? when there is none) into the dialogue line and waits for a whole typed line. For a key at a time, use INKEY or the K0-K11 function keys.',
    },
    {
      name: 'DIM',
      kind: 'command',
      domain: 'data',
      syntax: 'DIM <var>(<number>[, <number>]…)',
      description:
        'Declares an array and its bounds. Subscripts start at 0, so DIM A(10) gives eleven elements; an array used without DIM is created with bounds of 10.',
    },
    {
      name: 'READ',
      kind: 'command',
      domain: 'data',
      syntax: 'READ <var>[, <var>]…',
      description:
        'Takes the next constants from the DATA statements, in program order, and assigns them. Running past the last one stops with an out-of-data error.',
    },
    {
      name: 'LET',
      kind: 'command',
      domain: 'data',
      syntax: 'LET <var> = <expr>',
      description:
        'Assigns a value. The keyword is optional - A=1 and LET A=1 are the same statement and store the same bytes.',
    },
    {
      name: 'GOTO',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'GOTO <line>',
      description:
        'Jumps to a line number. BASIC-G reads it across a space as well, so GO TO 100 is the same statement.',
    },
    {
      name: 'RUN',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'RUN [<line>]',
      description:
        'Clears the variables and starts the program, from the given line if there is one. This is how the IDE starts a program: it types RUN at the emulated keyboard.',
    },
    {
      name: 'IF',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'IF <number> THEN <line> | <statement>',
      description:
        'Runs the rest of the line, or jumps to a line number, when the condition is non-zero. There is no ELSE: invert the test and jump, or write a second IF.',
    },
    {
      name: 'RESTORE',
      kind: 'command',
      domain: 'data',
      syntax: 'RESTORE',
      description:
        'Puts the READ pointer back at the first DATA constant in the program, so the same list can be read again.',
    },
    {
      name: 'GOSUB',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'GOSUB <line>',
      description:
        'Calls a subroutine, remembering where to come back to. RETURN comes back to the statement after this one.',
    },
    {
      name: 'RETURN',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'RETURN',
      description:
        'Returns from the innermost GOSUB. Reaching one without a matching GOSUB stops with an error.',
    },
    {
      name: 'REM',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'REM <comment>',
      description:
        'A comment. The rest of the line is stored verbatim and never executed, so a GOTO into it simply falls through to the next line.',
    },
    {
      name: 'STOP',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'STOP',
      description:
        'Halts the program with a message naming the line, leaving the variables intact so CONT can resume from the next statement.',
    },
    {
      name: 'BIT',
      kind: 'function',
      domain: 'numeric',
      syntax: 'BIT(<number>, <bit>)',
      description:
        'One bit of a value, as 0 or 1, counting from bit 0. BASIC-G has this where Microsoft 8K BASIC has an unused table slot.',
    },
    {
      name: 'ON',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'ON <number> GOTO | GOSUB <line>[, <line>]…',
      description:
        'Jumps or calls the nth line in the list, counting from 1. A value of 0, or one past the end of the list, falls through to the next statement.',
    },
    {
      name: 'NULL',
      kind: 'command',
      domain: 'text-screen',
      syntax: 'NULL <number>',
      description:
        'How many null characters to send after each line ending - padding for a printer whose carriage needs the time.',
    },
    {
      name: 'WAIT',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'WAIT <port>[, <mask>], <number>',
      description:
        'Spins reading an input port until its masked value matches. Not a delay: with nothing on the port to change it, the program stops there for good.',
    },
    {
      name: 'DEF',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'DEF FNC <name>(<param>) = <expr>',
      description:
        'Defines a one-line function. The keyword is FNC rather than the FN every other Microsoft BASIC uses, and the definition must run before the first call.',
    },
    {
      name: 'POKE',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'POKE <addr>, <byte>[, <byte>]…',
      description:
        'Writes bytes to consecutive addresses. The interpreter itself lives in RAM from 0, so a wrong address here can take BASIC-G down with it.',
    },
    {
      name: 'PRINT',
      kind: 'command',
      domain: 'text-screen',
      syntax: 'PRINT [<expr>][;|,]…',
      description:
        'Prints to the text screen. A trailing ; stays on the line and , moves to the next print zone; AT and INK( inside the list move the cursor and set the attribute.',
    },
    {
      name: 'ERR',
      kind: 'operator',
      domain: 'error-handling',
      syntax: 'ON ERR GOTO <line>',
      description:
        'Traps errors: after this, an error jumps to the given line instead of stopping the program. BASIC-G has this where Microsoft 8K BASIC has CONT.',
    },
    {
      name: 'LIST',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'LIST [<line>]',
      description:
        'Lists the program, or one line of it, to the screen. Tokens come back as their full spellings, so a `?` typed in lists back as `_`.',
    },
    {
      name: 'CLEAR',
      kind: 'command',
      domain: 'data',
      syntax: 'CLEAR',
      description:
        'Erases the variables and arrays and closes any open FOR and GOSUB, leaving the program itself alone.',
    },
    {
      name: 'LLIST',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'LLIST [<line>]',
      description:
        'Lists a line into the dialogue line ready for editing, rather than to a printer as the same spelling does on a Microsoft machine.',
    },
    {
      name: 'RAD',
      kind: 'command',
      domain: 'numeric',
      syntax: 'RAD',
      description:
        'Takes the angle arguments of SIN, COS, TAN and ATN in radians. This is the state a cold start begins in; DEG switches to degrees.',
    },
    {
      name: 'NEW',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'NEW',
      description: 'Erases the program and all its variables.',
    },
    {
      name: 'TAB(',
      kind: 'function',
      domain: 'text-screen',
      syntax: 'TAB(<col>)',
      description:
        'Inside a PRINT list, moves the print position to an absolute column. Going backwards has no effect - the position only ever moves right.',
    },
    {
      name: 'TO',
      kind: 'operator',
      domain: 'control-flow',
      syntax: 'FOR <numvar> = <number> TO <number>',
      description: 'The limit of a FOR loop, and only ever part of one.',
    },
    {
      name: 'FNC',
      kind: 'function',
      domain: 'control-flow',
      syntax: 'FNC <name>(<arg>)',
      description:
        'Calls a function defined by DEF. The name is separate from the keyword, so a call reads FNC A(X) rather than the FNA of other Microsoft BASICs.',
    },
    {
      name: 'SPC(',
      kind: 'function',
      domain: 'text-screen',
      syntax: 'SPC(<number>)',
      description:
        'Inside a PRINT list, prints that many spaces - a relative move, where TAB( is an absolute one.',
    },
    {
      name: 'THEN',
      kind: 'operator',
      domain: 'control-flow',
      syntax: 'IF <number> THEN <line> | <statement>',
      description:
        'Introduces what an IF does when its condition holds, and only ever part of one.',
    },
    {
      name: 'NOT',
      kind: 'operator',
      domain: 'numeric',
      syntax: 'NOT <number>',
      description:
        "Bitwise complement of a 16-bit two's complement value, so NOT 0 is -1 and NOT -1 is 0.",
    },
    {
      name: 'STEP',
      kind: 'operator',
      domain: 'control-flow',
      syntax: 'FOR <numvar> = <number> TO <number> STEP <number>',
      description:
        'The increment of a FOR loop. It may be negative or fractional, and is 1 when the loop does not say.',
    },
    {
      name: '+',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<expr> + <expr>',
      description: 'Adds two numbers, or joins two strings end to end.',
    },
    {
      name: '-',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> - <number>',
      description: 'Subtracts, or negates a single operand.',
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
      description:
        'Divides, in floating point: 7/2 is 3.5, and there is no integer division operator.',
    },
    {
      name: '^',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> ^ <number>',
      description:
        'Raises to a power. It folds left, as every Microsoft BASIC does: 2^3^2 is 64, not 512.',
    },
    {
      name: 'AND',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> AND <number>',
      description:
        "Bitwise AND of two 16-bit two's complement values, which is also how conditions are combined: a true comparison is -1, all bits set.",
    },
    {
      name: 'OR',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> OR <number>',
      description: 'Bitwise OR, on the same terms as AND.',
    },
    {
      name: '>',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<expr> > <expr>',
      description:
        'Greater than, giving -1 for true and 0 for false. Strings compare by character code, left to right.',
    },
    {
      name: '=',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<expr> = <expr>',
      description:
        'Equality inside an expression, and assignment at the head of a statement - one token doing both jobs.',
    },
    {
      name: '<',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<expr> < <expr>',
      description:
        'Less than. Combined with = and > it spells <=, >= and <>, which BASIC-G stores as two tokens rather than one.',
    },
    {
      name: '<=',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> <= <number> | <string> <= <string>',
      description:
        'Less than or equal. BASIC-G stores it as the two operator tokens side by side rather than as one of its own, so =< is the same comparison.',
    },
    {
      name: '>=',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> >= <number> | <string> >= <string>',
      description: 'Greater than or equal, stored as two tokens like <=.',
    },
    {
      name: '<>',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<expr> <> <expr>',
      description: 'Not equal, stored as two tokens like <=.',
    },
    {
      name: 'SGN',
      kind: 'function',
      domain: 'numeric',
      syntax: 'SGN(<number>)',
      description: 'The sign of a number: -1, 0 or 1.',
    },
    {
      name: 'INT',
      kind: 'function',
      domain: 'numeric',
      syntax: 'INT(<number>)',
      description:
        'The largest whole number not greater than the argument, so INT(-2.5) is -3 rather than -2.',
    },
    {
      name: 'ABS',
      kind: 'function',
      domain: 'numeric',
      syntax: 'ABS(<number>)',
      description: 'The absolute value: the argument with any sign removed.',
    },
    {
      name: 'USR',
      kind: 'function',
      domain: 'memory-hardware',
      syntax: 'USR(<addr>)',
      description:
        'Calls machine code at an address and returns what it leaves behind. The routine must end in RET, and runs as 8080 code.',
    },
    {
      name: 'FRE',
      kind: 'function',
      domain: 'memory-hardware',
      syntax: 'FRE(<number>)',
      description:
        'Bytes left between the end of the arrays and the stack. The argument is ignored; string space is a separate region and is not counted here.',
    },
    {
      name: 'INP',
      kind: 'function',
      domain: 'memory-hardware',
      syntax: 'INP(<port>)',
      description: 'Reads a byte from an input port.',
    },
    {
      name: 'POS',
      kind: 'function',
      domain: 'text-screen',
      syntax: 'POS(<number>)',
      description:
        'The column the print position is in. The argument is ignored.',
    },
    {
      name: 'SQR',
      kind: 'function',
      domain: 'numeric',
      syntax: 'SQR(<number>)',
      description: 'The square root. A negative argument stops with an error.',
    },
    {
      name: 'RND',
      kind: 'function',
      domain: 'numeric',
      syntax: 'RND(<number>)',
      description:
        'A pseudo-random number below 1. A positive argument gives the next in the sequence, 0 repeats the last one, and a negative argument reseeds.',
    },
    {
      name: 'LOG',
      kind: 'function',
      domain: 'numeric',
      syntax: 'LOG(<number>)',
      description:
        'The natural logarithm - there is no LN, and no base-10 log: divide by LOG(10).',
    },
    {
      name: 'EXP',
      kind: 'function',
      domain: 'numeric',
      syntax: 'EXP(<number>)',
      description: 'e raised to the given power, the inverse of LOG.',
    },
    {
      name: 'COS',
      kind: 'function',
      domain: 'numeric',
      syntax: 'COS(<number>)',
      description:
        'The cosine. The angle is in radians unless DEG has been used.',
    },
    {
      name: 'SIN',
      kind: 'function',
      domain: 'numeric',
      syntax: 'SIN(<number>)',
      description: 'The sine, on the same terms as COS.',
    },
    {
      name: 'TAN',
      kind: 'function',
      domain: 'numeric',
      syntax: 'TAN(<number>)',
      description: 'The tangent, on the same terms as COS.',
    },
    {
      name: 'ATN',
      kind: 'function',
      domain: 'numeric',
      syntax: 'ATN(<number>)',
      description:
        'The arctangent, giving an angle in the current unit between -pi/2 and pi/2.',
    },
    {
      name: 'PEEK',
      kind: 'function',
      domain: 'memory-hardware',
      syntax: 'PEEK(<addr>)',
      description:
        'Reads one byte of memory. Video RAM starts at C000h and the Monitor ROM at 8000h.',
    },
    {
      name: 'LEN',
      kind: 'function',
      domain: 'strings',
      syntax: 'LEN(<string>)',
      description: 'How many characters a string holds.',
    },
    {
      name: 'STR$',
      kind: 'function',
      domain: 'strings',
      syntax: 'STR$(<number>)',
      description:
        'A number formatted as BASIC-G would print it, leading space and all.',
    },
    {
      name: 'VAL',
      kind: 'function',
      domain: 'strings',
      syntax: 'VAL(<string>)',
      description:
        'The number a string begins with, or 0 when it does not begin with one.',
    },
    {
      name: 'ASC',
      kind: 'function',
      domain: 'strings',
      syntax: 'ASC(<string>)',
      description:
        'The character code of the first character. An empty string stops with an error.',
    },
    {
      name: 'CHR$',
      kind: 'function',
      domain: 'strings',
      syntax: 'CHR$(<byte>)',
      description:
        'A one-character string of the given code. 7Fh is the solid cell, the one glyph outside ASCII the character generator holds.',
    },
    {
      name: 'LEFT$',
      kind: 'function',
      domain: 'strings',
      syntax: 'LEFT$(<string>, <length>)',
      description: 'The leftmost characters of a string.',
    },
    {
      name: 'RIGHT$',
      kind: 'function',
      domain: 'strings',
      syntax: 'RIGHT$(<string>, <length>)',
      description: 'The rightmost characters of a string.',
    },
    {
      name: 'MID$',
      kind: 'function',
      domain: 'strings',
      syntax: 'MID$(<string>, <start>[, <length>])',
      description:
        'A substring from the given position, counting from 1; without a length, everything to the end. It cannot be assigned to.',
    },
    {
      name: 'SCALE',
      kind: 'command',
      domain: 'graphics',
      syntax: 'SCALE <x>, <x>, <y>, <y>',
      description:
        'Sets the coordinate window the drawing statements work in, as left, right, bottom and top. Everything plotted afterwards is mapped from it onto the 288x256 screen.',
    },
    {
      name: 'PLOT',
      kind: 'command',
      domain: 'graphics',
      syntax: 'PLOT <x>, <y>[, <penmode>][; <x>, <y>]…',
      description:
        'Draws a line from the last point to this one, then leaves the point there. Several coordinate pairs may follow on one statement, which is how a polyline is drawn.',
    },
    {
      name: 'MOVE',
      kind: 'command',
      domain: 'graphics',
      syntax: 'MOVE <x>, <y>',
      description:
        'Moves the drawing point without drawing anything - where a line should start rather than continue.',
    },
    {
      name: 'BEEP',
      kind: 'command',
      domain: 'sound',
      syntax: 'BEEP',
      description:
        'A short tone on the motherboard speaker. It is the whole sound repertoire: there is no pitch or duration to give.',
    },
    {
      name: 'AXES',
      kind: 'command',
      domain: 'graphics',
      syntax: 'AXES <x>, <y>',
      description:
        'Draws both axes crossing at a point, with tick marks at the given intervals, inside the current SCALE window.',
    },
    {
      name: 'GCLEAR',
      kind: 'command',
      domain: 'graphics',
      syntax: 'GCLEAR',
      description:
        'Clears the whole screen - text and graphics alike, since they are the same bitmap - and homes the print position.',
    },
    {
      name: 'PAUSE',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'PAUSE [<number>]',
      description:
        'Waits for roughly the given number of milliseconds, up to 255 - a longer wait is a parameter error, so it takes several PAUSEs. This is the machine’s delay statement; WAIT is not one.',
    },
    {
      name: 'DISP',
      kind: 'command',
      domain: 'text-screen',
      syntax: 'DISP [<expr>][;|,]…',
      description:
        'Prints into the dialogue line at the foot of the screen rather than into the scrolling text area, leaving what is above it untouched.',
    },
    {
      name: '_',
      kind: 'command',
      domain: 'input',
      syntax: '_ [<expr>][;|,]…',
      description:
        'DISP, and then waits for a key. This is what a `?` typed into the editor stores - on this machine `?` is not PRINT, and a program using it lists back with `_`.',
    },
    {
      name: 'BMOVE',
      kind: 'command',
      domain: 'graphics',
      syntax: 'BMOVE <x>, <y>',
      description:
        'Sets the cursor BPLOT writes at, in screen memory rather than in SCALE coordinates.',
    },
    {
      name: 'BPLOT',
      kind: 'command',
      domain: 'graphics',
      syntax: 'BPLOT <string>, <number>',
      description:
        'Writes the bytes of a string straight into video RAM from the BMOVE cursor - six pixels per byte, which is how a sprite is drawn here.',
    },
    {
      name: 'LOAD',
      kind: 'command',
      domain: 'storage',
      syntax: 'LOAD [CODE] <tapefile>',
      description:
        'Loads a program from tape by number, or with CODE a block of machine code. The argument is a number, not a name: LOAD "A" answers with a type error.',
    },
    {
      name: 'SAVE',
      kind: 'command',
      domain: 'storage',
      syntax: 'SAVE <tapefile>',
      description: 'Records the program to tape under a number.',
    },
    {
      name: 'DLOAD',
      kind: 'command',
      domain: 'storage',
      syntax: 'DLOAD <tapefile>, <var>',
      description: 'Loads an array back from tape, filling the named variable.',
    },
    {
      name: 'DSAVE',
      kind: 'command',
      domain: 'storage',
      syntax: 'DSAVE <tapefile>, <var>',
      description:
        'Records an array to tape - data rather than program, which SAVE cannot carry.',
    },
    {
      name: 'LABEL',
      kind: 'command',
      domain: 'graphics',
      syntax: 'LABEL <x>, <y>;<expr>',
      description:
        'Plots text at a point in the drawing coordinates, so a chart can be annotated where PRINT would only reach a text cell.',
    },
    {
      name: 'FILL',
      kind: 'command',
      domain: 'graphics',
      syntax: 'FILL <x>, <y>;<byte>',
      description:
        'Plots a byte as an enlarged bit pattern at a point - the machine’s way of hatching an area or drawing a fat marker.',
    },
    {
      name: 'AUTO',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'AUTO [<line>[, <number>]]',
      description:
        'Numbers entered lines automatically from a starting line and step, until the STOP key ends it.',
    },
    {
      name: 'OUTPUT',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'OUTPUT <channelno>;<expr>[;|,]…',
      description:
        'Prints down an I/O channel on the expansion board rather than to the screen - the printer or the serial line.',
    },
    {
      name: 'STATUS',
      kind: 'function',
      domain: 'memory-hardware',
      syntax: 'STATUS(<channelno>, <number>)',
      description:
        'Reads one register of an I/O device, for a program that has to know whether the channel is ready.',
    },
    {
      name: 'ENTER',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'ENTER <channelno>;<var>[, <var>]…',
      description:
        'Reads values in from an I/O channel, as INPUT does from the keyboard.',
    },
    {
      name: 'CONTROL',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'CONTROL <channelno>, <number>, <byte>[, <byte>]…',
      description:
        'Writes bytes to a device’s control port, which is how a channel is configured before OUTPUT or ENTER uses it.',
    },
    {
      name: 'CHECK',
      kind: 'command',
      domain: 'storage',
      syntax: 'CHECK <tapefile>',
      description:
        'Reads a tape file back and compares it with what is in memory, without loading it - the verify pass after a SAVE.',
    },
    {
      name: 'CONT',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'CONT',
      description:
        'Resumes a program stopped by STOP or by the STOP key, from the statement after it. Editing any line first makes it impossible.',
    },
    {
      name: 'OUT',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'OUT <port>, <byte>',
      description: 'Writes a byte to an output port.',
    },
    {
      name: 'INKEY',
      kind: 'function',
      domain: 'input',
      syntax: 'INKEY',
      description:
        'Which function key K0-K11 is held, or 255 when none is. This is the machine’s key-at-a-time read, and it sees only that row of keys.',
    },
    {
      name: 'CODE',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'CODE <string>[, <string>]…',
      description:
        'Assembles machine code written as hexadecimal digits in a string, into a scratch area at 7F00h, and calls it.',
    },
    {
      name: 'ROM',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'ROM <number>',
      description:
        'Copies a numbered block out of the ROM module - the same 8255 that BASIC-G itself arrived through - to 7000h and calls it.',
    },
    {
      name: 'APOKE',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'APOKE <addr>, <number>[, <number>]…',
      description:
        'POKE for 16-bit words: each value is written low byte first, as the 8080 stores an address.',
    },
    {
      name: 'PEN',
      kind: 'command',
      domain: 'colour',
      syntax: 'PEN <penmode>',
      description:
        'Sets what the drawing statements write into the two attribute bits of each cell: 0 plain, 1 blinking, 2 dim, 3 both.',
    },
    {
      name: 'INK(',
      kind: 'function',
      domain: 'colour',
      syntax: 'INK(<colour>)',
      description:
        'Inside a PRINT list, sets the same two attribute bits for the text that follows it.',
    },
    {
      name: 'APEEK',
      kind: 'function',
      domain: 'memory-hardware',
      syntax: 'APEEK(<addr>)',
      description:
        'PEEK for 16-bit words, reading low byte first - the counterpart of APOKE.',
    },
    {
      name: 'ADR',
      kind: 'function',
      domain: 'memory-hardware',
      syntax: 'ADR(<var>)',
      description:
        'The address a variable’s value is stored at, so machine code can be handed something to work on.',
    },
    {
      name: 'AT',
      kind: 'operator',
      domain: 'text-screen',
      syntax: 'PRINT AT <row>, <col>',
      description:
        'Inside a PRINT list, moves the print position to a text cell. The text area is 48 columns by 26 rows.',
    },
    {
      name: 'HEX$',
      kind: 'function',
      domain: 'strings',
      syntax: 'HEX$(<number>)',
      description:
        'A number as four hexadecimal digits. The matching input form is a literal written with a leading apostrophe, as in ’FF.',
    },
    {
      name: 'DEG',
      kind: 'command',
      domain: 'numeric',
      syntax: 'DEG',
      description:
        'Takes the angle arguments of SIN, COS, TAN and ATN in degrees, until RAD switches back.',
    },
  ],
};

export const pmd85Reference = withAbbreviations('pmd85', pmd85Table);
