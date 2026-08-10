// Porting facts for each supported machine: the language-rule and hardware
// differences a comparison highlights. Hand-authored from each dialect's
// hardware page, tokenizer and aiProfile; edit by hand. The structural fields
// (freeRamBytes, addressNotation, hexPrefix, statementSepChar, and the shape of
// memoryWriteSyntax) are pinned to src/dialects/ by facts-crosscheck.test.ts, so
// keep them true to the machine whose id the entry carries.
//
// One entry per machine, keyed by dialect id - not per docs *page*. A shared
// page has to hedge in prose ("40×25 text (VIC-20 is 22×23, the PET 40×25
// monochrome - see the hardware page)"), and a reader porting to a VIC-20 would
// be shown the C64's 38911 bytes free when the real figure is 3583. No
// parenthetical fixes a number.
//
// Machines that differ from a relative in only a few facts use `extends` and
// state just those, so the shared prose exists once. See PortingFactsEntry.
import {
  resolvePortingFacts,
  type PortingFacts,
  type PortingFactsEntry,
  type TargetPortingNote,
} from './types';

/**
 * The guidance every Commodore machine here gives, whatever you arrive from.
 *
 * A named list rather than five bullets typed into one entry, because `extends`
 * replaces a field outright: a variant with anything of its own to say about
 * porting would otherwise have to restate these five to keep them, and the copy
 * would drift from the original the first time either was edited.
 */
const COMMODORE_NOTES: TargetPortingNote[] = [
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
];

const entries: PortingFactsEntry[] = [
  {
    id: 'zx81',
    basicDialect: 'ZX81 BASIC',
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
    lineNumbers: { min: 1, max: 9999 },
    statementSeparator: null,
    elseSupported: false,
    letRequired: 'required',
    // Keywords arrive by keystroke, so there is no short spelling in the text.
    abbreviatedEntry: { style: 'none', symbols: [], shrinksProgram: false },
    variableNaming:
      'Numeric names may be multiple characters (start with a letter); string and array names are a single letter.',
    variableSignificance: {
      plain: null,
      marked: 1,
      markerDistinguishes: true,
      markers: '$',
    },
    numberHandling: 'Floating point.',
    numbers: { fractions: true },
    exponentOperator: '**',
    logicalOperators: 'value',
    comparisonTrue: 1,
    // The ZX81 punctuation set is 18 marks wide; everything else in printable
    // ASCII is simply not on the machine, in strings and REMs as much as in code.
    unsupportedCharacters: [
      '!',
      '#',
      '%',
      '&',
      "'",
      '@',
      '[',
      '\\',
      ']',
      '^',
      '_',
      '`',
      '{',
      '|',
      '}',
      '~',
    ],
    screen: '32×22 usable text; 64×44 block-pixel graphics via PLOT/UNPLOT.',
    // No dedicated screen region: the display file lives inside program RAM.
    programStart: '$407D',
    freeRamBytes: 15360,
    colour: 'None — black on white, with inverse video.',
    sound: 'None.',
    memoryWriteSyntax: 'POKE <addr>, <byte>',
    addressNotation: 'dec',
  },
  {
    id: 'zx80',
    basicDialect: 'ZX80 BASIC',
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
    lineNumbers: { min: 1, max: 9999 },
    statementSeparator: null,
    elseSupported: false,
    letRequired: 'required',
    abbreviatedEntry: { style: 'none', symbols: [], shrinksProgram: false },
    variableNaming:
      'A single letter A–Z (numeric arrays and FOR variables too).',
    variableSignificance: {
      plain: 1,
      marked: 1,
      markerDistinguishes: true,
      markers: '$',
    },
    numberHandling: 'Integer only: -32768 to 32767, and division truncates.',
    numbers: { fractions: false, range: { min: -32768, max: 32767 } },
    exponentOperator: '**',
    // Bitwise and -1, unlike the ZX81 a year later - the one place these two
    // Sinclairs part company on an expression that reads the same.
    logicalOperators: 'bitwise',
    comparisonTrue: -1,
    // The same repertoire as the ZX81; only the byte values behind the block
    // graphics differ between the two.
    unsupportedCharacters: [
      '!',
      '#',
      '%',
      '&',
      "'",
      '@',
      '[',
      '\\',
      ']',
      '^',
      '_',
      '`',
      '{',
      '|',
      '}',
      '~',
    ],
    screen:
      '32×24 text; no graphics mode. FAST display only (screen blanks while computing).',
    // No dedicated screen region: the display file lives inside program RAM.
    programStart: '$4028',
    freeRamBytes: 15360,
    colour: 'None — black on white, with inverse video.',
    sound: 'None.',
    memoryWriteSyntax: 'POKE <addr>, <byte>',
    addressNotation: 'dec',
  },
  {
    id: 'zxspectrum',
    basicDialect: '48K Sinclair BASIC',
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
        text: 'One ink and paper per 8×8 cell, so colours clash where shapes overlap — a routine drawing in several colours has to keep them a cell apart.',
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
    lineNumbers: { min: 1, max: 9999 },
    statementSeparator: ':',
    elseSupported: false,
    letRequired: 'required',
    abbreviatedEntry: { style: 'none', symbols: [], shrinksProgram: false },
    variableNaming:
      'Numeric names may be long; string and array names are a single letter with $.',
    variableSignificance: {
      plain: null,
      marked: 1,
      markerDistinguishes: true,
      markers: '$',
    },
    numberHandling: 'Floating point.',
    numbers: { fractions: true },
    exponentOperator: '↑',
    logicalOperators: 'value',
    comparisonTrue: 1,
    // 0x5E is ↑ and 0x60 is £, the Sinclair convention. The backslash is real
    // (0x5C), written `\\` in source.
    unsupportedCharacters: ['^', '`'],
    screen: '32×22 usable text; 256×176 pixel graphics via PLOT/DRAW/CIRCLE.',
    screenBase: '$4000',
    programStart: '$5CCB',
    freeRamBytes: 41472,
    colour:
      '8 colours with BRIGHT and FLASH; one ink/paper per 8×8 cell (attribute clash).',
    sound: 'BEEP duration,pitch (single channel).',
    memoryWriteSyntax: 'POKE <addr>, <byte>',
    addressNotation: 'dec',
  },
  {
    id: 'bbcmicro',
    basicDialect: 'BBC BASIC II',
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
      {
        text: 'How many colours you have is decided by MODE rather than by the machine, so a routine written for a fixed palette picks its mode first and is redrawn in whatever that mode leaves it.',
        topics: ['colour'],
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
    // Line 0 is typable and lists back: `0REM Z` entered at the keyboard of a
    // real BASIC II and a real BASIC IV both store and LIST as `    0REM Z`,
    // while `32768REM Z` answers `Syntax error` and stores nothing. (Higher
    // numbers up to 65279 exist in *loaded* programs and run - the tokenizer's
    // ENTRY_MAX/MAX_LINE split - but this row is the range a porter must
    // renumber into, which is the editor's.)
    lineNumberRange: '0–32767',
    lineNumbers: { min: 0, max: 32767 },
    statementSeparator: ':',
    elseSupported: true,
    letRequired: 'optional',
    // The ROM resolves a dotted prefix to the first keyword it begins, and
    // stores the same token the full spelling stores.
    abbreviatedEntry: { style: 'dot', symbols: [], shrinksProgram: false },
    variableNaming:
      'Any-length names; % suffix = fast integer, $ = string. A%–Z% are static and fastest.',
    variableSignificance: {
      plain: null,
      marked: null,
      markerDistinguishes: true,
      markers: '$%',
    },
    numberHandling: 'Floating point, with a 32-bit integer type marked by %.',
    numbers: { fractions: true },
    exponentOperator: '^',
    integerDivisionOperator: 'DIV',
    remainderOperator: 'MOD',
    xorOperator: 'EOR',
    logicalOperators: 'bitwise',
    comparisonTrue: -1,
    // 0x60 is £; the BBC has the rest of printable ASCII, `^` included.
    unsupportedCharacters: ['`'],
    screen:
      'MODE-dependent: 40×25 teletext (MODE 7) up to 640×256 2-colour (MODE 0); graphics space 0–1279 × 0–1023.',
    // MODE 7 default; higher-resolution modes move the screen base down.
    screenBase: '&7C00',
    programStart: '&1900',
    freeRamBytes: 25344,
    // The 19K the bitmap modes reach down into, between their floor at &3000
    // and the teletext screen at &7C00. Restated from
    // `src/dialects/bbcmicro/memoryBlocks.ts`; the Master inherits it, and both
    // are pinned by facts-crosscheck.test.ts.
    conditionallyFree: [
      {
        start: 0x3000,
        end: 0x7bff,
        bytes: 19456,
        condition: {
          kind: 'screen-modes',
          command: 'MODE',
          bootMode: 7,
          modes: [7],
        },
        conditionText: 'the program stays in the teletext mode (MODE 7)',
        note: 'the frame buffer MODE 0-MODE 6 draw into',
      },
    ],
    colour:
      'Up to 16 colours (mode-dependent); COLOUR sets text ink, GCOL sets graphics ink.',
    sound: 'SOUND channel,amplitude,pitch,duration with ENVELOPE.',
    memoryWriteSyntax: '?<addr>=<byte> (byte), !<addr>=<number> (word)',
    addressNotation: 'hex',
    hexPrefix: '&',
  },
  {
    id: 'commodore64',
    basicDialect: 'Commodore BASIC V2',
    portingNotes: COMMODORE_NOTES,
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
    lineNumbers: { min: 0, max: 63999 },
    statementSeparator: ':',
    elseSupported: false,
    letRequired: 'optional',
    abbreviatedEntry: {
      style: 'shifted',
      symbols: [{ spelling: '?', keyword: 'PRINT' }],
      shrinksProgram: false,
    },
    variableNaming:
      'Only the first two characters are significant; % suffix = integer, $ = string.',
    variableSignificance: {
      plain: 2,
      marked: 2,
      markerDistinguishes: true,
      markers: '$%',
    },
    numberHandling: 'Floating point, with an integer type marked by %.',
    numbers: { fractions: true },
    exponentOperator: '↑',
    logicalOperators: 'bitwise',
    comparisonTrue: -1,
    // PETSCII spends 0x5C on £, 0x5E on ↑ and 0x7B-0x7E on graphics, so seven
    // marks a C64 keyboard cannot type are unavailable to a program too.
    unsupportedCharacters: ['\\', '^', '`', '{', '|', '}', '~'],
    screen: '40×25 text; bitmap 320×200.',
    screenBase: '$0400',
    // The region starts at $0800; BASIC text begins one byte in, past the zero
    // byte the interpreter expects there.
    programStart: '$0801',
    freeRamBytes: 38911,
    colour: '16 colours and eight hardware sprites.',
    sound: 'Three-voice SID with filters, driven by POKE.',
    memoryWriteSyntax: 'POKE <addr>, <byte>',
    addressNotation: 'dec',
  },
  {
    id: 'atom',
    basicDialect: 'Atom BASIC',
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
    lineNumbers: { min: 0, max: 32767 },
    statementSeparator: ';',
    elseSupported: false,
    letRequired: 'optional',
    // The Atom keeps program text as typed, so a dotted keyword really is
    // fewer stored bytes - the one machine here where spelling is a fit measure.
    abbreviatedEntry: { style: 'dot', symbols: [], shrinksProgram: true },
    variableNaming:
      'Single letters A–Z hold 32-bit integers; %A–%Z name the floating-point ROM variables.',
    // No type markers at all: `$` is a prefix operator here (`$addr` reads a
    // string from memory), not a suffix that ends a name.
    variableSignificance: {
      plain: 1,
      marked: 1,
      markerDistinguishes: false,
      markers: '',
    },
    numberHandling:
      'Integer only: 32-bit, -2147483648 to 2147483647, and / truncates. The floating-point ROM adds %A–%Z reals.',
    // The floating-point ROM's %A-%Z reals are a separate variable set, not a
    // fraction the integer path can hold: a ported expression lands on the
    // integers, so this is what the truncation finding must answer to.
    numbers: {
      fractions: false,
      range: { min: -2147483648, max: 2147483647 },
    },
    // The Atom covers printable ASCII in full.
    unsupportedCharacters: [],
    // The exponent operator belongs to the floating-point half of this machine:
    // %A=2^3 works and 2^3 in an integer expression is rejected. Read off the
    // running machine by operatorBattery.test.ts, which is what corrected a
    // guide that reported the Atom as having no way to raise to a power.
    exponentOperator: '^',
    remainderOperator: '%',
    xorOperator: ':',
    logicalOperators: 'bitwise',
    // 1, not the BBC's -1: the two Acorns disagree.
    comparisonTrue: 1,
    screen: '32×16 text (CLEAR 0); graphics up to 256×192 (CLEAR 4).',
    screenBase: '&8000',
    programStart: '&2900',
    freeRamBytes: 4864,
    // 5K of the 6K of video RAM: everything above the page the text screen
    // displays out of. On the machine with the least program RAM of the two
    // Acorns, this is more memory than BASIC itself has. Restated from
    // `src/dialects/atom/memoryBlocks.ts` and pinned by
    // facts-crosscheck.test.ts.
    conditionallyFree: [
      {
        start: 0x8400,
        end: 0x97ff,
        bytes: 5120,
        condition: {
          kind: 'screen-modes',
          command: 'CLEAR',
          bootMode: 0,
          modes: [0],
        },
        conditionText: 'the program stays in text mode (CLEAR 0)',
        note: 'the video RAM the graphics modes CLEAR 1-CLEAR 4 draw into',
      },
    ],
    colour: 'None — the MC6847 VDG output is rendered monochrome here.',
    sound: 'A simple speaker; most programs are silent.',
    memoryWriteSyntax: '?<addr>=<byte> (byte), !<addr>=<number> (word)',
    addressNotation: 'hex',
    hexPrefix: '#',
    statementSepChar: ';',
  },
  {
    id: 'trs80',
    basicDialect: 'Level II BASIC',
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
    lineNumbers: { min: 0, max: 65529 },
    statementSeparator: ':',
    elseSupported: true,
    letRequired: 'optional',
    abbreviatedEntry: {
      style: 'none',
      symbols: [
        { spelling: '?', keyword: 'PRINT' },
        { spelling: "'", keyword: 'REM' },
      ],
      shrinksProgram: false,
    },
    variableNaming:
      'Only the first two characters are significant; $ = string, % = integer, ! = single, # = double.',
    variableSignificance: {
      plain: 2,
      marked: 2,
      markerDistinguishes: true,
      markers: '$%!#',
    },
    numberHandling:
      'Floating point, single (!) or double (#), with an integer type marked by %.',
    numbers: { fractions: true },
    exponentOperator: '↑',
    logicalOperators: 'bitwise',
    comparisonTrue: -1,
    // The TRS-80 covers printable ASCII in full.
    unsupportedCharacters: [],
    screen: '64×16 text, monochrome.',
    freeRamBytes: 15572,
    colour: 'None.',
    sound: 'None.',
    memoryWriteSyntax: 'POKE <addr>, <byte>',
    addressNotation: 'dec',
  },
  {
    id: 'cpc464',
    basicDialect: 'Locomotive BASIC 1.0',
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
      {
        text: 'Colour is indirect and mode-dependent: INK assigns one of 27 colours to a pen, PEN selects the pen, and MODE fixes how many pens there are — 16, 4 or 2.',
        topics: ['colour'],
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
    lineNumbers: { min: 1, max: 65535 },
    statementSeparator: ':',
    elseSupported: true,
    letRequired: 'optional',
    abbreviatedEntry: {
      style: 'none',
      symbols: [{ spelling: "'", keyword: 'REM' }],
      shrinksProgram: false,
    },
    variableNaming:
      'Up to 40 significant characters; % = integer, ! = real (default), $ = string.',
    variableSignificance: {
      plain: 40,
      marked: 40,
      markerDistinguishes: true,
      markers: '$%!',
    },
    numberHandling:
      'Floating point (! real, the default), with an integer type marked by %.',
    numbers: { fractions: true },
    exponentOperator: '^',
    integerDivisionOperator: '\\',
    remainderOperator: 'MOD',
    xorOperator: 'XOR',
    logicalOperators: 'bitwise',
    comparisonTrue: -1,
    // 0x5E is ↑, which is also how Locomotive BASIC spells its own exponent.
    unsupportedCharacters: ['^'],
    screen:
      'MODE 0 (20×25, 160×200, 16 inks), MODE 1 (40×25, 320×200, 4 inks), MODE 2 (80×25, 640×200, 2 inks); graphics space 640×400.',
    screenBase: '&C000',
    programStart: '&0170',
    freeRamBytes: 43535,
    colour: '27 hardware colours; INK/PEN/PAPER/BORDER assign them.',
    sound: 'SOUND channel,period,duration with ENV/ENT envelopes.',
    memoryWriteSyntax: 'POKE <addr>, <byte>',
    addressNotation: 'hex',
    hexPrefix: '&',
  },

  // --- Variants -----------------------------------------------------------
  // Each states only what differs from the relative it extends. What is absent
  // here is shared, and shared deliberately: the 128K Spectrum runs its BASIC in
  // the same memory map and to the same language rules as a 48K, and a CPC 6128
  // differs from a 464 in its keyword set (which the reference table carries)
  // rather than its hardware figures. The BASIC each of them runs is still its
  // own, and every variant below names it.

  {
    id: 'altair8800',
    basicDialect: 'Altair 8K BASIC',
    portingNotes: [
      {
        text: 'There is no display: BASIC writes to a serial terminal, so PRINT is the whole output repertoire - no cursor addressing, no clear-screen and no display memory to POKE.',
        topics: ['text-screen', 'graphics'],
      },
      {
        text: 'No key-at-a-time read at all: interactive programs take a whole typed line per turn through INPUT. Polling the console with INP does not help - BASIC reads it for CTRL-C between statements and takes the character first.',
        topics: ['input'],
      },
      {
        text: 'Only the first two characters of a variable name are significant, and a name containing a reserved word is mis-read rather than rejected.',
        topics: ['variable-names'],
      },
      {
        text: 'Spaces are ignored outside strings, REM and DATA, so FORI=1TO5 is valid.',
        topics: ['statement-layout'],
      },
      {
        text: 'String space is 50 bytes until a program says CLEAR n. Assigning a literal costs nothing; concatenating does.',
        topics: ['strings'],
      },
      {
        text: 'BASIC is loaded into RAM rather than being firmware, so a wrong POKE address can corrupt the interpreter itself.',
        topics: ['memory'],
      },
    ],
    substitutions: [
      {
        keyword: 'ELSE',
        note: 'No ELSE: write a second IF, or invert the test and jump.',
      },
      {
        keyword: 'INKEY$',
        note: 'No key-at-a-time read: INPUT takes a whole line, so a real-time loop becomes one turn per typed line.',
      },
      {
        keyword: 'PLOT',
        note: 'No graphics at all: build the picture in an array and PRINT it a character at a time.',
      },
      {
        keyword: 'CLS',
        note: 'Nothing clears a scrolling terminal - PRINT blank lines, or simply let the old output scroll away.',
      },
      {
        keyword: 'SOUND',
        note: 'No sound hardware. The only noise the machine can make is the terminal bell, CHR$(7).',
      },
      { keyword: 'COLOUR', note: 'No colour: the console is text only.' },
    ],
    // En dash, as every other entry uses: this row is compared as a string by
    // the guide, and one machine spelling its range with a hyphen reads as a
    // difference between the machines rather than between two keyboards.
    lineNumberRange: '0–65529',
    lineNumbers: { min: 0, max: 65529 },
    statementSeparator: ':',
    elseSupported: false,
    letRequired: 'optional',
    abbreviatedEntry: {
      style: 'none',
      symbols: [{ spelling: '?', keyword: 'PRINT' }],
      shrinksProgram: false,
    },
    variableNaming:
      'Only the first two characters are significant; $ marks a string, and there is no integer or double type tag.',
    variableSignificance: {
      plain: 2,
      marked: 2,
      markerDistinguishes: true,
      markers: '$',
    },
    numberHandling: 'Floating point, single precision only.',
    numbers: { fractions: true },
    exponentOperator: '^',
    logicalOperators: 'bitwise',
    comparisonTrue: -1,
    // Plain 7-bit ASCII, so the machine covers printable ASCII in full.
    unsupportedCharacters: [],
    screen:
      '80x24 serial terminal, monochrome; BASIC wraps at its own 72-column width.',
    freeRamBytes: 42628,
    // No screenBase to give: there is no display memory on this machine. The
    // program area starts at TXTTAB, written with the `$` the other decimal
    // machines here use (see ADDRESS_SIGIL in src/dialects/glyphSources.ts) -
    // Altair BASIC itself has no hex notation at all.
    programStart: '$1939',
    colour: 'None - the output is a serial terminal.',
    sound: 'None, beyond the terminal bell at CHR$(7).',
    memoryWriteSyntax: 'POKE <addr>, <byte>',
    addressNotation: 'dec',
  },
  {
    id: 'zxspectrum128',
    extends: 'zxspectrum',
    basicDialect: '128 Sinclair BASIC',
    // Same 41472-byte BASIC area and memory map as the 48K: the extra 64K is
    // bank-switched RAM the interpreter uses for its own workspace, not program
    // space. The audible difference is the whole difference.
    sound: 'PLAY strings on the three-channel AY-3-8912, or BEEP as on a 48K.',
  },
  {
    id: 'bbcmaster',
    extends: 'bbcmicro',
    basicDialect: 'BBC BASIC IV',
    freeRamBytes: 28160,
    // Shadow screen memory keeps the display out of the program's way, so BASIC
    // text starts lower than the Model B's &1900.
    programStart: '&0E00',
  },
  {
    id: 'pet',
    extends: 'commodore64',
    basicDialect: 'Commodore BASIC 4.0',
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
    // The C64's guidance is inherited by value, not merged, so the shared list
    // is spread rather than restated. Colour is the one thing the VIC says for
    // itself: the C64's note set is silent on it, and a routine that draws in
    // more than one colour is rewritten around this.
    portingNotes: [
      ...COMMODORE_NOTES,
      {
        text: 'Colour attaches to the character cell, not the pixel: one of 8 per 8×8 cell, so a shape drawn in two colours inside one cell cannot keep both.',
        topics: ['colour'],
      },
    ],
    // Commodore BASIC V2 inherited from the C64, and genuinely the same BASIC:
    // the two differ in hardware, which is what the figures below state.
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
    basicDialect: 'Locomotive BASIC 1.1',
    // Identical on every crosschecked figure: the 6128's extra 64K is banked,
    // not BASIC program space, so its free RAM matches the 464's exactly. What
    // it adds is the twelve BASIC 1.1 commands, which the reference table
    // carries as rows scoped to this machine - and the version name above,
    // which is what tells a reader why those twelve are there.
  },
];

/** Machine facts with every `extends` folded in; see {@link resolvePortingFacts}. */
export const portingFacts: PortingFacts[] = resolvePortingFacts(entries);
