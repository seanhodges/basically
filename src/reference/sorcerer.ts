// Reference table data for the Exidy Standard BASIC page.
// Seeded from the dialect's keyword table by scripts/gen-reference-scaffold.mts,
// then hand-enriched (typed <…> syntax + fuller descriptions). Edit by hand;
// the generator skips this file once it exists.
//
// Every row is a word in src/dialects/sorcerer/keywords.ts, which was transcribed
// from the reserved-word table inside the ROM PAC itself; keyword-crosscheck.test.ts
// holds the two in exact agreement in both directions. The behaviour each row
// describes was read off the booted ROM rather than off a relative's page: this is a
// Microsoft 8K BASIC and most of the vocabulary is the Altair's, but a word that
// looks the same does not always answer the same - GO TO is a syntax error here, and
// FN takes a name rather than a single letter.
import type { BasicReferenceTableData } from './types';
import { withAbbreviations } from './abbreviations';

const sorcererTable: BasicReferenceTableData = {
  title: 'Exidy Standard BASIC',
  machines: ['Exidy Sorcerer'],
  // Nothing beyond the shared vocabulary.
  placeholders: [],
  entries: [
    {
      name: 'END',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'END',
      description:
        'Stops the program and returns to the READY prompt without printing a BREAK message. Unlike STOP, a program ended this way cannot be resumed with CONT.',
    },
    {
      name: 'FOR',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'FOR <numvar> = <number> TO <number> [STEP <number>]',
      description:
        'Opens a counting loop that runs up to the matching NEXT. STEP sets the increment (default 1, and it may be negative or fractional); the body always runs at least once, because the limit is tested at the NEXT.',
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
        'Inline constants for READ to consume in program order. Strings may be quoted; the rest of the statement is stored exactly as typed, spaces included.',
    },
    {
      name: 'BYE',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'BYE',
      description:
        "Leaves the interpreter and drops into the Monitor, the machine's own firmware command line — where tapes are loaded, memory is examined and the baud rate is set. This is the one word Exidy added to the interpreter, and it is why every token above INPUT is one higher than the Altair's. PP returns to BASIC with the program intact.",
    },
    {
      name: 'INPUT',
      kind: 'command',
      domain: 'input',
      syntax: 'INPUT [<prompt>;] <var>[, <var>]…',
      description:
        "Prints the prompt (or ? when there is none) and waits for a whole line to be typed. This is the machine's only key read — there is no INKEY$ and no GET — so an interactive program takes one turn per typed line.",
    },
    {
      name: 'DIM',
      kind: 'command',
      domain: 'data',
      syntax: 'DIM <var>(<number>[, <number>]…)',
      description:
        'Declares an array and its bounds. Subscripts start at 0, so DIM A(10) has eleven elements; an undeclared array is created with bound 10 on first use, and re-declaring one answers ?DD ERROR.',
    },
    {
      name: 'READ',
      kind: 'command',
      domain: 'data',
      syntax: 'READ <var>[, <var>]…',
      description:
        'Takes the next constant from the DATA statements, in program order. RESTORE winds the pointer back to the first; running past the last answers ?OD ERROR.',
    },
    {
      name: 'LET',
      kind: 'command',
      domain: 'data',
      syntax: '[LET] <var> = <expr>',
      description:
        'Assigns a value. The keyword is optional and almost always left out; it costs a byte of program text and nothing else.',
    },
    {
      name: 'GOTO',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'GOTO <line>',
      description:
        'Jumps to a line number. It is one word here — GO TO with a space answers ?SN ERROR, unlike the Microsoft BASICs that accept both — and a line that does not exist answers ?UL ERROR.',
    },
    {
      name: 'RUN',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'RUN [<line>]',
      description:
        'Clears the variables and starts the program, from the given line or from the first. Because it clears, RUN 100 is not a way to resume — that is CONT.',
    },
    {
      name: 'IF',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'IF <expr> THEN <line> | <statement>',
      description:
        'Runs the rest of the line when the value is non-zero. There is no ELSE in this interpreter, so the alternative branch is a separate line reached by falling through.',
    },
    {
      name: 'RESTORE',
      kind: 'command',
      domain: 'data',
      syntax: 'RESTORE',
      description:
        'Winds the DATA pointer back to the first constant in the program. It takes no line number: the whole pointer resets or none of it does.',
    },
    {
      name: 'GOSUB',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'GOSUB <line>',
      description:
        'Calls a subroutine, remembering where to come back to. The return addresses are stacked, and the stack shares its memory with the string pool.',
    },
    {
      name: 'RETURN',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'RETURN',
      description:
        'Returns to the statement after the most recent GOSUB. Without one outstanding it answers ?RG ERROR.',
    },
    {
      name: 'REM',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'REM <comment>',
      description:
        'A comment. Everything to the end of the line is stored exactly as typed and never executed, so a REM is the one place a reserved word may be written freely. There is no apostrophe shorthand.',
    },
    {
      name: 'STOP',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'STOP',
      description:
        'Halts the program and prints BREAK IN <line>. CONT resumes from the statement after it, which is what separates STOP from END.',
    },
    {
      name: 'OUT',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'OUT <port>, <byte>',
      description:
        'Writes a byte to a Z80 output port. The ports that matter here are 0xFC to 0xFF — the serial data, status and control registers and the parallel port — and the control port is also how the keyboard is scanned.',
    },
    {
      name: 'ON',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'ON <expr> GOTO | GOSUB <line>[, <line>]…',
      description:
        'Jumps or calls the nth line in the list, counting from 1. A value of 0, or one past the end of the list, falls through to the next statement instead of failing.',
    },
    {
      name: 'NULL',
      kind: 'command',
      domain: 'text-screen',
      syntax: 'NULL <number>',
      description:
        'Sets how many null bytes are sent after each line of output — padding for a printer or a punch that needed time to return the carriage. Nothing on the screen depends on it.',
    },
    {
      name: 'WAIT',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'WAIT <port>, <mask>[, <mask>]',
      description:
        'Spins until an input port, exclusive-ORed with the third argument and masked by the second, is non-zero. Nothing but a key or a hardware signal will end the wait, and CTRL-C cannot interrupt it.',
    },
    {
      name: 'DEF',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'DEF FN<name>(<numvar>) = <expr>',
      description:
        'Defines a one-line numeric function. The body is a single expression, the parameter is local to it, and the definition must have run before the function is called.',
    },
    {
      name: 'POKE',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'POKE <addr>, <byte>',
      description:
        'Writes a byte to memory. The address is a signed 16-bit number, so everything from 32768 up is written negative — screen RAM at 0xF080 is -3968 — and the positive form answers ?FC ERROR.',
    },
    {
      name: 'PRINT',
      kind: 'command',
      domain: 'text-screen',
      syntax: 'PRINT [<expr>][;|,]…',
      description:
        'Prints to the screen. A semicolon runs the next item straight on, a comma moves to the next 14-column zone, and a trailing separator suppresses the newline. There is no PRINT AT: a position is reached with TAB( across a line, and with a POKE into screen RAM otherwise.',
    },
    {
      name: 'CONT',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'CONT',
      description:
        'Resumes a program stopped by STOP or by CTRL-C, from where it left off. Editing any line makes the program uncontinuable and answers ?CN ERROR.',
    },
    {
      name: 'LIST',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'LIST [<line>]',
      description:
        'Lists the program to the screen, from the given line or from the start. Keywords come back in their canonical spelling, so a line typed with ? lists as PRINT.',
    },
    {
      name: 'CLEAR',
      kind: 'command',
      domain: 'data',
      syntax: 'CLEAR [<number>]',
      description:
        'Discards every variable and array. With a number it also sets the string pool to that many bytes, taken off the top of memory; without one the pool keeps the size it had, 50 bytes until a program says otherwise.',
    },
    {
      name: 'CLOAD',
      kind: 'command',
      domain: 'storage',
      syntax: 'CLOAD <filename>',
      description:
        'Loads a BASIC program from cassette. The name is quoted and only its first five characters are kept, which is all an Exidy tape header carries; the tape is read past until a record with that name is found.',
    },
    {
      name: 'CSAVE',
      kind: 'command',
      domain: 'storage',
      syntax: 'CSAVE <filename>',
      description:
        'Saves the program to cassette as one Exidy record, named by the first five characters of the quoted name. The recorder has to be running before the statement is typed.',
    },
    {
      name: 'NEW',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'NEW',
      description:
        'Erases the program and every variable with it, and resets the string pool to 50 bytes. There is no way back afterwards.',
    },
    {
      name: 'TAB(',
      kind: 'function',
      domain: 'text-screen',
      syntax: 'TAB(<number>)',
      description:
        'Moves the print position to the given column, counting from 0. It only ever moves forward: a column already passed is ignored rather than wrapping to the next line. Valid inside PRINT alone.',
    },
    {
      name: 'TO',
      kind: 'operator',
      domain: 'control-flow',
      syntax: 'FOR <numvar> = <number> TO <number>',
      description:
        'The limit of a FOR loop. It is a reserved word wherever it appears, which is why a variable named TOTAL contains a keyword and mis-runs.',
    },
    {
      name: 'FN',
      kind: 'function',
      domain: 'control-flow',
      syntax: 'FN<name>(<number>)',
      description:
        'Calls a function made by DEF. The name follows FN with no space, and only its first two characters are significant — as with every other name here.',
    },
    {
      name: 'SPC(',
      kind: 'function',
      domain: 'text-screen',
      syntax: 'SPC(<number>)',
      description:
        'Prints the given number of spaces. Unlike TAB( it is relative, so it always moves. Valid inside PRINT alone.',
    },
    {
      name: 'THEN',
      kind: 'operator',
      domain: 'control-flow',
      syntax: 'IF <expr> THEN <line> | <statement>',
      description:
        'Introduces what an IF does when its value is non-zero. A bare line number after THEN means GOTO that line.',
    },
    {
      name: 'NOT',
      kind: 'operator',
      domain: 'numeric',
      syntax: 'NOT <number>',
      description:
        'Inverts all sixteen bits of its operand, so NOT 0 is -1 and NOT -1 is 0. That makes it the logical negation of a comparison, which answers -1 for true and 0 for false.',
    },
    {
      name: 'STEP',
      kind: 'operator',
      domain: 'control-flow',
      syntax: 'FOR <numvar> = <number> TO <number> STEP <number>',
      description:
        'The amount a FOR loop adds each time round. It may be negative or fractional, and a step of 0 loops for ever.',
    },
    {
      name: '+',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> + <number> | <string> + <string>',
      description:
        'Adds two numbers, or joins two strings. A joined string is built in the string pool, so concatenation in a loop is what exhausts it.',
    },
    {
      name: '-',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> - <number> | -<number>',
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
        'Divides, always in floating point — 7/2 is 3.5, and there is no integer-division operator. Dividing by zero answers ?/0 ERROR and stops the program.',
    },
    {
      name: '^',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> ^ <number>',
      description:
        'Raises to a power, folding left to right, so 2^3^2 is 64. This interpreter has no up-arrow spelling: the caret is the operator, and the caret key also carries a graphics character under GRAPHIC.',
    },
    {
      name: 'AND',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> AND <number>',
      description:
        'Combines two values bit by bit over sixteen bits. With comparisons, which answer -1 or 0, that is the logical AND; with other numbers it is a bit mask.',
    },
    {
      name: 'OR',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> OR <number>',
      description:
        'Combines two values bit by bit over sixteen bits, the counterpart of AND. There is no exclusive-OR operator.',
    },
    {
      name: '>',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> > <number> | <string> > <string>',
      description:
        'Greater than. Strings compare by character code, left to right, so a shorter string that is otherwise equal is the smaller one.',
    },
    {
      name: '=',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<var> = <expr> | <number> = <number>',
      description:
        "Assignment in a LET, and equality everywhere else. The interpreter tells them apart by position, which is why A=B=C assigns the comparison's -1 or 0.",
    },
    {
      name: '<',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> < <number> | <string> < <string>',
      description: 'Less than, comparing strings by character code as > does.',
    },
    {
      name: 'SGN',
      kind: 'function',
      domain: 'numeric',
      syntax: 'SGN(<number>)',
      description: '-1, 0 or 1 according to the sign of the value.',
    },
    {
      name: 'INT',
      kind: 'function',
      domain: 'numeric',
      syntax: 'INT(<number>)',
      description:
        'The largest whole number not above the value, so INT(-2.5) is -3. Rounding to nearest is INT(x+.5).',
    },
    {
      name: 'ABS',
      kind: 'function',
      domain: 'numeric',
      syntax: 'ABS(<number>)',
      description: 'The value without its sign.',
    },
    {
      name: 'USR',
      kind: 'function',
      domain: 'memory-hardware',
      syntax: 'USR(<number>)',
      description:
        'Calls machine code at one fixed vector, whose address is poked into 260 and 261 low byte first. The argument is not passed and the result is not returned — calling it before the vector is set answers ?FC ERROR — so a routine takes and gives back its values by poking bytes the program then PEEKs.',
    },
    {
      name: 'FRE',
      kind: 'function',
      domain: 'memory-hardware',
      syntax: 'FRE(<number>) | FRE(<string>)',
      description:
        'With a number, the bytes left between the top of the variables and the bottom of the string pool. With a string argument it collects the string pool first and answers the bytes free in that instead, which is 50 on a program that has not said CLEAR.',
    },
    {
      name: 'INP',
      kind: 'function',
      domain: 'memory-hardware',
      syntax: 'INP(<port>)',
      description:
        'Reads a byte from a Z80 input port. Reading the control port at 254 gives the keyboard row last selected, with a pressed key reading 0.',
    },
    {
      name: 'POS',
      kind: 'function',
      domain: 'text-screen',
      syntax: 'POS(<number>)',
      description:
        "The column the next character will print in, counting from 0. The argument is ignored — it exists because the interpreter's function call always takes one.",
    },
    {
      name: 'SQR',
      kind: 'function',
      domain: 'numeric',
      syntax: 'SQR(<number>)',
      description: 'Square root. A negative argument answers ?FC ERROR.',
    },
    {
      name: 'RND',
      kind: 'function',
      domain: 'numeric',
      syntax: 'RND(<number>)',
      description:
        'A random number from 0 up to but not including 1. A positive argument gives the next number in the sequence, 0 repeats the one just given, and a negative argument reseeds from that value — so the same negative seed replays the same run.',
    },
    {
      name: 'LOG',
      kind: 'function',
      domain: 'numeric',
      syntax: 'LOG(<number>)',
      description:
        'Natural logarithm. Logarithms to another base are LOG(x)/LOG(base).',
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
      description: 'Cosine of an angle in radians.',
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
      description: 'Arctangent, in radians, between -pi/2 and pi/2.',
    },
    {
      name: 'PEEK',
      kind: 'function',
      domain: 'memory-hardware',
      syntax: 'PEEK(<addr>)',
      description:
        "Reads a byte of memory. The address is signed exactly as POKE's is, so reading the screen means PEEK(-3968) and upwards.",
    },
    {
      name: 'LEN',
      kind: 'function',
      domain: 'strings',
      syntax: 'LEN(<string>)',
      description:
        'How many characters a string holds. A string may be up to 255 characters long, whatever the pool has room for.',
    },
    {
      name: 'STR$',
      kind: 'function',
      domain: 'strings',
      syntax: 'STR$(<number>)',
      description:
        'A number as the characters PRINT would have shown, leading space for the sign included.',
    },
    {
      name: 'VAL',
      kind: 'function',
      domain: 'strings',
      syntax: 'VAL(<string>)',
      description:
        'The number at the front of a string, or 0 where there is none. It stops at the first character that cannot be part of a number.',
    },
    {
      name: 'ASC',
      kind: 'function',
      domain: 'strings',
      syntax: 'ASC(<string>)',
      description:
        'The character code of the first character. An empty string answers ?FC ERROR.',
    },
    {
      name: 'CHR$',
      kind: 'function',
      domain: 'strings',
      syntax: 'CHR$(<number>)',
      description:
        'The one-character string for a code from 0 to 255. Codes 128 to 191 are the standard graphics set and print as shapes; codes below 32 are control codes the screen driver acts on rather than characters it draws.',
    },
    {
      name: 'LEFT$',
      kind: 'function',
      domain: 'strings',
      syntax: 'LEFT$(<string>, <length>)',
      description: 'The leftmost n characters.',
    },
    {
      name: 'RIGHT$',
      kind: 'function',
      domain: 'strings',
      syntax: 'RIGHT$(<string>, <length>)',
      description: 'The rightmost n characters.',
    },
    {
      name: 'MID$',
      kind: 'function',
      domain: 'strings',
      syntax: 'MID$(<string>, <start>[, <length>])',
      description:
        'The substring starting at position n, counting from 1, of the given length or to the end. It is a function only: unlike later Microsoft BASICs it cannot be assigned to, and trying answers ?SN ERROR.',
    },
    {
      name: '<=',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> <= <number> | <string> <= <string>',
      description:
        'Less than or equal. Stored as two tokens rather than one, so =< is the same operator written the other way round.',
    },
    {
      name: '>=',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> >= <number> | <string> >= <string>',
      description: 'Greater than or equal, stored as two tokens as <= is.',
    },
    {
      name: '<>',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> <> <number> | <string> <> <string>',
      description: 'Not equal, stored as two tokens; >< is the same operator.',
    },
  ],
};

/**
 * The page as it renders: each row carries the short spellings its keyword can
 * be typed as, derived from the machine's own resolution order rather than
 * authored above. See ./abbreviations.
 */
export const sorcererReference: BasicReferenceTableData = withAbbreviations(
  'sorcerer',
  sorcererTable,
);
