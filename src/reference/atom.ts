// Reference table data for the Acorn Atom BASIC page.
// Seeded from the dialect's keyword table by scripts/gen-reference-scaffold.mts,
// then hand-enriched (typed <…> syntax + fuller descriptions). Edit by hand;
// the generator skips this file once it exists.
import type { BasicReferenceTableData } from './types';
import { withAbbreviations } from './abbreviations';

const atomTable: BasicReferenceTableData = {
  title: 'Acorn Atom BASIC',
  machines: ['Acorn Atom'],
  // Nothing beyond the shared vocabulary.
  placeholders: [],
  entries: [
    {
      name: 'PRINT',
      kind: 'command',
      domain: 'text-screen',
      syntax: "PRINT [<expr> | &<number> | $<addr>][,|;|']…",
      description:
        "Prints values to the screen (abbreviate as P.); it adds no trailing newline, so use a quote ' to emit a carriage return. A comma tabs to the next field, a semicolon suppresses spacing, & prints a value in hexadecimal, and $<addr> prints the string stored at that address.",
    },
    {
      name: 'INPUT',
      kind: 'command',
      domain: 'input',
      syntax: 'INPUT [<prompt>,] <var>',
      description:
        'Reads a number from the keyboard into a numeric variable (A–Z), or text into a string when the target is a $ string. An optional quoted prompt is printed before the cursor.',
    },
    {
      name: 'IF',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'IF <number> THEN <statement>',
      description:
        'Runs the statement after THEN only when the condition is non-zero (true). Atom BASIC has no ELSE, and THEN takes a single statement.',
    },
    {
      name: 'THEN',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'IF <number> THEN <statement>',
      description:
        'Introduces the single statement executed when the preceding IF condition is true.',
    },
    {
      name: 'GOTO',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'GOTO <line>',
      description:
        'Jumps unconditionally to a line number, which may itself be a computed expression. Abbreviate as G.',
    },
    {
      name: 'GOSUB',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'GOSUB <line>',
      description:
        'Calls the subroutine at the given line; a later RETURN resumes after the GOSUB. Abbreviate as GOS.',
    },
    {
      name: 'RETURN',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'RETURN',
      description:
        'Returns from a GOSUB to the statement following the most recent call.',
    },
    {
      name: 'FOR',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'FOR <numvar> = <number> TO <number> [STEP <number>]',
      description:
        'Begins a counted loop over an integer variable, closed by NEXT. The counter is one of A–Z and steps by 1 unless STEP gives another value.',
    },
    {
      name: 'TO',
      kind: 'operator',
      domain: 'control-flow',
      syntax: 'FOR <numvar> = <number> TO <number>',
      description: 'Separates the start and end values of a FOR loop counter.',
    },
    {
      name: 'STEP',
      kind: 'operator',
      domain: 'control-flow',
      syntax: 'FOR <numvar> = <number> TO <number> STEP <number>',
      description:
        'Sets the increment added to the FOR counter on each pass; it may be negative to count down.',
    },
    {
      name: 'NEXT',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'NEXT [<numvar>]',
      description:
        'Marks the end of a FOR loop and advances the counter, looping back while the limit is not yet passed. Naming the variable is optional.',
    },
    {
      name: 'DO',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'DO <statement>… UNTIL <number>',
      description:
        "Begins a loop whose body repeats until the UNTIL condition is true (tested at the bottom, so the body always runs at least once). Because 0 is false, 'UNTIL 0' loops forever.",
    },
    {
      name: 'UNTIL',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'UNTIL <number>',
      description:
        'Closes a DO loop, testing its condition at the bottom and repeating the body until the expression is true (non-zero).',
    },
    {
      name: 'REM',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'REM <comment>',
      description:
        'Marks a comment; the rest of the line is ignored by the interpreter.',
    },
    {
      name: 'LET',
      kind: 'command',
      domain: 'data',
      syntax: 'LET <var> = <number>',
      description:
        'Assigns a value to a variable; the LET keyword is optional, so V=expr works on its own. Only one variable is assigned per statement.',
    },
    {
      name: 'DIM',
      kind: 'command',
      domain: 'data',
      syntax: 'DIM <var>(<number>)',
      description:
        'Reserves space for an array or a byte buffer of the given size for later indexed or ?/! access.',
    },
    {
      name: 'LINK',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'LINK <number>',
      description:
        'Calls a machine-code routine at the given address; addresses are commonly written as hex with a # prefix (e.g. LINK #FFE3).',
    },
    {
      name: 'WAIT',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'WAIT',
      description:
        'Pauses for one display frame (about 1/50 s), typically used to pace animation.',
    },
    {
      name: 'CLEAR',
      kind: 'command',
      domain: 'graphics',
      syntax: 'CLEAR <number>',
      description:
        'Selects a screen mode and clears it: CLEAR 0 is the 32×16 text screen, while CLEAR 1–4 select graphics modes, with CLEAR 4 the highest resolution (256×192).',
    },
    {
      name: 'MOVE',
      kind: 'command',
      domain: 'graphics',
      syntax: 'MOVE <x>, <y>',
      description:
        'Moves the graphics cursor to x,y without drawing. The graphics origin is the bottom-left of the screen.',
    },
    {
      name: 'DRAW',
      kind: 'command',
      domain: 'graphics',
      syntax: 'DRAW <x>, <y>',
      description:
        "Draws a line from the current graphics cursor to x,y; drawing to the cursor's own point plots a single dot.",
    },
    {
      name: 'PLOT',
      kind: 'command',
      domain: 'graphics',
      syntax: 'PLOT <action>, <x>, <y>',
      description:
        'Plots at x,y with a mode that controls whether the point is set, cleared, or inverted. The Atom has no colour list like the BBC.',
    },
    {
      name: 'END',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'END',
      description: 'Stops the program cleanly and returns to the prompt.',
    },
    {
      name: 'RUN',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'RUN',
      description: 'Runs the program in memory from its lowest line number.',
    },
    {
      name: 'LIST',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'LIST [<line>, <line>]',
      description:
        'Lists the program text, optionally restricted to a start and end line range.',
    },
    {
      name: 'NEW',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'NEW',
      description: 'Erases the program currently held in memory.',
    },
    {
      name: 'OLD',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'OLD',
      description:
        'Recovers the previous program after a NEW, provided its text has not yet been overwritten.',
    },
    {
      name: 'LOAD',
      kind: 'command',
      domain: 'storage',
      syntax: 'LOAD <filename>',
      description: 'Loads a named program from cassette into memory.',
    },
    {
      name: 'SAVE',
      kind: 'command',
      domain: 'storage',
      syntax: 'SAVE <filename>',
      description: 'Saves the program in memory to cassette under a name.',
    },
    {
      name: 'SHUT',
      kind: 'command',
      domain: 'storage',
      syntax: 'SHUT',
      description: 'Closes all open cassette or disc files.',
    },
    {
      name: 'BPUT',
      kind: 'command',
      domain: 'storage',
      syntax: 'BPUT <file>, <byte>',
      description:
        "Writes the low byte of the value to an output file opened with FOUT. In the IDE these bytes are stored in the emulator's virtual filesystem, viewable via the Emulator files viewer.",
    },
    {
      name: 'PUT',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'PUT <port>, <byte>',
      description: 'Writes a value to the given hardware I/O port.',
    },
    {
      name: 'STOP',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'STOP',
      description: 'Halts the program and prints a STOP report.',
    },
    {
      name: 'FPRINT',
      kind: 'command',
      domain: 'text-screen',
      syntax: 'FPRINT <number>',
      description:
        'Prints a floating-point value; the floating-point counterpart of PRINT (requires the floating-point ROM). Abbreviate as FP.',
    },
    {
      name: 'FINPUT',
      kind: 'command',
      domain: 'input',
      syntax: 'FINPUT %<var>',
      description:
        'Reads a floating-point value from the keyboard into a %A–%Z floating-point variable (requires the floating-point ROM).',
    },
    {
      name: 'FDIM',
      kind: 'command',
      domain: 'data',
      syntax: 'FDIM %<var>(<number>)',
      description:
        'Reserves space for a floating-point array indexed from zero (requires the floating-point ROM).',
    },
    {
      name: 'FIF',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'FIF <number> THEN <statement>',
      description:
        'Runs the statement after THEN only when a floating-point comparison is true (requires the floating-point ROM).',
    },
    {
      name: 'FUNTIL',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'FUNTIL <number>',
      description:
        'Closes a DO loop, repeating until a floating-point condition becomes true (requires the floating-point ROM).',
    },
    {
      name: 'FPUT',
      kind: 'command',
      domain: 'storage',
      syntax: 'FPUT <file>, %<var>',
      description:
        'Writes a floating-point value to an output file opened with FOUT (requires the floating-point ROM).',
    },
    {
      name: 'FGET',
      kind: 'command',
      domain: 'storage',
      syntax: 'FGET <file>, %<var>',
      description:
        'Reads a floating-point value from an input file opened with FIN (requires the floating-point ROM).',
    },
    {
      name: 'ABS',
      kind: 'function',
      domain: 'numeric',
      syntax: 'ABS(<number>)',
      description: 'Returns the absolute (unsigned) value of n.',
    },
    {
      name: 'LEN',
      kind: 'function',
      domain: 'strings',
      syntax: 'LEN(<number>)',
      description:
        'Returns the length of the string stored at the given address (a $ string), not counting its terminating carriage return.',
    },
    {
      name: 'RND',
      kind: 'function',
      domain: 'numeric',
      syntax: 'RND',
      description:
        'Returns a random integer; test its sign for a coin flip since arithmetic on A–Z is integer-only.',
    },
    {
      name: 'FOUT',
      kind: 'function',
      domain: 'storage',
      syntax: 'FOUT <filename>',
      description:
        "Opens a file for output and returns a handle to pass to BPUT. In the IDE the file lives in the emulator's virtual filesystem (see the Emulator files viewer).",
    },
    {
      name: 'FIN',
      kind: 'function',
      domain: 'storage',
      syntax: 'FIN <filename>',
      description:
        'Opens a file for input and returns a handle to pass to BGET, or 0 if no such file exists. In the IDE it reads from the emulator virtual filesystem.',
    },
    {
      name: 'BGET',
      kind: 'function',
      domain: 'storage',
      syntax: 'BGET <file>',
      description:
        'Reads and returns the next byte from an input file opened with FIN.',
    },
    {
      name: 'TOP',
      kind: 'function',
      domain: 'memory-hardware',
      syntax: 'TOP',
      description:
        'Returns the address of the byte just past the end of the program text, marking the start of free memory.',
    },
    {
      name: 'CH',
      kind: 'function',
      domain: 'input',
      syntax: 'CH <number>',
      description: 'Reads a character or key code.',
    },
    {
      name: 'GET',
      kind: 'function',
      domain: 'memory-hardware',
      syntax: 'GET <port>',
      description:
        'Reads and returns a value from the given hardware I/O port.',
    },
    {
      name: 'SGN',
      kind: 'function',
      domain: 'numeric',
      syntax: 'SGN(<number>)',
      description: 'Returns the sign of n as -1, 0, or 1.',
    },
    {
      name: 'SQR',
      kind: 'function',
      domain: 'numeric',
      syntax: 'SQR(<number>)',
      description:
        'Returns the square root of n (requires the floating-point ROM).',
    },
    {
      name: 'SIN',
      kind: 'function',
      domain: 'numeric',
      syntax: 'SIN(<number>)',
      description:
        'Returns the sine of n in radians (requires the floating-point ROM).',
    },
    {
      name: 'COS',
      kind: 'function',
      domain: 'numeric',
      syntax: 'COS(<number>)',
      description:
        'Returns the cosine of n in radians (requires the floating-point ROM).',
    },
    {
      name: 'TAN',
      kind: 'function',
      domain: 'numeric',
      syntax: 'TAN(<number>)',
      description:
        'Returns the tangent of n in radians (requires the floating-point ROM).',
    },
    {
      name: 'ATN',
      kind: 'function',
      domain: 'numeric',
      syntax: 'ATN(<number>)',
      description:
        'Returns the arctangent of n in radians (requires the floating-point ROM).',
    },
    {
      name: 'EXP',
      kind: 'function',
      domain: 'numeric',
      syntax: 'EXP(<number>)',
      description:
        'Returns e raised to the power n (requires the floating-point ROM).',
    },
    {
      name: 'LN',
      kind: 'function',
      domain: 'numeric',
      syntax: 'LN(<number>)',
      description:
        'Returns the natural (base-e) logarithm of n (requires the floating-point ROM).',
    },
    {
      name: 'LOG',
      kind: 'function',
      domain: 'numeric',
      syntax: 'LOG(<number>)',
      description:
        'Returns the base-10 logarithm of n (requires the floating-point ROM).',
    },
    {
      name: 'PI',
      kind: 'function',
      domain: 'numeric',
      syntax: 'PI',
      description:
        'Returns the constant 3.14159265 (requires the floating-point ROM).',
    },
    {
      name: 'COUNT',
      kind: 'function',
      domain: 'text-screen',
      syntax: 'COUNT',
      description:
        'Returns the current text cursor column — the number of characters printed since the last newline — like POS in other dialects.',
    },
    {
      name: 'PTR',
      kind: 'function',
      domain: 'storage',
      syntax: 'PTR <file>',
      description:
        'Returns the read/write pointer of an open file (the number of bytes transferred so far); it can also be assigned to seek to a position within the file.',
    },
    {
      name: 'EXT',
      kind: 'function',
      domain: 'storage',
      syntax: 'EXT <file>',
      description: 'Returns the length (extent) in bytes of an open file.',
    },
    {
      name: 'SGET',
      kind: 'function',
      domain: 'storage',
      syntax: 'SGET <file>',
      description:
        'Reads a whole string (up to a carriage return) from an input file opened with FIN — the string companion of BGET.',
    },
    {
      name: 'SPUT',
      kind: 'command',
      domain: 'storage',
      syntax: 'SPUT <file>, $<addr>',
      description:
        'Writes a string (the characters at an address, up to a carriage return) to an output file opened with FOUT — the string companion of BPUT.',
    },
    {
      name: '?',
      kind: 'operator',
      domain: 'memory-hardware',
      syntax: '?<addr> | ?<addr>=<byte>',
      description:
        'Byte indirection: reads or writes the single byte at an address (the Atom equivalent of PEEK/POKE). As a statement, ?addr=value stores a byte; in an expression, ?addr reads one. The dyadic form base?offset addresses base+offset.',
    },
    {
      name: '!',
      kind: 'operator',
      domain: 'memory-hardware',
      syntax: '!<addr> | !<addr>=<number>',
      description:
        'Word indirection: reads or writes the 4-byte word at an address, low byte first. As a statement, !addr=value stores four bytes; in an expression, !addr reads them. The dyadic form base!offset addresses base+offset.',
    },
    {
      name: '$',
      kind: 'operator',
      domain: 'strings',
      syntax: '$<addr> | $<addr>=<string>',
      description:
        'String indirection: addresses the string stored at a location, terminated by a carriage return. $addr="TEXT" stores a string; PRINT $addr prints one.',
    },
    {
      name: '%',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> % <number>',
      description:
        'Remainder after integer division (for example 7 % 3 is 1). Not to be confused with %A–%Z, the floating-point ROM variables.',
    },
    {
      name: '&',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> & <number>',
      description:
        'Bitwise AND of two integers (distinct from the logical AND keyword used in conditions).',
    },
    {
      name: ':',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> : <number>',
      description:
        'Bitwise exclusive-OR (XOR) of two integers, setting each result bit where exactly one operand bit is set.',
    },
    {
      name: 'AND',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> AND <number>',
      description:
        'Logical AND used to combine conditions (bitwise masking uses the & operator). Arithmetic on A–Z is integer-only.',
    },
    {
      name: 'OR',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> OR <number>',
      description:
        'Logical OR used to combine conditions (bitwise OR uses the \\ operator). Arithmetic on A–Z is integer-only.',
    },
    {
      name: '+',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> + <number>',
      description: 'Addition.',
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
      syntax: '<number> < <number>',
      description: 'Less than.',
    },
    {
      name: '>',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> > <number>',
      description: 'Greater than.',
    },
    {
      name: '<=',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> <= <number>',
      description: 'Less than or equal.',
    },
    {
      name: '>=',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> >= <number>',
      description: 'Greater than or equal.',
    },
    {
      name: '<>',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> <> <number>',
      description: 'Not equal.',
    },
    {
      name: '^',
      kind: 'operator',
      domain: 'numeric',
      syntax: '%<var> = <number> ^ <number>',
      description:
        'Raises to a power, computed through logs so the result is approximate. Floating point only: %A=2^3 works, and the same expression in integer arithmetic is rejected.',
    },
  ],
};

/**
 * The page as it renders: each row carries the short spellings its keyword can
 * be typed as, derived from the machine's own resolution order rather than
 * authored above. See ./abbreviations.
 */
export const atomReference: BasicReferenceTableData = withAbbreviations(
  'atom',
  atomTable,
);
