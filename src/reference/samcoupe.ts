// Reference table data for the SAM BASIC page.
// Seeded from the dialect's keyword table by scripts/gen-reference-scaffold.mts,
// then hand-enriched (typed <…> syntax + fuller descriptions). Edit by hand;
// the generator skips this file once it exists.
//
// Every row is a word in src/dialects/samcoupe/keywords.ts, transcribed from the
// v3.0 ROM's own token list; keyword-crosscheck.test.ts holds the two in exact
// agreement in both directions.
//
// SAM BASIC is Andy Wright's Beta BASIC line rather than Sinclair BASIC, and the
// Spectrum instinct is wrong about it in ways that were checked against the
// running ROM rather than assumed:
//
//  - there is no implied LET, because a bare name opens a DEF PROC call;
//  - MEM$ is sliced by address (`MEM$(<a> TO <b>)`) and reads the same space
//    PEEK does - the page form the keyword table used to claim is refused;
//  - PRINT AT reaches rows 0-18 only, rows 19 and 20 being the lower window,
//    and asking for one of them is report 32, "Off screen";
//  - ATTR is a MODE 1 reading and answers report 34 in any other mode;
//  - a whole vocabulary is in the ROM's token table but not in the ROM: DIR,
//    ERASE, FORMAT, MOVE, COPY, RENAME, PROTECT, HIDE, REF, USING and WRITE all
//    tokenize and are then refused as "Not understood", because the parser that
//    would read them arrives with a disc operating system. EOF, PTR, PATH$,
//    DVAR and a file OPEN get as far as running and answer "No DOS" instead.
import type { BasicReferenceTableData } from './types';
import { withAbbreviations } from './abbreviations';

const samcoupeTable: BasicReferenceTableData = {
  title: 'SAM BASIC',
  machines: ['MGT SAM Coupé'],
  placeholders: [
    { id: 'angle', meaning: 'an angle, in radians' },
    { id: 'bits', meaning: 'a binary literal, such as 10011' },
    { id: 'left', meaning: 'the left edge of a window or clipping area' },
    { id: 'right', meaning: 'the right edge of a window or clipping area' },
    { id: 'top', meaning: 'the top edge of a window or clipping area' },
    { id: 'bottom', meaning: 'the bottom edge of a window or clipping area' },
    { id: 'direction', meaning: 'which way something moves, 1 to 4' },
    { id: 'width', meaning: 'how wide something is, in pixels' },
    { id: 'height', meaning: 'how tall something is, in pixels' },
    { id: 'hwreg', meaning: 'a hardware register, by number' },
    { id: 'index', meaning: 'a colour-lookup slot, 0 to 15' },
    { id: 'target', meaning: 'a variable, array or procedure, by name' },
    { id: 'keycode', meaning: 'a key code, as CODE returns it' },
    { id: 'picture', meaning: 'a formatting pattern a number is printed to' },
    { id: 'radius', meaning: 'the radius of a circle, in pixels' },
    { id: 'screen', meaning: 'one of the machine’s screens, by number' },
    { id: 'sysvar', meaning: 'a system variable, by number' },
    { id: 'word', meaning: 'a value from 0 to 65535' },
  ],
  entries: [
    // ---- Control flow ----
    {
      name: 'GO TO',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'GO TO <line>',
      description:
        'Jumps to a line. GOTO written as one word is the same keyword and lists back as two, and the destination may be a LABEL name or an expression rather than a literal line number.',
    },
    {
      name: 'GO SUB',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'GO SUB <line>',
      description:
        'Calls a subroutine, which returns with RETURN. GOSUB is the same keyword and lists back as two words. Prefer DEF PROC for anything with parameters or local variables.',
    },
    {
      name: 'RETURN',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'RETURN',
      description:
        'Returns to the statement after the matching GO SUB. Without one the program stops with "RETURN without GOSUB".',
    },
    {
      name: 'ON',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'ON <number> GO TO <line>[, <line>]…',
      description:
        'Branches to the nth destination in the list, counting from 1. GO SUB works in the same position, and a value outside the list falls through to the next statement.',
    },
    {
      name: 'IF',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'IF <number> THEN <statement> | IF <number>',
      description:
        'The conditional, in two shapes. With THEN it runs the rest of the line; without, it opens a multi-line block that ELSE divides and END IF closes. The ROM stores the two forms as different tokens and rewrites the one you typed when it sees which follows.',
    },
    {
      name: 'THEN',
      kind: 'operator',
      domain: 'control-flow',
      syntax: 'IF <number> THEN <statement>',
      description:
        'Introduces the body of a single-line IF. Everything after it on the line is conditional, including statements after further colons.',
    },
    {
      name: 'ELSE',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'IF <number> THEN <statement>: ELSE <statement>',
      description:
        'The other branch, of a single-line IF or of a block one. In a block IF it stands alone on its own line, between the IF and its END IF.',
    },
    {
      name: 'END IF',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'END IF',
      description:
        'Closes a block IF. Leaving it out stops the program with "Missing END IF" when the block is reached.',
    },
    {
      name: 'FOR',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'FOR <numvar> = <number> TO <number> [STEP <number>]',
      description:
        'Opens a counting loop that runs to the matching NEXT. The step may be negative or fractional, and the control variable is an ordinary variable the body can read.',
    },
    {
      name: 'NEXT',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'NEXT [<numvar>]',
      description:
        'Closes a counting loop and jumps back to it. Naming the variable closes that loop specifically, which is how nested loops are unwound in the right order.',
    },
    {
      name: 'TO',
      kind: 'operator',
      domain: 'control-flow',
      syntax: 'FOR <numvar> = <number> TO <number>',
      description:
        'Separates the two ends of a range. The same word slices a string (a$(2 TO 5)), bounds MEM$ and joins the two halves of COPY and RENAME.',
    },
    {
      name: 'STEP',
      kind: 'operator',
      domain: 'control-flow',
      syntax: 'FOR <numvar> = <number> TO <number> STEP <number>',
      description:
        'Sets a loop increment other than 1, and the increment RENUM numbers by. A step of 0 loops forever.',
    },
    {
      name: 'DO',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'DO | DO WHILE <number> | DO UNTIL <number>',
      description:
        'Opens a loop closed by LOOP. The test may go on either end or on neither: a bare DO … LOOP repeats until an EXIT IF or a jump leaves it.',
    },
    {
      name: 'LOOP',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'LOOP | LOOP WHILE <number> | LOOP UNTIL <number>',
      description:
        'Closes a DO loop, optionally with the test on this end so the body always runs at least once. A LOOP with no DO above it stops with "LOOP without DO".',
    },
    {
      name: 'LOOP IF',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'LOOP IF <number>',
      description:
        'Closes a DO loop and repeats while the condition is true — LOOP WHILE written as one keyword.',
    },
    {
      name: 'EXIT IF',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'EXIT IF <number>',
      description:
        'Leaves the enclosing DO loop from the middle when the condition is true, carrying on after its LOOP. This is the structured way out; a GO TO out of a loop leaves its frame on the BASIC stack.',
    },
    {
      name: 'WHILE',
      kind: 'operator',
      domain: 'control-flow',
      syntax: 'DO WHILE <number> | LOOP WHILE <number>',
      description:
        'Repeats while the condition holds. Legal on either end of a DO … LOOP, and the choice decides whether the body can run zero times.',
    },
    {
      name: 'UNTIL',
      kind: 'operator',
      domain: 'control-flow',
      syntax: 'DO UNTIL <number> | LOOP UNTIL <number>',
      description:
        'Repeats until the condition holds — the negation of WHILE, and legal in the same two places.',
    },
    {
      name: 'DEF PROC',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'DEF PROC <name> [<param>[, <param>]…]',
      description:
        'Opens a procedure, closed by END PROC and called by writing its name as a statement. Parameters are named without brackets and are local to the call; this is why SAM BASIC has no implied LET, a bare name being a call rather than an assignment.',
    },
    {
      name: 'END PROC',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'END PROC',
      description:
        'Closes a procedure and returns to the statement after the call.',
    },
    {
      name: 'DEF FN',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'DEF FN <name>(<param>[, <param>]…) = <expr>',
      description:
        'Defines a one-expression function, called with FN. The name may be as long as any variable name, and a $ on the end makes it string-valued.',
    },
    {
      name: 'FN',
      kind: 'function',
      domain: 'control-flow',
      syntax: 'FN <name>(<arg>[, <arg>]…)',
      description:
        'Calls a function declared with DEF FN. Reaching one with no definition stops the program with "FN without DEF FN".',
    },
    {
      name: 'LOCAL',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'LOCAL <var>[, <var>]…',
      description:
        'Gives a procedure its own copies of these variables, restored when it returns. Named inside a DEF PROC, alongside the parameters that are already local.',
    },
    {
      name: 'REF',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'DEF PROC <name> REF <param>',
      description:
        'Marks a procedure parameter as passed by reference, so assigning to it inside the procedure changes the caller’s variable. The ROM alone refuses it; the parser that reads it arrives with a disc operating system.',
    },
    {
      name: 'DEFAULT',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'DEFAULT <param> = <expr>',
      description:
        'Gives a procedure parameter a value to use when the call leaves it out. Written inside the DEF PROC, before the body.',
    },
    {
      name: 'POP',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'POP [<numvar>]',
      description:
        'Discards the top GO SUB return address, optionally storing the line it named. With nothing to discard the program stops with "No POP data".',
    },
    {
      name: 'LABEL',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'LABEL <name>',
      description:
        'Names this line so GO TO and GO SUB can name it instead of a number. A labelled program survives RENUM and reads as its own documentation.',
    },
    {
      name: 'STOP',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'STOP',
      description:
        'Stops the program and reports "STOP statement" with the line it stopped on. CONTINUE resumes from there, which is what makes STOP a debugging tool rather than an ending.',
    },
    {
      name: 'PAUSE',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'PAUSE <number>',
      description:
        'Waits the given number of frames — fifty to the second — or until a key is pressed, whichever comes first. PAUSE 0 waits for a key with no timeout.',
    },
    {
      name: 'KEYIN',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'KEYIN <string>',
      description:
        'Executes a string as though it had been typed at the prompt, so a program can write and enter its own lines. This is where self-modifying SAM programs live.',
    },

    // ---- Data ----
    {
      name: 'LET',
      kind: 'command',
      domain: 'data',
      syntax: 'LET <var> = <expr>',
      description:
        'Assigns a value, and is not optional: a bare A=1 opens a call to a procedure named A. A string variable can be assigned through a slice, so LET a$(2 TO 3) = "xy" overwrites part of it in place.',
    },
    {
      name: 'DIM',
      kind: 'command',
      domain: 'data',
      syntax: 'DIM <var>(<number>[, <number>]…)',
      description:
        'Creates an array with the given bounds, subscripts counting from 1. A string array takes an extra last dimension for the fixed length of each slot, which is why TRUNC$ exists to read one back without its padding.',
    },
    {
      name: 'DATA',
      kind: 'command',
      domain: 'data',
      syntax: 'DATA <expr>[, <expr>]…',
      description:
        'Values for READ to consume in program order. The items are expressions evaluated when they are read, not text stored as typed, so a DATA item may name a variable.',
    },
    {
      name: 'READ',
      kind: 'command',
      domain: 'data',
      syntax: 'READ <var>[, <var>]…',
      description:
        'Reads the next DATA items into variables. ITEM says what the next one is — 0 when the list is exhausted — so a read loop can end without counting.',
    },
    {
      name: 'RESTORE',
      kind: 'command',
      domain: 'data',
      syntax: 'RESTORE [<line>]',
      description:
        'Sets READ back to the first DATA item, or to the first one at or after the given line.',
    },
    {
      name: 'ITEM',
      kind: 'function',
      domain: 'data',
      syntax: 'ITEM',
      description:
        'The type of the next DATA item: 0 when none is left, 1 for a string and 2 for a number. Lets a READ loop stop at the end of the data rather than at a count it was told.',
    },
    {
      name: 'CLEAR',
      kind: 'command',
      domain: 'data',
      syntax: 'CLEAR [<addr>]',
      description:
        'Erases the variables. With an address it also lowers RAMTOP to it, reserving the memory above for machine code; an address outside the BASIC area is "Invalid CLEAR address".',
    },

    // ---- Numeric ----
    {
      name: 'PI',
      kind: 'function',
      domain: 'numeric',
      syntax: 'PI',
      description:
        'The constant pi, 3.14159265…. The trigonometric functions work in radians, so it is the unit of a whole turn divided by two.',
    },
    {
      name: 'RND',
      kind: 'function',
      domain: 'numeric',
      syntax: 'RND',
      description:
        'A pseudo-random number in [0,1). Takes no argument; for a whole number use INT(RND*n)+1. RANDOMIZE reseeds it.',
    },
    {
      name: 'RANDOMIZE',
      kind: 'command',
      domain: 'numeric',
      syntax: 'RANDOMIZE [<number>]',
      description:
        'Seeds RND. With no argument it seeds from the frame counter, which is what makes a game different each time; with one, the same seed gives the same sequence, which is what makes a bug reproducible.',
    },
    {
      name: 'BIN',
      kind: 'function',
      domain: 'numeric',
      syntax: 'BIN <bits>',
      description:
        'The value of a run of binary digits written out in full, as BIN 10110. Handy for POKEing a bit pattern you want to be able to read on the page.',
    },
    {
      name: 'SIN',
      kind: 'function',
      domain: 'numeric',
      syntax: 'SIN <number>',
      description: 'Sine of an angle in radians.',
    },
    {
      name: 'COS',
      kind: 'function',
      domain: 'numeric',
      syntax: 'COS <number>',
      description: 'Cosine of an angle in radians.',
    },
    {
      name: 'TAN',
      kind: 'function',
      domain: 'numeric',
      syntax: 'TAN <number>',
      description: 'Tangent of an angle in radians.',
    },
    {
      name: 'ASN',
      kind: 'function',
      domain: 'numeric',
      syntax: 'ASN <number>',
      description:
        'Arcsine, in radians. The argument must be between -1 and 1.',
    },
    {
      name: 'ACS',
      kind: 'function',
      domain: 'numeric',
      syntax: 'ACS <number>',
      description:
        'Arccosine, in radians. The argument must be between -1 and 1.',
    },
    {
      name: 'ATN',
      kind: 'function',
      domain: 'numeric',
      syntax: 'ATN <number>',
      description: 'Arctangent, in radians.',
    },
    {
      name: 'LN',
      kind: 'function',
      domain: 'numeric',
      syntax: 'LN <number>',
      description:
        'Natural logarithm. For another base, divide: LN x / LN 10 is the common logarithm.',
    },
    {
      name: 'EXP',
      kind: 'function',
      domain: 'numeric',
      syntax: 'EXP <number>',
      description: 'e raised to the given power, the inverse of LN.',
    },
    {
      name: 'ABS',
      kind: 'function',
      domain: 'numeric',
      syntax: 'ABS <number>',
      description: 'Absolute value: the number with any sign removed.',
    },
    {
      name: 'SGN',
      kind: 'function',
      domain: 'numeric',
      syntax: 'SGN <number>',
      description: 'The sign of a number: -1, 0 or 1.',
    },
    {
      name: 'SQR',
      kind: 'function',
      domain: 'numeric',
      syntax: 'SQR <number>',
      description: 'Square root. A negative argument is an error.',
    },
    {
      name: 'INT',
      kind: 'function',
      domain: 'numeric',
      syntax: 'INT <number>',
      description:
        'The integer part, rounding towards minus infinity — so INT -1.5 is -2, not -1.',
    },
    {
      name: 'NOT',
      kind: 'function',
      domain: 'numeric',
      syntax: 'NOT <number>',
      description:
        'Logical NOT: 1 when the argument is zero, 0 otherwise. For the bitwise complement of a byte, subtract it from 255.',
    },
    {
      name: 'MOD',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> MOD <number>',
      description:
        'The remainder after integer division. Pairs with DIV, which gives the quotient.',
    },
    {
      name: 'DIV',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> DIV <number>',
      description:
        'Integer division, discarding the remainder. Faster and clearer than INT(a/b).',
    },
    {
      name: 'BOR',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> BOR <number>',
      description:
        'Bitwise OR. The B is what distinguishes it from OR, which is the logical one — a distinction the Microsoft BASICs do not draw.',
    },
    {
      name: 'BAND',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> BAND <number>',
      description:
        'Bitwise AND, the partner of BOR. Use it to mask bits out of a byte read with PEEK or IN.',
    },
    {
      name: 'OR',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> OR <number>',
      description:
        'Logical OR: 1 when either operand is non-zero. For bits, use BOR.',
    },
    {
      name: 'AND',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> AND <number> | <string> AND <number>',
      description:
        'Logical AND: 1 when both operands are non-zero. With a string on the left it yields that string, or "" when the right-hand side is zero — the Sinclair idiom for a conditional piece of text.',
    },
    {
      name: '<>',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<expr> <> <expr>',
      description:
        'Not equal. Compares two numbers or two strings and yields 1 or 0.',
    },
    {
      name: '<=',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<expr> <= <expr>',
      description: 'Less than or equal. Strings compare by character code.',
    },
    {
      name: '>=',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<expr> >= <expr>',
      description: 'Greater than or equal. Strings compare by character code.',
    },
    {
      name: '=',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<expr> = <expr>',
      description:
        'Equal, yielding 1 or 0. The same character assigns in LET, DEF FN and DEFAULT, where it is not a comparison.',
    },
    {
      name: '<',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<expr> < <expr>',
      description: 'Less than. Strings compare by character code.',
    },
    {
      name: '>',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<expr> > <expr>',
      description: 'Greater than. Strings compare by character code.',
    },
    {
      name: '+',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> + <number> | <string> + <string>',
      description:
        'Adds two numbers, or joins two strings end to end. There is no separate concatenation operator.',
    },
    {
      name: '-',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> - <number>',
      description:
        'Subtracts, and negates when it stands in front of a single value.',
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
        'Divides, in floating point: 7/2 is 3.5. For a whole quotient use DIV.',
    },
    {
      name: '↑',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> ↑ <number>',
      description:
        'Raises to a power. Typed with the caret key and drawn as an up arrow, character code 94; the same glyph the Spectrum uses for the same job.',
    },

    // ---- Strings ----
    {
      name: 'LEN',
      kind: 'function',
      domain: 'strings',
      syntax: 'LEN <string>',
      description: 'How many characters a string holds.',
    },
    {
      name: 'CODE',
      kind: 'function',
      domain: 'strings',
      syntax: 'CODE <string>',
      description:
        'The character code of the first character, the inverse of CHR$. An empty string gives 0.',
    },
    {
      name: 'VAL',
      kind: 'function',
      domain: 'strings',
      syntax: 'VAL <string>',
      description:
        'Evaluates a string as a numeric expression — not merely a number, so VAL "2*a" reads the variable a.',
    },
    {
      name: 'VAL$',
      kind: 'function',
      domain: 'strings',
      syntax: 'VAL$ <string>',
      description:
        'Evaluates a string as a string expression, the string-valued twin of VAL.',
    },
    {
      name: 'TRUNC$',
      kind: 'function',
      domain: 'strings',
      syntax: 'TRUNC$ <string>',
      description:
        'The string with its trailing spaces removed. Its reason for existing is the string array, whose slots are a fixed width and are padded out with spaces.',
    },
    {
      name: 'CHR$',
      kind: 'function',
      domain: 'strings',
      syntax: 'CHR$ <number>',
      description:
        'The one-character string with the given code. Codes 128 to 143 are the block graphics and 144 to 168 the user-defined graphics.',
    },
    {
      name: 'STR$',
      kind: 'function',
      domain: 'strings',
      syntax: 'STR$ <number>',
      description: 'A number as the string PRINT would have shown.',
    },
    {
      name: 'BIN$',
      kind: 'function',
      domain: 'strings',
      syntax: 'BIN$ <number>',
      description:
        'A number as binary digits — eight for a value that fits a byte, sixteen otherwise.',
    },
    {
      name: 'HEX$',
      kind: 'function',
      domain: 'strings',
      syntax: 'HEX$ <number>',
      description:
        'A number as hex digits: two, four or six according to its size. The & prefix reads one back.',
    },
    {
      name: 'STRING$',
      kind: 'function',
      domain: 'strings',
      syntax: 'STRING$(<length>, <string>)',
      description:
        'The string repeated (and cut) to exactly the given number of characters, so STRING$(32,"-") is a rule across the screen.',
    },
    {
      name: 'INSTR',
      kind: 'function',
      domain: 'strings',
      syntax: 'INSTR(<string>, <string>)',
      description:
        'The position of the second string inside the first, counting from 1, or 0 when it is not there.',
    },

    // ---- Text screen ----
    {
      name: 'PRINT',
      kind: 'command',
      domain: 'text-screen',
      syntax: "PRINT [#<file>;] [<expr>][;|,|' <expr>]…",
      description:
        'Prints to the current screen, or to a stream when one is named. A semicolon runs items together, a comma tabs to the next field and an apostrophe starts a new line; a trailing separator suppresses the newline.',
    },
    {
      name: 'LPRINT',
      kind: 'command',
      domain: 'text-screen',
      syntax: "LPRINT [<expr>][;|,|' <expr>]…",
      description:
        'Prints to the printer instead of the screen, taking the same separators as PRINT. Nothing is fitted here, so it goes nowhere.',
    },
    {
      name: 'AT',
      kind: 'operator',
      domain: 'text-screen',
      syntax: 'PRINT AT <row>, <col>; <expr>',
      description:
        'Positions the print position, counting from 0. Rows 0 to 18 are the upper window; rows 19 and 20 are the lower window where reports and INPUT live, and asking for one is "Off screen".',
    },
    {
      name: 'TAB',
      kind: 'operator',
      domain: 'text-screen',
      syntax: 'PRINT TAB <col>; <expr>',
      description:
        'Moves the print position to a column on the current line, wrapping to the next line when it is already past it.',
    },
    {
      name: 'USING',
      kind: 'operator',
      domain: 'text-screen',
      syntax: 'PRINT USING <picture>; <number>',
      description:
        'Formats a number to a picture of hashes and a decimal point, for columns that line up. The ROM alone refuses it, as it does the rest of the vocabulary a disc operating system fills in.',
    },
    {
      name: 'CLS',
      kind: 'command',
      domain: 'text-screen',
      syntax: 'CLS [#]',
      description:
        'Clears the screen and homes the print position. With the # it clears the current window only, leaving the rest of the screen alone.',
    },
    {
      name: 'SCREEN$',
      kind: 'function',
      domain: 'text-screen',
      syntax: 'SCREEN$(<row>, <col>)',
      description:
        'The character showing at a screen position, recognised by comparing the pixels against the font — so it reads back what was drawn, not a character map the machine does not keep.',
    },
    {
      name: 'CSIZE',
      kind: 'command',
      domain: 'text-screen',
      syntax: 'CSIZE <width>, <height>',
      description:
        'Sets the character cell. The width is 6 or 8 pixels and the height 6 to 32 scanlines; anything else is "Integer out of range". The machine boots on an 8 by 9 cell, which is what makes its screen 32 by 21 rather than 32 by 24.',
    },
    {
      name: 'BLOCKS',
      kind: 'command',
      domain: 'text-screen',
      syntax: 'BLOCKS <number>',
      description:
        'Chooses what codes 128 to 143 draw: 1 for the built-in 2×2 block graphics, 0 for the second bank of user-defined shapes.',
    },
    {
      name: 'WINDOW',
      kind: 'command',
      domain: 'text-screen',
      syntax: 'WINDOW <left>, <right>, <top>, <bottom> | WINDOW',
      description:
        'Limits printing and scrolling to part of the screen, in character cells. Written bare it restores the whole screen.',
    },
    {
      name: 'DUMP',
      kind: 'command',
      domain: 'text-screen',
      syntax: 'DUMP',
      description:
        'Prints the screen on the printer as a picture. Nothing is fitted here, so it goes nowhere.',
    },

    // ---- Graphics ----
    {
      name: 'MODE',
      kind: 'command',
      domain: 'graphics',
      syntax: 'MODE <mode>',
      description:
        'Selects one of the four screen modes and clears the screen. Modes 1 and 2 are 256×192 with attributes, mode 3 is 512×192 in four colours and mode 4 is 256×192 in sixteen; anything outside 1 to 4 is "Invalid screen mode".',
    },
    {
      name: 'PLOT',
      kind: 'command',
      domain: 'graphics',
      syntax: 'PLOT <x>, <y>',
      description:
        'Plots a point and moves the graphics position to it. The origin is the bottom left; x runs 0 to 255 (0 to 511 in mode 3) and y 0 to 173 in every mode, the lower window not being plottable.',
    },
    {
      name: 'DRAW',
      kind: 'command',
      domain: 'graphics',
      syntax: 'DRAW <dx>, <dy>[, <angle>]',
      description:
        'Draws from the graphics position by a distance, not to a coordinate — PLOT first to say where a line starts. A third argument bends the line into an arc turning through that many radians.',
    },
    {
      name: 'CIRCLE',
      kind: 'command',
      domain: 'graphics',
      syntax: 'CIRCLE <x>, <y>, <radius>',
      description:
        'Draws a circle centred on a point. It is clipped rather than refused where it runs off the screen.',
    },
    {
      name: 'FILL',
      kind: 'command',
      domain: 'graphics',
      syntax: 'FILL <x>, <y>',
      description:
        'Flood-fills the area around a point in the current pen, out to whatever encloses it. An unenclosed area fills the screen.',
    },
    {
      name: 'POINT',
      kind: 'function',
      domain: 'graphics',
      syntax: 'POINT(<x>, <y>)',
      description:
        'The colour of the pixel at a graphics coordinate, as a palette slot number.',
    },
    {
      name: 'FATPIX',
      kind: 'command',
      domain: 'graphics',
      syntax: 'FATPIX <number>',
      description:
        'Draws mode 2 pixels at double width (1) or single (0), which trades resolution for speed on the mode whose attributes change every scanline.',
    },
    {
      name: 'GRAB',
      kind: 'command',
      domain: 'graphics',
      syntax: 'GRAB <strvar>, <x>, <y>, <width>, <height>',
      description:
        'Copies a rectangle of screen into a string, which PUT draws back. This pair is how a SAM program animates a sprite.',
    },
    {
      name: 'PUT',
      kind: 'command',
      domain: 'graphics',
      syntax: 'PUT [OVER <number>;] <x>, <y>, <string>[, <string>]',
      description:
        'Draws a grabbed rectangle back at a position, optionally through a second string used as a mask. A qualifier such as OVER goes in front of the coordinates, not after them.',
    },
    {
      name: 'ROLL',
      kind: 'command',
      domain: 'graphics',
      syntax: 'ROLL <direction>[, <number>[, <x>, <y>, <width>, <height>]]',
      description:
        'Shifts the screen, or a rectangle of it, wrapping what falls off one edge round to the other. The direction is 1 to 4 and the second argument is how many pixels.',
    },
    {
      name: 'SCROLL',
      kind: 'command',
      domain: 'graphics',
      syntax: 'SCROLL <direction>[, <number>[, <x>, <y>, <width>, <height>]]',
      description:
        'The same shift as ROLL, but losing what falls off the edge instead of wrapping it round.',
    },
    {
      name: 'BLITZ',
      kind: 'command',
      domain: 'graphics',
      syntax: 'BLITZ <string>',
      description:
        'Runs a string of packed drawing commands in one go, which is far quicker than the same figure drawn statement by statement. Malformed contents are "Invalid BLITZ code".',
    },
    {
      name: 'SCREEN',
      kind: 'command',
      domain: 'graphics',
      syntax: 'SCREEN <screen>',
      description:
        'Directs printing and plotting to one of the machine’s screens. Screen 1 is the one it boots with; naming one that has not been opened is "Invalid screen number".',
    },
    {
      name: 'DISPLAY',
      kind: 'command',
      domain: 'graphics',
      syntax: 'DISPLAY <screen>',
      description:
        'Shows a screen, which need not be the one being drawn on — draw on one and display another and the picture appears complete rather than being built up in view.',
    },
    {
      name: 'WRITE',
      kind: 'operator',
      domain: 'graphics',
      syntax: 'FILL WRITE <x>, <y>',
      description:
        'A qualifier selecting the writing form of a command. The ROM alone refuses it, along with the rest of the vocabulary a disc operating system fills in.',
    },

    // ---- Colour ----
    {
      name: 'PALETTE',
      kind: 'command',
      domain: 'colour',
      syntax: 'PALETTE <index>, <colour>',
      description:
        'Points one of the sixteen colour-lookup slots at one of the 128 palette colours, so PEN 5 means whatever slot 5 was last told. A slot above 15 is "Invalid colour" and a colour above 127 "Invalid palette colour".',
    },
    {
      name: 'PEN',
      kind: 'command',
      domain: 'colour',
      syntax: 'PEN <colour>',
      description:
        'Sets the foreground colour for printing and plotting, as one of the sixteen palette slots. INK is accepted as a spelling of it and lists back as PEN.',
    },
    {
      name: 'PAPER',
      kind: 'command',
      domain: 'colour',
      syntax: 'PAPER <colour>',
      description:
        'Sets the background colour that printing lays its characters on and CLS clears to.',
    },
    {
      name: 'BORDER',
      kind: 'command',
      domain: 'colour',
      syntax: 'BORDER <colour>',
      description:
        'Sets the colour of the surround, from the same sixteen slots. A value above 15 is "Invalid colour".',
    },
    {
      name: 'FLASH',
      kind: 'command',
      domain: 'colour',
      syntax: 'FLASH <number>',
      description:
        'Alternates pen and paper: 1 flashing, 0 steady. An attribute bit, so it works in mode 1 only.',
    },
    {
      name: 'BRIGHT',
      kind: 'command',
      domain: 'colour',
      syntax: 'BRIGHT <number>',
      description:
        'Selects the bright half of the colour pair: 1 bright, 0 normal. An attribute bit, so it works in mode 1 only.',
    },
    {
      name: 'INVERSE',
      kind: 'command',
      domain: 'colour',
      syntax: 'INVERSE <number>',
      description:
        'Swaps pen and paper while printing: 1 inverse, 0 normal. Unlike FLASH and BRIGHT this is done as the characters are drawn, so it works in every mode.',
    },
    {
      name: 'OVER',
      kind: 'command',
      domain: 'colour',
      syntax: 'OVER <number>',
      description:
        'Combines what is drawn with what is already there rather than replacing it: 1 over, 0 normal. Drawing the same thing twice in OVER 1 erases it, which is how a sprite is moved without a background copy.',
    },
    {
      name: 'ATTR',
      kind: 'function',
      domain: 'colour',
      syntax: 'ATTR(<row>, <col>)',
      description:
        'The attribute byte of a character cell — its ink, paper, bright and flash bits. A mode 1 reading: in any other mode it answers "Invalid screen mode", there being no attribute to read.',
    },

    // ---- Sound ----
    {
      name: 'BEEP',
      kind: 'command',
      domain: 'sound',
      syntax: 'BEEP <duration>, <pitch>',
      description:
        'Sounds one note for a length in seconds at a pitch in semitones from middle C, exactly as the Spectrum’s BEEP does.',
    },
    {
      name: 'SOUND',
      kind: 'command',
      domain: 'sound',
      syntax: 'SOUND <hwreg>, <byte>',
      description:
        'Writes a value straight into one of the sound chip’s registers, 0 to 31. This is not a note: it is the only way to reach the SAA 1099’s noise generators, envelopes and stereo, and needs the register map on the hardware page.',
    },
    {
      name: 'ZAP',
      kind: 'command',
      domain: 'sound',
      syntax: 'ZAP',
      description:
        'One of the four built-in effects, a rising zap. Takes no arguments.',
    },
    {
      name: 'POW',
      kind: 'command',
      domain: 'sound',
      syntax: 'POW',
      description: 'A built-in thump. Takes no arguments.',
    },
    {
      name: 'BOOM',
      kind: 'command',
      domain: 'sound',
      syntax: 'BOOM',
      description: 'A built-in explosion. Takes no arguments.',
    },
    {
      name: 'ZOOM',
      kind: 'command',
      domain: 'sound',
      syntax: 'ZOOM',
      description: 'A built-in falling sweep. Takes no arguments.',
    },

    // ---- Input ----
    {
      name: 'INPUT',
      kind: 'command',
      domain: 'input',
      syntax: 'INPUT [<prompt>;] <var>[, <var>]…',
      description:
        'Waits for a line to be typed in the lower window and stores it. The prompt is printed first; without one the machine shows nothing but the cursor.',
    },
    {
      name: 'GET',
      kind: 'command',
      domain: 'input',
      syntax: 'GET <var>[, <var>]…',
      description:
        'Waits for a single keypress and stores it — its code in a numeric variable, its character in a string one. Unlike INKEY$ it blocks until a key arrives.',
    },
    {
      name: 'INKEY$',
      kind: 'function',
      domain: 'input',
      syntax: 'INKEY$',
      description:
        'The key held down right now as a one-character string, or "" when none is. Non-blocking, which makes it the heart of every real-time game loop.',
    },
    {
      name: 'KEY',
      kind: 'command',
      domain: 'input',
      syntax: 'KEY <number>, <number>',
      description:
        'Programs one of the ten function keys. Both operands are numbers; the string a key produces is set with DEF KEYCODE.',
    },
    {
      name: 'DEF KEYCODE',
      kind: 'command',
      domain: 'input',
      syntax: 'DEF KEYCODE <keycode> = <string>',
      description:
        'Makes a key produce a string rather than its own character, so a keystroke can type a whole command.',
    },
    {
      name: 'RECORD',
      kind: 'command',
      domain: 'input',
      syntax: 'RECORD TO <strvar> | RECORD STOP',
      description:
        'Records everything typed into a string until RECORD STOP. KEYIN plays it back, which together make a keyboard macro.',
    },
    {
      name: 'BUTTON',
      kind: 'function',
      domain: 'input',
      syntax: 'BUTTON <number>',
      description:
        'The state of mouse button 1 to 3: 1 while it is held, 0 otherwise. No mouse is fitted here.',
    },
    {
      name: 'XMOUSE',
      kind: 'function',
      domain: 'input',
      syntax: 'XMOUSE',
      description:
        'The mouse’s horizontal position. No mouse is fitted here, so it does not move.',
    },
    {
      name: 'YMOUSE',
      kind: 'function',
      domain: 'input',
      syntax: 'YMOUSE',
      description:
        'The mouse’s vertical position. No mouse is fitted here, so it does not move.',
    },
    {
      name: 'XPEN',
      kind: 'function',
      domain: 'input',
      syntax: 'XPEN',
      description:
        'The light pen’s horizontal position. No light pen is fitted here.',
    },
    {
      name: 'YPEN',
      kind: 'function',
      domain: 'input',
      syntax: 'YPEN',
      description:
        'The light pen’s vertical position. No light pen is fitted here.',
    },

    // ---- Storage ----
    {
      name: 'SAVE',
      kind: 'command',
      domain: 'storage',
      syntax: 'SAVE <filename> [LINE <line>]',
      description:
        'Saves the program to the current device, asking you to start the tape first. LINE makes the saved copy run itself from that line when it is loaded.',
    },
    {
      name: 'LOAD',
      kind: 'command',
      domain: 'storage',
      syntax:
        'LOAD <filename> | LOAD <filename> CODE | LOAD <filename> SCREEN$',
      description:
        'Loads a program, replacing what is in memory. CODE loads a memory block back where it was saved from and SCREEN$ loads a saved picture straight into the display.',
    },
    {
      name: 'MERGE',
      kind: 'command',
      domain: 'storage',
      syntax: 'MERGE <filename>',
      description:
        'Loads a program without erasing the one in memory, line numbers in the file replacing lines of the same number.',
    },
    {
      name: 'VERIFY',
      kind: 'command',
      domain: 'storage',
      syntax: 'VERIFY <filename>',
      description:
        'Reads a saved file back and compares it against memory without loading it, which is how a tape save was checked before the machine was switched off.',
    },
    {
      name: 'LINE',
      kind: 'operator',
      domain: 'storage',
      syntax: 'SAVE <filename> LINE <line>',
      description:
        'Gives a saved program an auto-run line, so loading it starts it. The IDE exports "load only" tapes, and runs the program itself.',
    },
    {
      name: 'DEVICE',
      kind: 'command',
      domain: 'storage',
      syntax: 'DEVICE T | DEVICE D1 | DEVICE N',
      description:
        'Chooses where SAVE and LOAD go: T the tape, D1 (or D2) a disc drive, N the network. A number after the T sets the tape speed, the ROM’s own default being 112.',
    },
    {
      name: 'BOOT',
      kind: 'command',
      domain: 'storage',
      syntax: 'BOOT',
      description:
        'Loads and runs the boot file from the current device — what the machine does itself when a disc is in the drive at reset.',
    },
    {
      name: 'OPEN',
      kind: 'command',
      domain: 'storage',
      syntax: 'OPEN #<file>; <string> | OPEN SCREEN <screen>, <mode>',
      description:
        'Opens a stream on a device or a file, or opens a second screen in a given mode for SCREEN and DISPLAY to use. The file form needs a disc operating system and answers "No DOS" without one.',
    },
    {
      name: 'CLOSE',
      kind: 'command',
      domain: 'storage',
      syntax: 'CLOSE #<file>',
      description:
        'Closes a stream, or a screen opened with OPEN SCREEN. Closing one that was never opened is "Stream is not open".',
    },
    {
      name: 'EOF',
      kind: 'function',
      domain: 'storage',
      syntax: 'EOF <file>',
      description:
        'True once an open file has been read to its end. Needs a disc operating system; without one it answers "No DOS".',
    },
    {
      name: 'PTR',
      kind: 'function',
      domain: 'storage',
      syntax: 'PTR <file>',
      description:
        'The current position within an open file. Needs a disc operating system; without one it answers "No DOS".',
    },
    {
      name: 'PATH$',
      kind: 'function',
      domain: 'storage',
      syntax: 'PATH$',
      description:
        'The current directory path. Needs a disc operating system; without one it answers "No DOS".',
    },
    {
      name: 'DIR',
      kind: 'command',
      domain: 'storage',
      syntax: 'DIR [<string>]',
      description:
        'Lists a disc directory, optionally matching a pattern. One of the words the ROM tokenizes but cannot run: without a disc operating system it is refused as "Not understood".',
    },
    {
      name: 'FORMAT',
      kind: 'command',
      domain: 'storage',
      syntax: 'FORMAT <string>',
      description:
        'Formats a disc. Refused as "Not understood" without a disc operating system.',
    },
    {
      name: 'ERASE',
      kind: 'command',
      domain: 'storage',
      syntax: 'ERASE <filename>',
      description:
        'Deletes a file. Refused as "Not understood" without a disc operating system.',
    },
    {
      name: 'MOVE',
      kind: 'command',
      domain: 'storage',
      syntax: 'MOVE <file> TO <file>',
      description:
        'Copies between streams, which is how a file is sent to the printer or the network. Refused as "Not understood" without a disc operating system.',
    },
    {
      name: 'COPY',
      kind: 'command',
      domain: 'storage',
      syntax: 'COPY <filename> TO <filename>',
      description:
        'Copies a file. Refused as "Not understood" without a disc operating system.',
    },
    {
      name: 'RENAME',
      kind: 'command',
      domain: 'storage',
      syntax: 'RENAME <filename> TO <filename>',
      description:
        'Renames a file. Refused as "Not understood" without a disc operating system.',
    },
    {
      name: 'PROTECT',
      kind: 'command',
      domain: 'storage',
      syntax: 'PROTECT <filename>',
      description:
        'Write-protects a file. Refused as "Not understood" without a disc operating system.',
    },
    {
      name: 'HIDE',
      kind: 'command',
      domain: 'storage',
      syntax: 'HIDE <filename>',
      description:
        'Hides a file from the directory listing. Refused as "Not understood" without a disc operating system.',
    },

    // ---- Memory and hardware ----
    {
      name: 'PEEK',
      kind: 'function',
      domain: 'memory-hardware',
      syntax: 'PEEK <addr>',
      description:
        'Reads one byte. Addresses run past 0xFFFF here: the space PEEK sees is ROM 0 and then BASIC’s four pages one after another, up to 0x1FFFF.',
    },
    {
      name: 'DPEEK',
      kind: 'function',
      domain: 'memory-hardware',
      syntax: 'DPEEK <addr>',
      description:
        'Reads a two-byte little-endian word, the pair of PEEKs a machine-code address usually wants written as one.',
    },
    {
      name: 'POKE',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'POKE <addr>, <byte>',
      description:
        'Writes one byte, in the same address space PEEK reads. A POKE into ROM 0 is discarded rather than refused.',
    },
    {
      name: 'DPOKE',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'DPOKE <addr>, <word>',
      description:
        'Writes a two-byte little-endian word — the low byte at the address and the high byte above it.',
    },
    {
      name: 'IN',
      kind: 'function',
      domain: 'memory-hardware',
      syntax: 'IN <port>',
      description:
        'Reads a byte from a Z80 input port. The port is the whole sixteen-bit address, which the SAM’s hardware needs: the palette port is selected by the high byte.',
    },
    {
      name: 'OUT',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'OUT <port>, <byte>',
      description:
        'Writes a byte to a Z80 output port. This is how the video and paging registers are reached, and how a program can page itself out of existence.',
    },
    {
      name: 'CALL',
      kind: 'command',
      domain: 'memory-hardware',
      syntax: 'CALL <addr>[, <arg>]…',
      description:
        'Calls machine code at an address, optionally passing arguments to it. This is how a program reaches a code block the IDE has loaded for it.',
    },
    {
      name: 'USR',
      kind: 'function',
      domain: 'memory-hardware',
      syntax: 'USR <addr>',
      description:
        'Calls machine code and returns the BC register it leaves. Takes the address itself — there is no USR "a" form for a user-defined graphic, UDG doing that job here.',
    },
    {
      name: 'USR$',
      kind: 'function',
      domain: 'memory-hardware',
      syntax: 'USR$ <string>',
      description:
        'Calls an external command by name, the hook a disc operating system hangs its own commands on.',
    },
    {
      name: 'FREE',
      kind: 'function',
      domain: 'memory-hardware',
      syntax: 'FREE',
      description:
        'The bytes still free for the program, its variables and its strings — RAMTOP less the top of everything in use. A cold machine reports 57545.',
    },
    {
      name: 'RAMTOP',
      kind: 'function',
      domain: 'memory-hardware',
      syntax: 'RAMTOP',
      description:
        'The highest address BASIC will use. It boots at the top of the fourth page of the BASIC area; CLEAR with an address lowers it.',
    },
    {
      name: 'MEM$',
      kind: 'function',
      domain: 'memory-hardware',
      syntax: 'MEM$(<addr> TO <addr>)',
      description:
        'A slice of memory as a string, in the address space PEEK reads — so it is a bulk PEEK, and assigning to it is a bulk POKE. The slice is required: MEM$ with a single subscript is not a complete expression.',
    },
    {
      name: 'SVAR',
      kind: 'function',
      domain: 'memory-hardware',
      syntax: 'SVAR <sysvar>',
      description:
        'The address of a system variable, by number, so a program can read the interpreter’s own state without a table of addresses that a new ROM would move.',
    },
    {
      name: 'DVAR',
      kind: 'function',
      domain: 'memory-hardware',
      syntax: 'DVAR <sysvar>',
      description:
        'The address of a disc-operating-system variable. Answers "No DOS" without one loaded.',
    },
    {
      name: 'UDG',
      kind: 'function',
      domain: 'memory-hardware',
      syntax: 'UDG <string>',
      description:
        'The address of the eight bytes that define a character’s shape, named by a one-character string. POKE them to redraw the glyph.',
    },
    {
      name: 'LENGTH',
      kind: 'function',
      domain: 'memory-hardware',
      syntax: 'LENGTH(<action>, <target>)',
      description:
        'The size or the address of a variable, an array or a procedure, the first argument choosing which — so LENGTH(1,a$) measures a string where LENGTH(0,a$) finds it.',
    },

    // ---- Program editing ----
    {
      name: 'NEW',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'NEW',
      description:
        'Erases the program and its variables and resets the interpreter. Memory above RAMTOP survives, which is how a code block outlives the program that loaded it.',
    },
    {
      name: 'RUN',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'RUN [<line>]',
      description:
        'Clears the variables and runs from the first line, or from the line given. Use GO TO to start without clearing them.',
    },
    {
      name: 'CONTINUE',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'CONTINUE',
      description:
        'Resumes where the program stopped, at the statement after the STOP or the break. Editing a line first loses the resume point.',
    },
    {
      name: 'LIST',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'LIST [<line>]',
      description:
        'Lists the program from a line, a screenful at a time. The listing shows the keywords in the ROM’s own spelling, so GOTO comes back as GO TO.',
    },
    {
      name: 'LLIST',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'LLIST [<line>]',
      description:
        'Lists the program to the printer. Nothing is fitted here, so it goes nowhere.',
    },
    {
      name: 'DELETE',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'DELETE <line> TO <line>',
      description: 'Deletes a whole range of lines in one statement.',
    },
    {
      name: 'RENUM',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'RENUM [LINE <line> TO <line>] [STEP <number>]',
      description:
        'Renumbers the program and fixes every GO TO, GO SUB and RESTORE that names a line. A jump to a computed line number cannot be fixed, which is one more reason to use LABEL.',
    },
    {
      name: 'AUTO',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'AUTO [<line>[, <number>]]',
      description:
        'Numbers lines automatically as they are typed, from a starting line and in steps. A typing aid at the machine; the IDE numbers lines for you.',
    },
    {
      name: 'REM',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'REM <comment>',
      description:
        'A comment: the rest of the line is stored exactly as typed and never run. Unlike the Spectrum, machine code does not live here — it goes in a block above RAMTOP.',
    },

    // ---- Error handling ----
    {
      name: 'ON ERROR',
      kind: 'command',
      domain: 'error-handling',
      syntax: 'ON ERROR <statement> | ON ERROR OFF',
      description:
        'Runs a statement instead of stopping when an error occurs — usually a GO TO to a handler. OFF puts the normal reporting back.',
    },
    {
      name: 'OFF',
      kind: 'operator',
      domain: 'error-handling',
      syntax: 'ON ERROR OFF',
      description:
        'A qualifier turning a setting off. Its one use in the bare ROM is cancelling an error handler.',
    },
  ],
};

export const samcoupeReference = withAbbreviations('samcoupe', samcoupeTable);
