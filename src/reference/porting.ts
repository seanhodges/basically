// Cross-dialect porting data for the comparison page: commands the machines
// spell differently, and commands they spell the same but mean differently.
// Hand-authored from the reference tables and each dialect's hardware page;
// pinned to those tables by porting-crosscheck.test.ts, which fails if a
// spelling named here stops existing (or starts existing where it should not).
//
// Both maps are keyed by docs page slug, and both are deliberately partial: a
// page absent from an entry simply has nothing to say about it.
import type {
  FalseFriend,
  KeywordEquivalence,
  PairPortingNotes,
} from './types';

export const keywordEquivalences: KeywordEquivalence[] = [
  {
    concept: 'unconditional-jump',
    spellings: {
      altair8800: 'GOTO',
      apple1: 'GOTO',
      atom: 'GOTO',
      bbc: 'GOTO',
      commodore: 'GOTO',
      cpc: 'GOTO',
      pmd85: 'GOTO',
      trs80: 'GOTO',
      zx80: 'GOTO',
      zx81: 'GOTO',
      zxspectrum: 'GO TO',
    },
  },
  {
    concept: 'subroutine-call',
    spellings: {
      altair8800: 'GOSUB',
      apple1: 'GOSUB',
      atom: 'GOSUB',
      bbc: 'GOSUB',
      commodore: 'GOSUB',
      cpc: 'GOSUB',
      pmd85: 'GOSUB',
      trs80: 'GOSUB',
      zx80: 'GOSUB',
      zx81: 'GOSUB',
      zxspectrum: 'GO SUB',
    },
  },
  {
    concept: 'resume-after-break',
    spellings: {
      altair8800: 'CONT',
      commodore: 'CONT',
      cpc: 'CONT',
      pmd85: 'CONT',
      trs80: 'CONT',
      zx81: 'CONT',
      zx80: 'CONTINUE',
      zxspectrum: 'CONTINUE',
    },
  },
  {
    // The Atom is deliberately absent: its CLEAR selects a screen mode, and it
    // has no discard-variables command at all.
    concept: 'discard-variables',
    spellings: {
      altair8800: 'CLEAR',
      apple1: 'CLR',
      bbc: 'CLEAR',
      commodore: 'CLR',
      cpc: 'CLEAR',
      pmd85: 'CLEAR',
      trs80: 'CLEAR',
      zx80: 'CLEAR',
      zx81: 'CLEAR',
      zxspectrum: 'CLEAR',
    },
  },
  {
    // The command that hands an address to the processor. The Sinclairs, the
    // TRS-80 and the Altair are absent because they have no such *command* -
    // they reach machine code through the USR function, which is a false friend
    // rather than a rename (see below).
    concept: 'run-machine-code',
    spellings: {
      apple1: 'CALL',
      atom: 'LINK',
      bbc: 'CALL',
      commodore: 'SYS',
      cpc: 'CALL',
    },
  },
  {
    concept: 'seed-random',
    spellings: {
      cpc: 'RANDOMIZE',
      trs80: 'RANDOM',
      zx80: 'RANDOMISE',
      zx81: 'RAND',
      zxspectrum: 'RANDOMIZE',
    },
  },
];

export const falseFriends: FalseFriend[] = [
  // The two that never fail. Every machine here has AND and OR, spelled the
  // same, taking the same operands - and the Sinclair pair answer a different
  // question with them. `IF A AND B` behaves the same way on both while the
  // operands are 0 or 1, so the trap only springs on the line that masks bits,
  // which is the line nobody rewrote. Measured per machine by
  // src/dialects/operatorBattery.test.ts, not taken from the manuals.
  {
    keyword: 'AND',
    meanings: {
      altair8800: 'Bitwise on 16-bit integers: 5 AND 3 is 1.',
      apple1:
        'Neither bits nor values, but truth: 5 AND 3 is 1 and 6 AND 3 is 1 too, because both operands are reduced to true or false first.',
      atom: 'Bitwise on integers: 5 AND 3 is 1. The & operator is the same thing.',
      bbc: 'Bitwise on integers: 5 AND 3 is 1.',
      commodore: 'Bitwise on 16-bit integers: 5 AND 3 is 1.',
      cpc: 'Bitwise on integers: 5 AND 3 is 1.',
      pmd85: 'Bitwise on 16-bit integers: 5 AND 3 is 1.',
      trs80: 'Bitwise on 16-bit integers: 5 AND 3 is 1.',
      zx80: 'Bitwise on 16-bit integers: 5 AND 3 is 1.',
      zx81: 'Picks a value, not bits: a AND b is a when b is non-zero and 0 otherwise, so 5 AND 3 is 5.',
      zxspectrum:
        'Picks a value, not bits: a AND b is a when b is non-zero and 0 otherwise, so 5 AND 3 is 5.',
    },
  },
  {
    keyword: 'OR',
    meanings: {
      altair8800: 'Bitwise on 16-bit integers: 5 OR 3 is 7.',
      apple1:
        'Neither bits nor values, but truth: 5 OR 3 is 1, not 7, because both operands are reduced to true or false first.',
      atom: 'Bitwise on integers: 5 OR 3 is 7. There is no symbolic spelling.',
      bbc: 'Bitwise on integers: 5 OR 3 is 7.',
      commodore: 'Bitwise on 16-bit integers: 5 OR 3 is 7.',
      cpc: 'Bitwise on integers: 5 OR 3 is 7.',
      pmd85: 'Bitwise on 16-bit integers: 5 OR 3 is 7.',
      trs80: 'Bitwise on 16-bit integers: 5 OR 3 is 7.',
      zx80: 'Bitwise on 16-bit integers: 5 OR 3 is 7.',
      zx81: 'Picks a value, not bits: a OR b is 1 when b is non-zero and a otherwise, so 5 OR 3 is 1.',
      zxspectrum:
        'Picks a value, not bits: a OR b is 1 when b is non-zero and a otherwise, so 5 OR 3 is 1.',
    },
  },
  {
    keyword: 'LOG',
    meanings: {
      altair8800: 'Natural (base-e) logarithm. There is no LN.',
      atom: 'Base-10 logarithm; LN gives the natural logarithm.',
      bbc: 'Base-10 logarithm; LN gives the natural logarithm.',
      commodore: 'Natural (base-e) logarithm. There is no LN.',
      cpc: 'Natural (base-e) logarithm.',
      pmd85: 'Natural (base-e) logarithm. There is no LN.',
      trs80: 'Natural (base-e) logarithm.',
    },
  },
  {
    // Only the Atom is the trap here. The others differ over whether CLEAR
    // takes an argument, which is a detail the "changed behaviour" list already
    // shows from the syntax - so they deliberately share one wording, and
    // identical meanings raise no warning between them.
    keyword: 'CLEAR',
    meanings: {
      altair8800: 'Discards all variables, leaving the program intact.',
      atom: 'Selects a screen mode and clears it — CLEAR 0 is the text screen.',
      bbc: 'Discards all variables, leaving the program intact.',
      cpc: 'Discards all variables, leaving the program intact.',
      pmd85: 'Discards all variables, leaving the program intact.',
      trs80: 'Discards all variables, leaving the program intact.',
      zx80: 'Discards all variables, leaving the program intact.',
      zx81: 'Discards all variables, leaving the program intact.',
      zxspectrum: 'Discards all variables, leaving the program intact.',
    },
  },
  {
    // One spelling, two input models and a file command. The two key reads are
    // opposite program structures: a BBC `GET` stops the program until someone
    // presses a key, while a Commodore `GET` takes whatever is waiting and
    // carries straight on - so a game loop ported one way runs flat out and the
    // other way freezes, with no error either time. The TRS-80's is not a key
    // read at all.
    keyword: 'GET',
    meanings: {
      atom: 'Reads a value from a hardware I/O port.',
      bbc: 'Waits for a key press and returns its character code.',
      commodore: 'Reads a pending key without waiting; empty if none.',
      trs80:
        'Nothing to do with the keyboard: it reads a record from a random-access file into its buffer (Disk BASIC).',
    },
  },
  {
    // The timed key read, which one machine can wait on and the other cannot.
    // Same spelling, same one numeric argument, and the argument means a
    // different thing: a BBC `INKEY(50)` gives the player half a second to
    // press anything, while a CPC `INKEY(50)` asks whether key 50 is down this
    // instant and returns immediately.
    keyword: 'INKEY',
    meanings: {
      bbc: 'The argument is a time: it waits up to that many centiseconds for any key and returns its code, or -1 if none came. A negative argument tests one particular key instead.',
      cpc: 'The argument is a key number: it reports whether that key is down right now and never waits, returning -1 when it is up.',
      pmd85:
        'Takes no argument at all: it reports which function key K0-K11 is held, or 255 when none is, and sees no other key.',
    },
  },
  {
    keyword: 'UNTIL',
    meanings: {
      atom: 'Closes a DO loop.',
      bbc: 'Closes a REPEAT loop.',
    },
  },
  {
    // The trap is the argument, not the return value: every machine here gives
    // USR a number and gets one back, and on half of them that number is the
    // address of the code to run while on the other half it is data handed to
    // whatever address was poked into a vector. A ported `LET X=USR 32768` runs
    // whatever the vector happens to hold and passes it 32768.
    keyword: 'USR',
    meanings: {
      altair8800:
        'The argument is data: it calls the routine whose address is held in the USR vector, and returns that routine’s result.',
      bbc: 'The argument is the address: it calls machine code there with the registers preset from A%, X%, Y% and the carry flag, and returns them packed into one number.',
      commodore:
        'The argument is data: it calls the routine whose address is held in the USR vector at $0311, and returns that routine’s result.',
      pmd85:
        'The argument is the address: it calls 8080 code there and returns what the routine leaves behind, so the routine must end in RET.',
      trs80:
        'The argument is data: it calls the routine whose address was set up by POKE or DEF USR, and returns that routine’s result.',
      zx80: 'The argument is the address: it calls machine code there and returns the BC register pair.',
      zx81: 'The argument is the address: it calls machine code there and returns the BC register pair.',
      zxspectrum:
        'The argument is the address: it calls machine code there and returns the BC register pair — unless it is a single-letter string, which gives that user-defined graphic’s address instead.',
    },
  },
  {
    keyword: 'CMD',
    meanings: {
      commodore: 'Redirects PRINT output to an open file or device.',
      trs80: 'Passes a command to the disk operating system.',
    },
  },
];

// Notes for the few ordered pairs whose relationship warrants them - the three
// pairs that are unusually close, and the cases where same-family intuition or a
// shared carrier format misleads. Directional: each entry is one (from → to), so
// a pair and its reverse are separate. Pinned by porting-crosscheck.test.ts.
//
// `covers` names the target-guidance topics a note has already made, so the
// reader is not told the same thing twice under one heading - see
// PortingTopic. Tag it only where the note genuinely makes the target bullet
// redundant: a note that half-covers one leaves it standing, and where the
// missing half was worth keeping the note here carries it instead.
export const pairPortingNotes: PairPortingNotes[] = [
  {
    from: 'zx80',
    to: 'zx81',
    notes: [
      {
        text: 'The ZX81 has floating point, so the ZX80’s integer-only workarounds can go: values are no longer capped at ±32767 and division stops truncating.',
      },
      {
        text: 'FOR gains STEP and INKEY$ can poll the keyboard, so loops that counted by one and INPUT-only key reads can be simplified.',
      },
      {
        text: 'Block graphics use the same escape spellings but different byte values, so imported graphics can come out wrong — recheck them.',
      },
    ],
  },
  {
    from: 'zx81',
    to: 'zx80',
    notes: [
      {
        text: 'The ZX80 is integer-only: rescale anything fractional, keep values within ±32767, and remember division truncates.',
        covers: ['numbers'],
      },
      {
        text: 'There is no STEP and no INKEY$ — count by one and multiply inside the loop, and read the keyboard with INPUT.',
        covers: ['control-flow'],
      },
      {
        text: 'Block graphics share the ZX81’s escape spellings but store different byte values, so recheck any imported graphics.',
      },
    ],
  },
  {
    from: 'zx80',
    to: 'zxspectrum',
    notes: [
      {
        text: 'A big step up: the Spectrum adds floating point, eight colours, BEEP sound and 256×176 pixel graphics.',
      },
      {
        text: 'Machine code hidden in REM lines does not carry — the Spectrum keeps code in separate .TAP CODE blocks.',
      },
      {
        text: 'Control codes and block graphics are spelled differently — brace directives inside strings, such as {INK 2} and {AT 5,3} — so redo any screen layout.',
        covers: ['control-codes'],
      },
    ],
  },
  {
    from: 'zxspectrum',
    to: 'zx80',
    notes: [
      {
        text: 'A severe downgrade: the ZX80 is integer-only with no colour, no sound and FAST-only display, so anything using those must go.',
        covers: ['numbers'],
      },
      {
        text: 'A .TAP CODE block has no home — the ZX80 carries machine code only as hidden-REM records, and even those differ in format.',
      },
      {
        text: 'Floating-point maths, DRAW/CIRCLE and BEEP have no equivalent; rebuild them with block graphics and integers or drop them.',
      },
    ],
  },
  {
    from: 'zx81',
    to: 'zxspectrum',
    notes: [
      {
        text: 'The closest port here: GOTO and GOSUB are written GO TO and GO SUB (the glued forms still enter), and floating point carries over.',
        covers: ['spelling'],
      },
      {
        text: 'Machine code hidden in REM lines must become a separate .TAP CODE block — the Spectrum does not keep code in the listing.',
      },
      {
        text: 'The Spectrum’s character codes and block graphics differ from the ZX81’s own, so recheck any CHR$ values and screen output.',
      },
    ],
  },
  {
    from: 'zxspectrum',
    to: 'zx81',
    notes: [
      {
        text: 'Dropping to the ZX81 loses colour, sound and pixel DRAW/CIRCLE; keep to text and PLOT/UNPLOT block graphics.',
      },
      {
        text: 'A .TAP CODE block must move back inside the listing as a hidden-REM record; there is no separate code file.',
      },
      {
        text: 'Character codes are the ZX81’s own, not ASCII, so CHR$ values and screen text need rechecking.',
        covers: ['control-codes'],
      },
    ],
  },
  {
    from: 'commodore',
    to: 'trs80',
    notes: [
      {
        text: 'Both are Microsoft-style BASICs, so most control flow, arrays and string functions carry across with little change.',
      },
      {
        text: 'The TRS-80 adds ELSE, so IF tests you had to invert or split across lines can be written in one.',
      },
      {
        text: 'There are no POKE-driven graphics or sound: use SET, RESET and POINT for the display, and the Model I makes no sound.',
        covers: ['graphics', 'sound'],
      },
    ],
  },
  {
    from: 'trs80',
    to: 'commodore',
    notes: [
      {
        text: 'Both are Microsoft-style BASICs, so most control flow and string handling ports with little change.',
      },
      {
        text: 'The Commodore has no ELSE, so every IF…THEN…ELSE must be restructured.',
        covers: ['control-flow'],
      },
      {
        text: 'PRINT@ and PRINT USING have no equivalent — position text by POKEing screen memory and format numbers by hand.',
      },
    ],
  },
  {
    from: 'commodore',
    to: 'zxspectrum',
    notes: [
      {
        text: 'The jumps are spelled with a space: GOTO and GOSUB become GO TO and GO SUB, while CLR becomes CLEAR and CONT becomes CONTINUE.',
        covers: ['spelling'],
      },
      {
        text: 'Everything the Commodore did by POKEing the VIC and SID becomes real keywords — PLOT, DRAW, CIRCLE, INK, PAPER and BEEP — so those routines are rewritten, not translated.',
      },
      {
        text: 'LEFT$, MID$ and RIGHT$ have no equivalent: slice with A$(start TO end). Numeric names may now be long, but string and array names are a single letter with $.',
      },
    ],
  },
  {
    from: 'zxspectrum',
    to: 'commodore',
    notes: [
      {
        text: 'GO TO, GO SUB, CLEAR and CONTINUE are written GOTO, GOSUB, CLR and CONT here.',
      },
      {
        text: 'The Commodore has no graphics, colour or sound keywords at all: PLOT, DRAW, CIRCLE, INK, PAPER and BEEP all become POKEs to the VIC and SID registers.',
        covers: ['graphics', 'sound'],
      },
      {
        text: 'Only the first two characters of a variable name are significant, and a name containing a reserved word is a syntax error — check long names before anything else.',
        covers: ['variable-names'],
      },
    ],
  },
  {
    from: 'commodore',
    to: 'bbc',
    notes: [
      {
        text: 'A close port on paper — most control flow and string handling carries — but POKE and PEEK are written ?addr=val and ?addr, and hex is &nn rather than decimal.',
        covers: ['memory'],
      },
      {
        text: 'The BBC has ELSE, REPEAT…UNTIL and DEF PROC, so IF tests split across lines and GOSUB-based structure can be rewritten properly.',
      },
      {
        text: 'The disk commands (DLOAD, DOPEN, PRINT#) become OPENIN/OPENOUT with BGET#/BPUT#, and screen POKEs mean nothing: use MODE, PLOT, GCOL and SOUND.',
      },
    ],
  },
  {
    from: 'bbc',
    to: 'commodore',
    notes: [
      {
        text: 'A steep step down: no ELSE, no REPEAT…UNTIL and no DEF PROC, so every structured block becomes IF…THEN with GOTO and GOSUB.',
        covers: ['control-flow'],
      },
      {
        text: 'MODE, PLOT, DRAW, GCOL, COLOUR and SOUND have no equivalent — the video and sound chips are reached by POKE, and ?addr=val becomes POKE addr,val.',
        covers: ['graphics', 'sound'],
      },
      {
        text: 'Only the first two characters of a variable name are significant here and a name containing a reserved word is a syntax error, so any-length BBC names need checking first.',
        covers: ['variable-names'],
      },
    ],
  },
  {
    from: 'zxspectrum',
    to: 'bbc',
    notes: [
      {
        text: 'GO TO and GO SUB are glued back together as GOTO and GOSUB, and the BBC adds ELSE, REPEAT…UNTIL, DEF PROC and DEF FN — though there is no WHILE.',
        covers: ['control-flow'],
      },
      {
        text: 'Both machines have full graphics, colour and sound, but none of the names match: INK/PAPER become COLOUR and GCOL, BEEP becomes SOUND, and MODE picks the screen first.',
      },
      {
        text: 'Pixel coordinates do not carry: the Spectrum plots on 256×176 with the origin bottom-left, the BBC on a 0–1279 by 0–1023 space whatever the mode.',
        covers: ['graphics'],
      },
    ],
  },
  {
    from: 'bbc',
    to: 'zxspectrum',
    notes: [
      {
        text: 'GOTO and GOSUB are written GO TO and GO SUB, and LET is required on every assignment.',
        covers: ['spelling'],
      },
      {
        text: 'No ELSE, REPEAT…UNTIL, DEF PROC, ON…GOTO or error trapping: restructure around IF…THEN, where everything after THEN — including further ‘:’ statements — runs only when the test is true.',
        covers: ['statement-layout', 'control-flow'],
      },
      {
        text: 'Memory indirection goes back to POKE addr,val and PEEK, addresses are decimal, and colour is one ink and paper per 8×8 cell rather than per pixel.',
        covers: ['colour'],
      },
    ],
  },
  {
    from: 'cpc',
    to: 'zxspectrum',
    notes: [
      {
        text: 'The richest of these BASICs to one of the plainer ones: WHILE…WEND, ELSE, AFTER/EVERY timers and ON ERROR GOTO all have to be rebuilt from IF…THEN and GO TO.',
      },
      {
        text: 'LOCATE, WINDOW, PRINT USING and the string set (LEFT$, MID$, RIGHT$, UPPER$, HEX$) are gone: position with PRINT AT and slice with A$(start TO end).',
      },
      {
        text: 'Graphics and sound both narrow — 640×400 with 27 inks becomes 256×176 with 8, and the three-channel SOUND becomes single-channel BEEP.',
      },
    ],
  },
  {
    from: 'zxspectrum',
    to: 'cpc',
    notes: [
      {
        text: 'A step up: Locomotive adds ELSE, WHILE…WEND, AFTER/EVERY timers, error trapping and 40-character variable names that may contain keywords.',
        covers: ['control-flow', 'variable-names'],
      },
      {
        text: 'GO TO and GO SUB are written GOTO and GOSUB, LET becomes optional, and hex literals are written &nn, binary &X1010.',
        covers: ['memory'],
      },
      {
        text: 'Colour works differently: INK assigns one of 27 colours to a pen and PEN selects it, ATTR, BRIGHT, FLASH and INVERSE are gone, and nothing clashes per cell.',
        covers: ['colour'],
      },
    ],
  },
  {
    from: 'atom',
    to: 'bbc',
    notes: [
      {
        text: 'Same manufacturer, but not a smooth upgrade: the BBC adds floating point, real string variables, and DEF PROC/FN with REPEAT…UNTIL — though not WHILE.',
        covers: ['control-flow'],
      },
      {
        text: 'Memory indirection carries over (?addr, !addr), but hex is written &nn here, not #nn, and statements separate with : not ;.',
        covers: ['memory'],
      },
      {
        text: 'PRINT ends the line on the BBC, so drop the Atom’s trailing ’ newlines and its build-a-string-from-bytes workarounds.',
      },
    ],
  },
  {
    from: 'bbc',
    to: 'atom',
    notes: [
      {
        text: 'Same manufacturer, but a steep step down: the Atom is integer-only, with no floating point at all.',
      },
      {
        text: 'There is no DEF PROC/FN and no REPEAT…UNTIL, so structure the program with GOSUB and IF…THEN.',
      },
      {
        text: 'Memory indirection still works (?addr, !addr), but hex is written #nn, not &nn, and statements separate with ; not :.',
        covers: ['memory'],
      },
    ],
  },
];
