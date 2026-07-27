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
      atom: 'GOTO',
      bbc: 'GOTO',
      commodore: 'GOTO',
      cpc: 'GOTO',
      trs80: 'GOTO',
      zx80: 'GOTO',
      zx81: 'GOTO',
      zxspectrum: 'GO TO',
    },
  },
  {
    concept: 'subroutine-call',
    spellings: {
      atom: 'GOSUB',
      bbc: 'GOSUB',
      commodore: 'GOSUB',
      cpc: 'GOSUB',
      trs80: 'GOSUB',
      zx80: 'GOSUB',
      zx81: 'GOSUB',
      zxspectrum: 'GO SUB',
    },
  },
  {
    concept: 'resume-after-break',
    spellings: {
      commodore: 'CONT',
      cpc: 'CONT',
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
      bbc: 'CLEAR',
      commodore: 'CLR',
      cpc: 'CLEAR',
      trs80: 'CLEAR',
      zx80: 'CLEAR',
      zx81: 'CLEAR',
      zxspectrum: 'CLEAR',
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
  {
    keyword: 'LOG',
    meanings: {
      atom: 'Base-10 logarithm; LN gives the natural logarithm.',
      bbc: 'Base-10 logarithm; LN gives the natural logarithm.',
      commodore: 'Natural (base-e) logarithm. There is no LN.',
      cpc: 'Natural (base-e) logarithm.',
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
      atom: 'Selects a screen mode and clears it — CLEAR 0 is the text screen.',
      bbc: 'Discards all variables, leaving the program intact.',
      cpc: 'Discards all variables, leaving the program intact.',
      trs80: 'Discards all variables, leaving the program intact.',
      zx80: 'Discards all variables, leaving the program intact.',
      zx81: 'Discards all variables, leaving the program intact.',
      zxspectrum: 'Discards all variables, leaving the program intact.',
    },
  },
  {
    keyword: 'GET',
    meanings: {
      atom: 'Reads a value from a hardware I/O port.',
      bbc: 'Waits for a key press and returns its character code.',
      commodore: 'Reads a pending key without waiting; empty if none.',
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
export const pairPortingNotes: PairPortingNotes[] = [
  {
    from: 'zx80',
    to: 'zx81',
    notes: [
      'The ZX81 has floating point, so the ZX80’s integer-only workarounds can go: values are no longer capped at ±32767 and division stops truncating.',
      'FOR gains STEP and INKEY$ can poll the keyboard, so loops that counted by one and INPUT-only key reads can be simplified.',
      'Block graphics use the same escape spellings but different byte values, so imported graphics can come out wrong — recheck them.',
    ],
  },
  {
    from: 'zx81',
    to: 'zx80',
    notes: [
      'The ZX80 is integer-only: rescale anything fractional, keep values within ±32767, and remember division truncates.',
      'There is no STEP and no INKEY$ — count by one and multiply inside the loop, and read the keyboard with INPUT.',
      'Block graphics share the ZX81’s escape spellings but store different byte values, so recheck any imported graphics.',
    ],
  },
  {
    from: 'zx80',
    to: 'zxspectrum',
    notes: [
      'A big step up: the Spectrum adds floating point, eight colours, BEEP sound and 256×176 pixel graphics.',
      'Machine code hidden in REM lines does not carry — the Spectrum keeps code in separate .TAP CODE blocks.',
      'Control codes and block graphics are spelled differently (brace directives like {INK 2}), so redo any screen layout.',
    ],
  },
  {
    from: 'zxspectrum',
    to: 'zx80',
    notes: [
      'A severe downgrade: the ZX80 is integer-only with no colour, no sound and FAST-only display, so anything using those must go.',
      'A .TAP CODE block has no home — the ZX80 carries machine code only as hidden-REM records, and even those differ in format.',
      'Floating-point maths, DRAW/CIRCLE and BEEP have no equivalent; rebuild them with block graphics and integers or drop them.',
    ],
  },
  {
    from: 'zx81',
    to: 'zxspectrum',
    notes: [
      'The closest port here: GOTO and GOSUB are written GO TO and GO SUB (the glued forms still enter), and floating point carries over.',
      'Machine code hidden in REM lines must become a separate .TAP CODE block — the Spectrum does not keep code in the listing.',
      'The Spectrum’s character codes and block graphics differ from the ZX81’s own, so recheck any CHR$ values and screen output.',
    ],
  },
  {
    from: 'zxspectrum',
    to: 'zx81',
    notes: [
      'Dropping to the ZX81 loses colour, sound and pixel DRAW/CIRCLE; keep to text and PLOT/UNPLOT block graphics.',
      'A .TAP CODE block must move back inside the listing as a hidden-REM record; there is no separate code file.',
      'Character codes are the ZX81’s own, not ASCII, so CHR$ values and screen text need rechecking.',
    ],
  },
  {
    from: 'commodore',
    to: 'trs80',
    notes: [
      'Both are Microsoft-style BASICs, so most control flow, arrays and string functions carry across with little change.',
      'The TRS-80 adds ELSE, so IF tests you had to invert or split across lines can be written in one.',
      'There are no POKE-driven graphics or sound: use SET, RESET and POINT for the display, and the Model I makes no sound.',
    ],
  },
  {
    from: 'trs80',
    to: 'commodore',
    notes: [
      'Both are Microsoft-style BASICs, so most control flow and string handling ports with little change.',
      'The Commodore has no ELSE, so every IF…THEN…ELSE must be restructured.',
      'PRINT@ and PRINT USING have no equivalent — position text by POKEing screen memory and format numbers by hand.',
    ],
  },
  {
    from: 'atom',
    to: 'bbc',
    notes: [
      'Same manufacturer, but not a smooth upgrade: the BBC adds floating point, real string variables, and DEF PROC/FN with REPEAT.',
      'Memory indirection carries over (?addr, !addr), but hex is written &nn here, not #nn, and statements separate with : not ;.',
      'PRINT ends the line on the BBC, so drop the Atom’s trailing ’ newlines and its build-a-string-from-bytes workarounds.',
    ],
  },
  {
    from: 'bbc',
    to: 'atom',
    notes: [
      'Same manufacturer, but a steep step down: the Atom is integer-only, with no floating point and no string variables.',
      'There is no DEF PROC/FN or REPEAT, and PRINT does not end the line — use ’ for newlines and GOSUB for structure.',
      'Memory indirection still works (?addr, !addr), but hex is written #nn, not &nn, and statements separate with ; not :.',
    ],
  },
];
