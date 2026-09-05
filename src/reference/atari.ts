// Reference table data for the Atari BASIC page.
// Seeded from the dialect's keyword table by scripts/gen-reference-scaffold.mts,
// then hand-enriched (typed <…> syntax + fuller descriptions). Edit by hand;
// the generator skips this file once it exists.
//
// Every row is a word in src/dialects/atari800/keywords.ts, which was read out
// of the cartridge's own two token tables; keyword-crosscheck.test.ts holds the
// two in exact agreement in both directions. The Atari 400 runs the same
// cartridge and so has the same vocabulary - nothing here is scoped to one
// machine.
//
// What a reader arriving from another machine trips over:
//
//  - there are no string functions but LEN, and no LEFT$/MID$/RIGHT$: a string
//    is sliced by subscripting it, A$(3,5), and concatenated by assigning into
//    the position past its end;
//  - `+` is arithmetic only, because of the above;
//  - there is no ELSE, no WHILE and no REPEAT, and everything after THEN on a
//    line belongs to the THEN;
//  - INPUT takes no prompt string - PRINT the wording first;
//  - there is no hexadecimal, so every address is written in decimal;
//  - COLOR chooses which colour register to draw in and SETCOLOR says what
//    colour that register holds, which is the reverse of the pairing most of
//    these machines use;
//  - a name is matched after the keyword table and matched greedily, so LOGO
//    reads as LOG followed by O.
import type { BasicReferenceTableData } from './types';
import { withAbbreviations } from './abbreviations';

const atariTable: BasicReferenceTableData = {
  title: 'Atari BASIC',
  machines: ['Atari 800', 'Atari 400'],
  placeholders: [
    {
      id: 'filespec',
      meaning: 'a device or file, as a quoted string: "C:", "P:", "D:GAME"',
    },
    { id: 'aux1', meaning: 'what to open a channel for: 4 read, 8 write' },
    { id: 'aux2', meaning: 'a second, device-specific option byte' },
    { id: 'register', meaning: 'one of the five colour registers, 0 to 4' },
    { id: 'hue', meaning: 'a hue, 0 to 15' },
    { id: 'luminance', meaning: 'a brightness, an even number from 0 to 14' },
    { id: 'voice', meaning: 'one of the four sound voices, 0 to 3' },
    { id: 'distortion', meaning: 'how noisy a voice sounds, an even number' },
    { id: 'volume', meaning: 'how loud a sound is' },
    { id: 'paddle', meaning: 'a paddle controller, 0 to 7' },
  ],
  entries: [
    {
      name: 'ABS',
      kind: 'function',
      domain: 'numeric',
      syntax: 'ABS(<number>)',
      description: 'The value without its sign.',
    },
    {
      name: 'ADR',
      kind: 'function',
      domain: 'memory-hardware',
      syntax: 'ADR(<string>)',
      description:
        'The address the string’s characters are stored at. This is how a machine-code routine is handed something to work on, and how a program POKEs bytes into a string it has DIMensioned as a buffer.',
    },
    {
      name: 'AND',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> AND <number>',
      description:
        'True when both operands are non-zero. Logical, not bitwise: there is no bitwise operator in this BASIC at all, and a true result is 1 rather than -1.',
    },
    {
      name: 'ASC',
      kind: 'function',
      domain: 'strings',
      syntax: 'ASC(<string>)',
      description:
        'The ATASCII code of the first character. An empty string is an error rather than zero.',
    },
    {
      name: 'ATN',
      kind: 'function',
      domain: 'numeric',
      syntax: 'ATN(<number>)',
      description:
        'Arctangent, in radians unless DEG has been used. There is no ASN or ACS.',
    },
    {
      name: 'BYE',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'BYE',
      description:
        'Leaves BASIC for the Memo Pad, the machine’s typewriter mode. The program is still in memory; pressing SYSTEM RESET comes back to it.',
    },
    {
      name: 'CHR$',
      kind: 'function',
      domain: 'strings',
      syntax: 'CHR$(<number>)',
      description:
        'The one-character string for an ATASCII code. Adding 128 to a code gives its inverse-video twin, which is how a text-mode game draws a solid block: CHR$(160) is an inverse space.',
    },
    {
      name: 'CLOAD',
      kind: 'command',
      domain: 'storage',
      syntax: 'CLOAD',
      description:
        'Loads a tokenized program from the cassette recorder. The machine beeps once and waits for RETURN, so that playback can be started first.',
    },
    {
      name: 'CLOG',
      kind: 'function',
      domain: 'numeric',
      syntax: 'CLOG(<number>)',
      description:
        'Logarithm to base 10. LOG is the natural one here, which is the opposite of the Acorn machines’ naming.',
    },
    {
      name: 'CLOSE',
      kind: 'command',
      domain: 'storage',
      syntax: 'CLOSE #<file>',
      description:
        'Closes one of the eight I/O channels and flushes anything still buffered on it. END closes them all.',
    },
    {
      name: 'CLR',
      kind: 'command',
      domain: 'data',
      syntax: 'CLR',
      description:
        'Forgets every variable, array and string, and un-DIMensions them. It is also the only way to give back one of the 128 variable-name slots a program may use, because a name is kept once it has been typed.',
    },
    {
      name: 'COLOR',
      kind: 'command',
      domain: 'colour',
      syntax: 'COLOR <colour>',
      description:
        'Chooses what later PLOT and DRAWTO statements draw with. In a graphics mode this selects one of the colour registers; in a text mode it is the ATASCII code of the character to draw. SETCOLOR is the statement that says what colour a register holds.',
    },
    {
      name: 'COM',
      kind: 'command',
      domain: 'data',
      syntax: 'COM <numvar>(<number>[, <number>]) | COM <strvar>(<length>)',
      description:
        'A second spelling of DIM, inherited from the Data General BASIC this cartridge descends from. It does exactly what DIM does.',
    },
    {
      name: 'CONT',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'CONT',
      description:
        'Carries on after STOP or BREAK. Execution resumes at the next line, not at the rest of the line it stopped in.',
    },
    {
      name: 'COS',
      kind: 'function',
      domain: 'numeric',
      syntax: 'COS(<number>)',
      description: 'Cosine, in radians unless DEG has been used.',
    },
    {
      name: 'CSAVE',
      kind: 'command',
      domain: 'storage',
      syntax: 'CSAVE',
      description:
        'Saves the tokenized program to the cassette recorder. The machine beeps twice and waits for RETURN, so that RECORD and PLAY can be pressed first.',
    },
    {
      name: 'DATA',
      kind: 'command',
      domain: 'data',
      syntax: 'DATA <constant>[, <constant>]…',
      description:
        'Constants for READ to walk through. The rest of the line is stored exactly as typed, so quotation marks are neither needed nor stripped and a comma always ends an item.',
    },
    {
      name: 'DEG',
      kind: 'command',
      domain: 'numeric',
      syntax: 'DEG',
      description:
        'Makes SIN, COS and ATN work in degrees. It stays in force until RAD or a RUN, which resets to radians.',
    },
    {
      name: 'DIM',
      kind: 'command',
      domain: 'data',
      syntax: 'DIM <numvar>(<number>[, <number>]) | DIM <strvar>(<length>)',
      description:
        'Reserves space for an array or a string. Everything must be dimensioned before use — including every string, which is a fixed buffer of the declared length rather than something that grows — and dimensioning the same name twice is an error until CLR.',
    },
    {
      name: 'DOS',
      kind: 'command',
      domain: 'storage',
      syntax: 'DOS',
      description:
        'Leaves BASIC for the disk operating system’s menu. With no disk system loaded it drops into the Memo Pad, exactly as BYE does.',
    },
    {
      name: 'DRAWTO',
      kind: 'command',
      domain: 'graphics',
      syntax: 'DRAWTO <x>, <y>',
      description:
        'Draws a straight line from the last plotted point to this one, in the colour COLOR selected, and leaves the graphics cursor at the end of it.',
    },
    {
      name: 'END',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'END',
      description:
        'Stops the program, closes every open channel and silences all four sound voices. STOP does none of those three things.',
    },
    {
      name: 'ENTER',
      kind: 'command',
      domain: 'storage',
      syntax: 'ENTER <filespec>',
      description:
        'Reads an ATASCII listing back a line at a time, exactly as if it had been typed. Unlike LOAD it merges into the program already in memory rather than replacing it, which is how two listings are joined.',
    },
    {
      name: 'EXP',
      kind: 'function',
      domain: 'numeric',
      syntax: 'EXP(<number>)',
      description: 'e raised to the power given.',
    },
    {
      name: 'FOR',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'FOR <numvar> = <number> TO <number> [STEP <number>]',
      description:
        'Begins a counting loop. The body always runs once, because the limit is tested at the NEXT rather than on the way in.',
    },
    {
      name: 'FRE',
      kind: 'function',
      domain: 'memory-hardware',
      syntax: 'FRE(0)',
      description:
        'Bytes still free between the program and the screen. The argument is ignored but must be there.',
    },
    {
      name: 'GET',
      kind: 'command',
      domain: 'input',
      syntax: 'GET [#<file>,] <numvar>',
      description:
        'Reads one byte from a channel and waits until there is one. Opening a channel on the "K:" device makes this the blocking keyboard read; PEEK(764) is the non-blocking one.',
    },
    {
      name: 'GO TO',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'GO TO <line>',
      description:
        'GOTO with a space in it. The cartridge holds it as a separate token and lists it back the way it was typed, so the two spellings are told apart in a listing but do the same thing.',
    },
    {
      name: 'GOSUB',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'GOSUB <line>',
      description:
        'Calls a subroutine, which comes back with RETURN. Only the line number may be given — there is no computed GOSUB other than ON … GOSUB.',
    },
    {
      name: 'GOTO',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'GOTO <line>',
      description:
        'Jumps to a line. The destination must be a plain number: this BASIC has no GOTO to an expression.',
    },
    {
      name: 'GRAPHICS',
      kind: 'command',
      domain: 'graphics',
      syntax: 'GRAPHICS <mode>',
      description:
        'Selects a display mode, clears the screen and rebuilds the display list from the top of memory downwards. Adding 16 to the mode drops the four-line text window at the foot of the screen, and adding 32 keeps the screen contents instead of clearing them.',
    },
    {
      name: 'IF',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'IF <number> THEN <line> | IF <number> THEN <statement>',
      description:
        'Runs the rest of the line when the condition is non-zero. There is no ELSE, and everything after THEN belongs to the THEN — a statement written after it on the same line cannot be reached unconditionally.',
    },
    {
      name: 'INPUT',
      kind: 'command',
      domain: 'input',
      syntax: 'INPUT [#<file>;] <var>[, <var>]…',
      description:
        'Reads a line from the keyboard, or from a channel. It takes no prompt string, so the wording is PRINTed first; with no channel it shows a question mark and echoes what is typed.',
    },
    {
      name: 'INT',
      kind: 'function',
      domain: 'numeric',
      syntax: 'INT(<number>)',
      description:
        'The largest whole number not above the value, so it rounds a negative number away from zero: INT(-2.5) is -3.',
    },
    {
      name: 'LEN',
      kind: 'function',
      domain: 'strings',
      syntax: 'LEN(<string>)',
      description:
        'How many characters the string currently holds, which is not the length it was DIMensioned to. Assigning to a string sets this; it is also the position a further piece is appended at.',
    },
    {
      name: 'LET',
      kind: 'command',
      domain: 'data',
      syntax: 'LET <var> = <expr>',
      description:
        'Assigns a value. The keyword is optional and almost always left out, though writing it is the way to assign to a name that begins with a keyword.',
    },
    {
      name: 'LIST',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'LIST [<line>[, <line>]] | LIST <filespec>[, <line>, <line>]',
      description:
        'Prints the program as ATASCII text, optionally one line or a range of them, and optionally to a device rather than the screen. LIST "C:" writes a listing to cassette that ENTER reads back; this is the untokenized counterpart of SAVE.',
    },
    {
      name: 'LOAD',
      kind: 'command',
      domain: 'storage',
      syntax: 'LOAD <filespec>',
      description:
        'Reads back a tokenized program written by SAVE, replacing whatever was in memory. It cannot read a LIST listing — that is what ENTER is for.',
    },
    {
      name: 'LOCATE',
      kind: 'command',
      domain: 'graphics',
      syntax: 'LOCATE <x>, <y>, <numvar>',
      description:
        'Reads back what is already on the screen at a point: the colour register number in a graphics mode, the character’s code in a text one. This is how a game finds out what it is about to move into. It leaves the cursor at that point.',
    },
    {
      name: 'LOG',
      kind: 'function',
      domain: 'numeric',
      syntax: 'LOG(<number>)',
      description:
        'Natural logarithm. CLOG is the base-10 one; the Acorn machines use these two names the other way round.',
    },
    {
      name: 'LPRINT',
      kind: 'command',
      domain: 'text-screen',
      syntax: 'LPRINT [<expr>][;|, <expr>]…',
      description:
        'Prints to the printer, opening and closing the channel around each statement. Nothing else needs to be opened first.',
    },
    {
      name: 'NEW',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'NEW',
      description:
        'Erases the program, its variables and the whole name table. This is the only way to forget a variable name short of switching off — CLR forgets the values but keeps the names.',
    },
    {
      name: 'NEXT',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'NEXT <numvar>',
      description:
        'Closes the innermost FOR loop. The variable must be named, and it must be the right one: this BASIC will not close several loops from one NEXT.',
    },
    {
      name: 'NOT',
      kind: 'operator',
      domain: 'numeric',
      syntax: 'NOT <number>',
      description:
        'Gives 1 for zero and 0 for anything else. Logical rather than bitwise, like AND and OR.',
    },
    {
      name: 'NOTE',
      kind: 'command',
      domain: 'storage',
      syntax: 'NOTE #<file>, <numvar>, <numvar>',
      description:
        'Reads back where an open disk file has got to, as a sector and a byte within it, so that POINT can come back to the same place later.',
    },
    {
      name: 'ON',
      kind: 'command',
      domain: 'control-flow',
      syntax:
        'ON <number> GOTO <line>[, <line>]… | ON <number> GOSUB <line>[, <line>]…',
      description:
        'Jumps to the nth line in the list, counting from 1. A value of zero, or one past the end of the list, falls through to the next statement instead of failing.',
    },
    {
      name: 'OPEN',
      kind: 'command',
      domain: 'storage',
      syntax: 'OPEN #<file>, <aux1>, <aux2>, <filespec>',
      description:
        'Opens one of the eight I/O channels on a device. Channel 0 is the screen editor and channel 6 the graphics screen, so a program opens 1 to 5 or 7; "K:" is the keyboard, "S:" the screen, "P:" the printer, "C:" the cassette and "D:" a disk file.',
    },
    {
      name: 'OR',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> OR <number>',
      description:
        'True when either operand is non-zero. Logical, not bitwise, and a true result is 1.',
    },
    {
      name: 'PADDLE',
      kind: 'function',
      domain: 'input',
      syntax: 'PADDLE(<paddle>)',
      description:
        'How far a paddle controller is turned, 1 at the clockwise end and 228 at the other. Two paddles share each of the machine’s ports.',
    },
    {
      name: 'PEEK',
      kind: 'function',
      domain: 'memory-hardware',
      syntax: 'PEEK(<addr>)',
      description:
        'The byte at an address, written in decimal — this BASIC has no hexadecimal at all. PEEK(764) is the last key pressed, PEEK(53279) the console keys, and PEEK(88)+256*PEEK(89) where the screen currently starts.',
    },
    {
      name: 'PLOT',
      kind: 'command',
      domain: 'graphics',
      syntax: 'PLOT <x>, <y>',
      description:
        'Draws one point in the colour COLOR selected, and leaves the graphics cursor there so that DRAWTO can carry on from it.',
    },
    {
      name: 'POINT',
      kind: 'command',
      domain: 'storage',
      syntax: 'POINT #<file>, <number>, <number>',
      description:
        'Moves an open disk file to a sector and a byte within it, which NOTE recorded earlier. This is the whole of random access on this machine.',
    },
    {
      name: 'POKE',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'POKE <addr>, <byte>',
      description:
        'Writes one byte to an address, in decimal. Many of the machine’s hardware registers are written through a shadow address in low memory that the vertical blank copies out fifty times a second; POKEing the chip directly is undone at the next frame.',
    },
    {
      name: 'POP',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'POP',
      description:
        'Throws away the innermost entry on the runtime stack: the pending RETURN of a GOSUB, or a FOR that is being abandoned. Leaving a subroutine or a loop by GOTO without this eventually fills the stack.',
    },
    {
      name: 'POSITION',
      kind: 'command',
      domain: 'text-screen',
      syntax: 'POSITION <x>, <y>',
      description:
        'Moves the cursor for the next PRINT, in text cells in GRAPHICS 0 and in pixels in a graphics mode. Follow the PRINT with a semicolon, or the cursor drops to the next row afterwards.',
    },
    {
      name: 'PRINT',
      kind: 'command',
      domain: 'text-screen',
      syntax: 'PRINT [#<file>;] [<expr>][;|, <expr>]…',
      description:
        'Prints to the screen, or to a channel. A trailing semicolon holds the cursor where it is and a comma moves it to the next ten-column field; anything else ends the line. Never print into column 39: the screen editor reads a character written there as the end of a logical line and pushes the rest of the screen down a row.',
    },
    {
      name: 'PTRIG',
      kind: 'function',
      domain: 'input',
      syntax: 'PTRIG(<paddle>)',
      description: 'A paddle’s button: 0 while it is held, 1 otherwise.',
    },
    {
      name: 'PUT',
      kind: 'command',
      domain: 'text-screen',
      syntax: 'PUT [#<file>,] <byte>',
      description:
        'Writes one byte to a channel. PUT to the screen editor sends the code straight through, which is how a control code is written without embedding it in a string.',
    },
    {
      name: 'RAD',
      kind: 'command',
      domain: 'numeric',
      syntax: 'RAD',
      description:
        'Puts SIN, COS and ATN back into radians after DEG. This is also the state a RUN starts in.',
    },
    {
      name: 'READ',
      kind: 'command',
      domain: 'data',
      syntax: 'READ <var>[, <var>]…',
      description:
        'Takes the next constants from the DATA statements. Reading past the last one gives error 8 rather than the error 6 the Atari BASIC manual documents.',
    },
    {
      name: 'REM',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'REM <comment>',
      description:
        'A comment. The rest of the line is kept exactly as typed rather than tokenized, so a long remark costs its own length in program memory.',
    },
    {
      name: 'RESTORE',
      kind: 'command',
      domain: 'data',
      syntax: 'RESTORE [<line>]',
      description:
        'Sends READ back to the first DATA statement, or to the one at a given line — which is how one program reads several independent tables.',
    },
    {
      name: 'RETURN',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'RETURN',
      description: 'Goes back to the statement after the matching GOSUB.',
    },
    {
      name: 'RND',
      kind: 'function',
      domain: 'numeric',
      syntax: 'RND(<number>)',
      description:
        'A random number from 0 up to but not including 1, taken from POKEY’s own noise register. The argument is ignored, and there is no way to seed the sequence or to repeat one.',
    },
    {
      name: 'RUN',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'RUN [<filespec>]',
      description:
        'Clears the variables and starts at the lowest line. Given a file it loads that program first, which is how one program chains to the next.',
    },
    {
      name: 'SAVE',
      kind: 'command',
      domain: 'storage',
      syntax: 'SAVE <filespec>',
      description:
        'Writes the program in its tokenized form — the pointer header, the variable tables and the statement table. LOAD reads it back; LIST writes the text form instead.',
    },
    {
      name: 'SETCOLOR',
      kind: 'command',
      domain: 'colour',
      syntax: 'SETCOLOR <register>, <hue>, <luminance>',
      description:
        'Says what colour one of the five registers holds, as a hue and a brightness rather than a single number. In GRAPHICS 0 register 2 is the background and register 1 supplies the characters’ luminance, so the whole text screen is one colour.',
    },
    {
      name: 'SGN',
      kind: 'function',
      domain: 'numeric',
      syntax: 'SGN(<number>)',
      description: '-1, 0 or 1 according to the sign.',
    },
    {
      name: 'SIN',
      kind: 'function',
      domain: 'numeric',
      syntax: 'SIN(<number>)',
      description: 'Sine, in radians unless DEG has been used.',
    },
    {
      name: 'SOUND',
      kind: 'command',
      domain: 'sound',
      syntax: 'SOUND <voice>, <pitch>, <distortion>, <volume>',
      description:
        'Plays a tone on one of POKEY’s four voices until it is changed. A lower pitch number is a higher note; distortion 10 is a pure tone and the lower even values are noise; volume runs 0 to 15, and four voices at full volume distort. SOUND with a volume of 0 stops a voice, and END stops all four.',
    },
    {
      name: 'SQR',
      kind: 'function',
      domain: 'numeric',
      syntax: 'SQR(<number>)',
      description: 'Square root.',
    },
    {
      name: 'STATUS',
      kind: 'command',
      domain: 'storage',
      syntax: 'STATUS #<file>, <numvar>',
      description:
        'Reads a channel’s status byte without disturbing it: 1 means the last operation succeeded, and the error codes are the ones a failed operation would have reported.',
    },
    {
      name: 'STEP',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'FOR <numvar> = <number> TO <number> STEP <number>',
      description:
        'The stride of a FOR loop. It may be fractional or negative; left out, it is 1.',
    },
    {
      name: 'STICK',
      kind: 'function',
      domain: 'input',
      syntax: 'STICK(<port>)',
      description:
        'Which way a joystick is pushed, as four bits that are 0 when the switch is closed: 15 centred, 14 up, 13 down, 11 left, 7 right, and the diagonals are the two combined.',
    },
    {
      name: 'STOP',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'STOP',
      description:
        'Halts and reports the line it stopped at, leaving everything open so that CONT can carry on. END is the tidy way to finish.',
    },
    {
      name: 'STR$',
      kind: 'function',
      domain: 'strings',
      syntax: 'STR$(<number>)',
      description:
        'The number written out as a string, with no leading space for the sign — unlike Microsoft BASIC, which reserves one.',
    },
    {
      name: 'STRIG',
      kind: 'function',
      domain: 'input',
      syntax: 'STRIG(<port>)',
      description: 'A joystick’s button: 0 while it is held, 1 otherwise.',
    },
    {
      name: 'THEN',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'IF <number> THEN <line> | IF <number> THEN <statement>',
      description:
        'The consequent of an IF. A bare line number is a jump; anything else is the rest of the line, which runs only when the condition holds.',
    },
    {
      name: 'TO',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'FOR <numvar> = <number> TO <number>',
      description: 'The limit of a FOR loop, tested at the NEXT.',
    },
    {
      name: 'TRAP',
      kind: 'command',
      domain: 'error-handling',
      syntax: 'TRAP <line>',
      description:
        'Sends the next error to a line instead of stopping. It fires once and then clears itself, so the handler sets it again; a line number above the highest in the program turns trapping off. PEEK(195) is the error code afterwards and PEEK(187)*256+PEEK(186) the line it happened on.',
    },
    {
      name: 'USR',
      kind: 'function',
      domain: 'memory-hardware',
      syntax: 'USR(<addr>[, <number>]…)',
      description:
        'Calls a machine-code routine at an address and takes its answer from locations 212 and 213. Every argument after the first is pushed as two bytes, and a count of them is pushed on top — so the routine must PLA that count before anything else, or its RTS returns into nothing.',
    },
    {
      name: 'VAL',
      kind: 'function',
      domain: 'strings',
      syntax: 'VAL(<string>)',
      description:
        'The number a string spells. Anything that does not begin with a number is error 18 rather than zero, so a string from INPUT is worth checking first.',
    },
    {
      name: 'XIO',
      kind: 'command',
      domain: 'storage',
      syntax: 'XIO <number>, #<file>, <aux1>, <aux2>, <filespec>',
      description:
        'Sends any command to a device, for the operations with no keyword of their own: 18 fills an area of the graphics screen, and on a disk 32 renames, 33 deletes, 35 locks and 36 unlocks.',
    },
    {
      name: '#',
      kind: 'operator',
      domain: 'storage',
      syntax: '#<file>',
      description:
        'Marks a channel number rather than an ordinary value. It is what tells PRINT, INPUT, GET and PUT to work on an open channel instead of the screen and the keyboard.',
    },
    {
      name: '+',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> + <number> | +<number>',
      description:
        'Addition. It does not join strings: two strings are joined by assigning the second one past the end of the first, A$(LEN(A$)+1)=B$.',
    },
    {
      name: '-',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> - <number> | -<number>',
      description: 'Subtraction, and negation.',
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
      description:
        'Division. There is no integer division and no remainder operator; INT(A/B) and A-B*INT(A/B) are how both are written.',
    },
    {
      name: '^',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> ^ <number>',
      description:
        'Raise to a power, computed through the logarithm — so it is slow, and it is inexact for cases that ought to be whole numbers.',
    },
    {
      name: '=',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<var> = <expr> | <expr> = <expr>',
      description:
        'Assignment, and equality. Which one it is depends on where it appears, and the cartridge stores a different token for each — for a numeric assignment, a string assignment, a numeric comparison and a string comparison.',
    },
    {
      name: '<',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> < <number> | <string> < <string>',
      description:
        'Less than. A true comparison is 1 and a false one 0, so a comparison can be used directly in arithmetic.',
    },
    {
      name: '>',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> > <number> | <string> > <string>',
      description: 'Greater than.',
    },
    {
      name: '<=',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> <= <number> | <string> <= <string>',
      description:
        'Less than or equal. It must be written in this order — =< is not accepted.',
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

export const atariReference = withAbbreviations('atari', atariTable);
