// Porting facts for each dialect reference page: the language-rule and hardware
// differences a comparison highlights. Hand-authored from each dialect's
// hardware page, tokenizer and aiProfile; edit by hand. The structural fields
// (freeRamBytes, addressNotation, hexPrefix, statementSepChar, and the shape of
// memoryWriteSyntax) are pinned to src/dialects/ by facts-crosscheck.test.ts, so
// keep them true to the representative dialect listed there. Shared pages
// describe the marquee machine (Commodore → C64) with a note about siblings.
import type { PortingFacts } from './types';

export const portingFacts: PortingFacts[] = [
  {
    id: 'zx81',
    portingNotes: [
      'One statement per line, and LET is required on every assignment.',
      'Numeric names may be several characters, but string and array names are a single letter.',
      'SCROLL when the screen fills, or the program stops with report 5.',
      'No DATA/READ/RESTORE, no DEF FN and no ON…GOTO — use GOTO on a computed line number.',
      "CHR$ uses the ZX81's own character codes, not ASCII.",
    ],
    substitutions: [
      {
        keyword: 'ELSE',
        note: 'No ELSE: put the negative case on the following line, or invert the test.',
      },
      {
        keyword: 'DATA',
        note: 'No DATA/READ: hold constants in an array filled by a FOR loop, or in a string.',
      },
    ],
    lineNumberRange: '1–9999',
    statementSeparator: null,
    elseSupported: false,
    letRequired: 'required',
    variableNaming:
      'Numeric names may be multiple characters (start with a letter); string and array names are a single letter.',
    exponentOperator: '**',
    screen: '32×22 usable text; 64×44 block-pixel graphics via PLOT/UNPLOT.',
    freeRamBytes: 15360,
    colour: 'None — black on white, with inverse video.',
    sound: 'None.',
    memoryWriteSyntax: 'POKE addr,val',
    addressNotation: 'dec',
  },
  {
    id: 'zx80',
    portingNotes: [
      'Integer only. There is no floating point, values run -32768 to 32767, and division truncates — rescale anything fractional.',
      'Variable names are a single letter A–Z, arrays and FOR counters included.',
      'No <=, >= or <>: combine with AND/OR/NOT, e.g. NOT A<B for A>=B.',
      'FOR has no STEP — the counter always increments by one.',
      'One statement per line, LET required, no ELSE, and the screen blanks while the program computes.',
    ],
    substitutions: [
      {
        keyword: 'PLOT',
        note: 'No PLOT: draw by PRINTing the block-graphics characters, two by two per cell.',
      },
      {
        keyword: 'STEP',
        note: 'No STEP: count by one and multiply inside the loop.',
      },
      {
        keyword: 'INKEY$',
        note: 'No INKEY$: the ZX80 cannot poll the keyboard, so use INPUT.',
      },
    ],
    lineNumberRange: '1–9999',
    statementSeparator: null,
    elseSupported: false,
    letRequired: 'required',
    variableNaming:
      'A single letter A–Z (numeric arrays and FOR variables too).',
    exponentOperator: '**',
    screen:
      '32×24 text; no graphics mode. FAST display only (screen blanks while computing).',
    freeRamBytes: 15360,
    colour: 'None — black on white, with inverse video.',
    sound: 'None.',
    memoryWriteSyntax: 'POKE addr,val',
    addressNotation: 'dec',
  },
  {
    id: 'zxspectrum',
    portingNotes: [
      'Listings spell the jumps GO TO and GO SUB with a space; the glued forms are accepted on entry.',
      "LET is required. There is no ELSE, but everything after THEN — including further ':' statements — runs only when the test is true.",
      'One ink and paper per 8×8 cell, so colours clash where shapes overlap.',
      'Control codes are brace directives inside strings, such as {INK 2} and {AT 5,3}.',
    ],
    substitutions: [
      {
        keyword: 'SCROLL',
        note: "No SCROLL: the Spectrum scrolls by itself, prompting with 'scroll?' when full.",
      },
      {
        keyword: 'FAST',
        note: 'No FAST/SLOW: the Spectrum always displays, so drop the mode switches.',
      },
      {
        keyword: 'UNPLOT',
        note: 'No UNPLOT: PLOT with INVERSE 1 clears a pixel.',
      },
    ],
    lineNumberRange: '1–9999',
    statementSeparator: ':',
    elseSupported: false,
    letRequired: 'required',
    variableNaming:
      'Numeric names may be long; string and array names are a single letter with $.',
    exponentOperator: '↑',
    screen: '32×22 usable text; 256×176 pixel graphics via PLOT/DRAW/CIRCLE.',
    freeRamBytes: 41472,
    colour:
      '8 colours with BRIGHT and FLASH; one ink/paper per 8×8 cell (attribute clash).',
    sound: 'BEEP duration,pitch (single channel).',
    memoryWriteSyntax: 'POKE addr,val',
    addressNotation: 'dec',
  },
  {
    id: 'bbc',
    portingNotes: [
      'Structured: DEF PROC…ENDPROC, DEF FN and REPEAT…UNTIL — but there is no WHILE.',
      'Memory is written with ?addr= for a byte and !addr= for a word rather than POKE, and hex literals are written &nn.',
      'MODE picks the screen; every graphics mode shares one 0–1279 by 0–1023 space with the origin bottom-left.',
      'Variable names may be any length; the % integer suffix is the fast one, and A%–Z% are fastest of all.',
    ],
    substitutions: [
      {
        keyword: 'POKE',
        note: 'Write ?addr=val for a byte, !addr=val for a word.',
      },
      { keyword: 'PEEK', note: 'Read ?addr for a byte, !addr for a word.' },
      {
        keyword: 'CLR',
        note: 'CLEAR discards all variables, arrays and definitions.',
      },
      {
        keyword: 'SYS',
        note: 'CALL addr runs machine code; USR(addr) returns a value.',
      },
    ],
    lineNumberRange: '1–32767',
    statementSeparator: ':',
    elseSupported: true,
    letRequired: 'optional',
    variableNaming:
      'Any-length names; % suffix = fast integer, $ = string. A%–Z% are static and fastest.',
    exponentOperator: '^',
    screen:
      'MODE-dependent: 40×25 teletext (MODE 7) up to 640×256 2-colour (MODE 0); graphics space 0–1279 × 0–1023.',
    freeRamBytes: 28672,
    colour:
      'Up to 16 colours (mode-dependent); COLOUR sets text ink, GCOL sets graphics ink.',
    sound: 'SOUND channel,amplitude,pitch,duration with ENVELOPE.',
    memoryWriteSyntax: '?addr=val (byte), !addr=val (word)',
    addressNotation: 'hex',
    hexPrefix: '&',
  },
  {
    id: 'commodore',
    portingNotes: [
      'There is no ELSE — every IF…THEN…ELSE has to be restructured.',
      'Only the first two characters of a variable name are significant, so SCORE and SCALE are one variable; a name containing a reserved word is a syntax error.',
      'There are no graphics or sound keywords at all: the video and sound chips are driven by POKE.',
      'LOG is the natural logarithm and there is no LN.',
      'Control codes go inside string literals as escapes, such as {clr} and {red}.',
    ],
    substitutions: [
      {
        keyword: 'ELSE',
        note: 'No ELSE: follow the IF line with the negative case, or invert the test.',
      },
      {
        keyword: 'CLEAR',
        note: 'CLR clears variables; it does not take an argument.',
      },
      {
        keyword: 'LN',
        note: 'No LN: LOG is already the natural logarithm here.',
      },
      {
        keyword: 'SOUND',
        note: "No sound keywords: POKE the sound chip's registers directly.",
      },
      {
        keyword: 'MODE',
        note: 'No MODE: the screen is fixed, and the video chip is reached by POKE.',
      },
    ],
    lineNumberRange: '0–63999',
    statementSeparator: ':',
    elseSupported: false,
    letRequired: 'optional',
    variableNaming:
      'Only the first two characters are significant; % suffix = integer, $ = string.',
    exponentOperator: '↑',
    screen:
      '40×25 text; C64 bitmap 320×200 (VIC-20 is 22×23, the PET 40×25 monochrome — see the hardware page).',
    freeRamBytes: 38911,
    colour:
      '16 colours and hardware sprites on the C64 (VIC-20 has 8 colours; the PET is monochrome).',
    sound:
      'Three-voice SID on the C64 (the VIC-20 has a 3-voice VIC, the PET a single square-wave voice).',
    memoryWriteSyntax: 'POKE addr,val',
    addressNotation: 'dec',
  },
  {
    id: 'atom',
    portingNotes: [
      "Statements on a line are separated by ';', not ':', and there is no ELSE.",
      'There are no string variables. A string is CR-terminated bytes at an address, reached with the $ prefix operator, so there is no CHR$, ASC, LEFT$, MID$, RIGHT$, STR$ or VAL.',
      "Single letters A–Z hold 32-bit integers; real arithmetic needs the floating-point ROM's %A–%Z variables and F… statements.",
      'CLEAR selects a screen mode. Memory is written with ?addr= and !addr=, and hex literals are written #nn.',
      "PRINT does not end the line — ' emits the newline. There is no DIV or MOD; % is remainder.",
    ],
    substitutions: [
      {
        keyword: 'POKE',
        note: 'Write ?addr=val for a byte, !addr=val for a four-byte word.',
      },
      {
        keyword: 'MODE',
        note: 'CLEAR n selects the screen mode: CLEAR 0 is text, CLEAR 4 the finest graphics.',
      },
      {
        keyword: 'CHR$',
        note: 'No string functions: build text as bytes at an address and print it with $.',
      },
      { keyword: 'MOD', note: 'No MOD: % is the remainder operator.' },
      {
        keyword: 'DIV',
        note: 'No DIV: / already truncates on the integer variables.',
      },
    ],
    lineNumberRange: '0–32767',
    statementSeparator: ';',
    elseSupported: false,
    letRequired: 'optional',
    variableNaming:
      'Single letters A–Z hold 32-bit integers; %A–%Z name the floating-point ROM variables.',
    // Integer BASIC has no exponent operator (the FP ROM adds functions, not **).
    screen: '32×16 text (CLEAR 0); graphics up to 256×192 (CLEAR 4).',
    freeRamBytes: 8192,
    colour: 'None — the MC6847 VDG output is rendered monochrome here.',
    sound: 'A simple speaker; most programs are silent.',
    memoryWriteSyntax: '?addr=val (byte), !addr=val (word)',
    addressNotation: 'hex',
    hexPrefix: '#',
    statementSepChar: ';',
  },
  {
    id: 'trs80',
    portingNotes: [
      'Only the first two characters of a variable name are significant, and a name containing a reserved word is a syntax error.',
      'Spaces are ignored outside strings and REM, so FORI=1TO5 is valid — and a variable may not embed a keyword.',
      'Four types: % integer, ! single, # double and $ string, with DEFINT/DEFSNG/DEFDBL/DEFSTR setting the default by initial letter.',
      '64 by 16 text, monochrome, no sound. Graphics are SET, RESET and POINT on a 128 by 48 grid of cells.',
      'LOG is the natural logarithm.',
    ],
    substitutions: [
      {
        keyword: 'PLOT',
        note: 'SET(x,y) lights a cell, RESET(x,y) clears it, POINT(x,y) tests one.',
      },
      {
        keyword: 'LN',
        note: 'No LN: LOG is already the natural logarithm here.',
      },
      {
        keyword: 'SOUND',
        note: 'No sound hardware on the Model I, so sound has no direct equivalent.',
      },
      { keyword: 'COLOUR', note: 'No colour: the display is monochrome.' },
    ],
    lineNumberRange: '0–65529',
    statementSeparator: ':',
    elseSupported: true,
    letRequired: 'optional',
    variableNaming:
      'Only the first two characters are significant; $ = string, % = integer, ! = single, # = double.',
    exponentOperator: '↑',
    screen: '64×16 text, monochrome.',
    freeRamBytes: 15572,
    colour: 'None.',
    sound: 'None.',
    memoryWriteSyntax: 'POKE addr,val',
    addressNotation: 'dec',
  },
  {
    id: 'cpc',
    portingNotes: [
      'Locomotive is the richest of these BASICs: real ELSE, WHILE…WEND, and AFTER/EVERY interrupt timers that call a subroutine on a clock.',
      'Variable names may be up to 40 characters, all significant, and may contain embedded keywords — SCORE and PRINTER are both fine.',
      'Three types: % integer, ! real (the default) and $ string.',
      'MODE 0, 1 and 2 change the text width and colour count, but the graphics space is always 640 by 400 with the origin bottom-left.',
      'Hex literals are written &nn and binary &X1010.',
    ],
    substitutions: [
      {
        keyword: 'SET',
        note: 'PLOT x,y lights a point; TEST(x,y) reads one back.',
      },
      {
        keyword: 'GCOL',
        note: "Colour comes from INK and PEN, or PLOT's optional third argument.",
      },
    ],
    lineNumberRange: '1–65535',
    statementSeparator: ':',
    elseSupported: true,
    letRequired: 'optional',
    variableNaming:
      'Up to 40 significant characters; % = integer, ! = real (default), $ = string.',
    exponentOperator: '^',
    screen:
      'MODE 0 (20×25, 160×200, 16 inks), MODE 1 (40×25, 320×200, 4 inks), MODE 2 (80×25, 640×200, 2 inks); graphics space 640×400.',
    freeRamBytes: 42619,
    colour: '27 hardware colours; INK/PEN/PAPER/BORDER assign them.',
    sound: 'SOUND channel,period,duration with ENV/ENT envelopes.',
    memoryWriteSyntax: 'POKE addr,val',
    addressNotation: 'hex',
    hexPrefix: '&',
  },
];
