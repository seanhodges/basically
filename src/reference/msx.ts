// Reference table data for the MSX BASIC page.
// Seeded from the dialect's keyword table by scripts/gen-reference-scaffold.mts,
// then hand-enriched (typed <…> syntax + fuller descriptions). Edit by hand;
// the generator skips this file once it exists.
//
// Every row is a word in src/dialects/hb10p/keywords.ts, read off the machine's
// own BASIC ROM; keyword-crosscheck.test.ts holds the two in exact agreement in
// both directions.
//
// MSX BASIC is Microsoft BASIC 4.5 with a machine bolted to it, so most of this
// table will read as familiar. What was checked against the running ROM rather
// than assumed, because the family instinct gets it wrong:
//
//  - GO TO written as two words is a syntax error here, unlike the Altair's;
//  - CINT truncates rather than rounds, and differs from FIX only in
//    overflowing past 32767;
//  - the disc vocabulary (FILES, KILL, NAME, COPY, SET, IPL, CMD, DSKI$,
//    DSKO$, DSKF, ATTR$, LFILES) is in the ROM of a machine with no drive, and
//    every one of them answers "Illegal function call";
//  - LPRINT and LLIST are not errors - they wait for a printer that never
//    answers, so a program reaching one stops until CTRL-STOP;
//  - MAXFILES is stored as the MAX token followed by the FILES one, which is
//    why the reference lists it under MAX.
import type { BasicReferenceTableData } from './types';
import { withAbbreviations } from './abbreviations';

const msxTable: BasicReferenceTableData = {
  title: 'MSX BASIC',
  machines: ['Sony HB-10P'],
  placeholders: [
    { id: 'hwreg', meaning: 'a hardware register, by number' },
    { id: 'plane', meaning: 'a sprite plane, 0 to 31' },
    { id: 'pattern', meaning: 'a sprite shape, by number' },
    { id: 'radius', meaning: 'the radius of a circle, in pixels' },
    { id: 'record', meaning: 'a record number in a random-access file' },
    { id: 'disc', meaning: 'a disc drive, by number' },
    { id: 'sector', meaning: 'a sector on a disc, by number' },
    { id: 'extension', meaning: 'the name of a cartridge or disc extension' },
  ],
  entries: [
    {
      name: 'END',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'END',
      description:
        'Stops the program and returns to Ok without printing a message. It is not final: MSX BASIC leaves the same resume point STOP does, so CONT carries on at the statement after it.',
    },
    {
      name: 'FOR',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'FOR <numvar> = <number> TO <number> [STEP <number>]',
      description:
        'Opens a counting loop that runs to the matching NEXT. STEP sets the increment, which may be negative or fractional; the limit is tested at NEXT, so the body always runs at least once.',
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
        'Inline constants for READ to consume in program order. The rest of the statement is stored exactly as typed, so a value holding a comma or a colon has to be quoted.',
    },
    {
      name: 'INPUT',
      kind: 'command',
      domain: 'input',
      syntax:
        'INPUT [<prompt>;] <var>[, <var>]… | INPUT #<file>, <var>[, <var>]…',
      description:
        'Prints the prompt (or a question mark when there is none) and waits for a whole line to be typed. With a file number it reads the next comma-separated fields from an open file instead.',
    },
    {
      name: 'DIM',
      kind: 'command',
      domain: 'data',
      syntax: 'DIM <var>(<number>[, <number>]…)',
      description:
        'Declares an array and its bounds. Subscripts start at 0, so DIM A(10) has eleven elements; an array used without DIM is created with bound 10, and DIMming it afterwards is a Redimensioned array error.',
    },
    {
      name: 'READ',
      kind: 'command',
      domain: 'data',
      syntax: 'READ <var>[, <var>]…',
      description:
        'Takes the next constant from the DATA statements, in program order. RESTORE winds the pointer back.',
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
        'Jumps to a line number. Unlike the Microsoft BASICs it descends from, MSX BASIC will not read GO TO as two words - the space is a syntax error.',
    },
    {
      name: 'RUN',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'RUN [<line>] | RUN <filename>[, R]',
      description:
        'Clears the variables and starts the program, at the line named when one is given. Given a filename it loads that program first, so RUN"CAS:GAME" is load-and-go from tape.',
    },
    {
      name: 'IF',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'IF <number> THEN <statement>|<line> [ELSE <statement>|<line>]',
      description:
        'Runs the consequent when the value is non-zero, and the ELSE part when it is zero. GOTO may stand in for THEN before a line number, and IFs may be nested along one line because each ELSE binds to the nearest IF.',
    },
    {
      name: 'RESTORE',
      kind: 'command',
      domain: 'data',
      syntax: 'RESTORE [<line>]',
      description:
        'Winds the DATA pointer back to the first constant in the program, or to the first in the line named.',
    },
    {
      name: 'GOSUB',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'GOSUB <line>',
      description:
        'Calls the subroutine at a line number; RETURN comes back to the statement after.',
    },
    {
      name: 'RETURN',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'RETURN [<line>]',
      description:
        'Returns from a subroutine to the statement after the GOSUB. A line number goes there instead and forgets the call, which is how an event trap hands control to a chosen place.',
    },
    {
      name: 'REM',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'REM <comment>',
      description:
        'A comment to the end of the line. An apostrophe is shorthand for it, stored as a REM behind a colon the listing hides, so it may follow another statement on the same line.',
    },
    {
      name: 'STOP',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'STOP',
      description:
        'Halts the program and reports Break in nn. CONT resumes at the following statement with every variable intact.',
    },
    {
      name: 'PRINT',
      kind: 'command',
      domain: 'text-screen',
      syntax: 'PRINT [<expr>][;|,]… | PRINT #<file>, <expr>',
      description:
        'Prints to the screen; a question mark is shorthand for it. A semicolon runs the next item straight on, a comma moves to the next 14-column zone, and a trailing separator holds the newline back. In SCREEN 2 and SCREEN 3 it draws nothing at all and raises no error - text on a graphics screen goes through the GRP: device.',
    },
    {
      name: 'CLEAR',
      kind: 'command',
      domain: 'data',
      syntax: 'CLEAR [<number>[, <addr>]]',
      description:
        'Discards every variable. The first argument resizes the string space, which is only 200 bytes on a clean boot; the second lowers the top of memory, which is how a program reserves room for a machine-code routine.',
    },
    {
      name: 'LIST',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'LIST [<line>][-<line>]',
      description:
        'Lists the program to the screen, all of it or the range given. The listing is regenerated from the tokens, so it comes back in the machine spelling rather than as it was typed.',
    },
    {
      name: 'NEW',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'NEW',
      description: 'Erases the program and every variable with it.',
    },
    {
      name: 'ON',
      kind: 'command',
      domain: 'control-flow',
      syntax:
        'ON <number> GOTO <line>[, <line>]… | ON <number> GOSUB <line>[, <line>]…',
      description:
        'Branches to the n-th line in the list (1 selects the first) and falls through when the value is 0 or past the end. ON ERROR GOTO sets an error handler, and ON KEY, ON SPRITE, ON STOP, ON STRIG and ON INTERVAL arm the event traps that call a subroutine when something happens.',
    },
    {
      name: 'WAIT',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'WAIT <port>, <mask>[, <mask>]',
      description:
        'Reads an input port until the value, exclusive-ORed with the second mask and ANDed with the first, is non-zero. The program stops there until it is, so a mask that can never match is a hang.',
    },
    {
      name: 'DEF',
      kind: 'command',
      domain: 'control-flow',
      syntax:
        'DEF FN<name>[(<param>[, <param>]…)] = <expr> | DEF USR[<number>] = <addr>',
      description:
        'Defines a single-expression function called through FN, or sets one of the ten USR entry points. DEF USR is how a BASIC program reaches machine code on this machine; CALL is not.',
    },
    {
      name: 'POKE',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'POKE <addr>, <byte>',
      description:
        'Writes a byte to processor memory, addressed in decimal or as &H hexadecimal. It cannot reach the picture: the screen lives in the video chip’s own 16K, which only VPOKE writes.',
    },
    {
      name: 'CONT',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'CONT',
      description:
        'Resumes a program stopped by STOP, END or CTRL-STOP, at the statement after. Editing any line makes that impossible and the answer is Can’t CONTINUE.',
    },
    {
      name: 'CSAVE',
      kind: 'command',
      domain: 'storage',
      syntax: 'CSAVE <filename>[, <number>]',
      description:
        'Saves the tokenized program to cassette under a name of up to six characters. The second argument is the speed - 1 for 1200 baud, 2 for 2400 - and 1200 is the default.',
    },
    {
      name: 'CLOAD',
      kind: 'command',
      domain: 'storage',
      syntax: 'CLOAD [<filename>]',
      description:
        'Loads a tokenized program from cassette, the first one found when no name is given. The machine works the speed out as it reads, so a tape does not have to say which it was written at.',
    },
    {
      name: 'OUT',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'OUT <port>, <byte>',
      description:
        'Writes a byte to a processor output port. The video chip is at ports &H98 and &H99 and the sound chip at &HA0 to &HA2, which is what VPOKE and SOUND are built on.',
    },
    {
      name: 'LPRINT',
      kind: 'command',
      domain: 'text-screen',
      syntax: 'LPRINT [<expr>][;|,]…',
      description:
        'Prints to the printer rather than the screen, taking the items PRINT does. No printer is fitted here and this is not an error: the machine waits for one that never answers, so a program reaching LPRINT stops until CTRL-STOP.',
    },
    {
      name: 'LLIST',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'LLIST [<line>][-<line>]',
      description:
        'Lists the program to the printer. As with LPRINT there is no printer here, so it waits rather than reporting anything.',
    },
    {
      name: 'CLS',
      kind: 'command',
      domain: 'text-screen',
      syntax: 'CLS',
      description:
        'Clears the screen and homes the cursor. In SCREEN 2 and SCREEN 3 it clears the picture as well as the text.',
    },
    {
      name: 'WIDTH',
      kind: 'command',
      domain: 'text-screen',
      syntax: 'WIDTH <number>',
      description:
        'Sets how many columns the text screen uses: up to 40 in SCREEN 0 and 32 in SCREEN 1. Neither starts at its maximum - this machine boots at 37 and 29 - so a program laying text out by column sets the width for itself.',
    },
    {
      name: 'ELSE',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'IF <number> THEN <statement>|<line> ELSE <statement>|<line>',
      description:
        'The alternative branch of an IF. It is stored behind a colon the listing hides, which is why it can open what looks like a fresh statement and still belong to the IF before it.',
    },
    {
      name: 'TRON',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'TRON',
      description:
        'Prints each line number in square brackets as the program reaches it.',
    },
    {
      name: 'TROFF',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'TROFF',
      description: 'Stops the line-number trace TRON started.',
    },
    {
      name: 'SWAP',
      kind: 'command',
      domain: 'data',
      syntax: 'SWAP <var>, <var>',
      description:
        'Exchanges the values of two variables. They must be the same type; mixing them is a Type mismatch.',
    },
    {
      name: 'ERASE',
      kind: 'command',
      domain: 'data',
      syntax: 'ERASE <var>[, <var>]…',
      description:
        'Discards an array and the memory it held, so it may be DIMmed again with different bounds.',
    },
    {
      name: 'ERROR',
      kind: 'command',
      domain: 'error-handling',
      syntax: 'ERROR <number>',
      description:
        'Raises the error with that code as though the interpreter had. Codes the machine does not use are free for a program’s own, and report Unprintable error when nothing traps them.',
    },
    {
      name: 'RESUME',
      kind: 'command',
      domain: 'error-handling',
      syntax: 'RESUME [<line>|0|NEXT]',
      description:
        'Returns from an ON ERROR handler: bare or 0 retries the statement that failed, NEXT carries on at the one after it, and a line number goes there. Outside a handler it is a RESUME without error.',
    },
    {
      name: 'DELETE',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'DELETE <line>[-<line>]',
      description: 'Removes a line, or a range of lines, from the program.',
    },
    {
      name: 'AUTO',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'AUTO [<line>[, <number>]]',
      description:
        'Numbers the lines as they are typed, from the line given and in the steps given; 10 and 10 when neither is. An asterisk beside the number warns that a line already exists there.',
    },
    {
      name: 'RENUM',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'RENUM [<line>[, <line>[, <number>]]]',
      description:
        'Renumbers the program and rewrites every GOTO, GOSUB, THEN and RESTORE to match: the new first number, the old line to start renumbering at, and the step.',
    },
    {
      name: 'DEFSTR',
      kind: 'command',
      domain: 'data',
      syntax: 'DEFSTR <letter>[-<letter>][, <letter>[-<letter>]]…',
      description:
        'Makes every variable whose name begins with one of those letters a string, unless the name carries a suffix of its own.',
    },
    {
      name: 'DEFINT',
      kind: 'command',
      domain: 'data',
      syntax: 'DEFINT <letter>[-<letter>][, <letter>[-<letter>]]…',
      description:
        'Makes every variable whose name begins with one of those letters a sixteen-bit integer. DEFINT A-Z at the top of a game is the usual first line: integer arithmetic is markedly faster than the double precision MSX BASIC otherwise uses.',
    },
    {
      name: 'DEFSNG',
      kind: 'command',
      domain: 'data',
      syntax: 'DEFSNG <letter>[-<letter>][, <letter>[-<letter>]]…',
      description:
        'Makes every variable whose name begins with one of those letters single precision, keeping six digits in four bytes.',
    },
    {
      name: 'DEFDBL',
      kind: 'command',
      domain: 'data',
      syntax: 'DEFDBL <letter>[-<letter>][, <letter>[-<letter>]]…',
      description:
        'Makes every variable whose name begins with one of those letters double precision, keeping fourteen digits in eight bytes. This is what MSX BASIC uses when nothing says otherwise.',
    },
    {
      name: 'LINE',
      kind: 'command',
      domain: 'graphics',
      syntax:
        'LINE [(<x>, <y>)]-(<x>, <y>)[, <colour>[, B|BF]] | LINE INPUT [<prompt>;] <strvar>',
      description:
        'Draws a straight line between two points, starting from the last point plotted when the first is left out; B draws the box with those two corners and BF fills it. The unrelated LINE INPUT reads a whole typed line, commas and all, into a string.',
    },
    {
      name: 'OPEN',
      kind: 'command',
      domain: 'storage',
      syntax:
        'OPEN <filename> [FOR INPUT | FOR OUTPUT | FOR APPEND] AS #<file>',
      description:
        'Opens a device or file on a number. The device prefix is what matters here: CAS: is the cassette, CRT: and LPT: the screen and the printer, and GRP: is how text is drawn on a graphics screen.',
    },
    {
      name: 'FIELD',
      kind: 'command',
      domain: 'storage',
      syntax: 'FIELD #<file>, <length> AS <strvar>[, <length> AS <strvar>]…',
      description:
        'Maps a random-access record buffer onto string variables. Random files need a disc, which this machine has none of, so it answers Illegal function call.',
    },
    {
      name: 'GET',
      kind: 'command',
      domain: 'storage',
      syntax: 'GET #<file>[, <record>]',
      description:
        'Reads a record of a random-access file into the buffer FIELD mapped. Disc only, so on this machine it reports Illegal function call.',
    },
    {
      name: 'PUT',
      kind: 'command',
      domain: 'graphics',
      syntax:
        'PUT SPRITE <plane>[, (<x>, <y>)][, <colour>][, <pattern>] | PUT #<file>[, <record>]',
      description:
        'PUT SPRITE places one of the 32 sprite planes at a point in a colour, showing the shape SPRITE$ defined for it; an argument left out keeps what the plane already had. The unrelated file form writes a random-access record and needs a disc.',
    },
    {
      name: 'CLOSE',
      kind: 'command',
      domain: 'storage',
      syntax: 'CLOSE [#<file>[, #<file>]…]',
      description:
        'Closes an open file, or every open file when none is named. A file written to tape is not finished until it is closed.',
    },
    {
      name: 'LOAD',
      kind: 'command',
      domain: 'storage',
      syntax: 'LOAD <filename>[, R]',
      description:
        'Loads a program from a device, tokenized or as an ASCII listing - the machine tells which from the first byte. R runs it as soon as it arrives, leaving any open files open.',
    },
    {
      name: 'MERGE',
      kind: 'command',
      domain: 'storage',
      syntax: 'MERGE <filename>',
      description:
        'Reads an ASCII listing into the program already in memory, each incoming line replacing one it collides with. A tokenized file cannot be merged; save it with the A option to get a listing.',
    },
    {
      name: 'FILES',
      kind: 'command',
      domain: 'storage',
      syntax: 'FILES [<filename>]',
      description:
        'Lists the files on a disc, matching a pattern when one is given. This machine has no drive, so it answers Illegal function call.',
    },
    {
      name: 'LSET',
      kind: 'command',
      domain: 'storage',
      syntax: 'LSET <strvar> = <string>',
      description:
        'Places a string into a FIELD buffer variable, left-justified and padded or cut to the field width. Disc only here.',
    },
    {
      name: 'RSET',
      kind: 'command',
      domain: 'storage',
      syntax: 'RSET <strvar> = <string>',
      description:
        'Places a string into a FIELD buffer variable, right-justified. Disc only here.',
    },
    {
      name: 'SAVE',
      kind: 'command',
      domain: 'storage',
      syntax: 'SAVE <filename>[, A]',
      description:
        'Saves the program to a device. A writes an ASCII listing instead of the tokenized program, which is what MERGE reads and what another machine’s BASIC has some chance of accepting.',
    },
    {
      name: 'LFILES',
      kind: 'command',
      domain: 'storage',
      syntax: 'LFILES [<filename>]',
      description:
        'The FILES listing sent to the printer. Disc only, so it answers Illegal function call here.',
    },
    {
      name: 'CIRCLE',
      kind: 'command',
      domain: 'graphics',
      syntax:
        'CIRCLE (<x>, <y>), <radius>[, <colour>[, <number>, <number>[, <number>]]]',
      description:
        'Draws a circle or an arc centred on the point. The two optional angles are radians measured anticlockwise from three o’clock, and the argument after them is the aspect ratio, which flattens the circle into an ellipse.',
    },
    {
      name: 'COLOR',
      kind: 'command',
      domain: 'colour',
      syntax: 'COLOR [<colour>][, <colour>][, <colour>]',
      description:
        'Sets the foreground, background and border colours from the fixed sixteen (0 transparent, 1 black, 15 white). In SCREEN 1 there is one pair for the whole screen, so a COLOR statement recolours every character already on it.',
    },
    {
      name: 'DRAW',
      kind: 'command',
      domain: 'graphics',
      syntax: 'DRAW <string>',
      description:
        'Draws from a macro string: U, D, L, R and E, F, G, H move and draw a distance in one of eight directions, M moves to a point, C sets the colour, S the scale and A a rotation in quarter turns, while B prefixed to a move draws nothing and N returns to where the move started.',
    },
    {
      name: 'PAINT',
      kind: 'command',
      domain: 'graphics',
      syntax: 'PAINT (<x>, <y>)[, <colour>]',
      description:
        'Fills the area around a point, stopping at pixels already that colour. It only fills what is enclosed, so a boundary with a one-pixel gap in it leaks into the rest of the screen.',
    },
    {
      name: 'BEEP',
      kind: 'command',
      domain: 'sound',
      syntax: 'BEEP',
      description:
        'The single click the machine makes on an error, played through the sound chip. Printing character 7 does exactly the same.',
    },
    {
      name: 'PLAY',
      kind: 'command',
      domain: 'sound',
      syntax: 'PLAY <string>[, <string>[, <string>]]',
      description:
        'Plays music macro strings, one per sound channel: A to G with # and - are notes, O sets the octave, L the note length, T the tempo, V the volume, S and M the envelope, and R rests. It returns at once and the music plays on underneath, so a game can start a sound and carry straight on.',
    },
    {
      name: 'PSET',
      kind: 'command',
      domain: 'graphics',
      syntax: 'PSET (<x>, <y>)[, <colour>]',
      description:
        'Plots a point - 256×192 in SCREEN 2, 64×48 in SCREEN 3, with the origin at the top left. It also fixes the position the GRP: device prints text at.',
    },
    {
      name: 'PRESET',
      kind: 'command',
      domain: 'graphics',
      syntax: 'PRESET (<x>, <y>)[, <colour>]',
      description:
        'Plots a point in the background colour, which is how a pixel is erased. Given a colour of its own it behaves exactly as PSET does.',
    },
    {
      name: 'SOUND',
      kind: 'command',
      domain: 'sound',
      syntax: 'SOUND <hwreg>, <byte>',
      description:
        'Writes a byte straight to a sound chip register: 0 to 5 are the three tone periods, 6 the noise period, 7 the mixer, 8 to 10 the channel volumes and 11 to 13 the envelope. The noise channel can be reached no other way.',
    },
    {
      name: 'SCREEN',
      kind: 'command',
      domain: 'graphics',
      syntax: 'SCREEN [<mode>][, <number>]',
      description:
        'Selects the display: 0 is 40×24 text, 1 is 32×24 text with colour, 2 is 256×192 graphics and 3 is 64×48 blocks. The second argument is the sprite size - 0 and 1 give 8×8, 2 and 3 give 16×16, and the odd numbers magnify - and three further arguments set the key click, the cassette speed and the printer type.',
    },
    {
      name: 'VPOKE',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'VPOKE <addr>, <byte>',
      description:
        'Writes a byte to video RAM - the video chip’s own 16K, a second address space POKE cannot reach. Writing the name table directly is how an MSX program puts characters on screen faster than LOCATE and PRINT can.',
    },
    {
      name: 'SPRITE',
      kind: 'command',
      domain: 'graphics',
      syntax: 'SPRITE$(<pattern>) = <string> | SPRITE ON | SPRITE OFF',
      description:
        'SPRITE$ defines a shape from eight bytes for an 8×8 sprite or thirty-two for a 16×16 one, which PUT SPRITE then places. The ON and OFF forms arm and disarm the collision trap ON SPRITE GOSUB sets, and SPRITE STOP holds it pending.',
    },
    {
      name: 'VDP',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'VDP(<hwreg>) | VDP(<hwreg>) = <byte>',
      description:
        'Reads or writes one of the video chip’s eight control registers. VDP(8) is the exception: it reads the status register, which carries the frame flag and the sprite collision and fifth-sprite bits.',
    },
    {
      name: 'BASE',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'BASE(<number>) | BASE(<number>) = <addr>',
      description:
        'Reads or moves one of the video chip’s tables in video RAM. The twenty numbers are five tables - name, colour, pattern, sprite attributes, sprite patterns - for each of the four screen modes in turn, so BASE(5) is SCREEN 1’s name table and BASE(10) SCREEN 2’s.',
    },
    {
      name: 'CALL',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'CALL <extension>[(<arg>[, <arg>]…)]',
      description:
        'Passes a statement to a cartridge or disc extension by name. It is not how machine code is run - that is DEF USR and USR - and with nothing fitted to answer, every name is a Syntax error.',
    },
    {
      name: 'TIME',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'TIME | TIME = <number>',
      description:
        'The interrupt counter, stepping once a frame - fifty times a second on this PAL machine - and wrapping at 65536. Assigning to it resets it, which is how a program times something without a clock.',
    },
    {
      name: 'KEY',
      kind: 'command',
      domain: 'input',
      syntax: 'KEY <number>, <string> | KEY LIST | KEY ON | KEY OFF',
      description:
        'Sets what one of the ten function keys types, lists them all, or shows and hides the strip along the bottom row. KEY OFF is usually the first thing a full-screen program does, since it gives that row back.',
    },
    {
      name: 'MAX',
      kind: 'command',
      domain: 'storage',
      syntax: 'MAXFILES = <number>',
      description:
        'Reserves that many file buffers, 0 to 15, and clears every variable as it does so. Each buffer costs a few hundred bytes, so MAXFILES=0 is how a program that opens nothing takes the room back. The statement is stored as the MAX token followed by the FILES one, which is why it is listed here under MAX.',
    },
    {
      name: 'MOTOR',
      kind: 'command',
      domain: 'storage',
      syntax: 'MOTOR | MOTOR ON | MOTOR OFF',
      description:
        'Turns the cassette motor on or off, or reverses whichever it was when neither word is given. No recorder is modelled here, so it is accepted and does nothing.',
    },
    {
      name: 'BLOAD',
      kind: 'command',
      domain: 'storage',
      syntax: 'BLOAD <filename>[, R][, <addr>]',
      description:
        'Loads a machine-code file saved by BSAVE back to the addresses it came from, or that far past them when an offset is given; R runs it afterwards. Code blocks attached to a document are placed for you, so a program here rarely needs it.',
    },
    {
      name: 'BSAVE',
      kind: 'command',
      domain: 'storage',
      syntax: 'BSAVE <filename>, <addr>, <addr>[, <addr>]',
      description:
        'Saves a range of memory as a binary file, its header carrying the start, the end and an optional entry address. A tape image holding one is reported on import rather than pasted into the editor as nonsense.',
    },
    {
      name: 'DSKO$',
      kind: 'command',
      domain: 'storage',
      syntax: 'DSKO$ <disc>, <sector>',
      description:
        'Writes a buffer out to a disc sector. This machine has no drive, so it answers Illegal function call.',
    },
    {
      name: 'SET',
      kind: 'command',
      domain: 'storage',
      syntax: 'SET PASSWORD <string>',
      description:
        'A disc option - the password a later SAVE writes. Illegal function call here, there being no drive.',
    },
    {
      name: 'NAME',
      kind: 'command',
      domain: 'storage',
      syntax: 'NAME <filename> AS <filename>',
      description:
        'Renames a file on disc. Illegal function call on a machine with no drive.',
    },
    {
      name: 'KILL',
      kind: 'command',
      domain: 'storage',
      syntax: 'KILL <filename>',
      description:
        'Deletes a file from disc. Illegal function call on a machine with no drive.',
    },
    {
      name: 'IPL',
      kind: 'command',
      domain: 'storage',
      syntax: 'IPL <string>',
      description:
        'Sets the command the machine runs at the next reset. It belongs to the disc ROM, so it answers Illegal function call here.',
    },
    {
      name: 'COPY',
      kind: 'command',
      domain: 'storage',
      syntax: 'COPY <filename> TO <filename>',
      description:
        'Copies a file from one device to another. Illegal function call without a disc interface.',
    },
    {
      name: 'CMD',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'CMD <extension>',
      description:
        'Hands a command to an extension ROM. Nothing here claims one, so it answers Illegal function call.',
    },
    {
      name: 'LOCATE',
      kind: 'command',
      domain: 'text-screen',
      syntax: 'LOCATE [<col>][, <row>][, <number>]',
      description:
        'Moves the text cursor. Both are counted from 0 and the column comes first, which is the other way round from most of this family. A third argument of 1 shows the cursor and 0 hides it.',
    },
    {
      name: 'TO',
      kind: 'operator',
      domain: 'control-flow',
      syntax: 'FOR <numvar> = <number> TO <number> [STEP <number>]',
      description:
        'The upper limit of a FOR loop, and the separator in COPY. Because keywords are recognised inside names, a variable may not contain it: TOTAL reads as TO followed by TAL.',
    },
    {
      name: 'THEN',
      kind: 'operator',
      domain: 'control-flow',
      syntax: 'IF <number> THEN <statement>|<line>',
      description:
        'Introduces what an IF does when its test succeeds. A bare line number after it is a jump, so THEN 100 and GOTO 100 are the same thing.',
    },
    {
      name: 'TAB(',
      kind: 'function',
      domain: 'text-screen',
      syntax: 'PRINT TAB(<col>)',
      description:
        'Inside PRINT, moves the print position to that column, counted from 0. It only moves forwards.',
    },
    {
      name: 'STEP',
      kind: 'operator',
      domain: 'control-flow',
      syntax: 'FOR <numvar> = <number> TO <number> STEP <number>',
      description:
        'The amount a FOR loop adds each time round, which may be negative or fractional. Without it the step is 1.',
    },
    {
      name: 'USR',
      kind: 'function',
      domain: 'memory-hardware',
      syntax: 'USR[<number>](<arg>)',
      description:
        'Calls the machine-code routine DEF USR set, passing one argument and returning whatever the routine leaves behind. The ten entry points are numbered 0 to 9, and a bare USR is USR0.',
    },
    {
      name: 'FN',
      kind: 'function',
      domain: 'control-flow',
      syntax: 'FN<name>[(<arg>[, <arg>]…)]',
      description:
        'Calls a function DEF FN defined. The name follows FN with no space, and the DEF must have run before the call.',
    },
    {
      name: 'SPC(',
      kind: 'function',
      domain: 'text-screen',
      syntax: 'PRINT SPC(<number>)',
      description:
        'Inside PRINT, emits that many spaces. Unlike TAB( it counts from wherever the print position already is.',
    },
    {
      name: 'NOT',
      kind: 'operator',
      domain: 'numeric',
      syntax: 'NOT <number>',
      description:
        'Flips every bit of a sixteen-bit signed integer, so NOT 0 is -1. A true comparison is -1 here, every bit set, which is what makes this a working logical negation too.',
    },
    {
      name: 'ERL',
      kind: 'function',
      domain: 'error-handling',
      syntax: 'ERL',
      description:
        'The number of the line the last error happened on, for an ON ERROR handler to report or branch on.',
    },
    {
      name: 'ERR',
      kind: 'function',
      domain: 'error-handling',
      syntax: 'ERR',
      description:
        'The code of the last error - the same number ERROR raises and the message table is indexed by.',
    },
    {
      name: 'STRING$',
      kind: 'function',
      domain: 'strings',
      syntax: 'STRING$(<length>, <expr>)',
      description:
        'A string of that many copies of a character, named either by its code or as the first character of a string.',
    },
    {
      name: 'USING',
      kind: 'operator',
      domain: 'text-screen',
      syntax: 'PRINT USING <string>; <expr>[; <expr>]…',
      description:
        'Formats output against a template: # is a digit position, . fixes the decimal point, a comma groups thousands, ** pads with asterisks, $$ floats a currency sign and ^^^^ selects exponent notation. For strings, ! takes the first character and a pair of backslashes makes a field as wide as the gap between them. The template repeats when there are more values than fields.',
    },
    {
      name: 'INSTR',
      kind: 'function',
      domain: 'strings',
      syntax: 'INSTR([<start>,] <string>, <string>)',
      description:
        'The position of the second string inside the first, counting from 1, or 0 when it is not there. The optional first argument says where to start looking.',
    },
    {
      name: 'VARPTR',
      kind: 'function',
      domain: 'memory-hardware',
      syntax: 'VARPTR(<var>)',
      description:
        'The address of a variable’s value: two bytes for an integer, a three-byte descriptor for a string, four or eight for a float. VARPTR(#n) gives the address of an open file’s control block instead.',
    },
    {
      name: 'CSRLIN',
      kind: 'function',
      domain: 'text-screen',
      syntax: 'CSRLIN',
      description:
        'The row the text cursor is on, counted from 0. POS gives the column.',
    },
    {
      name: 'ATTR$',
      kind: 'function',
      domain: 'storage',
      syntax: 'ATTR$',
      description:
        'The attributes of the last file a disc search found. Illegal function call on a machine with no drive.',
    },
    {
      name: 'DSKI$',
      kind: 'function',
      domain: 'storage',
      syntax: 'DSKI$(<disc>, <sector>)',
      description:
        'Reads a disc sector into a string. Illegal function call here.',
    },
    {
      name: 'OFF',
      kind: 'operator',
      domain: 'control-flow',
      syntax: 'KEY(<number>) OFF',
      description:
        'Disarms an event trap. It follows KEY(n), INTERVAL, SPRITE, STOP and STRIG(n), where ON arms the trap and STOP holds it pending until ON comes back. It is also the second word of KEY OFF and MOTOR OFF.',
    },
    {
      name: 'INKEY$',
      kind: 'function',
      domain: 'input',
      syntax: 'INKEY$',
      description:
        'One character from the keyboard buffer without waiting, or the empty string when there is none. It never blocks, which is what makes it the read a game loop uses.',
    },
    {
      name: 'POINT',
      kind: 'function',
      domain: 'graphics',
      syntax: 'POINT(<x>, <y>)',
      description:
        'The colour of a pixel in SCREEN 2 or SCREEN 3, or -1 when the point is off the screen.',
    },
    {
      name: '>',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> > <number> | <string> > <string>',
      description:
        'Greater than. Strings compare a character code at a time from the left, and a shorter string that matches as far as it goes is the smaller.',
    },
    {
      name: '=',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> = <number> | <string> = <string>',
      description:
        'Equal, and also the assignment in LET. Which of the two it is comes from where it stands, not from how it is written.',
    },
    {
      name: '<',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> < <number> | <string> < <string>',
      description: 'Less than.',
    },
    {
      name: '+',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> + <number> | <string> + <string>',
      description:
        'Adds numbers and joins strings. A joined string longer than 255 characters is a String too long.',
    },
    {
      name: '-',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> - <number> | -<number>',
      description: 'Subtracts, and negates.',
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
        'Divides, always producing a fractional value. The backslash is the integer division.',
    },
    {
      name: '^',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> ^ <number>',
      description:
        'Raises to a power. It folds left to right, so 2^3^2 is 64 rather than 512.',
    },
    {
      name: 'AND',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> AND <number>',
      description:
        'Combines two sixteen-bit integers a bit at a time, so 5 AND 3 is 1. A true comparison is -1, every bit set, which is why it also reads as a logical AND.',
    },
    {
      name: 'OR',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> OR <number>',
      description: 'Bitwise OR, so 5 OR 3 is 7.',
    },
    {
      name: 'XOR',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> XOR <number>',
      description:
        'Bitwise exclusive OR: a bit is set where exactly one operand has it, so 5 XOR 3 is 6.',
    },
    {
      name: 'EQV',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> EQV <number>',
      description:
        'Bitwise equivalence: a bit is set where the two operands agree, so 5 EQV 3 is -7. The complement of XOR, and rare outside this family.',
    },
    {
      name: 'IMP',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> IMP <number>',
      description:
        'Bitwise implication: a bit is clear only where the left operand has it and the right does not, so 5 IMP 3 is -5.',
    },
    {
      name: 'MOD',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> MOD <number>',
      description:
        'The remainder of an integer division. Both operands are converted to integers first and the sign follows the left one, so -7 MOD 2 is -1.',
    },
    {
      name: '\\',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> \\ <number>',
      description:
        'Integer division: both operands are converted to integers and the result is truncated towards zero, so -7 \\ 2 is -3.',
    },
    {
      name: 'LEFT$',
      kind: 'function',
      domain: 'strings',
      syntax: 'LEFT$(<string>, <length>)',
      description: 'The first n characters of a string.',
    },
    {
      name: 'RIGHT$',
      kind: 'function',
      domain: 'strings',
      syntax: 'RIGHT$(<string>, <length>)',
      description: 'The last n characters of a string.',
    },
    {
      name: 'MID$',
      kind: 'function',
      domain: 'strings',
      syntax: 'MID$(<string>, <start>[, <length>])',
      description:
        'The substring starting at that position, counting from 1, of the given length or to the end. It also works on the left of an assignment, overwriting that part of a string in place without changing its length.',
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
        'Rounds down to a whole number, so INT(-1.5) is -2. FIX truncates towards zero instead.',
    },
    {
      name: 'ABS',
      kind: 'function',
      domain: 'numeric',
      syntax: 'ABS(<number>)',
      description: 'The value without its sign.',
    },
    {
      name: 'SQR',
      kind: 'function',
      domain: 'numeric',
      syntax: 'SQR(<number>)',
      description:
        'The square root. A negative argument is an Illegal function call.',
    },
    {
      name: 'RND',
      kind: 'function',
      domain: 'numeric',
      syntax: 'RND(<number>)',
      description:
        'A random number from 0 up to but not including 1. A positive argument carries the sequence on, 0 repeats the number just given, and a negative one reseeds from that value - so RND(-TIME) is the usual way of starting somewhere unpredictable.',
    },
    {
      name: 'SIN',
      kind: 'function',
      domain: 'numeric',
      syntax: 'SIN(<number>)',
      description: 'The sine of an angle in radians.',
    },
    {
      name: 'LOG',
      kind: 'function',
      domain: 'numeric',
      syntax: 'LOG(<number>)',
      description:
        'The natural logarithm, to base e. There is no base-10 logarithm; divide by LOG(10).',
    },
    {
      name: 'EXP',
      kind: 'function',
      domain: 'numeric',
      syntax: 'EXP(<number>)',
      description: 'e raised to that power - the inverse of LOG.',
    },
    {
      name: 'COS',
      kind: 'function',
      domain: 'numeric',
      syntax: 'COS(<number>)',
      description: 'The cosine of an angle in radians.',
    },
    {
      name: 'TAN',
      kind: 'function',
      domain: 'numeric',
      syntax: 'TAN(<number>)',
      description: 'The tangent of an angle in radians.',
    },
    {
      name: 'ATN',
      kind: 'function',
      domain: 'numeric',
      syntax: 'ATN(<number>)',
      description:
        'The arctangent, in radians, between -π/2 and π/2. There is no two-argument form, so the quadrant has to be worked out from the signs.',
    },
    {
      name: 'FRE',
      kind: 'function',
      domain: 'memory-hardware',
      syntax: 'FRE(<expr>)',
      description:
        'Free memory, and which pool depends on the argument’s type: FRE(0) is the bytes left in the program area and FRE("") the bytes left in the string space. The two are separate, and the string space is only 200 bytes until CLEAR grows it.',
    },
    {
      name: 'INP',
      kind: 'function',
      domain: 'memory-hardware',
      syntax: 'INP(<port>)',
      description: 'Reads a byte from a processor input port.',
    },
    {
      name: 'POS',
      kind: 'function',
      domain: 'text-screen',
      syntax: 'POS(<number>)',
      description:
        'The column the text cursor is on, counted from 0. The argument is a dummy the interpreter ignores.',
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
        'A number as the text PRINT would show, leading space for the sign and all. VAL is the other direction.',
    },
    {
      name: 'VAL',
      kind: 'function',
      domain: 'strings',
      syntax: 'VAL(<string>)',
      description:
        'The number a string begins with, or 0 when it does not begin with one. It reads &H, &O and &B literals as well as decimals.',
    },
    {
      name: 'ASC',
      kind: 'function',
      domain: 'strings',
      syntax: 'ASC(<string>)',
      description:
        'The code of a string’s first character. An empty string is an Illegal function call.',
    },
    {
      name: 'CHR$',
      kind: 'function',
      domain: 'strings',
      syntax: 'CHR$(<number>)',
      description:
        'The character with that code. Codes below 32 are console commands rather than shapes - CHR$(12) clears the screen - and CHR$(1) is the prefix that prints one of their glyphs instead.',
    },
    {
      name: 'PEEK',
      kind: 'function',
      domain: 'memory-hardware',
      syntax: 'PEEK(<addr>)',
      description:
        'Reads a byte of processor memory. The screen is not in it: VPEEK reads video RAM.',
    },
    {
      name: 'VPEEK',
      kind: 'function',
      domain: 'memory-hardware',
      syntax: 'VPEEK(<addr>)',
      description:
        'Reads a byte of video RAM - the video chip’s separate 16K, where the screen, the character shapes and the sprites all live.',
    },
    {
      name: 'SPACE$',
      kind: 'function',
      domain: 'strings',
      syntax: 'SPACE$(<length>)',
      description: 'A string of that many spaces.',
    },
    {
      name: 'OCT$',
      kind: 'function',
      domain: 'strings',
      syntax: 'OCT$(<number>)',
      description:
        'A number written as octal digits, with no leading marker. The matching literal form is &O.',
    },
    {
      name: 'HEX$',
      kind: 'function',
      domain: 'strings',
      syntax: 'HEX$(<number>)',
      description:
        'A number written as hexadecimal digits, with no leading marker. The matching literal form is &H.',
    },
    {
      name: 'LPOS',
      kind: 'function',
      domain: 'text-screen',
      syntax: 'LPOS(<number>)',
      description:
        'The column the printer head is at, as far as BASIC knows. The argument is a dummy.',
    },
    {
      name: 'BIN$',
      kind: 'function',
      domain: 'strings',
      syntax: 'BIN$(<number>)',
      description:
        'A number written as binary digits, with no leading marker. The matching literal form is &B.',
    },
    {
      name: 'CINT',
      kind: 'function',
      domain: 'numeric',
      syntax: 'CINT(<number>)',
      description:
        'Converts to a sixteen-bit integer, truncating towards zero rather than rounding, and reporting Overflow outside -32768 to 32767. FIX truncates the same way without the range check.',
    },
    {
      name: 'CSNG',
      kind: 'function',
      domain: 'numeric',
      syntax: 'CSNG(<number>)',
      description:
        'Converts to single precision - six digits in four bytes, which is what a literal short enough to fit is stored as.',
    },
    {
      name: 'CDBL',
      kind: 'function',
      domain: 'numeric',
      syntax: 'CDBL(<number>)',
      description:
        'Converts to double precision - fourteen digits in eight bytes, and what MSX BASIC calculates in when nothing says otherwise.',
    },
    {
      name: 'FIX',
      kind: 'function',
      domain: 'numeric',
      syntax: 'FIX(<number>)',
      description:
        'Truncates towards zero, so FIX(-1.5) is -1 where INT gives -2. Unlike CINT it keeps values beyond the integer range.',
    },
    {
      name: 'STICK',
      kind: 'function',
      domain: 'input',
      syntax: 'STICK(<number>)',
      description:
        'A direction: 0 for centred, then 1 to 8 clockwise from up, so 1 is up, 3 right, 5 down and 7 left. STICK(0) reads the cursor keys, STICK(1) and STICK(2) the two joystick ports.',
    },
    {
      name: 'STRIG',
      kind: 'function',
      domain: 'input',
      syntax: 'STRIG(<number>)',
      description:
        'A trigger: -1 while it is held and 0 otherwise. STRIG(0) is the space bar, 1 and 3 the first triggers of the two joystick ports, 2 and 4 their second triggers.',
    },
    {
      name: 'PDL',
      kind: 'function',
      domain: 'input',
      syntax: 'PDL(<number>)',
      description:
        'A paddle position on one of the general-purpose ports, 1 to 12. No paddle is fitted here, so it reads 255.',
    },
    {
      name: 'PAD',
      kind: 'function',
      domain: 'input',
      syntax: 'PAD(<number>)',
      description:
        'A touch pad on one of the general-purpose ports, 0 to 7. Nothing is fitted here, so it reads 0.',
    },
    {
      name: 'DSKF',
      kind: 'function',
      domain: 'storage',
      syntax: 'DSKF(<disc>)',
      description:
        'Free clusters on a disc. Illegal function call on a machine with no drive.',
    },
    {
      name: 'FPOS',
      kind: 'function',
      domain: 'storage',
      syntax: 'FPOS(<file>)',
      description:
        'The byte position within an open file. It belongs to the disc ROM, so it answers Illegal function call here.',
    },
    {
      name: 'CVI',
      kind: 'function',
      domain: 'storage',
      syntax: 'CVI(<string>)',
      description:
        'Two bytes out of a record buffer read back as an integer. MKI$ is the other direction.',
    },
    {
      name: 'CVS',
      kind: 'function',
      domain: 'storage',
      syntax: 'CVS(<string>)',
      description:
        'Four bytes out of a record buffer read back as a single-precision value.',
    },
    {
      name: 'CVD',
      kind: 'function',
      domain: 'storage',
      syntax: 'CVD(<string>)',
      description:
        'Eight bytes out of a record buffer read back as a double-precision value.',
    },
    {
      name: 'EOF',
      kind: 'function',
      domain: 'storage',
      syntax: 'EOF(<file>)',
      description:
        'True (-1) once a sequential file has nothing more to read, so a read loop knows to stop.',
    },
    {
      name: 'LOC',
      kind: 'function',
      domain: 'storage',
      syntax: 'LOC(<file>)',
      description:
        'The record last read or written. Disc only, so it answers Illegal function call here.',
    },
    {
      name: 'LOF',
      kind: 'function',
      domain: 'storage',
      syntax: 'LOF(<file>)',
      description:
        'The length of an open file in bytes. Disc only, so it answers Illegal function call here.',
    },
    {
      name: 'MKI$',
      kind: 'function',
      domain: 'storage',
      syntax: 'MKI$(<number>)',
      description:
        'An integer as the two bytes a record buffer holds it in. CVI reads them back.',
    },
    {
      name: 'MKS$',
      kind: 'function',
      domain: 'storage',
      syntax: 'MKS$(<number>)',
      description:
        'A single-precision value as four bytes for a record buffer.',
    },
    {
      name: 'MKD$',
      kind: 'function',
      domain: 'storage',
      syntax: 'MKD$(<number>)',
      description:
        'A double-precision value as eight bytes for a record buffer.',
    },
    {
      name: '<=',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> <= <number> | <string> <= <string>',
      description:
        'Less than or equal. MSX BASIC has no token of its own for it: the pair is stored as the < and = tokens side by side, which is why the reversed spelling is the same test.',
    },
    {
      name: '=<',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> =< <number> | <string> =< <string>',
      description:
        'Less than or equal, written the other way round; the same two tokens as <=, in the other order.',
    },
    {
      name: '>=',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> >= <number> | <string> >= <string>',
      description: 'Greater than or equal.',
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
      name: '<>',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> <> <number> | <string> <> <string>',
      description: 'Not equal.',
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

/**
 * The page as it renders: each row carries the short spellings its keyword can
 * be typed as, derived from the machine's own resolution order rather than
 * authored above. See ./abbreviations - MSX BASIC has no abbreviated entry, so
 * this adds nothing today and keeps the page uniform with its neighbours.
 */
export const msxReference: BasicReferenceTableData = withAbbreviations(
  'msx',
  msxTable,
);
