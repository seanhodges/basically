// Reference table data for the Acorn Atom BASIC page.
// Seeded from the dialect's keyword table by scripts/gen-reference-scaffold.mts,
// then hand-enriched (typed <…> syntax + fuller descriptions). Edit by hand;
// the generator skips this file once it exists.
import type { ReferenceTableData } from './types';

export const atomReference: ReferenceTableData = {
  title: 'Acorn Atom BASIC',
  machines: ['Acorn Atom'],
  entries: [
    {
      name: 'PRINT',
      kind: 'command',
      syntax: 'PRINT [<number> | "…" | &<number> | $<number>] [, | ; | \'] …',
      description:
        "Prints values to the screen (abbreviate as P.); it adds no trailing newline, so use a quote ' to emit a carriage return. A comma tabs to the next field, a semicolon suppresses spacing, & prints a value in hexadecimal, and $<addr> prints the string stored at that address.",
    },
    {
      name: 'INPUT',
      kind: 'command',
      syntax: 'INPUT ["…",] <var>',
      description:
        'Reads a number from the keyboard into a numeric variable (A–Z), or text into a string when the target is a $ string. An optional quoted prompt is printed before the cursor.',
    },
    {
      name: 'IF',
      kind: 'command',
      syntax: 'IF <number> THEN <statement>',
      description:
        'Runs the statement after THEN only when the condition is non-zero (true). Atom BASIC has no ELSE and only one statement per line.',
    },
    {
      name: 'THEN',
      kind: 'command',
      syntax: 'IF <number> THEN <statement>',
      description:
        'Introduces the single statement executed when the preceding IF condition is true.',
    },
    {
      name: 'GOTO',
      kind: 'command',
      syntax: 'GOTO <line>',
      description:
        'Jumps unconditionally to a line number, which may itself be a computed expression. Abbreviate as G.',
    },
    {
      name: 'GOSUB',
      kind: 'command',
      syntax: 'GOSUB <line>',
      description:
        'Calls the subroutine at the given line; a later RETURN resumes after the GOSUB. Abbreviate as GOS.',
    },
    {
      name: 'RETURN',
      kind: 'command',
      syntax: 'RETURN',
      description:
        'Returns from a GOSUB to the statement following the most recent call.',
    },
    {
      name: 'FOR',
      kind: 'command',
      syntax: 'FOR <numvar>=<number> TO <number> [STEP <number>]',
      description:
        'Begins a counted loop over an integer variable, closed by NEXT. The counter is one of A–Z and steps by 1 unless STEP gives another value.',
    },
    {
      name: 'TO',
      kind: 'operator',
      syntax: 'FOR <numvar>=<number> TO <number>',
      description: 'Separates the start and end values of a FOR loop counter.',
    },
    {
      name: 'STEP',
      kind: 'operator',
      syntax: 'FOR <numvar>=<number> TO <number> STEP <number>',
      description:
        'Sets the increment added to the FOR counter on each pass; it may be negative to count down.',
    },
    {
      name: 'NEXT',
      kind: 'command',
      syntax: 'NEXT [<numvar>]',
      description:
        'Marks the end of a FOR loop and advances the counter, looping back while the limit is not yet passed. Naming the variable is optional.',
    },
    {
      name: 'DO',
      kind: 'command',
      syntax: 'DO … UNTIL <number>',
      description:
        "Begins a loop whose body repeats until the UNTIL condition is true (tested at the bottom, so the body always runs at least once). Because 0 is false, 'UNTIL 0' loops forever.",
    },
    {
      name: 'UNTIL',
      kind: 'command',
      syntax: 'UNTIL <number>',
      description:
        'Closes a DO loop, testing its condition at the bottom and repeating the body until the expression is true (non-zero).',
    },
    {
      name: 'REM',
      kind: 'command',
      syntax: 'REM …',
      description:
        'Marks a comment; the rest of the line is ignored by the interpreter.',
    },
    {
      name: 'LET',
      kind: 'command',
      syntax: 'LET <var>=<number>',
      description:
        'Assigns a value to a variable; the LET keyword is optional, so V=expr works on its own. Only one variable is assigned per statement.',
    },
    {
      name: 'DIM',
      kind: 'command',
      syntax: 'DIM <name>(<number>)',
      description:
        'Reserves space for an array or a byte buffer of the given size for later indexed or ?/! access.',
    },
    {
      name: 'LINK',
      kind: 'command',
      syntax: 'LINK <number>',
      description:
        'Calls a machine-code routine at the given address; addresses are commonly written as hex with a # prefix (e.g. LINK #FFE3).',
    },
    {
      name: 'WAIT',
      kind: 'command',
      syntax: 'WAIT',
      description:
        'Pauses for one display frame (about 1/50 s), typically used to pace animation.',
    },
    {
      name: 'CLEAR',
      kind: 'command',
      syntax: 'CLEAR <number>',
      description:
        'Selects a screen mode and clears it: CLEAR 0 is the 32×16 text screen, while CLEAR 1–4 select graphics modes, with CLEAR 4 the highest resolution (256×192).',
    },
    {
      name: 'MOVE',
      kind: 'command',
      syntax: 'MOVE <number>,<number>',
      description:
        'Moves the graphics cursor to x,y without drawing. The graphics origin is the bottom-left of the screen.',
    },
    {
      name: 'DRAW',
      kind: 'command',
      syntax: 'DRAW <number>,<number>',
      description:
        "Draws a line from the current graphics cursor to x,y; drawing to the cursor's own point plots a single dot.",
    },
    {
      name: 'PLOT',
      kind: 'command',
      syntax: 'PLOT <number>,<number>,<number>',
      description:
        'Plots at x,y with a mode that controls whether the point is set, cleared, or inverted. The Atom has no colour list like the BBC.',
    },
    {
      name: 'END',
      kind: 'command',
      syntax: 'END',
      description: 'Stops the program cleanly and returns to the prompt.',
    },
    {
      name: 'RUN',
      kind: 'command',
      syntax: 'RUN',
      description: 'Runs the program in memory from its lowest line number.',
    },
    {
      name: 'LIST',
      kind: 'command',
      syntax: 'LIST [<line>,<line>]',
      description:
        'Lists the program text, optionally restricted to a start and end line range.',
    },
    {
      name: 'NEW',
      kind: 'command',
      syntax: 'NEW',
      description: 'Erases the program currently held in memory.',
    },
    {
      name: 'OLD',
      kind: 'command',
      syntax: 'OLD',
      description:
        'Recovers the previous program after a NEW, provided its text has not yet been overwritten.',
    },
    {
      name: 'LOAD',
      kind: 'command',
      syntax: 'LOAD "…"',
      description: 'Loads a named program from cassette into memory.',
    },
    {
      name: 'SAVE',
      kind: 'command',
      syntax: 'SAVE "…"',
      description: 'Saves the program in memory to cassette under a name.',
    },
    {
      name: 'SHUT',
      kind: 'command',
      syntax: 'SHUT',
      description: 'Closes all open cassette or disc files.',
    },
    {
      name: 'PUT',
      kind: 'command',
      syntax: 'PUT <number>,<number>',
      description: 'Writes a value to the given hardware I/O port.',
    },
    {
      name: 'STOP',
      kind: 'command',
      syntax: 'STOP',
      description: 'Halts the program and prints a STOP report.',
    },
    {
      name: 'ABS',
      kind: 'function',
      syntax: 'ABS(<number>)',
      description: 'Returns the absolute (unsigned) value of n.',
    },
    {
      name: 'RND',
      kind: 'function',
      syntax: 'RND',
      description:
        'Returns a random integer; test its sign for a coin flip since arithmetic on A–Z is integer-only.',
    },
    {
      name: 'TOP',
      kind: 'function',
      syntax: 'TOP',
      description:
        'Returns the address of the byte just past the end of the program text, marking the start of free memory.',
    },
    {
      name: 'CH',
      kind: 'function',
      syntax: 'CH <number>',
      description: 'Reads a character or key code.',
    },
    {
      name: 'GET',
      kind: 'function',
      syntax: 'GET <number>',
      description:
        'Reads and returns a value from the given hardware I/O port.',
    },
    {
      name: 'SGN',
      kind: 'function',
      syntax: 'SGN(<number>)',
      description: 'Returns the sign of n as -1, 0, or 1.',
    },
    {
      name: 'SQR',
      kind: 'function',
      syntax: 'SQR(<number>)',
      description:
        'Returns the square root of n (requires the floating-point ROM).',
    },
    {
      name: 'SIN',
      kind: 'function',
      syntax: 'SIN(<number>)',
      description:
        'Returns the sine of n in radians (requires the floating-point ROM).',
    },
    {
      name: 'COS',
      kind: 'function',
      syntax: 'COS(<number>)',
      description:
        'Returns the cosine of n in radians (requires the floating-point ROM).',
    },
    {
      name: 'TAN',
      kind: 'function',
      syntax: 'TAN(<number>)',
      description:
        'Returns the tangent of n in radians (requires the floating-point ROM).',
    },
    {
      name: 'ATN',
      kind: 'function',
      syntax: 'ATN(<number>)',
      description:
        'Returns the arctangent of n in radians (requires the floating-point ROM).',
    },
    {
      name: 'EXP',
      kind: 'function',
      syntax: 'EXP(<number>)',
      description:
        'Returns e raised to the power n (requires the floating-point ROM).',
    },
    {
      name: 'LN',
      kind: 'function',
      syntax: 'LN(<number>)',
      description:
        'Returns the natural (base-e) logarithm of n (requires the floating-point ROM).',
    },
    {
      name: 'LOG',
      kind: 'function',
      syntax: 'LOG(<number>)',
      description:
        'Returns the base-10 logarithm of n (requires the floating-point ROM).',
    },
    {
      name: 'PI',
      kind: 'function',
      syntax: 'PI',
      description:
        'Returns the constant 3.14159265 (requires the floating-point ROM).',
    },
    {
      name: 'AND',
      kind: 'operator',
      syntax: '<number> AND <number>',
      description:
        'Bitwise/logical AND of two integers, used both for masking and for combining conditions.',
    },
    {
      name: 'OR',
      kind: 'operator',
      syntax: '<number> OR <number>',
      description:
        'Bitwise/logical OR of two integers, used both for setting bits and for combining conditions.',
    },
    {
      name: 'DIV',
      kind: 'operator',
      syntax: '<number> DIV <number>',
      description:
        'Integer division, discarding any remainder (A–Z arithmetic is integer-only).',
    },
    {
      name: 'MOD',
      kind: 'operator',
      syntax: '<number> MOD <number>',
      description: 'Returns the integer remainder after dividing a by b.',
    },
  ],
};
