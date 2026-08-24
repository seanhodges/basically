// Reference table data for the Apple 1 Integer BASIC page.
// Seeded from the dialect's keyword table by scripts/gen-reference-scaffold.mts,
// then hand-enriched (typed <…> syntax + fuller descriptions). Edit by hand;
// the generator skips this file once it exists.
//
// Every row is a word in src/dialects/apple1/keywords.ts, which was read out of
// the interpreter's own syntax table in the shipped firmware; keyword-
// crosscheck.test.ts holds the two in exact agreement in both directions.
//
// The shortest BASIC vocabulary in the project, and what a reader arriving from
// another machine here will trip over:
//
//  - there is no DATA, no READ, no CHR$, no ASC and no string function but LEN;
//  - HIMEM= and LOMEM= take `=`, not the Apple II's `:`, and they - along with
//    LIST, RUN, DEL, AUTO, OFF, SCR and CLR - are refused inside a numbered
//    line;
//  - TAB is a statement, not a print formatter: `TAB 10` on a line of its own
//    moves the print column;
//  - AND, OR and NOT are logical rather than bitwise, and a true comparison is
//    1 rather than -1;
//  - there is no abbreviation of any kind, not even `?` for PRINT.
import type { BasicReferenceTableData } from './types';
import { withAbbreviations } from './abbreviations';

const apple1Table: BasicReferenceTableData = {
  title: 'Apple 1 Integer BASIC',
  machines: ['Apple I'],
  // Nothing beyond the shared vocabulary.
  placeholders: [],
  entries: [
    {
      name: 'CALL',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'CALL <addr>',
      description:
        'Calls a machine-code routine, which returns with RTS. The address is signed decimal like every address here, so a routine above 32767 is called with a negative number.',
    },
    {
      name: 'DIM',
      kind: 'command',
      domain: 'data',
      syntax: 'DIM <numvar>(<number>) | DIM <strvar>(<length>)',
      description:
        'Declares an array or a string. A string is a fixed buffer of the declared length, allocated once and never grown, and must be declared before it is used at all.',
    },
    {
      name: 'END',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'END',
      description:
        'Stops the program and returns to the > prompt. Worth ending every program with: falling off the last line stops just as cleanly but reports *** END ERR as it goes.',
    },
    {
      name: 'FOR',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'FOR <numvar> = <number> TO <number> [STEP <number>]',
      description:
        'Opens a counting loop that runs up to the matching NEXT. STEP sets the increment, which may be negative; the body always runs at least once.',
    },
    {
      name: 'GOSUB',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'GOSUB <line>',
      description:
        'Calls a subroutine, which returns with RETURN. Sixteen levels deep; deeper answers *** TOO LONG ERR.',
    },
    {
      name: 'GOTO',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'GOTO <line>',
      description:
        "Jumps to a line number. The target may be an expression, which is this BASIC's only computed jump - there is no ON … GOTO.",
    },
    {
      name: 'IF',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'IF <number> THEN <line> | IF <number> THEN <statement>',
      description:
        'Runs the consequent when the condition is non-zero. There is no ELSE: write a second IF, and note that a true comparison here is 1 rather than the -1 of the Microsoft BASICs.',
    },
    {
      name: 'INPUT',
      kind: 'command',
      domain: 'input',
      syntax: 'INPUT [<prompt>,] <var>[, <var>]…',
      description:
        "Prints the prompt, then a ?, and waits for a whole line to be typed. This is the machine's only key read - a program cannot poll the keyboard, because the interpreter takes any keypress first and stops with STOPPED AT.",
    },
    {
      name: 'LET',
      kind: 'command',
      domain: 'data',
      syntax: 'LET <var> = <expr>',
      description:
        'Assigns a value. Optional, as on every BASIC here; the interpreter stores the same bytes either way.',
    },
    {
      name: 'NEXT',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'NEXT <numvar>[, <numvar>]…',
      description:
        'Closes a FOR loop and jumps back to it. The variable is not optional on this machine, unlike most BASICs of the period.',
    },
    {
      name: 'POKE',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'POKE <addr>, <byte>',
      description:
        'Stores a byte in memory. The address is signed decimal - there are no hex literals at all - so the display port at $D012 is written as POKE -12270.',
    },
    {
      name: 'PRINT',
      kind: 'command',
      domain: 'text-screen',
      syntax: 'PRINT [<expr>[;|,]]…',
      description:
        'Prints to the display. A trailing ; stays on the line and , moves to the next tab stop; a bare PRINT ends the line. Each character costs one video field, so a full screen takes about sixteen seconds.',
    },
    {
      name: 'REM',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'REM <comment>',
      description:
        'A comment, to the end of the line. Stored verbatim - and stored in the same 2048 bytes the program and its variables share, so a long comment is a real cost here.',
    },
    {
      name: 'RETURN',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'RETURN',
      description:
        'Returns from a subroutine to the statement after its GOSUB.',
    },
    {
      name: 'STEP',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'FOR <numvar> = <number> TO <number> STEP <number>',
      description:
        'The increment of a FOR loop, and only ever part of one. Whole numbers only, this BASIC having no fractions.',
    },
    {
      name: 'TAB',
      kind: 'command',
      domain: 'text-screen',
      syntax: 'TAB <col>',
      description:
        'Moves the print column, counting from 1. A statement rather than a print formatter, so it stands on its own rather than inside a PRINT, and it moves right only - there is no cursor addressing on this machine.',
    },
    {
      name: 'THEN',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'IF <number> THEN <line> | IF <number> THEN <statement>',
      description:
        'The consequent of an IF, and only ever part of one. A bare line number jumps; anything else is run as a statement.',
    },
    {
      name: 'TO',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'FOR <numvar> = <number> TO <number>',
      description: 'The limit of a FOR loop, and only ever part of one.',
    },
    {
      name: 'AUTO',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'AUTO <line>[, <number>]',
      description:
        'Numbers lines as they are typed, starting at the given line and stepping by the second number (10 by default). Cancelled with OFF, and refused inside a program.',
    },
    {
      name: 'CLR',
      kind: 'command',
      domain: 'data',
      syntax: 'CLR',
      description:
        'Discards every variable, leaving the program alone. Refused inside a program line; on an unnumbered line of its own it is accepted and kept, though a program the IDE builds starts with no variables anyway.',
    },
    {
      name: 'DEL',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'DEL <line>[, <line>]',
      description:
        'Deletes a line, or an inclusive range of them. Refused inside a program line; on an unnumbered line of its own it is accepted and kept, but the IDE builds every line the listing holds - delete them from the listing instead.',
    },
    {
      name: 'HIMEM=',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'HIMEM= <addr>',
      description:
        "Sets the top of the workspace, which the program grows down from. `=`, not the Apple II's `:`. A stock machine has 4K fitted and the cold start already puts HIMEM at the top of it, so raising this needs more RAM on the board. Refused inside a program line; on an unnumbered line of its own - the way a listing writes it - it sets the workspace the IDE builds the program into.",
    },
    {
      name: 'LIST',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'LIST [<line>[, <line>]]',
      description:
        'Lists the program, or one line, or an inclusive range. Refused inside a program line; on an unnumbered line of its own it is accepted and kept, having nothing to print here.',
    },
    {
      name: 'LOMEM=',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'LOMEM= <addr>',
      description:
        'Sets the bottom of the workspace, which the variables grow up from, and discards every variable. Lowering it to 768 buys a larger workspace at the cost of the free RAM a machine-code block would go in. Refused inside a program line; on an unnumbered line of its own - the way a listing writes it - it sets the workspace the IDE builds the program into.',
    },
    {
      name: 'OFF',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'OFF',
      description:
        'Cancels AUTO line numbering. Refused inside a program line - which is a difficulty, AUTO being on while you type one. On an unnumbered line of its own it is accepted and kept.',
    },
    {
      name: 'RUN',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'RUN [<line>]',
      description:
        'Clears the variables and starts the program, at the given line or at the first. Refused inside a program line; on an unnumbered line of its own - a listing often ends with one - it is accepted and kept, the IDE starting the program itself.',
    },
    {
      name: 'SCR',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'SCR',
      description:
        'Scratch: erases the whole program. Refused inside a program line, which is the only thing standing between a listing and a typing slip. On an unnumbered line of its own - the way a listing opens - it is accepted and kept, a program the IDE builds being scratched to begin with.',
    },
    {
      name: 'ABS',
      kind: 'function',
      domain: 'numeric',
      syntax: 'ABS(<number>)',
      description: 'The magnitude of a number, dropping its sign.',
    },
    {
      name: 'LEN',
      kind: 'function',
      domain: 'strings',
      syntax: 'LEN(<string>)',
      description:
        'How many characters a string holds. The only string function this BASIC has: there is no CHR$, no ASC, no MID$ and no concatenation.',
    },
    {
      name: 'PEEK',
      kind: 'function',
      domain: 'memory-hardware',
      syntax: 'PEEK(<addr>)',
      description:
        'The byte at an address. Signed decimal, so the keyboard port at $D010 is read as PEEK(-12272) - although a program cannot usefully poll it, the interpreter taking any keypress first.',
    },
    {
      name: 'RND',
      kind: 'function',
      domain: 'numeric',
      syntax: 'RND(<number>)',
      description:
        'A whole number from 0 up to one less than the argument. There is no fractional form, this BASIC having no fractions.',
    },
    {
      name: 'SGN',
      kind: 'function',
      domain: 'numeric',
      syntax: 'SGN(<number>)',
      description: 'The sign of a number: -1, 0 or 1.',
    },
    {
      name: '+',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> + <number> | +<number>',
      description:
        'Adds, or marks a positive number. Never joins strings: this BASIC has no concatenation.',
    },
    {
      name: '-',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> - <number> | -<number>',
      description: 'Subtracts, or negates.',
    },
    {
      name: '*',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> * <number>',
      description:
        'Multiplies. A product over 32767 answers *** >32767 ERR rather than wrapping.',
    },
    {
      name: '/',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> / <number>',
      description:
        'Divides, truncating towards zero: 7/2 is 3. There are no fractions to keep, so a calculation that needs one is rescaled - work in tenths and divide at the end.',
    },
    {
      name: '=',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> = <number> | <string> = <string>',
      description:
        'Equal, and also the assignment in LET. A true comparison is 1 here, not the -1 of the Microsoft BASICs.',
    },
    {
      name: '#',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> # <number> | <string> # <string>',
      description:
        "Not equal, in this BASIC's own spelling. The one comparison a string takes besides =.",
    },
    {
      name: '<>',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> <> <number>',
      description:
        'Not equal, the familiar spelling. Stores a token of its own, distinct from #, and unlike # it does not compare strings.',
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
      name: 'AND',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> AND <number>',
      description:
        'Logical and: 1 when both operands are non-zero, 0 otherwise. Not bitwise - 5 AND 3 is 1, not 1 by coincidence of the bits.',
    },
    {
      name: 'MOD',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> MOD <number>',
      description:
        'The remainder after dividing. Exact, division here truncating rather than rounding.',
    },
    {
      name: 'NOT',
      kind: 'operator',
      domain: 'numeric',
      syntax: 'NOT <number>',
      description:
        'Logical not: 1 when the operand is zero, 0 otherwise. NOT 5 is 0, not the -6 a bitwise BASIC would give.',
    },
    {
      name: 'OR',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> OR <number>',
      description:
        'Logical or: 1 when either operand is non-zero, 0 otherwise. Not bitwise - 5 OR 3 is 1.',
    },
  ],
};

export const apple1Reference = withAbbreviations('apple1', apple1Table);
