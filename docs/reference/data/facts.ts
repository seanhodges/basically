// Porting facts for each supported machine: the language-rule and hardware
// differences a comparison highlights. Hand-authored from each dialect's
// hardware page, tokenizer and aiProfile; edit by hand. The structural fields
// (freeRamBytes, addressNotation, hexPrefix, statementSepChar, and the shape of
// memoryWriteSyntax) are pinned to src/dialects/ by facts-crosscheck.test.ts, so
// keep them true to the machine whose id the entry carries.
//
// One entry per machine, keyed by dialect id. These used to be keyed by docs
// *page*, with a shared page describing its marquee machine and hedging about
// the others in prose - "40×25 text (VIC-20 is 22×23, the PET 40×25 monochrome
// - see the hardware page)". That hedging is what a per-machine table replaces:
// a reader porting to a VIC-20 was being shown the C64's 38911 bytes free when
// the real figure is 3583, and no parenthetical fixes a number.
//
// Machines that differ from a relative in only a few facts use `extends` and
// state just those, so the shared prose exists once. See PortingFactsEntry.
import {
  resolvePortingFacts,
  type PortingFacts,
  type PortingFactsEntry,
} from './types';

const entries: PortingFactsEntry[] = [
  {
    id: 'zx81',
    portingNotes: [
      {
        text: 'One statement per line, and LET is required on every assignment.',
        topics: ['statement-layout'],
      },
      {
        text: 'Numeric names may be several characters, but string and array names are a single letter.',
        topics: ['variable-names'],
      },
      {
        text: 'SCROLL when the screen fills, or the program stops with report 5.',
        topics: ['text-screen'],
      },
      {
        text: 'No DATA/READ/RESTORE, no DEF FN and no ON…GOTO — use GOTO on a computed line number.',
        topics: ['control-flow'],
      },
      {
        text: "CHR$ uses the ZX81's own character codes, not ASCII.",
        topics: ['control-codes'],
      },
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
    numberHandling: 'Floating point.',
    exponentOperator: '**',
    screen: '32×22 usable text; 64×44 block-pixel graphics via PLOT/UNPLOT.',
    // No dedicated screen region: the display file lives inside program RAM.
    programStart: '$407D',
    freeRamBytes: 15360,
    colour: 'None — black on white, with inverse video.',
    sound: 'None.',
    memoryWriteSyntax: 'POKE addr,val',
    addressNotation: 'dec',
  },
  {
    id: 'zx80',
    portingNotes: [
      {
        text: 'Integer only. There is no floating point, values run -32768 to 32767, and division truncates — rescale anything fractional.',
        topics: ['numbers'],
      },
      {
        text: 'Variable names are a single letter A–Z, arrays and FOR counters included.',
        topics: ['variable-names'],
      },
      {
        text: 'No <=, >= or <>: combine with AND/OR/NOT, e.g. NOT A<B for A>=B.',
        topics: ['operators'],
      },
      {
        text: 'FOR has no STEP — the counter always increments by one.',
        topics: ['control-flow'],
      },
      {
        text: 'One statement per line, LET required, no ELSE, and the screen blanks while the program computes.',
        topics: ['statement-layout', 'control-flow', 'text-screen'],
      },
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
    numberHandling: 'Integer only: -32768 to 32767, and division truncates.',
    exponentOperator: '**',
    screen:
      '32×24 text; no graphics mode. FAST display only (screen blanks while computing).',
    // No dedicated screen region: the display file lives inside program RAM.
    programStart: '$4028',
    freeRamBytes: 15360,
    colour: 'None — black on white, with inverse video.',
    sound: 'None.',
    memoryWriteSyntax: 'POKE addr,val',
    addressNotation: 'dec',
  },
  {
    id: 'zxspectrum',
    portingNotes: [
      {
        text: 'Listings spell the jumps GO TO and GO SUB with a space; the glued forms are accepted on entry.',
        topics: ['spelling'],
      },
      {
        text: "LET is required. There is no ELSE, but everything after THEN — including further ':' statements — runs only when the test is true.",
        topics: ['statement-layout', 'control-flow'],
      },
      {
        text: 'One ink and paper per 8×8 cell, so colours clash where shapes overlap.',
        topics: ['colour'],
      },
      {
        text: 'Control codes are brace directives inside strings, such as {INK 2} and {AT 5,3}.',
        topics: ['control-codes'],
      },
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
    numberHandling: 'Floating point.',
    exponentOperator: '↑',
    screen: '32×22 usable text; 256×176 pixel graphics via PLOT/DRAW/CIRCLE.',
    screenBase: '$4000',
    programStart: '$5CCB',
    freeRamBytes: 41472,
    colour:
      '8 colours with BRIGHT and FLASH; one ink/paper per 8×8 cell (attribute clash).',
    sound: 'BEEP duration,pitch (single channel).',
    memoryWriteSyntax: 'POKE addr,val',
    addressNotation: 'dec',
  },
  {
    id: 'bbcmicro',
    portingNotes: [
      {
        text: 'Structured: DEF PROC…ENDPROC, DEF FN and REPEAT…UNTIL — but there is no WHILE.',
        topics: ['control-flow'],
      },
      {
        text: 'Memory is written with ?addr= for a byte and !addr= for a word rather than POKE, and hex literals are written &nn.',
        topics: ['memory'],
      },
      {
        text: 'MODE picks the screen; every graphics mode shares one 0–1279 by 0–1023 space with the origin bottom-left.',
        topics: ['graphics'],
      },
      {
        text: 'Variable names may be any length; the % integer suffix is the fast one, and A%–Z% are fastest of all.',
        topics: ['variable-names'],
      },
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
    numberHandling: 'Floating point, with a 32-bit integer type marked by %.',
    exponentOperator: '^',
    screen:
      'MODE-dependent: 40×25 teletext (MODE 7) up to 640×256 2-colour (MODE 0); graphics space 0–1279 × 0–1023.',
    // MODE 7 default; higher-resolution modes move the screen base down.
    screenBase: '&7C00',
    programStart: '&1900',
    freeRamBytes: 28672,
    colour:
      'Up to 16 colours (mode-dependent); COLOUR sets text ink, GCOL sets graphics ink.',
    sound: 'SOUND channel,amplitude,pitch,duration with ENVELOPE.',
    memoryWriteSyntax: '?addr=val (byte), !addr=val (word)',
    addressNotation: 'hex',
    hexPrefix: '&',
  },
  {
    id: 'commodore64',
    portingNotes: [
      {
        text: 'There is no ELSE — every IF…THEN…ELSE has to be restructured.',
        topics: ['control-flow'],
      },
      {
        text: 'Only the first two characters of a variable name are significant, so SCORE and SCALE are one variable; a name containing a reserved word is a syntax error.',
        topics: ['variable-names'],
      },
      {
        text: 'There are no graphics or sound keywords at all: the video and sound chips are driven by POKE.',
        topics: ['graphics', 'sound'],
      },
      {
        text: 'LOG is the natural logarithm and there is no LN.',
        topics: ['numbers'],
      },
      {
        text: 'Control codes go inside string literals as escapes, such as {clr} and {red}.',
        topics: ['control-codes'],
      },
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
    numberHandling: 'Floating point, with an integer type marked by %.',
    exponentOperator: '↑',
    screen: '40×25 text; bitmap 320×200.',
    screenBase: '$0400',
    // The region starts at $0800; BASIC text begins one byte in, past the zero
    // byte the interpreter expects there.
    programStart: '$0801',
    freeRamBytes: 38911,
    colour: '16 colours and eight hardware sprites.',
    sound: 'Three-voice SID with filters, driven by POKE.',
    memoryWriteSyntax: 'POKE addr,val',
    addressNotation: 'dec',
  },
  {
    id: 'atom',
    portingNotes: [
      {
        text: "Statements on a line are separated by ';', not ':', and there is no ELSE.",
        topics: ['statement-layout', 'control-flow'],
      },
      {
        text: 'There are no string variables. A string is CR-terminated bytes at an address, reached with the $ prefix operator, so there is no CHR$, ASC, LEFT$, MID$, RIGHT$, STR$ or VAL.',
        topics: ['strings'],
      },
      {
        text: "Single letters A–Z hold 32-bit integers; real arithmetic needs the floating-point ROM's %A–%Z variables and F… statements.",
        topics: ['variable-names', 'numbers'],
      },
      {
        text: 'CLEAR selects a screen mode rather than clearing variables.',
        topics: ['graphics'],
      },
      // Split from the CLEAR note so that a pair arriving from a machine whose
      // own notes already teach ?addr=/!addr= (the BBC) drops this one without
      // taking the unrelated CLEAR fact with it.
      {
        text: 'Memory is written with ?addr= and !addr=, and hex literals are written #nn.',
        topics: ['memory'],
      },
      {
        text: "PRINT does not end the line — ' emits the newline. There is no DIV or MOD; % is remainder.",
        topics: ['text-screen', 'operators'],
      },
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
    numberHandling:
      'Integer only: 32-bit, -2147483648 to 2147483647, and / truncates. The floating-point ROM adds %A–%Z reals.',
    // Integer BASIC has no exponent operator (the FP ROM adds functions, not **).
    screen: '32×16 text (CLEAR 0); graphics up to 256×192 (CLEAR 4).',
    screenBase: '&8000',
    programStart: '&2900',
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
      {
        text: 'Only the first two characters of a variable name are significant, and a name containing a reserved word is a syntax error.',
        topics: ['variable-names'],
      },
      {
        text: 'Spaces are ignored outside strings and REM, so FORI=1TO5 is valid — and a variable may not embed a keyword.',
        topics: ['statement-layout', 'variable-names'],
      },
      {
        text: 'Four types: % integer, ! single, # double and $ string, with DEFINT/DEFSNG/DEFDBL/DEFSTR setting the default by initial letter.',
        topics: ['numbers'],
      },
      {
        text: '64 by 16 text, and the display is monochrome.',
        topics: ['text-screen', 'colour'],
      },
      // Kept apart from the screen note above so that a pair arriving from a
      // machine that drove its display and sound chip by POKE (the Commodore)
      // drops this one without taking the screen size with it.
      {
        text: 'Graphics are SET, RESET and POINT on a 128 by 48 grid of cells, and the Model I has no sound.',
        topics: ['graphics', 'sound'],
      },
      {
        text: 'LOG is the natural logarithm.',
        topics: ['numbers'],
      },
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
    numberHandling:
      'Floating point, single (!) or double (#), with an integer type marked by %.',
    exponentOperator: '↑',
    screen: '64×16 text, monochrome.',
    freeRamBytes: 15572,
    colour: 'None.',
    sound: 'None.',
    memoryWriteSyntax: 'POKE addr,val',
    addressNotation: 'dec',
  },
  {
    id: 'cpc464',
    portingNotes: [
      {
        text: 'Locomotive is the richest of these BASICs: real ELSE, WHILE…WEND, and AFTER/EVERY interrupt timers that call a subroutine on a clock.',
        topics: ['control-flow'],
      },
      {
        text: 'Variable names may be up to 40 characters, all significant, and may contain embedded keywords — SCORE and PRINTER are both fine.',
        topics: ['variable-names'],
      },
      {
        text: 'Three types: % integer, ! real (the default) and $ string.',
        topics: ['numbers'],
      },
      {
        text: 'MODE 0, 1 and 2 change the text width and colour count, but the graphics space is always 640 by 400 with the origin bottom-left.',
        topics: ['graphics'],
      },
      {
        text: 'Hex literals are written &nn and binary &X1010.',
        topics: ['memory'],
      },
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
    numberHandling:
      'Floating point (! real, the default), with an integer type marked by %.',
    exponentOperator: '^',
    screen:
      'MODE 0 (20×25, 160×200, 16 inks), MODE 1 (40×25, 320×200, 4 inks), MODE 2 (80×25, 640×200, 2 inks); graphics space 640×400.',
    screenBase: '&C000',
    programStart: '&0170',
    freeRamBytes: 42619,
    colour: '27 hardware colours; INK/PEN/PAPER/BORDER assign them.',
    sound: 'SOUND channel,period,duration with ENV/ENT envelopes.',
    memoryWriteSyntax: 'POKE addr,val',
    addressNotation: 'hex',
    hexPrefix: '&',
  },

  // --- Variants -----------------------------------------------------------
  // Each states only what differs from the relative it extends. What is absent
  // here is shared, and shared deliberately: the 128K Spectrum runs the same
  // BASIC in the same memory map as a 48K, and a CPC 6128 differs from a 464 in
  // its keyword set (which the reference table carries) rather than its facts.

  {
    id: 'zxspectrum128',
    extends: 'zxspectrum',
    // Same 41472-byte BASIC area and memory map as the 48K: the extra 64K is
    // bank-switched RAM the interpreter uses for its own workspace, not program
    // space. The audible difference is the whole difference.
    sound: 'PLAY strings on the three-channel AY-3-8912, or BEEP as on a 48K.',
  },
  {
    id: 'bbcmaster',
    extends: 'bbcmicro',
    freeRamBytes: 30720,
    // Shadow screen memory keeps the display out of the program's way, so BASIC
    // text starts lower than the Model B's &1900.
    programStart: '&0E00',
  },
  {
    id: 'pet',
    extends: 'commodore64',
    freeRamBytes: 31743,
    screenBase: '$8000',
    programStart: '$0400',
    screen: '40×25 text, monochrome; no bitmap mode and no sprites.',
    colour:
      'None - the display is monochrome. Colour control codes are accepted and round-trip, but have no visible effect.',
    sound:
      'A single square-wave voice driven through the user port; no sound chip.',
  },
  {
    id: 'vic20',
    extends: 'commodore64',
    // The smallest BASIC budget of any machine here by an order of magnitude:
    // a program that fits a C64 very often will not fit unexpanded.
    freeRamBytes: 3583,
    screenBase: '$1E00',
    programStart: '$1000',
    screen: '22×23 text; no bitmap mode, and characters are 8×8 as on the C64.',
    colour: '8 colours, set per character cell; no sprites.',
    sound: 'Three tone voices and a noise voice on the VIC-I, driven by POKE.',
  },
  {
    id: 'cpc6128',
    extends: 'cpc464',
    // Identical on every crosschecked figure: the 6128's extra 64K is banked,
    // not BASIC program space, so its free RAM matches the 464's exactly. What
    // it adds is the twelve BASIC 1.1 commands, which the reference table
    // carries as rows scoped to this machine.
  },
];

/** Machine facts with every `extends` folded in; see {@link resolvePortingFacts}. */
export const portingFacts: PortingFacts[] = resolvePortingFacts(entries);
