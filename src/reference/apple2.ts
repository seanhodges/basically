// Reference table data for the Apple II Integer BASIC page.
// Seeded from the dialect's keyword table by scripts/gen-reference-scaffold.mts,
// then hand-enriched (typed <…> syntax + fuller descriptions). Edit by hand;
// the generator skips this file once it exists.
//
// Every row is a word in src/dialects/apple2/keywords.ts, which was read out of
// the interpreter's own syntax table in the shipped firmware, and every
// behaviour below was provoked at the machine's own > prompt on that firmware.
//
// Two BASICs pull at this page from opposite sides, and both of them get it
// wrong. Applesoft is the Apple II BASIC most readers have met - floating
// point, HGR, MID$, CHR$ - and none of it is here. The Apple 1's Integer BASIC
// is the same interpreter one revision earlier and is missing most of what this
// page documents: no graphics, no cursor addressing, no key poll, no LOAD or
// SAVE, and HIMEM=/LOMEM= where this machine writes HIMEM:/LOMEM:. What a
// reader arriving from either will trip over:
//
//  - RND(N) is a whole number from 0 to N-1, not a fraction;
//  - ^ works here and does nothing on the Apple 1;
//  - TAB is a statement, not a print formatter, and VTAB is its vertical half;
//  - LEN( and ASC( are the only string functions, and ASC( answers with bit 7
//    set because that is how the machine stores a character;
//  - AND, OR and NOT are logical rather than bitwise, and a true comparison is
//    1 rather than -1;
//  - there is no abbreviation of any kind, not even ? for PRINT.
import type { BasicReferenceTableData } from './types';
import { withAbbreviations } from './abbreviations';

const apple2Table: BasicReferenceTableData = {
  title: 'Apple II Integer BASIC',
  machines: ['Apple II'],
  placeholders: [{ id: 'slot', meaning: 'a peripheral slot, 0 to 7' }],
  entries: [
    {
      name: 'CALL',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'CALL <addr>',
      description:
        'Calls a machine-code routine, which returns with RTS. The address is signed decimal like every address here, so a firmware routine above 32767 is called with a negative number: CALL -936 is the monitor call that clears the screen.',
    },
    {
      name: 'COLOR=',
      kind: 'command',
      domain: 'colour',
      syntax: 'COLOR=<colour>',
      description:
        'Sets the colour PLOT, HLIN and VLIN draw in, 0 (black) to 15 (white). The number is taken modulo 16, so COLOR=19 draws in colour 3, and colours 5 and 10 are two bit patterns that beat to the same grey.',
    },
    {
      name: 'DIM',
      kind: 'command',
      domain: 'data',
      syntax: 'DIM <numvar>(<number>) | DIM <strvar>(<length>)',
      description:
        'Declares an array or a string, and both must be declared before they are touched at all - an undeclared subscript answers *** RANGE ERR. A numeric array is indexed from 0, so DIM A(3) holds four numbers; a string is a fixed buffer of at most 255 characters. There are no string arrays and nothing two-dimensional.',
    },
    {
      name: 'DSP',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'DSP <var>',
      description:
        'Watches one variable: every assignment to it prints the line number and the new value. NODSP stops the watch. No other BASIC here has it.',
    },
    {
      name: 'END',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'END',
      description:
        'Stops the program and returns to the > prompt. Every program needs one: falling off the last line reports *** NO END ERR.',
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
        'Calls a subroutine, which returns with RETURN. Sixteen levels deep; deeper answers *** 16 GOSUBS ERR.',
    },
    {
      name: 'GOTO',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'GOTO <line>',
      description:
        "Jumps to a line number. The target may be an expression, which is this BASIC's whole computed jump - there is no ON … GOTO.",
    },
    {
      name: 'GR',
      kind: 'command',
      domain: 'graphics',
      syntax: 'GR',
      description:
        'Switches on the lo-res screen and clears it to black: a 40 by 40 grid of coloured blocks with four lines of text under it. The page is really 40 by 48, and PLOT reaches the eight rows hidden behind the text window. TEXT switches back.',
    },
    {
      name: 'HLIN',
      kind: 'command',
      domain: 'graphics',
      syntax: 'HLIN <x>, <x> AT <y>',
      description:
        'Draws a horizontal run of lo-res blocks in the current colour, from the first column to the second inclusive, along row <y>.',
    },
    {
      name: 'AT',
      kind: 'command',
      domain: 'graphics',
      syntax: 'HLIN <x>, <x> AT <y> | VLIN <y>, <y> AT <x>',
      description:
        'Names the row HLIN draws along, or the column VLIN draws down. It belongs to those two statements and appears nowhere else - but it is still a keyword everywhere, so a variable called CAT is read as C, AT and a syntax error.',
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
      name: 'IN#',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'IN#<slot>',
      description:
        'Reads input from the card in a peripheral slot instead of from the keyboard; IN#0 gives the keyboard back. No cards are fitted to the emulated machine, so 0 is the only slot with anything on the other end of it.',
    },
    {
      name: 'INPUT',
      kind: 'command',
      domain: 'input',
      syntax: 'INPUT [<prompt>,] <var>[, <var>]…',
      description:
        'Prints the prompt, then a ?, and waits for a whole line to be typed. It is not the only way in: unlike the Apple 1, this machine can read the keyboard without stopping, with PEEK(-16384).',
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
      name: 'LIST',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'LIST [<line>[, <line>]]',
      description:
        'Lists the whole program, one line, or a range. Alone among the commands the interpreter takes at its prompt, it is also legal inside a numbered line, so a program can list itself as it runs.',
    },
    {
      name: 'NEXT',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'NEXT <numvar>[, <numvar>]…',
      description:
        'Closes a FOR loop and jumps back to it. The variable is not optional, unlike most BASICs of the period; several may be named at once, innermost first.',
    },
    {
      name: 'NODSP',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'NODSP <var>',
      description: 'Stops the DSP watch on one variable.',
    },
    {
      name: 'NOTRACE',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'NOTRACE',
      description: 'Stops TRACE printing line numbers.',
    },
    {
      name: 'PLOT',
      kind: 'command',
      domain: 'graphics',
      syntax: 'PLOT <x>, <y>',
      description:
        'Lights one lo-res block in the current colour. <x> runs 0 to 39 and <y> 0 to 47; outside that the program stops with *** RANGE ERR.',
    },
    {
      name: 'POKE',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'POKE <addr>, <byte>',
      description:
        'Stores a byte in memory. The address is signed decimal - there is no hexadecimal anywhere in this BASIC - so the keyboard strobe at $C010 is cleared with POKE -16368,0.',
    },
    {
      name: 'POP',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'POP',
      description:
        'Discards the innermost GOSUB return address, so the next RETURN goes back one level further out. How a subroutine leaves without returning to whoever called it.',
    },
    {
      name: 'PR#',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'PR#<slot>',
      description:
        'Sends everything PRINT writes to the card in a peripheral slot instead of to the screen; PR#0 gives the screen back. As with IN#, the emulated machine has no cards fitted.',
    },
    {
      name: 'PRINT',
      kind: 'command',
      domain: 'text-screen',
      syntax: 'PRINT [<expr>[;|,]]…',
      description:
        'Prints numbers and strings. A trailing ; holds the cursor where it is - which is how a program stops the screen scrolling - and a trailing , steps to the next eight-column tab zone.',
    },
    {
      name: 'REM',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'REM <comment>',
      description:
        'A comment, to the end of the line. The text is stored as typed, a byte a character, and comes back unchanged in a listing.',
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
        'The amount a FOR loop adds each time round. Negative counts down; there is no fractional step, this BASIC having no fractions.',
    },
    {
      name: 'TAB',
      kind: 'command',
      domain: 'text-screen',
      syntax: 'TAB <col>',
      description:
        "Moves the cursor to a column, counting from 1, on the row it is already on. A statement rather than a print formatter - the TAB( inside a PRINT is Applesoft's - and it moves back as readily as forward, so what is printed next overwrites what was there.",
    },
    {
      name: 'TEXT',
      kind: 'command',
      domain: 'graphics',
      syntax: 'TEXT',
      description:
        'Switches back from lo-res graphics to the full 40 by 24 text screen. It does not clear it; CALL -936 does that.',
    },
    {
      name: 'THEN',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'IF <number> THEN <line> | IF <number> THEN <statement>',
      description:
        'The consequent of an IF: a line number to jump to, or a statement to run. The two are different tokens to the interpreter, though nothing in a listing shows it.',
    },
    {
      name: 'TO',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'FOR <numvar> = <number> TO <number>',
      description:
        'The value a FOR loop counts to, inclusive. Also one of the seven words that end a variable name where they appear inside one, which is why TOTAL is a variable and XTOTAL is not.',
    },
    {
      name: 'TRACE',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'TRACE',
      description:
        "Prints each line number as the program reaches it, with a # in front, until NOTRACE. With DSP it is the whole of this machine's debugger.",
    },
    {
      name: 'VLIN',
      kind: 'command',
      domain: 'graphics',
      syntax: 'VLIN <y>, <y> AT <x>',
      description:
        'Draws a vertical run of lo-res blocks in the current colour, from the first row to the second inclusive, down column <x>.',
    },
    {
      name: 'VTAB',
      kind: 'command',
      domain: 'text-screen',
      syntax: 'VTAB <row>',
      description:
        'Moves the cursor to a row, 1 to 24; outside that the program stops with *** RANGE ERR. With TAB it addresses any cell on the screen, which is what lets text be redrawn in place.',
    },
    {
      name: 'AUTO',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'AUTO <line>[, <number>]',
      description:
        'Numbers lines for you as you type them, from the given line and in the given steps (10 by default). MAN cancels it. A prompt command: inside a numbered line it answers *** SYNTAX ERR.',
    },
    {
      name: 'CLR',
      kind: 'command',
      domain: 'data',
      syntax: 'CLR',
      description:
        'Discards every variable, array and string, leaving the program itself alone. A prompt command.',
    },
    {
      name: 'CON',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'CON',
      description:
        'Continues a program stopped by a break or an error, from where it stopped. A prompt command.',
    },
    {
      name: 'DEL',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'DEL <line>[, <line>]',
      description:
        'Deletes one line, or every line from the first to the second inclusive. A prompt command.',
    },
    {
      name: 'HIMEM:',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'HIMEM:<addr>',
      description:
        'Sets the top of the workspace, which is where the program text starts and grows down from. The cold start leaves it at the top of RAM, and since a constant stops at 32767 that address is typed HIMEM:-16384. The colon is part of the spelling; HIMEM= is the Apple 1. A prompt command.',
    },
    {
      name: 'LOAD',
      kind: 'command',
      domain: 'storage',
      syntax: 'LOAD',
      description:
        'Reads a program from cassette into the top of whatever workspace the machine already has. The tape carries no name and no bounds, so a HIMEM: is typed before the LOAD rather than after it. A prompt command.',
    },
    {
      name: 'LOMEM:',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'LOMEM:<addr>',
      description:
        'Sets the bottom of the workspace, where the variables start and grow up. The cold start leaves it at 2048, just above the text page, and lowering it claims the page of RAM a machine-code block would otherwise use. A prompt command.',
    },
    {
      name: 'MAN',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'MAN',
      description:
        'Cancels AUTO and hands the line numbering back to you. The Apple 1 spells the same command OFF. A prompt command.',
    },
    {
      name: 'NEW',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'NEW',
      description:
        'Erases the program and every variable with it. The Apple 1 spells the same command SCR. A prompt command.',
    },
    {
      name: 'RUN',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'RUN [<line>]',
      description:
        'Discards the variables and starts the program, at the given line or at the lowest one. A prompt command.',
    },
    {
      name: 'SAVE',
      kind: 'command',
      domain: 'storage',
      syntax: 'SAVE',
      description:
        'Writes the program to cassette as two records - its length, then its text - beeping once for each. A prompt command.',
    },
    {
      name: 'ABS',
      kind: 'function',
      domain: 'numeric',
      syntax: 'ABS(<number>)',
      description: 'The value without its sign.',
    },
    {
      name: 'ASC',
      kind: 'function',
      domain: 'strings',
      syntax: 'ASC(<string>)',
      description:
        'The code of a string\'s first character, with bit 7 already set - ASC("H") is 200, not 72 - because that is the form the machine stores characters in. It therefore compares directly with what PEEK(-16384) reads from the keyboard.',
    },
    {
      name: 'LEN',
      kind: 'function',
      domain: 'strings',
      syntax: 'LEN(<string>)',
      description:
        "How many characters a string holds. With ASC( it is the whole of this BASIC's string library: there is no MID$, LEFT$, RIGHT$, CHR$, STR$ or VAL, and no concatenation.",
    },
    {
      name: 'PDL',
      kind: 'function',
      domain: 'input',
      syntax: 'PDL(<number>)',
      description:
        'How far a paddle is turned, 0 to 255 with 128 at the centre. The game connector carries four of them, numbered 0 to 3; the on-screen controller drives 0 and 1 as the two axes of a stick.',
    },
    {
      name: 'PEEK',
      kind: 'function',
      domain: 'memory-hardware',
      syntax: 'PEEK(<addr>)',
      description:
        "The byte at an address, written in signed decimal: PEEK(-16384) is the keyboard latch, and a value over 127 there means a key is waiting. Reading one of the machine's soft switches throws it exactly as writing to it would.",
    },
    {
      name: 'RND',
      kind: 'function',
      domain: 'numeric',
      syntax: 'RND(<number>)',
      description:
        'A whole number from 0 up to one less than the argument, so RND(6) is 0 to 5. There is no fractional form: the RND(1) of Applesoft belongs to the other BASIC in these ROM sockets.',
    },
    {
      name: 'SCRN',
      kind: 'function',
      domain: 'graphics',
      syntax: 'SCRN(<x>, <y>)',
      description:
        'The colour of one lo-res block, 0 to 15. The only function here that takes two arguments, and it means a program can read its own picture back rather than keeping a map of it in an array.',
    },
    {
      name: 'SGN',
      kind: 'function',
      domain: 'numeric',
      syntax: 'SGN(<number>)',
      description: 'The sign of a number: -1, 0 or 1.',
    },
    {
      name: 'AND',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> AND <number>',
      description:
        'Logical and: 1 when both operands are non-zero, 0 otherwise. Not bitwise - 5 AND 3 is 1, not the 1 the bits would give by coincidence.',
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
      description:
        'Not equal, the familiar spelling. It stores a token of its own, distinct from #, and unlike # it does not compare strings.',
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
        'Divides, truncating towards zero: 7/2 is 3 and -7/2 is -3. There are no fractions to keep, so a calculation needing one is rescaled - work in tenths and divide at the end. Dividing by zero answers *** >32767 ERR.',
    },
    {
      name: '+',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> + <number> | +<number>',
      description:
        'Adds, or marks a positive number. Never joins strings: append by assigning past the end instead, as A$(LEN(A$)+1)="C".',
    },
    {
      name: '-',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> - <number> | -<number>',
      description: 'Subtracts, or negates.',
    },
    {
      name: '^',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> ^ <number>',
      description:
        'Raises to a power: 2^10 is 1024. The Apple 1 has a token for it and no working code behind that token; here it runs.',
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
        "Not equal, in this BASIC's own spelling. With = it is the whole of what a string comparison can be.",
    },
    {
      name: '<',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> < <number>',
      description:
        'Less than. Numbers only: strings have no ordering here, so IF A$<B$ is a syntax error.',
    },
    {
      name: '>',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> > <number>',
      description: 'Greater than.',
    },
  ],
};

export const apple2Reference = withAbbreviations('apple2', apple2Table);
