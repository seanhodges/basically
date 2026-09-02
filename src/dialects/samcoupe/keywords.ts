import type { KeywordInfo } from '../types';

/**
 * SAM BASIC's keyword table, transcribed from the v3.0 ROM's own token list.
 *
 * Two disjoint ranges, and the split matters because it is how the byte stream
 * is read back:
 *
 * - **Functions and operators, 0x3B-0x83**, each stored as `0xFF` followed by
 *   the code. `0xFF` is the function leader; there is no bare 0xFF token.
 * - **Qualifiers and commands, 0x85-0xFE**, stored as the single byte.
 *
 * The ROM keeps one list of strings for both, terminator marked by bit 7 of the
 * last character, and indexes it twice - once from 0x3B and once from 0x85 -
 * so the gap at 0x84 exists in the numbering and not in the table. Codes with
 * no keyword (0x49, 0x4E, 0x51, 0x52, 0x68, 0x6A, 0x75, 0x77-0x79, 0x7D, 0xD0,
 * 0xF7-0xFE) hold a `-` placeholder in the ROM and are simply absent here.
 *
 * **Order is meaningful.** The ROM's matcher walks this list from the top and
 * takes the first entry that matches with a legal character after it, so LOOP
 * IF must precede LOOP and ON ERROR must precede ON. The tokenizer walks the
 * table in the same order for the same reason; sorting it would silently change
 * what programs mean.
 *
 * Two spellings appear twice because the ROM keeps two tokens for one word:
 * 0xD7/0xD8 are the long and short IF and 0xD9/0xDA the long and short ELSE.
 * A typed IF always tokenizes to 0xD7, and the ROM's syntax pass rewrites it to
 * 0xD8 when THEN follows on the same statement - see the tokenizer. Both list
 * back as the same word, so only the first of each pair is a table entry.
 */
export const samcoupeKeywords: KeywordInfo[] = [
  // -- Immediate functions, 0x3B-0x52. No argument, or a bracketed one, so the
  //    ROM lists them with neither a leading nor a trailing space.
  {
    word: 'PI',
    token: 0x3b,
    kind: 'function',
    signature: 'PI',
    doc: '3.14159…',
  },
  {
    word: 'RND',
    token: 0x3c,
    kind: 'function',
    signature: 'RND',
    doc: 'Random number in [0,1). Seeded by RANDOMIZE.',
  },
  {
    word: 'POINT',
    token: 0x3d,
    kind: 'function',
    signature: 'POINT (x,y)',
    doc: 'Colour of the pixel at x,y.',
  },
  {
    word: 'FREE',
    token: 0x3e,
    kind: 'function',
    signature: 'FREE',
    doc: 'Bytes of memory still free for the program.',
  },
  {
    word: 'LENGTH',
    token: 0x3f,
    kind: 'function',
    signature: 'LENGTH (n,item)',
    doc: 'Size or address of a variable, array or DEF PROC - e.g. LENGTH(1,a$).',
  },
  {
    word: 'ITEM',
    token: 0x40,
    kind: 'function',
    signature: 'ITEM',
    doc: 'Type of the next DATA item: 0 none left, 1 string, 2 numeric.',
  },
  {
    word: 'ATTR',
    token: 0x41,
    kind: 'function',
    signature: 'ATTR (line,column)',
    doc: 'Attribute byte of a character cell.',
  },
  {
    word: 'FN',
    token: 0x42,
    kind: 'function',
    signature: 'FN name(args)',
    doc: 'Call a function declared with DEF FN.',
  },
  {
    word: 'BIN',
    token: 0x43,
    kind: 'function',
    signature: 'BIN 10110',
    doc: 'The value of a run of binary digits.',
  },
  {
    word: 'XMOUSE',
    token: 0x44,
    kind: 'function',
    signature: 'XMOUSE',
    doc: 'Mouse x position.',
  },
  {
    word: 'YMOUSE',
    token: 0x45,
    kind: 'function',
    signature: 'YMOUSE',
    doc: 'Mouse y position.',
  },
  {
    word: 'XPEN',
    token: 0x46,
    kind: 'function',
    signature: 'XPEN',
    doc: 'Light-pen x position.',
  },
  {
    word: 'YPEN',
    token: 0x47,
    kind: 'function',
    signature: 'YPEN',
    doc: 'Light-pen y position.',
  },
  {
    word: 'RAMTOP',
    token: 0x48,
    kind: 'function',
    signature: 'RAMTOP',
    doc: 'Highest address BASIC will use.',
  },
  {
    word: 'INSTR',
    token: 0x4a,
    kind: 'function',
    signature: 'INSTR (a$,b$)',
    doc: 'Position of b$ inside a$, or 0 if it is not there.',
  },
  {
    word: 'INKEY$',
    token: 0x4b,
    kind: 'function',
    signature: 'INKEY$',
    doc: 'Key currently pressed, "" if none. The heart of every game loop.',
  },
  {
    word: 'SCREEN$',
    token: 0x4c,
    kind: 'function',
    signature: 'SCREEN$ (line,column)',
    doc: 'Character shown at a screen position (recognises the font).',
  },
  {
    word: 'MEM$',
    token: 0x4d,
    kind: 'function',
    // The page form this used to carry is not one the ROM accepts: a single
    // subscript is "Not understood" and only a `TO` slice parses. What comes
    // back is the same address space PEEK reads, checked against PEEK on the
    // booted ROM.
    signature: 'MEM$(a TO b)',
    doc: 'A slice of memory as a string, for reading and writing RAM in bulk.',
  },
  {
    word: 'PATH$',
    token: 0x4f,
    kind: 'function',
    signature: 'PATH$',
    doc: 'Current directory path (needs a disc operating system).',
  },
  {
    word: 'STRING$',
    token: 0x50,
    kind: 'function',
    signature: 'STRING$ (n,a$)',
    doc: 'a$ repeated to n characters.',
  },

  // -- Calculator functions, 0x53-0x79. The ROM lists these with a trailing
  //    space, since their argument follows unbracketed.
  {
    word: 'SIN',
    token: 0x53,
    kind: 'function',
    signature: 'SIN n',
    doc: 'Sine (radians).',
  },
  {
    word: 'COS',
    token: 0x54,
    kind: 'function',
    signature: 'COS n',
    doc: 'Cosine (radians).',
  },
  {
    word: 'TAN',
    token: 0x55,
    kind: 'function',
    signature: 'TAN n',
    doc: 'Tangent (radians).',
  },
  {
    word: 'ASN',
    token: 0x56,
    kind: 'function',
    signature: 'ASN n',
    doc: 'Arcsine.',
  },
  {
    word: 'ACS',
    token: 0x57,
    kind: 'function',
    signature: 'ACS n',
    doc: 'Arccosine.',
  },
  {
    word: 'ATN',
    token: 0x58,
    kind: 'function',
    signature: 'ATN n',
    doc: 'Arctangent.',
  },
  {
    word: 'LN',
    token: 0x59,
    kind: 'function',
    signature: 'LN n',
    doc: 'Natural logarithm.',
  },
  {
    word: 'EXP',
    token: 0x5a,
    kind: 'function',
    signature: 'EXP n',
    doc: 'e to the power n.',
  },
  {
    word: 'ABS',
    token: 0x5b,
    kind: 'function',
    signature: 'ABS n',
    doc: 'Absolute value.',
  },
  {
    word: 'SGN',
    token: 0x5c,
    kind: 'function',
    signature: 'SGN n',
    doc: 'Sign: -1, 0 or 1.',
  },
  {
    word: 'SQR',
    token: 0x5d,
    kind: 'function',
    signature: 'SQR n',
    doc: 'Square root.',
  },
  {
    word: 'INT',
    token: 0x5e,
    kind: 'function',
    signature: 'INT n',
    doc: 'Integer part, rounding towards minus infinity.',
  },
  {
    word: 'USR',
    token: 0x5f,
    kind: 'function',
    signature: 'USR n',
    doc: 'Call machine code at n and return the BC it leaves.',
  },
  {
    word: 'IN',
    token: 0x60,
    kind: 'function',
    signature: 'IN port',
    doc: 'Read a byte from a Z80 input port.',
  },
  {
    word: 'PEEK',
    token: 0x61,
    kind: 'function',
    signature: 'PEEK addr',
    doc: 'Read one byte of memory.',
  },
  {
    word: 'DPEEK',
    token: 0x62,
    kind: 'function',
    signature: 'DPEEK addr',
    doc: 'Read a two-byte little-endian word.',
  },
  {
    word: 'DVAR',
    token: 0x63,
    kind: 'function',
    signature: 'DVAR n',
    doc: 'Address of a disc-operating-system variable (needs one loaded).',
  },
  {
    word: 'SVAR',
    token: 0x64,
    kind: 'function',
    signature: 'SVAR n',
    doc: 'Address of system variable n.',
  },
  {
    word: 'BUTTON',
    token: 0x65,
    kind: 'function',
    signature: 'BUTTON n',
    doc: 'Mouse button n (1-3): 1 if pressed, 0 if not.',
  },
  {
    word: 'EOF',
    token: 0x66,
    kind: 'function',
    signature: 'EOF n',
    doc: 'True at the end of an open file (needs a disc operating system).',
  },
  {
    word: 'PTR',
    token: 0x67,
    kind: 'function',
    signature: 'PTR n',
    doc: 'Position within an open file (needs a disc operating system).',
  },
  {
    word: 'UDG',
    token: 0x69,
    kind: 'function',
    signature: 'UDG a$',
    doc: 'Address of the eight bytes defining a character’s shape.',
  },
  {
    word: 'LEN',
    token: 0x6b,
    kind: 'function',
    signature: 'LEN a$',
    doc: 'Length of a string.',
  },
  {
    word: 'CODE',
    token: 0x6c,
    kind: 'function',
    signature: 'CODE a$',
    doc: 'Character code of the first character.',
  },
  {
    word: 'VAL$',
    token: 0x6d,
    kind: 'function',
    signature: 'VAL$ a$',
    doc: 'Evaluate a string as a string expression.',
  },
  {
    word: 'VAL',
    token: 0x6e,
    kind: 'function',
    signature: 'VAL a$',
    doc: 'Evaluate a string as a numeric expression.',
  },
  {
    word: 'TRUNC$',
    token: 0x6f,
    kind: 'function',
    signature: 'TRUNC$ a$',
    doc: 'The string with trailing spaces removed - for reading fixed-width array slots back.',
  },
  {
    word: 'CHR$',
    token: 0x70,
    kind: 'function',
    signature: 'CHR$ n',
    doc: 'Character with code n.',
  },
  {
    word: 'STR$',
    token: 0x71,
    kind: 'function',
    signature: 'STR$ n',
    doc: 'A number as the string PRINT would show.',
  },
  {
    word: 'BIN$',
    token: 0x72,
    kind: 'function',
    signature: 'BIN$ n',
    doc: 'A number as 8 or 16 binary digits.',
  },
  {
    word: 'HEX$',
    token: 0x73,
    kind: 'function',
    signature: 'HEX$ n',
    doc: 'A number as 2, 4 or 6 hex digits.',
  },
  {
    word: 'USR$',
    token: 0x74,
    kind: 'function',
    signature: 'USR$ a$',
    doc: 'Call an external command by name.',
  },
  {
    word: 'NOT',
    token: 0x76,
    kind: 'function',
    signature: 'NOT n',
    doc: 'Logical NOT: 1 when n is zero, else 0.',
  },

  // -- Binary operators, 0x7A-0x83. MOD to AND list with spaces either side;
  //    the three comparisons list with none.
  {
    word: 'MOD',
    token: 0x7a,
    kind: 'operator',
    signature: 'a MOD b',
    doc: 'Remainder after integer division.',
  },
  {
    word: 'DIV',
    token: 0x7b,
    kind: 'operator',
    signature: 'a DIV b',
    doc: 'Integer division.',
  },
  {
    word: 'BOR',
    token: 0x7c,
    kind: 'operator',
    signature: 'a BOR b',
    doc: 'Bitwise OR.',
  },
  {
    word: 'BAND',
    token: 0x7e,
    kind: 'operator',
    signature: 'a BAND b',
    doc: 'Bitwise AND.',
  },
  {
    word: 'OR',
    token: 0x7f,
    kind: 'operator',
    signature: 'a OR b',
    doc: 'Logical OR.',
  },
  {
    word: 'AND',
    token: 0x80,
    kind: 'operator',
    signature: 'a AND b',
    doc: 'Logical AND; with a string on the left it yields "" when b is zero.',
  },
  { word: '<>', token: 0x81, kind: 'operator', doc: 'Not equal.' },
  { word: '<=', token: 0x82, kind: 'operator', doc: 'Less than or equal.' },
  { word: '>=', token: 0x83, kind: 'operator', doc: 'Greater than or equal.' },

  // -- Qualifiers, 0x85-0x8F: words that shape another statement rather than
  //    opening one of their own.
  {
    word: 'USING',
    token: 0x85,
    kind: 'operator',
    signature: 'PRINT USING "###.##";n',
    doc: 'Format a number to a picture string.',
  },
  {
    word: 'WRITE',
    token: 0x86,
    kind: 'operator',
    signature: 'FILL WRITE …',
    doc: 'Qualifier selecting the writing form of a command.',
  },
  {
    word: 'AT',
    token: 0x87,
    kind: 'operator',
    signature: 'PRINT AT line,column;',
    doc: 'Position the print position.',
  },
  {
    word: 'TAB',
    token: 0x88,
    kind: 'operator',
    signature: 'PRINT TAB n;',
    doc: 'Move the print position to column n.',
  },
  {
    word: 'OFF',
    token: 0x89,
    kind: 'operator',
    signature: 'SCROLL OFF',
    doc: 'Qualifier turning a setting off.',
  },
  {
    word: 'WHILE',
    token: 0x8a,
    kind: 'operator',
    signature: 'DO WHILE cond',
    doc: 'Loop while a condition holds; legal on DO and on LOOP.',
  },
  {
    word: 'UNTIL',
    token: 0x8b,
    kind: 'operator',
    signature: 'LOOP UNTIL cond',
    doc: 'Loop until a condition holds; legal on DO and on LOOP.',
  },
  {
    word: 'LINE',
    token: 0x8c,
    kind: 'operator',
    signature: 'SAVE "name" LINE n',
    doc: 'Give a saved program an auto-run line.',
  },
  {
    word: 'THEN',
    token: 0x8d,
    kind: 'operator',
    signature: 'IF cond THEN …',
    doc: 'Introduces the body of a single-line IF.',
  },
  {
    word: 'TO',
    token: 0x8e,
    kind: 'operator',
    signature: 'FOR i=1 TO 10',
    doc: 'Range separator, in FOR and in string slices.',
  },
  {
    word: 'STEP',
    token: 0x8f,
    kind: 'operator',
    signature: 'FOR i=1 TO 10 STEP 2',
    doc: 'Loop increment.',
  },

  // -- Commands, 0x90-0xFE.
  {
    word: 'DIR',
    token: 0x90,
    kind: 'command',
    signature: 'DIR',
    doc: 'List a disc directory. Needs a disc operating system; the ROM alone rejects it.',
  },
  {
    word: 'FORMAT',
    token: 0x91,
    kind: 'command',
    signature: 'FORMAT "d1:"',
    doc: 'Format a disc. Needs a disc operating system.',
  },
  {
    word: 'ERASE',
    token: 0x92,
    kind: 'command',
    signature: 'ERASE "name"',
    doc: 'Delete a file. Needs a disc operating system.',
  },
  {
    word: 'MOVE',
    token: 0x93,
    kind: 'command',
    signature: 'MOVE …',
    doc: 'Copy between streams. Needs a disc operating system.',
  },
  {
    word: 'SAVE',
    token: 0x94,
    kind: 'command',
    signature: 'SAVE "name" [LINE n]',
    doc: 'Save the program, optionally with an auto-run line.',
  },
  {
    word: 'LOAD',
    token: 0x95,
    kind: 'command',
    signature: 'LOAD "name" [CODE|SCREEN$]',
    doc: 'Load a program, a code block or a screen.',
  },
  {
    word: 'MERGE',
    token: 0x96,
    kind: 'command',
    signature: 'MERGE "name"',
    doc: 'Load a program without erasing the one in memory.',
  },
  {
    word: 'VERIFY',
    token: 0x97,
    kind: 'command',
    signature: 'VERIFY "name"',
    doc: 'Check a saved file against memory.',
  },
  {
    word: 'OPEN',
    token: 0x98,
    kind: 'command',
    signature: 'OPEN #n',
    doc: 'Open a stream or a screen.',
  },
  {
    word: 'CLOSE',
    token: 0x99,
    kind: 'command',
    signature: 'CLOSE #n',
    doc: 'Close a stream or a screen.',
  },
  {
    word: 'CIRCLE',
    token: 0x9a,
    kind: 'command',
    signature: 'CIRCLE x,y,r',
    doc: 'Draw a circle.',
  },
  {
    word: 'PLOT',
    token: 0x9b,
    kind: 'command',
    signature: 'PLOT x,y',
    doc: 'Plot a point and move the graphics position there.',
  },
  {
    word: 'LET',
    token: 0x9c,
    kind: 'command',
    signature: 'LET name=expr',
    doc: 'Assign a value. SAM BASIC has no implied LET - a bare name opens a DEF PROC call.',
  },
  {
    word: 'BLITZ',
    token: 0x9d,
    kind: 'command',
    signature: 'BLITZ a$',
    doc: 'Run a compact string of drawing commands in one go.',
  },
  {
    word: 'BORDER',
    token: 0x9e,
    kind: 'command',
    signature: 'BORDER n',
    doc: 'Set the border colour.',
  },
  {
    word: 'CLS',
    token: 0x9f,
    kind: 'command',
    signature: 'CLS [#]',
    doc: 'Clear the screen, or the current window.',
  },
  {
    word: 'PALETTE',
    token: 0xa0,
    kind: 'command',
    signature: 'PALETTE index,colour',
    doc: 'Point one of the 16 colour-lookup slots at one of the 128 palette colours.',
  },
  {
    word: 'PEN',
    token: 0xa1,
    kind: 'command',
    signature: 'PEN n',
    doc: 'Set the foreground colour. INK is accepted as a spelling of it.',
  },
  {
    word: 'PAPER',
    token: 0xa2,
    kind: 'command',
    signature: 'PAPER n',
    doc: 'Set the background colour.',
  },
  {
    word: 'FLASH',
    token: 0xa3,
    kind: 'command',
    signature: 'FLASH n',
    doc: 'Alternate pen and paper (MODE 1 only).',
  },
  {
    word: 'BRIGHT',
    token: 0xa4,
    kind: 'command',
    signature: 'BRIGHT n',
    doc: 'Select the bright half of the colour pair (MODE 1 only).',
  },
  {
    word: 'INVERSE',
    token: 0xa5,
    kind: 'command',
    signature: 'INVERSE n',
    doc: 'Swap pen and paper while printing.',
  },
  {
    word: 'OVER',
    token: 0xa6,
    kind: 'command',
    signature: 'OVER n',
    doc: 'Combine with what is already on screen instead of replacing it.',
  },
  {
    word: 'FATPIX',
    token: 0xa7,
    kind: 'command',
    signature: 'FATPIX n',
    doc: 'Draw MODE 2 pixels double width (1) or single (0).',
  },
  {
    word: 'CSIZE',
    token: 0xa8,
    kind: 'command',
    signature: 'CSIZE w,h',
    doc: 'Character cell size: width 6 or 8, height 6-32.',
  },
  {
    word: 'BLOCKS',
    token: 0xa9,
    kind: 'command',
    signature: 'BLOCKS n',
    doc: 'Draw codes 128-143 as block graphics (1) or as user-defined shapes (0).',
  },
  {
    word: 'MODE',
    token: 0xaa,
    kind: 'command',
    signature: 'MODE n',
    doc: 'Select screen mode 1-4.',
  },
  {
    word: 'GRAB',
    token: 0xab,
    kind: 'command',
    signature: 'GRAB a$,x,y,w,h',
    doc: 'Copy a rectangle of screen into a string.',
  },
  {
    word: 'PUT',
    token: 0xac,
    kind: 'command',
    signature: 'PUT x,y,a$[,mask$]',
    doc: 'Draw a grabbed rectangle back, optionally through a mask.',
  },
  {
    word: 'BEEP',
    token: 0xad,
    kind: 'command',
    signature: 'BEEP duration,pitch',
    doc: 'Sound one note.',
  },
  {
    word: 'SOUND',
    token: 0xae,
    kind: 'command',
    signature: 'SOUND register,value',
    doc: 'Write a value to a SAA 1099 sound-chip register.',
  },
  {
    word: 'NEW',
    token: 0xaf,
    kind: 'command',
    signature: 'NEW',
    doc: 'Erase the program and variables.',
  },
  {
    word: 'RUN',
    token: 0xb0,
    kind: 'command',
    signature: 'RUN [n]',
    doc: 'Clear the variables and run from the first line, or from line n.',
  },
  {
    word: 'STOP',
    token: 0xb1,
    kind: 'command',
    signature: 'STOP',
    doc: 'Stop the program; CONTINUE resumes.',
  },
  {
    word: 'CONTINUE',
    token: 0xb2,
    kind: 'command',
    signature: 'CONTINUE',
    doc: 'Resume where the program stopped.',
  },
  {
    word: 'CLEAR',
    token: 0xb3,
    kind: 'command',
    signature: 'CLEAR [addr]',
    doc: 'Erase the variables, and optionally lower RAMTOP.',
  },
  {
    word: 'GO TO',
    token: 0xb4,
    kind: 'command',
    signature: 'GO TO n',
    doc: 'Jump to a line. GOTO is the same keyword.',
  },
  {
    word: 'GO SUB',
    token: 0xb5,
    kind: 'command',
    signature: 'GO SUB n',
    doc: 'Call a subroutine. GOSUB is the same keyword.',
  },
  {
    word: 'RETURN',
    token: 0xb6,
    kind: 'command',
    signature: 'RETURN',
    doc: 'Return from GO SUB.',
  },
  {
    word: 'REM',
    token: 0xb7,
    kind: 'command',
    signature: 'REM text',
    doc: 'Comment: the rest of the line is stored as typed.',
  },
  {
    word: 'READ',
    token: 0xb8,
    kind: 'command',
    signature: 'READ a,b$',
    doc: 'Read the next DATA items into variables.',
  },
  {
    word: 'DATA',
    token: 0xb9,
    kind: 'command',
    signature: 'DATA 1,"two"',
    doc: 'Values for READ; the items are expressions, evaluated when read.',
  },
  {
    word: 'RESTORE',
    token: 0xba,
    kind: 'command',
    signature: 'RESTORE [n]',
    doc: 'Set READ back to the first DATA item, or to line n.',
  },
  {
    word: 'PRINT',
    token: 0xbb,
    kind: 'command',
    signature: 'PRINT items',
    doc: 'Print to the screen; ";" joins, "," tabs and "\'" starts a new line.',
  },
  {
    word: 'LPRINT',
    token: 0xbc,
    kind: 'command',
    signature: 'LPRINT items',
    doc: 'Print to the printer.',
  },
  {
    word: 'LIST',
    token: 0xbd,
    kind: 'command',
    signature: 'LIST [n]',
    doc: 'List the program.',
  },
  {
    word: 'LLIST',
    token: 0xbe,
    kind: 'command',
    signature: 'LLIST [n]',
    doc: 'List the program to the printer.',
  },
  {
    word: 'DUMP',
    token: 0xbf,
    kind: 'command',
    signature: 'DUMP',
    doc: 'Print the screen on the printer.',
  },
  {
    word: 'FOR',
    token: 0xc0,
    kind: 'command',
    signature: 'FOR i=1 TO 10 [STEP s]',
    doc: 'Open a counting loop.',
  },
  {
    word: 'NEXT',
    token: 0xc1,
    kind: 'command',
    signature: 'NEXT i',
    doc: 'Close a counting loop.',
  },
  {
    word: 'PAUSE',
    token: 0xc2,
    kind: 'command',
    signature: 'PAUSE n',
    doc: 'Wait n frames, or until a key is pressed; PAUSE 0 waits for a key.',
  },
  {
    word: 'DRAW',
    token: 0xc3,
    kind: 'command',
    signature: 'DRAW x,y[,angle]',
    doc: 'Draw a line from the graphics position, optionally curved.',
  },
  {
    word: 'DEFAULT',
    token: 0xc4,
    kind: 'command',
    signature: 'DEFAULT name=expr',
    doc: 'Give a DEF PROC parameter a value to use when the call omits it.',
  },
  {
    word: 'DIM',
    token: 0xc5,
    kind: 'command',
    signature: 'DIM a(10)',
    doc: 'Create an array.',
  },
  {
    word: 'INPUT',
    token: 0xc6,
    kind: 'command',
    signature: 'INPUT "prompt";a',
    doc: 'Read a value typed at the keyboard.',
  },
  {
    word: 'RANDOMIZE',
    token: 0xc7,
    kind: 'command',
    signature: 'RANDOMIZE [n]',
    doc: 'Seed RND; with no argument, seed it from the frame counter.',
  },
  {
    word: 'DEF FN',
    token: 0xc8,
    kind: 'command',
    signature: 'DEF FN name(args)=expr',
    doc: 'Define a one-expression function.',
  },
  {
    word: 'DEF KEYCODE',
    token: 0xc9,
    kind: 'command',
    signature: 'DEF KEYCODE n=a$',
    doc: 'Make a key produce a string.',
  },
  {
    word: 'DEF PROC',
    token: 0xca,
    kind: 'command',
    signature: 'DEF PROC name [params]',
    doc: 'Open a procedure, called afterwards by writing its name.',
  },
  {
    word: 'END PROC',
    token: 0xcb,
    kind: 'command',
    signature: 'END PROC',
    doc: 'Close a procedure and return to the caller.',
  },
  {
    word: 'RENUM',
    token: 0xcc,
    kind: 'command',
    signature: 'RENUM [LINE n TO m] [STEP s]',
    doc: 'Renumber the program, fixing the jumps.',
  },
  {
    word: 'DELETE',
    token: 0xcd,
    kind: 'command',
    signature: 'DELETE n TO m',
    doc: 'Delete a range of lines.',
  },
  {
    word: 'REF',
    token: 0xce,
    kind: 'command',
    signature: 'REF name',
    doc: 'Pass a DEF PROC parameter by reference. The ROM alone rejects it.',
  },
  {
    word: 'COPY',
    token: 0xcf,
    kind: 'command',
    signature: 'COPY "from" TO "to"',
    doc: 'Copy a file. Needs a disc operating system; the ROM alone rejects it.',
  },
  {
    word: 'KEYIN',
    token: 0xd1,
    kind: 'command',
    signature: 'KEYIN a$',
    doc: 'Execute a string as if it had been typed in - self-modifying programs live here.',
  },
  {
    word: 'LOCAL',
    token: 0xd2,
    kind: 'command',
    signature: 'LOCAL a,b$',
    doc: 'Give a procedure its own copies of these variables.',
  },
  {
    word: 'LOOP IF',
    token: 0xd3,
    kind: 'command',
    signature: 'LOOP IF cond',
    doc: 'Close a DO loop, repeating while the condition is true.',
  },
  {
    word: 'DO',
    token: 0xd4,
    kind: 'command',
    signature: 'DO [WHILE|UNTIL cond]',
    doc: 'Open a loop.',
  },
  {
    word: 'LOOP',
    token: 0xd5,
    kind: 'command',
    signature: 'LOOP [WHILE|UNTIL cond]',
    doc: 'Close a DO loop.',
  },
  {
    word: 'EXIT IF',
    token: 0xd6,
    kind: 'command',
    signature: 'EXIT IF cond',
    doc: 'Leave the enclosing DO loop when the condition is true.',
  },
  {
    word: 'IF',
    token: 0xd7,
    kind: 'command',
    signature: 'IF cond [THEN …]',
    doc: 'Conditional. With THEN it runs the rest of the line; without, it opens a block closed by END IF.',
  },
  {
    word: 'ELSE',
    token: 0xd9,
    kind: 'command',
    signature: 'ELSE …',
    doc: 'The other branch of an IF, single-line or block.',
  },
  {
    word: 'END IF',
    token: 0xdb,
    kind: 'command',
    signature: 'END IF',
    doc: 'Close a block IF.',
  },
  {
    word: 'KEY',
    token: 0xdc,
    kind: 'command',
    signature: 'KEY n,value',
    doc: 'Set what one of the ten function keys produces.',
  },
  {
    word: 'ON ERROR',
    token: 0xdd,
    kind: 'command',
    signature: 'ON ERROR statement',
    doc: 'Run a statement instead of stopping when an error occurs.',
  },
  {
    word: 'ON',
    token: 0xde,
    kind: 'command',
    signature: 'ON n GO TO a,b,c',
    doc: 'Branch to the nth of a list of destinations.',
  },
  {
    word: 'GET',
    token: 0xdf,
    kind: 'command',
    signature: 'GET a[,b$]',
    doc: 'Wait for a keypress and store it.',
  },
  {
    word: 'OUT',
    token: 0xe0,
    kind: 'command',
    signature: 'OUT port,value',
    doc: 'Write a byte to a Z80 output port.',
  },
  {
    word: 'POKE',
    token: 0xe1,
    kind: 'command',
    signature: 'POKE addr,value',
    doc: 'Write one byte of memory.',
  },
  {
    word: 'DPOKE',
    token: 0xe2,
    kind: 'command',
    signature: 'DPOKE addr,value',
    doc: 'Write a two-byte little-endian word.',
  },
  {
    word: 'RENAME',
    token: 0xe3,
    kind: 'command',
    signature: 'RENAME "from" TO "to"',
    doc: 'Rename a file. Needs a disc operating system; the ROM alone rejects it.',
  },
  {
    word: 'CALL',
    token: 0xe4,
    kind: 'command',
    signature: 'CALL addr[,args]',
    doc: 'Call machine code, optionally passing arguments.',
  },
  {
    word: 'ROLL',
    token: 0xe5,
    kind: 'command',
    signature: 'ROLL dir[,pixels[,x,y,w,h]]',
    doc: 'Shift the screen or a rectangle of it, wrapping round.',
  },
  {
    word: 'SCROLL',
    token: 0xe6,
    kind: 'command',
    signature: 'SCROLL dir[,pixels[,x,y,w,h]]',
    doc: 'Shift the screen or a rectangle of it, losing what falls off.',
  },
  {
    word: 'SCREEN',
    token: 0xe7,
    kind: 'command',
    signature: 'SCREEN n',
    doc: 'Direct printing and plotting to screen n.',
  },
  {
    word: 'DISPLAY',
    token: 0xe8,
    kind: 'command',
    signature: 'DISPLAY n',
    doc: 'Show screen n, whichever one is being drawn on.',
  },
  {
    word: 'BOOT',
    token: 0xe9,
    kind: 'command',
    signature: 'BOOT',
    doc: 'Load and run the boot file from the current device.',
  },
  {
    word: 'LABEL',
    token: 0xea,
    kind: 'command',
    signature: 'LABEL name',
    doc: 'Name this line, so a jump can go to the name instead of a number.',
  },
  {
    word: 'FILL',
    token: 0xeb,
    kind: 'command',
    signature: 'FILL x,y',
    doc: 'Flood-fill the area around a point.',
  },
  {
    word: 'WINDOW',
    token: 0xec,
    kind: 'command',
    signature: 'WINDOW left,right,top,bottom',
    doc: 'Limit printing and scrolling to part of the screen.',
  },
  {
    word: 'AUTO',
    token: 0xed,
    kind: 'command',
    signature: 'AUTO [n[,s]]',
    doc: 'Number lines automatically as they are typed.',
  },
  {
    word: 'POP',
    token: 0xee,
    kind: 'command',
    signature: 'POP [name]',
    doc: 'Discard the top GO SUB return address, optionally into a variable.',
  },
  {
    word: 'RECORD',
    token: 0xef,
    kind: 'command',
    signature: 'RECORD TO a$ | RECORD STOP',
    doc: 'Record what is typed into a string.',
  },
  {
    word: 'DEVICE',
    token: 0xf0,
    kind: 'command',
    signature: 'DEVICE t | DEVICE d1 | DEVICE n',
    doc: 'Choose where SAVE and LOAD go: tape, disc or network.',
  },
  {
    word: 'PROTECT',
    token: 0xf1,
    kind: 'command',
    signature: 'PROTECT "name"',
    doc: 'Protect a file. Needs a disc operating system; the ROM alone rejects it.',
  },
  {
    word: 'HIDE',
    token: 0xf2,
    kind: 'command',
    signature: 'HIDE "name"',
    doc: 'Hide a file from the directory. Needs a disc operating system.',
  },
  {
    word: 'ZAP',
    token: 0xf3,
    kind: 'command',
    signature: 'ZAP',
    doc: 'Built-in sound effect.',
  },
  {
    word: 'POW',
    token: 0xf4,
    kind: 'command',
    signature: 'POW',
    doc: 'Built-in sound effect.',
  },
  {
    word: 'BOOM',
    token: 0xf5,
    kind: 'command',
    signature: 'BOOM',
    doc: 'Built-in sound effect.',
  },
  {
    word: 'ZOOM',
    token: 0xf6,
    kind: 'command',
    signature: 'ZOOM',
    doc: 'Built-in sound effect.',
  },
];

/**
 * The short IF and short ELSE tokens, which are never produced by matching a
 * keyword: the ROM tokenizes IF as 0xD7 and ELSE as 0xD9 because those come
 * first in its list, then rewrites them here when a THEN turns the statement
 * into a single-line one. Both list back as the word their long twin does.
 */
export const SHORT_IF = 0xd8;
export const SHORT_ELSE = 0xda;
/** The long forms, as typed. */
export const LONG_IF = 0xd7;
export const LONG_ELSE = 0xd9;
/** THEN, the token whose presence turns a long IF into a short one. */
export const THEN_TOKEN = 0x8d;
/** REM: everything after it on the line is stored as typed. */
export const REM_TOKEN = 0xb7;
/** DEF FN, whose parameters each need a hidden five-byte value slot. */
export const DEF_FN_TOKEN = 0xc8;
/** BIN, whose binary digits carry an inline value like a decimal literal. */
export const BIN_TOKEN = 0x43;

/** The 0xFF that introduces every function and operator code 0x3B-0x83. */
export const FUNCTION_LEADER = 0xff;
/** First and last function code behind {@link FUNCTION_LEADER}. */
export const FUNCTION_FIRST = 0x3b;
export const FUNCTION_LAST = 0x83;
/** First command/qualifier token stored as a single byte. */
export const COMMAND_FIRST = 0x85;

/**
 * Spellings the ROM's matcher accepts that are not the keyword's listing form.
 *
 * Only INK needs an entry. The ROM's own token list carries "INK" at the end
 * and its tokenizer converts a match on it to the PEN token, so a program may
 * be typed with either word and lists back as PEN. Glued forms of the
 * two-word keywords - GOTO, GOSUB, DEFPROC, ENDPROC, ENDIF - need no entry:
 * a space in a listed keyword is optional in the input, so the matcher takes
 * them already.
 */
export const keywordAliases: Record<string, string> = {
  INK: 'PEN',
};

/**
 * Operators the machine stores as characters rather than tokens. `↑` at 0x5E is
 * the power operator: the ROM's priority table gives character 0x5E priority
 * 0xCF, and the ROM font draws that code as an up arrow.
 */
export const samcoupeOperators = [
  '↑',
  '+',
  '-',
  '*',
  '/',
  '=',
  '<',
  '>',
] as const;
