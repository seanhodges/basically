// Reference table data for the Applesoft BASIC page.
// Seeded from the dialect's keyword table by scripts/gen-reference-scaffold.mts,
// then hand-enriched (typed <…> syntax + fuller descriptions). Edit by hand;
// the generator skips this file once it exists.
//
// Every row is a word in src/dialects/apple2plus/keywords.ts, which was walked
// out of the token table at $D0D0 in the shipped firmware, and every behaviour
// below was provoked on that firmware - typed at the ] prompt, or loaded and
// run - rather than read out of a manual.
//
// The page the reader most likely came from is the Apple II's, one machine
// over: the same board with Woz's Integer BASIC in its ROM sockets instead of
// this. The two share more than a dozen spellings and not one token, which is
// why they cannot share a page. What a reader arriving from there will trip
// over:
//
//  - there is floating point here, so 7/2 is 3.5 rather than 3, and STEP may
//    be fractional;
//  - RND(N) is a fraction below 1, not a whole number from 0 to N-1;
//  - ASC( answers plain ASCII rather than the bit-7 form, so a key read from
//    the latch is compared against ASC("A")+128;
//  - strings are joined with + and sliced with LEFT$, RIGHT$ and MID$; there
//    is no assigning into the middle of one;
//  - HGR, HPLOT, DRAW and the shape table are here, and hi-res is reachable
//    from BASIC rather than only through CALL;
//  - a report is ?SYNTAX ERROR IN 10 rather than *** SYNTAX ERR;
//  - ? is PRINT, which that machine has no abbreviation for at all;
//  - and AT is matched ahead of ATN and THEN wherever those letters fall, so
//    IF A THEN 20 is broken here and IF A<>0 THEN 20 is not.
import type { BasicReferenceTableData } from './types';
import { withAbbreviations } from './abbreviations';

const applesoftTable: BasicReferenceTableData = {
  title: 'Applesoft BASIC',
  machines: ['Apple II Plus'],
  placeholders: [
    { id: 'slot', meaning: 'a peripheral slot, 0 to 7' },
    { id: 'shape', meaning: 'a shape in the shape table, by number' },
    { id: 'array', meaning: 'an array, named without a subscript' },
  ],
  entries: [
    {
      name: 'END',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'END',
      description:
        "Stops the program and returns to the ] prompt. Optional, unlike the Apple II's Integer BASIC: falling off the last line stops just as quietly.",
    },
    {
      name: 'FOR',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'FOR <numvar> = <number> TO <number> [STEP <number>]',
      description:
        'Opens a counting loop that runs to the matching NEXT. The limit and the step may both be fractional, and the variable keeps counting past the limit - after FOR I=1 TO 3 ... NEXT I it holds 4.',
    },
    {
      name: 'NEXT',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'NEXT [<numvar>[, <numvar>]…]',
      description:
        'Closes a FOR loop and jumps back to it. The variable may be left out, which closes the innermost open loop; naming several closes them innermost first.',
    },
    {
      name: 'DATA',
      kind: 'command',
      domain: 'data',
      syntax: 'DATA <constant>[, <constant>]…',
      description:
        'Constants for READ to walk, in program order. The rest of the statement is stored as typed rather than crunched, so spaces inside a DATA survive; a string needs quotes only where it contains a comma, a colon or a leading space.',
    },
    {
      name: 'INPUT',
      kind: 'command',
      domain: 'input',
      syntax: 'INPUT [<prompt>;] <var>[, <var>]…',
      description:
        'Prints the prompt, then a ?, and waits for a whole line to be typed. The prompt is a quoted literal followed by a semicolon - a comma there is a syntax error - and a value of the wrong type answers ?REENTER and asks for the line again.',
    },
    {
      name: 'DEL',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'DEL <line>, <line>',
      description:
        'Deletes every line from the first to the second inclusive. Both are required: one line is deleted with DEL 100,100, or by typing its number on its own.',
    },
    {
      name: 'DIM',
      kind: 'command',
      domain: 'data',
      syntax: 'DIM <var>(<number>[, <number>]…)',
      description:
        'Declares an array, of any number of dimensions and of either type. Subscripts count from 0, so DIM A(3) holds four elements. A DIM is only needed past ten - an array used without one is created with subscripts 0 to 10.',
    },
    {
      name: 'READ',
      kind: 'command',
      domain: 'data',
      syntax: 'READ <var>[, <var>]…',
      description:
        'Takes the next constant from the DATA statements. Reading past the last one is ?OUT OF DATA ERROR; RESTORE rewinds to the first.',
    },
    {
      name: 'GR',
      kind: 'command',
      domain: 'graphics',
      syntax: 'GR',
      description:
        'Switches on the lo-res screen and clears it to black: a 40 by 40 grid of coloured blocks with four lines of text under it. The page is really 40 by 48, and PLOT reaches the eight rows behind that text window. TEXT switches back.',
    },
    {
      name: 'TEXT',
      kind: 'command',
      domain: 'graphics',
      syntax: 'TEXT',
      description:
        'Returns to the full 40 by 24 text screen from either graphics mode and gives the text window the whole screen back. It does not clear what is there; HOME does.',
    },
    {
      name: 'PR#',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'PR#<slot>',
      description:
        'Sends everything PRINT writes to the card in a peripheral slot instead of to the screen; PR#0 gives the screen back. No cards are fitted to the emulated machine, so 0 is the only slot with anything behind it.',
    },
    {
      name: 'IN#',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'IN#<slot>',
      description:
        'Reads input from the card in a peripheral slot instead of from the keyboard; IN#0 gives the keyboard back. As with PR#, the emulated machine has no cards fitted.',
    },
    {
      name: 'CALL',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'CALL <addr>',
      description:
        'Calls a machine-code routine, which returns with RTS. An address above 32767 may be written negative, so the monitor routine that clears the screen is CALL -936.',
    },
    {
      name: 'PLOT',
      kind: 'command',
      domain: 'graphics',
      syntax: 'PLOT <x>, <y>',
      description:
        'Lights one lo-res block in the colour COLOR= set. <x> runs 0 to 39 and <y> 0 to 47; outside that stops the program with ?ILLEGAL QUANTITY ERROR.',
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
      name: 'VLIN',
      kind: 'command',
      domain: 'graphics',
      syntax: 'VLIN <y>, <y> AT <x>',
      description:
        'Draws a vertical run of lo-res blocks in the current colour, from the first row to the second inclusive, down column <x>.',
    },
    {
      name: 'HGR2',
      kind: 'command',
      domain: 'graphics',
      syntax: 'HGR2',
      description:
        'Switches on hi-res page 2 and clears it to black - the whole 280 by 192 raster, with no text window under it, so nothing a program prints can be seen while it is up.',
    },
    {
      name: 'HGR',
      kind: 'command',
      domain: 'graphics',
      syntax: 'HGR',
      description:
        'Switches on hi-res page 1 and clears it to black: 280 by 160 with four lines of text under it. HPLOT still reaches the 32 rows behind that window. Both hi-res pages are ordinary RAM above the program, so a program long enough to reach 8192 has its own text cleared out from under it.',
    },
    {
      name: 'HCOLOR=',
      kind: 'command',
      domain: 'colour',
      syntax: 'HCOLOR=<colour>',
      description:
        'Sets the colour HPLOT, DRAW and XDRAW draw in, 0 to 7. On the real machine those are artefacts of how the dots beat against the colour subcarrier rather than a palette; the hi-res screen is drawn here in monochrome, so what changes is whether a dot is set.',
    },
    {
      name: 'HPLOT',
      kind: 'command',
      domain: 'graphics',
      syntax: 'HPLOT <x>, <y>[ TO <x>, <y>]… | HPLOT TO <x>, <y>',
      description:
        'Draws in hi-res: one dot, or a line to each point in turn. The second form continues from wherever the last plot left off, which is how a shape is drawn without repeating its corners. <x> runs 0 to 279 and <y> 0 to 191.',
    },
    {
      name: 'DRAW',
      kind: 'command',
      domain: 'graphics',
      syntax: 'DRAW <shape> [AT <x>, <y>]',
      description:
        "Draws a shape from the shape table in the current HCOLOR=, ROT= and SCALE=, at the given point or from where the last plot left off. The table's address goes in locations 232 and 233 before the first DRAW.",
    },
    {
      name: 'XDRAW',
      kind: 'command',
      domain: 'graphics',
      syntax: 'XDRAW <shape> [AT <x>, <y>]',
      description:
        'Draws a shape by inverting every dot it covers instead of setting it, so drawing the same shape twice in the same place leaves the screen exactly as it was. That is how a moving shape is erased without keeping a copy of the background.',
    },
    {
      name: 'HTAB',
      kind: 'command',
      domain: 'text-screen',
      syntax: 'HTAB <col>',
      description:
        'Moves the cursor to a column, 1 to 40, on the row it is already on. Unlike TAB( it moves backwards as readily as forwards, so what is printed next overwrites what was there.',
    },
    {
      name: 'HOME',
      kind: 'command',
      domain: 'text-screen',
      syntax: 'HOME',
      description:
        'Clears the text window and puts the cursor at its top left. The window rather than the screen: after a TEXT the two are the same, but a program that has narrowed the window by poking locations 32 to 35 clears only what it narrowed to.',
    },
    {
      name: 'ROT=',
      kind: 'command',
      domain: 'graphics',
      syntax: 'ROT=<number>',
      description:
        'Sets the rotation DRAW and XDRAW apply to a shape, 0 to 63, with 0 upright and 16 a quarter turn clockwise. At SCALE=1 the shape is too coarse for most of the 64 to change anything.',
    },
    {
      name: 'SCALE=',
      kind: 'command',
      domain: 'graphics',
      syntax: 'SCALE=<number>',
      description:
        'Sets the size DRAW and XDRAW draw a shape at, 1 to 255, where each unit is one screen dot per step in the shape table. 0 means 256.',
    },
    {
      name: 'SHLOAD',
      kind: 'command',
      domain: 'storage',
      syntax: 'SHLOAD',
      description:
        'Reads a shape table from cassette, places it below HIMEM: and points locations 232 and 233 at it. There is no cassette wired to the emulated machine, so a shape table reaches a program here as a memory block instead.',
    },
    {
      name: 'TRACE',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'TRACE',
      description:
        'Prints each line number as the program reaches it, as #10, #20, before the line runs. It survives a NEW; NOTRACE stops it.',
    },
    {
      name: 'NOTRACE',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'NOTRACE',
      description: 'Stops TRACE printing line numbers.',
    },
    {
      name: 'NORMAL',
      kind: 'command',
      domain: 'text-screen',
      syntax: 'NORMAL',
      description:
        'Prints in normal video from here on, undoing INVERSE or FLASH.',
    },
    {
      name: 'INVERSE',
      kind: 'command',
      domain: 'text-screen',
      syntax: 'INVERSE',
      description:
        'Prints in inverse video - black on white - from here on. It masks what PRINT writes rather than changing what is already on the screen.',
    },
    {
      name: 'FLASH',
      kind: 'command',
      domain: 'text-screen',
      syntax: 'FLASH',
      description:
        'Prints in flashing video from here on, alternating between normal and inverse about four times a second. The video counter does the flashing, so it costs the program nothing to leave text on screen.',
    },
    {
      name: 'COLOR=',
      kind: 'command',
      domain: 'colour',
      syntax: 'COLOR=<colour>',
      description:
        'Sets the colour PLOT, HLIN and VLIN draw in, from 0 black to 15 white. The number is taken modulo 16, so COLOR=19 draws in colour 3.',
    },
    {
      name: 'POP',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'POP',
      description:
        'Forgets the innermost GOSUB return address, so the next RETURN goes back a level further. It turns a subroutine into a jump after the fact.',
    },
    {
      name: 'VTAB',
      kind: 'command',
      domain: 'text-screen',
      syntax: 'VTAB <row>',
      description:
        'Moves the cursor to a row, 1 to 24, in the column it is already in. With HTAB it addresses any cell on the screen.',
    },
    {
      name: 'HIMEM:',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'HIMEM:<addr>',
      description:
        'Sets the top of the memory Applesoft will use, which is the address the string space fills down from. Lowering it is how RAM is set aside for machine code or a shape table. The colon is part of the spelling.',
    },
    {
      name: 'LOMEM:',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'LOMEM:<addr>',
      description:
        'Sets the bottom of the variables, which otherwise sit directly above the program. Raising it clears space between the two - and erases every variable in doing so.',
    },
    {
      name: 'ONERR',
      kind: 'command',
      domain: 'error-handling',
      syntax: 'ONERR GOTO <line>',
      description:
        'Traps every error from here on and jumps to a line instead of stopping. The code of the error that fired is in location 222 and the line it happened on in 218 and 219, so a handler can tell an ?OUT OF DATA ERROR from a ?TYPE MISMATCH ERROR.',
    },
    {
      name: 'RESUME',
      kind: 'command',
      domain: 'error-handling',
      syntax: 'RESUME',
      description:
        'Returns from an ONERR handler to the statement that raised the error and runs it again - so a handler that has not fixed the cause loops for ever.',
    },
    {
      name: 'RECALL',
      kind: 'command',
      domain: 'storage',
      syntax: 'RECALL <array>',
      description:
        'Reads an array back from cassette, element by element, into an array of the same name. There is no cassette wired to the emulated machine.',
    },
    {
      name: 'STORE',
      kind: 'command',
      domain: 'storage',
      syntax: 'STORE <array>',
      description:
        'Writes a whole array to cassette. As with RECALL there is no cassette here; the Transfer dialog is how data leaves this IDE.',
    },
    {
      name: 'SPEED=',
      kind: 'command',
      domain: 'text-screen',
      syntax: 'SPEED=<number>',
      description:
        "Sets how fast characters are printed, 0 slowest and 255 full speed. It is a delay between characters rather than a screen setting, so it slows a listing as readily as a program's own output.",
    },
    {
      name: 'LET',
      kind: 'command',
      domain: 'data',
      syntax: 'LET <var> = <expr>',
      description:
        'Assigns a value. Optional, as on every BASIC here: LET A=1 and A=1 differ by the one token and nothing else.',
    },
    {
      name: 'GOTO',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'GOTO <line>',
      description:
        'Jumps to a line number, which must be a literal. There is no computed GOTO - GOTO A reads no digits at all and looks for line 0 - and ON ... GOTO is what replaces it.',
    },
    {
      name: 'RUN',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'RUN [<line>]',
      description:
        'Clears the variables and starts the program, at the given line or at the lowest one. Legal inside a program too, where it restarts it.',
    },
    {
      name: 'IF',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'IF <number> THEN <line> | IF <number> THEN <statement>',
      description:
        'Runs the consequent when the condition is non-zero; there is no ELSE. Everything after THEN belongs to the IF, so a false condition skips the rest of the line. Write the condition as a comparison: IF A THEN 20 is stored as IF, the AT token and HEN20, because the token scan reaches AT long before THEN. IF A<>0 THEN 20 is the way to say it.',
    },
    {
      name: 'RESTORE',
      kind: 'command',
      domain: 'data',
      syntax: 'RESTORE',
      description:
        'Rewinds READ to the first DATA statement in the program. There is no way to rewind to a particular one.',
    },
    {
      name: '&',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: '& <statement>',
      description:
        'Hands the rest of the statement to the machine-code routine vectored at location 1013, which is where an add-on language or toolkit hooks itself into the interpreter. Nothing is vectored there on a stock machine, so an & with no routine behind it drops into the monitor.',
    },
    {
      name: 'GOSUB',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'GOSUB <line>',
      description:
        'Calls a subroutine, which returns with RETURN. Twenty-four levels deep: the twenty-fifth answers ?OUT OF MEMORY ERROR, the 6502 stack rather than the workspace being what runs out.',
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
      name: 'REM',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'REM <comment>',
      description:
        'A comment, to the end of the line. The text is stored as typed - spaces and all, which nothing else on a line survives - and comes back unchanged in a listing.',
    },
    {
      name: 'STOP',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'STOP',
      description:
        'Stops the program and reports BREAK IN <line>, naming the line it stopped on. CONT carries on from there.',
    },
    {
      name: 'ON',
      kind: 'command',
      domain: 'control-flow',
      syntax:
        'ON <number> GOTO <line>[, <line>]… | ON <number> GOSUB <line>[, <line>]…',
      description:
        'Branches to the first line for 1, the second for 2 and so on. A value of 0, or one past the end of the list, falls through to the next statement; a negative one is ?ILLEGAL QUANTITY ERROR.',
    },
    {
      name: 'WAIT',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'WAIT <addr>, <mask>[, <byte>]',
      description:
        'Spins until a location changes: it reads the address, exclusive-ORs with the third argument (0 where it is left out), ANDs with the mask, and returns when the result is non-zero. Nothing else runs while it waits, and no key interrupts it.',
    },
    {
      name: 'LOAD',
      kind: 'command',
      domain: 'storage',
      syntax: 'LOAD',
      description:
        'Reads a program from cassette. The tape carries no name, so what loads is whatever comes next on it. There is no cassette wired to the emulated machine; a program arrives in this IDE through the Transfer dialog instead.',
    },
    {
      name: 'SAVE',
      kind: 'command',
      domain: 'storage',
      syntax: 'SAVE',
      description:
        'Writes the program to cassette as two records, beeping once for each: a three-byte header giving the length, then the program text. There is no cassette wired to the emulated machine, but the Transfer dialog writes the same two records as audio.',
    },
    {
      name: 'DEF',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'DEF FN <name>(<param>) = <number>',
      description:
        'Defines a one-expression function of one numeric argument. The parameter is an ordinary variable and is left holding the last value passed to it. Numeric only: there is no string function to define.',
    },
    {
      name: 'POKE',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'POKE <addr>, <byte>',
      description:
        'Stores a byte in memory. An address above 32767 may be written negative, so the keyboard strobe at 49168 is cleared with POKE -16368,0.',
    },
    {
      name: 'PRINT',
      kind: 'command',
      domain: 'text-screen',
      syntax: 'PRINT [<expr>[;|,]]…',
      description:
        "Prints numbers and strings. A trailing ; holds the cursor where it is and a trailing , steps to the next 16-column tab zone. A number is shown to nine significant digits with no leading zero, so a half prints as .5. Can be typed ?, which is this machine's whole abbreviation scheme.",
    },
    {
      name: 'CONT',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'CONT',
      description:
        "Carries on from a STOP or a BREAK, at the statement after the one that stopped. Editing any line in between makes it ?CAN'T CONTINUE ERROR.",
    },
    {
      name: 'LIST',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'LIST [<line>[, <line>]]',
      description:
        'Lists the whole program, one line, or a range. The listing puts its own spacing back around every token, because the interpreter threw the original spacing away when it stored the line - which is why a listed program never looks quite like the one that was typed.',
    },
    {
      name: 'CLEAR',
      kind: 'command',
      domain: 'data',
      syntax: 'CLEAR',
      description:
        'Forgets every variable, array and string, and closes every open FOR and GOSUB. The program itself is untouched.',
    },
    {
      name: 'GET',
      kind: 'command',
      domain: 'input',
      syntax: 'GET <var>',
      description:
        'Waits for a single keypress and stores it, without echoing it and without waiting for RETURN. No cursor appears while it waits, so a program that wants one draws it.',
    },
    {
      name: 'NEW',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'NEW',
      description: 'Erases the program and every variable with it.',
    },
    {
      name: 'TAB(',
      kind: 'function',
      domain: 'text-screen',
      syntax: 'TAB(<col>)',
      description:
        'Inside a PRINT, moves the cursor to a column, counting from 1. It only ever moves forward: a column left of where the cursor already is does nothing at all.',
    },
    {
      name: 'TO',
      kind: 'operator',
      domain: 'control-flow',
      syntax: 'FOR <numvar> = <number> TO <number>',
      description:
        "The value a FOR loop counts to, inclusive, and the joiner between two points in HPLOT. It is half of this machine's most famous trap: AT is matched before TO can be, so the interpreter reads the raw character after the match to decide between them - A TO B comes out as A, TO and B, while A T O B comes out as AT, O and B.",
    },
    {
      name: 'FN',
      kind: 'function',
      domain: 'control-flow',
      syntax: 'FN<name>(<arg>)',
      description:
        "Calls a function defined by DEF FN. The definition has to have run before the call: a name that has not been defined is ?UNDEF'D FUNCTION ERROR.",
    },
    {
      name: 'SPC(',
      kind: 'function',
      domain: 'text-screen',
      syntax: 'SPC(<number>)',
      description:
        'Inside a PRINT, prints that many spaces. Unlike TAB( it is relative, so it always moves.',
    },
    {
      name: 'THEN',
      kind: 'operator',
      domain: 'control-flow',
      syntax: 'IF <number> THEN <line> | IF <number> THEN <statement>',
      description:
        'The consequent of an IF: a line number to jump to, or a statement to run. A bare variable in front of it is the trap - IF A THEN 20 stores as IF, the AT token and HEN20, the scan having taken the A and the T of THEN as an AT. A comparison keeps the two apart.',
    },
    {
      name: 'AT',
      kind: 'operator',
      domain: 'graphics',
      syntax: 'HLIN <x>, <x> AT <y> | VLIN <y>, <y> AT <x>',
      description:
        'Names the row HLIN draws along or the column VLIN draws down, and the point DRAW and XDRAW put a shape at. It is also matched ahead of ATN and THEN wherever those two letters fall in a name, so LATCH=1 stores as L, AT and CH and CATALOG as C, AT, A and LOG - no variable here may contain a keyword.',
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
      name: 'STEP',
      kind: 'operator',
      domain: 'control-flow',
      syntax: 'FOR <numvar> = <number> TO <number> STEP <number>',
      description:
        "The amount a FOR loop adds each time round. It may be negative, and it may be fractional - this BASIC has floating point where the Apple II's Integer BASIC has none.",
    },
    {
      name: '+',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> + <number> | <string> + <string>',
      description:
        'Adds, and joins two strings. A join longer than 255 characters is ?STRING TOO LONG ERROR.',
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
      description: 'Multiplies.',
    },
    {
      name: '/',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> / <number>',
      description:
        'Divides, keeping the fraction: 7/2 is 3.5. Dividing by zero stops the program with ?DIVISION BY ZERO ERROR.',
    },
    {
      name: '^',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> ^ <number>',
      description:
        'Raises to a power, by way of the logarithm, so 2^.5 answers 1.41421356 rather than an error.',
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
      name: 'OR',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> OR <number>',
      description:
        'Logical or: 1 when either operand is non-zero, 0 otherwise. Not bitwise - 5 OR 3 is 1, not 7.',
    },
    {
      name: '>',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> > <number> | <string> > <string>',
      description:
        "Greater than. Strings compare too, character by character in the machine's own code order, which is what the Apple II's Integer BASIC cannot do at all.",
    },
    {
      name: '=',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> = <number> | <string> = <string>',
      description:
        'Equal, and also the assignment in LET. A true comparison here is 1 rather than the -1 most Microsoft BASICs answer with.',
    },
    {
      name: '<',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> < <number> | <string> < <string>',
      description: 'Less than.',
    },
    {
      name: 'SGN',
      kind: 'function',
      domain: 'numeric',
      syntax: 'SGN(<number>)',
      description: '-1, 0 or 1, by the sign of the argument.',
    },
    {
      name: 'INT',
      kind: 'function',
      domain: 'numeric',
      syntax: 'INT(<number>)',
      description:
        'Rounds down, towards minus infinity rather than towards zero: INT(-1.5) is -2.',
    },
    {
      name: 'ABS',
      kind: 'function',
      domain: 'numeric',
      syntax: 'ABS(<number>)',
      description: 'The argument without its sign.',
    },
    {
      name: 'USR',
      kind: 'function',
      domain: 'memory-hardware',
      syntax: 'USR(<number>)',
      description:
        'Calls the machine-code routine jumped to from location 10, with the argument in the floating-point accumulator, and answers with whatever the routine leaves there. Nothing is vectored there on a stock machine, so a JMP has to be poked into 10, 11 and 12 first.',
    },
    {
      name: 'FRE',
      kind: 'function',
      domain: 'memory-hardware',
      syntax: 'FRE(<number>)',
      description:
        'Free bytes, after collecting the string space - which is the real reason to call it, the collection being what reclaims strings the program has discarded. The count is signed 16-bit, so above 32767 it comes back negative and the true figure is FRE(0)+65536. The argument is ignored.',
    },
    {
      name: 'SCRN(',
      kind: 'function',
      domain: 'graphics',
      syntax: 'SCRN(<x>, <y>)',
      description:
        'The colour of one lo-res block, 0 to 15, so a program can read its own picture back rather than keeping a copy of it in an array.',
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
      name: 'POS',
      kind: 'function',
      domain: 'text-screen',
      syntax: 'POS(<number>)',
      description:
        'The column the cursor is in, counting from 0 - one less than the HTAB that would put it there. The argument is ignored.',
    },
    {
      name: 'SQR',
      kind: 'function',
      domain: 'numeric',
      syntax: 'SQR(<number>)',
      description:
        'Square root. A negative argument is ?ILLEGAL QUANTITY ERROR.',
    },
    {
      name: 'RND',
      kind: 'function',
      domain: 'numeric',
      syntax: 'RND(<number>)',
      description:
        'A random fraction from 0 up to but not including 1. A positive argument gives the next number in the sequence, 0 repeats the last one, and a negative one seeds the sequence - the same negative value always starts the same run.',
    },
    {
      name: 'LOG',
      kind: 'function',
      domain: 'numeric',
      syntax: 'LOG(<number>)',
      description:
        'Natural logarithm. Zero or a negative argument is ?ILLEGAL QUANTITY ERROR.',
    },
    {
      name: 'EXP',
      kind: 'function',
      domain: 'numeric',
      syntax: 'EXP(<number>)',
      description: 'e raised to the power of the argument.',
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
      description:
        'Arc tangent, in radians. It is reached only where the raw character after the AT match is an N, which is why ATN( works and AT N( does not.',
    },
    {
      name: 'PEEK',
      kind: 'function',
      domain: 'memory-hardware',
      syntax: 'PEEK(<addr>)',
      description:
        "The byte at an address, which may be written negative above 32767: PEEK(-16384) is the keyboard latch, and a value over 127 there means a key is waiting. Reading one of the machine's soft switches throws it exactly as writing to it would.",
    },
    {
      name: 'LEN',
      kind: 'function',
      domain: 'strings',
      syntax: 'LEN(<string>)',
      description: 'How many characters a string holds, 0 to 255.',
    },
    {
      name: 'STR$',
      kind: 'function',
      domain: 'strings',
      syntax: 'STR$(<number>)',
      description:
        'A number as the string PRINT would have shown, leading zero and all - which is to say without one, STR$(.5) being .5.',
    },
    {
      name: 'VAL',
      kind: 'function',
      domain: 'strings',
      syntax: 'VAL(<string>)',
      description:
        'A string read as a number, stopping at the first character that cannot be part of one: VAL("12X") is 12 and VAL("X") is 0.',
    },
    {
      name: 'ASC',
      kind: 'function',
      domain: 'strings',
      syntax: 'ASC(<string>)',
      description:
        'The code of a string\'s first character, 0 to 127 - plain ASCII, not the bit-7 form the Apple II\'s Integer BASIC answers with and not what the keyboard latch holds. A key read with PEEK(-16384) is compared against ASC("A")+128.',
    },
    {
      name: 'CHR$',
      kind: 'function',
      domain: 'strings',
      syntax: 'CHR$(<number>)',
      description:
        "The character with a given code, 0 to 255. Codes 128 to 255 draw the same characters as 0 to 127, that being the machine's own normal-video form, so CHR$(193) prints an A just as CHR$(65) does.",
    },
    {
      name: 'LEFT$',
      kind: 'function',
      domain: 'strings',
      syntax: 'LEFT$(<string>, <length>)',
      description: 'The first characters of a string.',
    },
    {
      name: 'RIGHT$',
      kind: 'function',
      domain: 'strings',
      syntax: 'RIGHT$(<string>, <length>)',
      description: 'The last characters of a string.',
    },
    {
      name: 'MID$',
      kind: 'function',
      domain: 'strings',
      syntax: 'MID$(<string>, <start>[, <length>])',
      description:
        "Characters from a position, counting from 1, either to the end of the string or for a given length. There is no assigning into the middle of a string as the Apple II's Integer BASIC does: a string here is built by joining with +.",
    },
    {
      name: '<=',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> <= <number> | <string> <= <string>',
      description:
        'Less than or equal. Two tokens rather than one, the < and the = stored in the order they were typed, which is why it lists back as A < = B.',
    },
    {
      name: '>=',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> >= <number> | <string> >= <string>',
      description:
        'Greater than or equal, stored as its two tokens in the order typed.',
    },
    {
      name: '<>',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> <> <number> | <string> <> <string>',
      description:
        'Not equal, stored as a < and a > and listed back as A < > B.',
    },
    {
      name: '=<',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> =< <number> | <string> =< <string>',
      description:
        'Less than or equal, written the other way round. The interpreter reads the pair rather than a spelling, so this and <= are one test.',
    },
    {
      name: '=>',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> => <number> | <string> => <string>',
      description:
        'Greater than or equal, written the other way round; the same test as >=.',
    },
    {
      name: '><',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> >< <number> | <string> >< <string>',
      description:
        'Not equal, written the other way round; the same test as <>.',
    },
  ],
};

export const applesoftReference = withAbbreviations(
  'applesoft',
  applesoftTable,
);
