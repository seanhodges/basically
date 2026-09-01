// Per-(target dialect, capability) porting advice: what to do when a program
// being ported needs something the target has no command for, plus a short
// worked example of how that job is done on the target where its support for
// the capability is absent or partial.
//
// Cells are keyed by (target, capability) and never by pair: a target-anchored
// note like "the ZX81 has no pixel graphics, rescale to the 64x44 block grid"
// is equally correct arriving from a CPC, a BBC or a Spectrum. The target is a
// machine, not the reference page it reads from: a cell is a paragraph written
// *to* a machine, and two machines on one page needing different advice is the
// ordinary case - the ZX81 and the Spectrum share the Sinclair page and share
// almost none of this. Machines that do share a cell are named together through
// the lists in porting.ts. `summary`
// renders only in the "newly available" brief (what this machine offers
// here); `instead` renders only against a lost-capability group (what to do
// instead); the two are never shown together. Completeness is enforced from
// the real diff by domain-guidance-crosscheck.test.ts rather than from a
// hand-maintained list, so a cell here either answers a question the
// comparison can actually ask or the crosscheck rejects it as dead.
//
// Edit by hand, grounded in each dialect's real reference table and hardware
// page — the same discipline porting.ts and facts.ts already follow.
import type { KeywordDomain } from './domains';
import {
  ATARIS,
  BBCS,
  COMMODORE_V2S,
  COMMODORES,
  CPCS,
  LOCOMOTIVE_1_1S,
  SPECTRUMS,
} from './porting';

/** A short worked example of how a job is done on the target machine. */
export interface DomainGuidanceExample {
  /** One line above the code, e.g. "No ELSE: split into two branches". */
  caption: string;
  /** Program lines, capped at MAX_EXAMPLE_LINES of MAX_EXAMPLE_LINE_CHARS each. */
  code: string[];
}

/** Advice for one (target dialect, capability) pair. */
export interface DomainGuidance {
  /**
   * The machine this cell advises for, or the machines it reads the same for.
   * Several are named only where the advice is genuinely shared, never because
   * they share a reference page.
   */
  to: string | readonly string[];
  /** The capability domain this cell covers. */
  domain: KeywordDomain;
  /** How well the target covers this capability on its own. */
  support: 'full' | 'partial' | 'none';
  /** "What this machine offers here" — rendered in the additions brief only. */
  summary: string;
  /**
   * "What to do instead" — rendered against a lost-capability group only.
   * Required for every cell some source dialect can lose into this target.
   */
  instead?: string;
  /** A worked example; present exactly when support !== 'full' and instead is set. */
  example?: DomainGuidanceExample;
  /** Up to 4 of the target's own command names in this domain, for the brief. */
  reachFor?: string[];
}

export const domainGuidance: DomainGuidance[] = [
  // ---------------------------------------------------------------- zx81 --
  {
    to: 'zx81',
    domain: 'control-flow',
    support: 'partial',
    summary:
      'IF…THEN, FOR…NEXT with STEP, and GOTO/GOSUB/PAUSE cover jumps, loops and timed pauses.',
    instead:
      'No ELSE: put the negative case on the following line, or invert the test and GOTO past the positive case.',
    example: {
      caption: 'No ELSE: split into two lines',
      code: [
        '10 IF X=0 THEN GOTO 40',
        '20 PRINT "NONZERO"',
        '30 GOTO 50',
        '40 PRINT "ZERO"',
      ],
    },
    reachFor: ['FOR', 'GOTO', 'GOSUB', 'PAUSE'],
  },
  {
    to: 'zx81',
    domain: 'data',
    support: 'partial',
    summary: 'LET and DIM declare variables and arrays.',
    instead:
      'No DATA/READ/RESTORE: hold constants in an array filled by a FOR loop, or pack them into a string and slice it out.',
    example: {
      caption: 'Fill an array instead of DATA',
      code: ['10 DIM A(2)', '20 LET A(1)=10', '30 LET A(2)=20'],
    },
    reachFor: ['LET', 'DIM'],
  },
  {
    to: 'zx81',
    domain: 'numeric',
    support: 'full',
    summary:
      'A full trig/log set plus <=, >= and <> covers real arithmetic and complete comparisons.',
    instead:
      'No integer-only workarounds needed: RND, INT and the trig functions already work directly on real numbers.',
    reachFor: ['SIN', 'SQR', 'RND'],
  },
  {
    to: 'zx81',
    domain: 'strings',
    support: 'partial',
    summary:
      'CODE, VAL, LEN, STR$ and CHR$ convert between strings and numbers.',
    instead:
      'No LEFT$/MID$/RIGHT$: slice a string with A$(start TO end) — e.g. A$(1 TO 3) for the first three characters.',
    example: {
      caption: 'Slice instead of LEFT$/MID$',
      code: ['10 LET A$="HELLO"', '20 PRINT A$(1 TO 3)'],
    },
    reachFor: ['CODE', 'LEN', 'STR$'],
  },
  {
    to: 'zx81',
    domain: 'text-screen',
    support: 'full',
    summary:
      'AT positions text by row and column, TAB moves the column, and SCROLL/CLS/COPY manage the screen.',
    instead:
      'No LOCATE-named command: AT row,column is the equivalent, written directly inside a PRINT statement.',
    reachFor: ['AT', 'SCROLL', 'CLS'],
  },
  {
    to: 'zx81',
    domain: 'graphics',
    support: 'partial',
    summary:
      'PLOT and UNPLOT set and clear a single point on the 64×44 block-graphics grid.',
    instead:
      'No DRAW or CIRCLE: step along the shape yourself and PLOT each point, or shade with the block-graphics character set.',
    example: {
      caption: 'A line from PLOT points',
      code: ['10 FOR X=0 TO 20', '20 PLOT X,X', '30 NEXT X'],
    },
    reachFor: ['PLOT', 'UNPLOT'],
  },
  {
    to: 'zx81',
    domain: 'colour',
    support: 'none',
    summary: 'No colour: black on white with inverse video only.',
    instead:
      'No colour keywords: use inverse video (the inverse character forms) in place of ink to draw attention to text.',
    example: {
      caption: 'Highlight with inverse video',
      code: ['10 PRINT CHR$(143);"HELLO"'],
    },
  },
  {
    to: 'zx81',
    domain: 'sound',
    support: 'none',
    summary: 'No sound: silent unless a program POKEs the speaker directly.',
    instead:
      'No sound keywords at all: drop the effect, or print a message in its place.',
    example: { caption: 'Print instead of a beep', code: ['10 PRINT "BEEP"'] },
  },
  {
    to: 'zx81',
    domain: 'input',
    support: 'full',
    summary: 'INKEY$ polls the keyboard without waiting, INPUT reads a line.',
    instead:
      'No LINE INPUT-style raw read: INPUT already accepts a full expression or string, quoted or not.',
    reachFor: ['INKEY$', 'INPUT'],
  },
  {
    to: 'zx81',
    domain: 'storage',
    support: 'full',
    summary: 'SAVE and LOAD store and retrieve a whole program on cassette.',
    instead:
      'No partial or record-level storage: SAVE/LOAD handle a whole program only.',
    reachFor: ['LOAD', 'SAVE'],
  },
  {
    to: 'zx81',
    domain: 'memory-hardware',
    support: 'full',
    summary:
      'PEEK and POKE read and write memory, USR calls machine code, and FAST/SLOW pick the display mode.',
    instead:
      'No indirection operators: address every read/write with PEEK/POKE directly.',
    reachFor: ['PEEK', 'POKE', 'USR'],
  },
  {
    to: 'zx81',
    domain: 'program-editing',
    support: 'partial',
    summary:
      'LIST, NEW, RUN and CONT (resume after Break) cover editing and running a listing.',
    instead:
      'No DELETE/RENUMBER: remove a line by typing its number alone and pressing enter, and renumber by hand.',
    example: { caption: 'Delete a line by number', code: ['100'] },
    reachFor: ['LIST', 'RUN', 'CONT'],
  },
  {
    to: 'zx81',
    domain: 'error-handling',
    support: 'none',
    summary:
      'No error trapping: an error stops the program and reports a code.',
    instead:
      'No error trapping at all: guard against a likely failure (check a divisor, SCROLL before the screen fills) before it happens.',
    example: {
      caption: 'Guard instead of catching',
      code: [
        '10 IF D=0 THEN GOTO 40',
        '20 PRINT N/D',
        '30 GOTO 50',
        '40 PRINT "DIV 0"',
      ],
    },
  },
  // ---------------------------------------------------------------- zx80 --
  {
    to: 'zx80',
    domain: 'control-flow',
    support: 'partial',
    summary: 'IF…THEN, FOR…NEXT and GOTO/GOSUB cover the basics.',
    instead:
      'No ELSE and no STEP: put the negative case on the next line (or invert with NOT), and multiply the loop counter by hand for any step but one.',
    example: {
      caption: 'No STEP: multiply instead',
      code: ['10 FOR I=0 TO 5', '20 PRINT I*2', '30 NEXT I'],
    },
    reachFor: ['FOR', 'GOTO', 'GOSUB'],
  },
  {
    to: 'zx80',
    domain: 'data',
    support: 'partial',
    summary: 'LET and DIM declare variables and arrays.',
    instead:
      'No DATA/READ/RESTORE at all: fill an array from a FOR loop of LET assignments instead of a table of constants.',
    example: {
      caption: 'Fill an array instead of DATA',
      code: ['10 DIM A(2)', '20 LET A(0)=1', '30 LET A(1)=2'],
    },
    reachFor: ['LET', 'DIM'],
  },
  {
    to: 'zx80',
    domain: 'numeric',
    support: 'partial',
    summary: 'The four operators, AND/OR/NOT and RND cover integer arithmetic.',
    instead:
      'Integer only, and no <=, >= or <>: rescale anything fractional, keep values within ±32767, and combine with AND/OR/NOT for the missing comparisons.',
    example: {
      caption: 'A>=B without >=',
      code: ['10 IF NOT(A<B) THEN PRINT"A>=B"'],
    },
  },
  {
    to: 'zx80',
    domain: 'strings',
    support: 'partial',
    summary: 'CHR$, CODE, STR$ and TL$ give basic character handling.',
    instead:
      'No LEN or substring functions: TL$ drops the first character, so peel a string apart one character at a time in a loop.',
    example: {
      caption: 'Peel a string with TL$',
      code: ['10 LET A$="HELLO"', '20 LET A$=TL$(A$)'],
    },
    reachFor: ['CHR$', 'STR$', 'TL$'],
  },
  {
    to: 'zx80',
    domain: 'text-screen',
    support: 'partial',
    summary: 'PRINT and CLS cover basic text output.',
    instead:
      'No TAB or AT: position text by printing leading spaces to reach the column you want.',
    example: {
      caption: 'Position with leading spaces',
      code: ['10 PRINT "     HELLO"'],
    },
  },
  {
    to: 'zx80',
    domain: 'graphics',
    support: 'none',
    summary:
      'No PLOT: the block-graphics character set is drawn by PRINTing its characters.',
    instead:
      'No PLOT: PRINT the block-graphics characters directly — each covers a 2×2 dot within its character cell.',
    example: { caption: 'A block via PRINT', code: ['10 PRINT CHR$(128)'] },
  },
  {
    to: 'zx80',
    domain: 'colour',
    support: 'none',
    summary:
      'No colour: black on white, with inverse video the only highlight.',
    instead:
      'No colour keywords: use inverse video (the inverse character forms) in place of ink to draw attention to text.',
    example: {
      caption: 'Highlight with inverse video',
      code: ['10 PRINT CHR$(143);"HELLO"'],
    },
  },
  {
    to: 'zx80',
    domain: 'sound',
    support: 'none',
    summary:
      'No sound hardware: the display even blanks while the program computes.',
    instead:
      'No sound hardware at all: drop the effect, or print a message in its place.',
    example: { caption: 'Print instead of a beep', code: ['10 PRINT "BEEP"'] },
  },
  {
    to: 'zx80',
    domain: 'input',
    support: 'partial',
    summary: 'INPUT reads a whole line, waiting until return is pressed.',
    instead:
      'No INKEY$: the ZX80 cannot poll the keyboard at all, so restructure a poll-then-continue loop as an INPUT prompt.',
    example: { caption: 'INPUT instead of a poll', code: ['10 INPUT A$'] },
    reachFor: ['INPUT'],
  },
  {
    to: 'zx80',
    domain: 'storage',
    support: 'full',
    summary:
      'SAVE and LOAD store and retrieve a whole program on cassette — the full extent of storage here.',
    instead:
      'No file or record-level storage: SAVE and LOAD only handle a whole program.',
    reachFor: ['SAVE', 'LOAD'],
  },
  {
    to: 'zx80',
    domain: 'memory-hardware',
    support: 'full',
    summary: 'PEEK and POKE read and write memory, and USR calls machine code.',
    instead:
      'No indirection operators: address every read/write with PEEK/POKE directly.',
    reachFor: ['PEEK', 'POKE', 'USR'],
  },
  {
    to: 'zx80',
    domain: 'program-editing',
    support: 'partial',
    summary:
      'LIST, NEW, RUN and CONTINUE (resume after Stop) cover editing and running a listing.',
    instead:
      'No DELETE/RENUMBER: remove a line by typing its number alone and pressing enter, and renumber by hand.',
    example: { caption: 'Delete a line by number', code: ['100'] },
    reachFor: ['LIST', 'RUN', 'NEW'],
  },
  {
    to: 'zx80',
    domain: 'error-handling',
    support: 'none',
    summary:
      'No error trapping: an error stops the program and reports a code and line.',
    instead:
      'No error trapping at all: guard against a likely failure (check a divisor, check array bounds) before it happens.',
    example: {
      caption: 'Guard instead of catching',
      code: [
        '10 IF D=0 THEN GOTO 40',
        '20 PRINT N/D',
        '30 GOTO 50',
        '40 PRINT "DIV 0"',
      ],
    },
  },
  // ----------------------------------------------------------- SPECTRUMS --
  {
    to: SPECTRUMS,
    domain: 'control-flow',
    support: 'partial',
    summary:
      'IF…THEN, FOR…NEXT and GO TO/GO SUB cover jumps and loops, with everything after THEN running only when the test is true.',
    instead:
      "No ELSE: put the negative case on the following line, or chain further ':' statements after THEN — they all run only when the test is true.",
    example: {
      caption: 'No ELSE: chain after THEN',
      code: ['10 IF X=0 THEN PRINT "ZERO": GO TO 30', '20 PRINT "NONZERO"'],
    },
    reachFor: ['FOR', 'GO TO', 'GO SUB'],
  },
  {
    to: SPECTRUMS,
    domain: 'data',
    support: 'full',
    summary:
      'READ/DATA/RESTORE, DIM and LET cover constant tables, arrays and assignment.',
    instead:
      'No DEFINT-style type defaults: every string/array name is fixed with a trailing $, so there is nothing to declare up front.',
    reachFor: ['DATA', 'READ', 'DIM'],
  },
  {
    to: SPECTRUMS,
    domain: 'numeric',
    support: 'full',
    summary:
      'A full trig/log set plus <=, >= and <> covers real arithmetic and complete comparisons.',
    instead:
      'No base-only quirks: SIN/COS/TAN and the rest already take radians directly.',
    reachFor: ['SIN', 'SQR', 'RND'],
  },
  {
    to: SPECTRUMS,
    domain: 'strings',
    support: 'partial',
    summary:
      'VAL$, CODE, VAL, LEN, STR$ and CHR$ convert between strings and numbers.',
    instead:
      'No LEFT$/MID$/RIGHT$: slice a string with a$(start TO end) — e.g. a$(1 TO 3) for the first three characters.',
    example: {
      caption: 'Slice instead of LEFT$/MID$',
      code: ['10 LET a$="HELLO"', '20 PRINT a$(1 TO 3)'],
    },
    reachFor: ['CODE', 'LEN', 'STR$'],
  },
  {
    to: SPECTRUMS,
    domain: 'text-screen',
    support: 'full',
    summary:
      'AT positions text by row and column, TAB moves the column, and SCREEN$ reads a character back off the display.',
    instead:
      'No LOCATE-named command: AT row,column is the equivalent, written directly inside a PRINT statement.',
    reachFor: ['AT', 'SCREEN$', 'TAB'],
  },
  {
    to: SPECTRUMS,
    domain: 'graphics',
    support: 'full',
    summary:
      'PLOT/DRAW/CIRCLE cover point, line and circle drawing over the full 256×176 pixel screen.',
    instead:
      'No named FILL command: OVER 1 with repeated PLOT/DRAW builds a filled shape, or draw it as adjacent line segments.',
    reachFor: ['DRAW', 'CIRCLE', 'PLOT'],
  },
  {
    to: SPECTRUMS,
    domain: 'colour',
    support: 'full',
    summary:
      'INK/PAPER/BORDER/BRIGHT/FLASH set the 8-colour attribute for a region.',
    instead:
      'No per-pixel colour: one ink/paper pair applies to a whole 8×8 cell, so redesign artwork that relies on finer colour granularity.',
    reachFor: ['INK', 'PAPER', 'FLASH'],
  },
  // Split from the Spectrums' shared cell: PLAY and the AY chip arrived with the
  // 128, so a 48K reader offered them is sent to a command their machine has
  // never had. The two share nothing here but BEEP.
  {
    to: 'zxspectrum',
    domain: 'sound',
    support: 'partial',
    summary:
      'BEEP plays a tone at a given duration and pitch, on the one beeper channel the 48K has.',
    instead:
      'No multi-channel envelope like SOUND/ENVELOPE: BEEP duration,pitch plays one note at a time — sequence several for a tune.',
    example: {
      caption: 'A tune from sequential BEEPs',
      code: ['10 BEEP .2,0', '20 BEEP .2,4'],
    },
    reachFor: ['BEEP'],
  },
  {
    to: 'zxspectrum128',
    domain: 'sound',
    support: 'partial',
    summary:
      'BEEP sounds one tone on the beeper; PLAY drives the AY chip’s three channels from music strings.',
    instead:
      'No SOUND/ENVELOPE register control: BEEP duration,pitch for one note, or hand PLAY one music string per channel.',
    example: {
      caption: 'Three channels with PLAY',
      code: ['10 PLAY "cdefg", "eg", "c"'],
    },
    reachFor: ['BEEP', 'PLAY'],
  },
  {
    to: SPECTRUMS,
    domain: 'input',
    support: 'full',
    summary:
      'INKEY$ polls the keyboard without waiting, INPUT reads a whole line or expression.',
    instead:
      'No LINE INPUT-style raw read: INPUT already accepts a full expression or string, quoted or not.',
    reachFor: ['INKEY$', 'INPUT'],
  },
  {
    to: SPECTRUMS,
    domain: 'storage',
    support: 'full',
    summary:
      'SAVE/LOAD/VERIFY/MERGE with CAT and FORMAT give full cassette (and +3 disk) file handling.',
    instead:
      'No random-access record keyword in BASIC: structure tape data sequentially, since there is no direct-access file mode.',
    reachFor: ['SAVE', 'VERIFY', 'CAT'],
  },
  {
    to: SPECTRUMS,
    domain: 'memory-hardware',
    support: 'full',
    summary:
      'PEEK and POKE read and write memory, USR calls machine code, and IN/OUT reach I/O ports.',
    instead:
      'No indirection operators: address every read/write with PEEK/POKE directly rather than ?addr/!addr-style shortcuts.',
    reachFor: ['PEEK', 'POKE', 'IN'],
  },
  {
    to: SPECTRUMS,
    domain: 'program-editing',
    support: 'partial',
    summary:
      'LIST, NEW, RUN and CONTINUE (resume after Break) cover editing and running a listing.',
    instead:
      'No DELETE/RENUMBER: remove a line by typing its number alone and pressing enter, and renumber by hand.',
    example: { caption: 'Delete a line by number', code: ['100'] },
    reachFor: ['LIST', 'RUN', 'CONTINUE'],
  },
  {
    to: SPECTRUMS,
    domain: 'error-handling',
    support: 'none',
    summary:
      'No error trapping: an error stops the program and reports it by code and line.',
    instead:
      'No error trapping at all: guard against a likely failure (check a divisor, check for a full screen) before it happens.',
    example: {
      caption: 'Guard instead of catching',
      code: [
        '10 IF d=0 THEN GO TO 40',
        '20 PRINT n/d',
        '30 GO TO 50',
        '40 PRINT "DIV 0"',
      ],
    },
  },
  // ---------------------------------------------------------------- BBCS --
  {
    to: BBCS,
    domain: 'control-flow',
    support: 'full',
    summary:
      'IF…THEN…ELSE, FOR…NEXT, REPEAT…UNTIL and DEF PROC/FN with ON…GOSUB give full structured control flow.',
    instead:
      'No WHILE/WEND or AFTER/EVERY timers: rewrite a while-loop as REPEAT…UNTIL with an inverted test, and poll TIME instead of a timer interrupt.',
    reachFor: ['PROC', 'REPEAT', 'ON'],
  },
  {
    to: BBCS,
    domain: 'data',
    support: 'full',
    summary:
      'LET, DIM, DATA/READ/RESTORE and CLEAR cover assignment, arrays and constant tables.',
    instead:
      "No DEFINT/DEFSTR type defaults: every variable's type is fixed by its own %, $ or plain suffix, so declare each explicitly.",
    reachFor: ['DATA', 'DIM', 'READ'],
  },
  {
    to: BBCS,
    domain: 'numeric',
    support: 'full',
    summary:
      'A full set of trig, log and rounding functions plus DIV/MOD/EOR covers real and integer arithmetic.',
    instead:
      'No CINT/FIX/ROUND functions: truncate with INT, and round by adding 0.5 before INT for positive values.',
    reachFor: ['SQR', 'LOG', 'RND'],
  },
  {
    to: BBCS,
    domain: 'strings',
    support: 'full',
    summary:
      'LEFT$/MID$/RIGHT$/STR$/VAL/INSTR/EVAL give full substring, conversion and expression-evaluation support.',
    instead:
      'No LOWER$/UPPER$ case conversion: shift a character’s ASC value by 32 and rebuild the string with CHR$, or drop the case-folding.',
    reachFor: ['LEFT$', 'MID$', 'INSTR'],
  },
  {
    to: BBCS,
    domain: 'text-screen',
    support: 'full',
    summary:
      'VDU drives the display directly, with TAB, SPC, POS/VPOS and WIDTH for layout on top of PRINT.',
    instead:
      'No LOCATE/WINDOW text areas: position each PRINT with TAB(x,y) and manage margins by hand.',
    reachFor: ['VDU', 'TAB', 'WIDTH'],
  },
  {
    to: BBCS,
    domain: 'graphics',
    support: 'full',
    summary:
      'MOVE/DRAW/PLOT cover the whole 1280×1024 graphics space, with POINT to read a pixel back and CLG to clear it.',
    instead:
      "No named CIRCLE or FILL command: PLOT's plot-code argument draws circles and filled shapes — check the PLOT reference for the code.",
    reachFor: ['DRAW', 'PLOT', 'POINT'],
  },
  {
    to: BBCS,
    domain: 'colour',
    support: 'full',
    summary:
      'COLOUR sets text ink/paper and GCOL sets graphics ink, both from up to 16 mode-dependent colours.',
    instead:
      "No PEN/PAPER-style pair: COLOUR n for text, GCOL n for graphics — pick the right one for what you're drawing.",
    reachFor: ['COLOUR', 'GCOL'],
  },
  {
    to: BBCS,
    domain: 'sound',
    support: 'full',
    summary:
      'SOUND drives up to four channels by amplitude, pitch and duration, shaped by an ENVELOPE.',
    instead:
      "No SQ-style channel query: SOUND's own channel argument already selects which of the four voices plays.",
    reachFor: ['SOUND', 'ENVELOPE'],
  },
  {
    to: BBCS,
    domain: 'input',
    support: 'full',
    summary:
      'INKEY/INKEY$ poll the keyboard without blocking, GET/GET$ wait for a key, and ADVAL reads analogue/joystick input.',
    instead:
      'No SPEED KEY-style typematic control: read the keyboard as often as needed with INKEY rather than configuring a repeat rate.',
    reachFor: ['INKEY', 'GET', 'ADVAL'],
  },
  {
    to: BBCS,
    domain: 'storage',
    support: 'full',
    summary:
      'OPENIN/OPENOUT/OPENUP with BGET/BPUT and PTR/EXT give full random-access file I/O alongside LOAD/SAVE/CHAIN.',
    instead:
      'No CAT/directory keyword: use *CAT (a star command via OSCLI) rather than a BASIC keyword.',
    reachFor: ['OPENIN', 'BPUT', 'CHAIN'],
  },
  {
    to: BBCS,
    domain: 'memory-hardware',
    support: 'full',
    summary:
      '?addr and !addr read/write a byte or word directly, and CALL/USR/OSCLI reach machine code and the OS.',
    instead:
      'No POKE/PEEK: write ?addr=val for a byte, !addr=val for a word, and read them back the same way.',
    reachFor: ['CALL', 'USR', 'OSCLI'],
  },
  {
    to: BBCS,
    domain: 'program-editing',
    support: 'full',
    summary:
      'AUTO, RENUMBER, DELETE and TRACE give full listing-editing and debugging tools alongside LIST/NEW.',
    instead:
      'No CONT to resume after Escape: catch the break in an error handler, or rerun from a saved restart point.',
    reachFor: ['AUTO', 'RENUMBER', 'TRACE'],
  },
  {
    to: BBCS,
    domain: 'error-handling',
    support: 'full',
    summary:
      'ON ERROR traps a failure, ERR/ERL/REPORT identify it, and the handler can recover with normal control flow.',
    instead:
      'No RESUME to continue at the failing line: the handler must GOTO back explicitly, since ON ERROR does not resume on its own.',
    reachFor: ['ERROR', 'ERR', 'REPORT'],
  },
  // ---------------------------------------------------------- COMMODORES --
  {
    to: COMMODORES,
    domain: 'control-flow',
    support: 'partial',
    summary:
      'GOTO/GOSUB, FOR…NEXT and ON…GOTO/GOSUB cover jumps and loops, all through line numbers rather than named blocks.',
    instead:
      'No ELSE: follow the IF line with the negative-case statements, or invert the test and GOTO past them.',
    example: {
      caption: 'No ELSE: invert the test',
      code: [
        '10 IF X=0 THEN 40',
        '20 PRINT"NONZERO"',
        '30 GOTO 50',
        '40 PRINT"ZERO"',
      ],
    },
    reachFor: ['FOR', 'GOSUB', 'ON'],
  },
  {
    to: COMMODORES,
    domain: 'data',
    support: 'full',
    summary:
      'DATA/READ/RESTORE hold constant tables, and DIM/LET declare arrays and variables.',
    instead:
      'Only the first two characters of a name are significant: rename any DIM/LET variable that collides with another under that rule.',
    reachFor: ['DATA', 'READ', 'RESTORE'],
  },
  {
    to: COMMODORES,
    domain: 'numeric',
    support: 'full',
    summary:
      'A full trig/log/rounding set covers real arithmetic, though LOG is natural rather than base-10.',
    instead:
      'No LN: LOG is already the natural logarithm here, so drop any base conversion that assumed LOG meant base-10.',
    reachFor: ['SQR', 'LOG', 'RND'],
  },
  {
    to: COMMODORES,
    domain: 'strings',
    support: 'full',
    summary:
      'LEFT$/MID$/RIGHT$/STR$/VAL/ASC/CHR$ give full substring extraction and numeric-string conversion.',
    instead:
      'No INSTR-style search built in: scan with a FOR loop comparing MID$(A$,I,LEN(B$)) against B$ at each position.',
    reachFor: ['LEFT$', 'MID$', 'ASC'],
  },
  {
    to: COMMODORES,
    domain: 'text-screen',
    support: 'partial',
    summary:
      'PRINT with TAB(/SPC( positions text by column, and POS reports where the cursor sits.',
    instead:
      'No CLS keyword: PRINT CHR$(147) clears the screen, and there is no AT-style row/column jump — position with TAB( only.',
    example: {
      caption: 'Clear screen without CLS',
      code: ['10 PRINT CHR$(147)', '20 PRINT"HELLO"'],
    },
    reachFor: ['PRINT', 'TAB('],
  },
  {
    to: COMMODORES,
    domain: 'graphics',
    support: 'none',
    summary:
      'No graphics keywords: the video chip is reached only by POKEing its registers.',
    instead:
      'No PLOT/DRAW at all: POKE bitmap or sprite data directly into screen/colour RAM, or drop pixel graphics for character-based output.',
    example: {
      caption: 'A block via a screen POKE',
      code: ['10 POKE 1024,81', '20 POKE 55296,1'],
    },
  },
  {
    to: COMMODORES,
    domain: 'colour',
    support: 'none',
    summary:
      'No colour keywords: text colour is a control code inside the string, and graphics colour is POKEd.',
    instead:
      'No INK/PAPER commands: embed a colour control code — e.g. {red} — inside a PRINT string, one of the codes the character set defines.',
    example: {
      caption: 'Colour via a control code',
      code: ['10 PRINT CHR$(28);"RED TEXT"'],
    },
  },
  {
    to: COMMODORES,
    domain: 'sound',
    support: 'none',
    summary:
      'No sound keywords: the sound chip is driven entirely by POKEing its registers.',
    instead:
      "No SOUND/BEEP: POKE the sound chip's frequency, waveform and volume registers directly — there is no shortcut command.",
    example: {
      caption: 'A tone via register POKEs',
      code: ['10 POKE 54276,33', '20 POKE 54273,20'],
    },
  },
  {
    to: COMMODORES,
    domain: 'input',
    support: 'full',
    summary:
      'INPUT reads a line and GET reads one pending key without waiting, covering blocking and polled input.',
    instead:
      'No INKEY$-named function: GET A$ is the equivalent — it returns an empty string immediately when no key is waiting.',
    reachFor: ['GET', 'INPUT'],
  },
  // Split from the Commodores' shared cell: DSAVE, DLOAD and CATALOG are BASIC
  // 4.0, so only the PET has them - a VIC-20 or C64 reader sent to them is sent
  // to commands their machine answers with a syntax error.
  {
    to: 'pet',
    domain: 'storage',
    support: 'full',
    summary:
      'OPEN/PRINT#/INPUT# give full sequential file I/O, alongside disk commands like DSAVE, DLOAD and CATALOG.',
    instead:
      'No random-access RECORD-style shortcut on cassette: use OPEN with a channel and PRINT#/INPUT# for sequential access instead.',
    reachFor: ['OPEN', 'DSAVE', 'CATALOG'],
  },
  {
    to: COMMODORE_V2S,
    domain: 'storage',
    support: 'full',
    summary:
      'OPEN/PRINT#/INPUT# give full sequential file I/O, with LOAD, SAVE and VERIFY for whole files.',
    instead:
      'No disk commands and no RECORD: OPEN a channel on the drive and drive it with PRINT#/INPUT#, or move whole files with LOAD and SAVE.',
    reachFor: ['OPEN', 'PRINT#', 'INPUT#'],
  },
  {
    to: COMMODORES,
    domain: 'memory-hardware',
    support: 'full',
    summary:
      'PEEK/POKE read and write memory directly, and SYS/USR call machine code.',
    instead:
      'No CALL-named entry point: SYS address runs machine code directly, and USR(x) is a separate user-function vector.',
    reachFor: ['SYS', 'USR', 'PEEK'],
  },
  {
    to: COMMODORES,
    domain: 'program-editing',
    support: 'partial',
    summary:
      'RUN, LIST, NEW and CONT (resume after Stop) cover the essentials of editing and running a listing.',
    instead:
      'No DELETE/RENUMBER: remove a line by typing its number alone and pressing return, and renumber by hand.',
    example: { caption: 'Delete a line by number', code: ['100'] },
    reachFor: ['LIST', 'RUN', 'CONT'],
  },
  {
    to: COMMODORES,
    domain: 'error-handling',
    support: 'none',
    summary:
      'No error trapping: an error stops the program and reports a code and line number.',
    instead:
      'No ON ERROR at all: guard risky operations (check a divisor, check a file exists) before they run rather than catching a failure.',
    example: {
      caption: 'Guard instead of catching',
      code: [
        '10 IF D=0 THEN 40',
        '20 PRINT N/D',
        '30 GOTO 50',
        '40 PRINT"DIV BY 0"',
      ],
    },
  },
  // ---------------------------------------------------------------- atom --
  {
    to: 'atom',
    domain: 'control-flow',
    support: 'partial',
    summary:
      'IF…THEN, GOTO/GOSUB, FOR…NEXT and a DO…UNTIL loop cover the basics.',
    instead:
      'No ELSE and no PROC/FN: put the negative case on the next line or invert the test, and call a subroutine with GOSUB to a labelled line.',
    example: {
      caption: 'No ELSE: split into two branches',
      code: [
        '100 IF X=0 THEN GOTO 130',
        '110 PRINT"NONZERO"',
        '120 GOTO 140',
        '130 PRINT"ZERO"',
      ],
    },
    reachFor: ['FOR', 'GOSUB', 'DO'],
  },
  {
    to: 'atom',
    domain: 'data',
    support: 'partial',
    summary: 'LET and DIM declare variables and arrays.',
    instead:
      'No DATA/READ/RESTORE: fill an array from a FOR loop of LET assignments, or hold constants in a string and pull them out by position.',
    example: {
      caption: 'Fill an array instead of DATA',
      code: [
        '10 DIM A(3)',
        '20 LET A(0)=1;LET A(1)=2',
        '30 LET A(2)=3;LET A(3)=5',
      ],
    },
    reachFor: ['LET', 'DIM'],
  },
  {
    to: 'atom',
    domain: 'numeric',
    support: 'partial',
    summary:
      'ABS, SQR and the full trig/log set are available through the floating-point ROM.',
    instead:
      "Native variables are 32-bit integers with no exponent operator: for real arithmetic use the FP ROM's %A–%Z variables and its F-prefixed statements.",
    example: {
      caption: "Float via the FP ROM's %-variables",
      code: ['10 FLET %A=2.5', '20 FLET %B=SQR(%A)', '30 FPRINT %B'],
    },
    reachFor: ['SIN', 'SQR', 'LOG'],
  },
  {
    to: 'atom',
    domain: 'strings',
    support: 'partial',
    summary:
      "LEN reads a string's length and the $ prefix addresses one in memory.",
    instead:
      'No string functions at all beyond LEN and $: build text as a run of bytes at an address and print it with the $ prefix operator.',
    example: {
      caption: 'Bytes as a string',
      code: ['10 DIM B(10)', '20 B(0)=72;B(1)=13', '30 PRINT $B'],
    },
    reachFor: ['LEN'],
  },
  {
    to: 'atom',
    domain: 'text-screen',
    support: 'partial',
    summary:
      'PRINT and FPRINT write text, and COUNT reports the cursor column.',
    instead:
      'No CLS or TAB: CLEAR 0 blanks the text screen, and text is positioned by counting characters printed rather than jumping to a column.',
    example: {
      caption: 'Clear text screen',
      code: ['10 CLEAR 0', '20 PRINT"HELLO"'],
    },
    reachFor: ['PRINT', 'COUNT'],
  },
  {
    to: 'atom',
    domain: 'graphics',
    support: 'partial',
    summary:
      'MOVE and DRAW plot lines and PLOT sets a single point on the graphics screen.',
    instead:
      'No CIRCLE: approximate one with a short loop of PLOT points at computed offsets around the centre, or draw a polygon with DRAW.',
    example: {
      caption: 'Point without CIRCLE',
      code: ['10 CLEAR 4', '20 PLOT 100,100'],
    },
    reachFor: ['MOVE', 'DRAW', 'PLOT'],
  },
  {
    to: 'atom',
    domain: 'colour',
    support: 'none',
    summary:
      'No colour support: the MC6847 output is rendered monochrome here.',
    instead:
      'No colour keywords at all: use contrast (inverse text, block-graphics density) to distinguish elements instead of ink.',
    example: {
      caption: 'Contrast instead of colour',
      code: ['10 CLEAR 0', '20 PRINT"BOLD BLOCK"'],
    },
  },
  {
    to: 'atom',
    domain: 'sound',
    support: 'none',
    summary: 'No sound support: most Atom programs are silent.',
    instead:
      'No sound keywords: if a beep matters, POKE the speaker port directly, or drop the effect — most ported programs go silent here.',
    example: { caption: 'A single speaker click', code: ['10 POKE &B000,1'] },
  },
  {
    to: 'atom',
    domain: 'input',
    support: 'full',
    summary:
      'INPUT reads a line, FINPUT reads a floating-point value, and CH reads a character.',
    instead:
      'No single non-blocking key read: use CH to read one character (it waits), or INPUT for a whole line.',
    reachFor: ['INPUT', 'FINPUT', 'CH'],
  },
  {
    to: 'atom',
    domain: 'storage',
    support: 'full',
    summary:
      'LOAD/SAVE handle whole programs, and BPUT/BGET/FPUT/FGET give byte- and value-level file access with PTR/EXT for seeking.',
    instead:
      'Full byte- and record-level file access already exists: use BPUT/BGET for raw bytes, FPUT/FGET for numbers, and PTR/EXT to seek.',
    reachFor: ['LOAD', 'SAVE', 'BPUT'],
  },
  {
    to: 'atom',
    domain: 'memory-hardware',
    support: 'full',
    summary:
      '? and ! read and write memory directly, LINK and GET call machine code, and PUT/TOP report or move the top of memory.',
    instead:
      'Write ?addr= for a byte and !addr= for a four-byte word rather than POKE; call machine code with LINK, not SYS or USR.',
    reachFor: ['?', '!', 'LINK'],
  },
  {
    to: 'atom',
    domain: 'program-editing',
    support: 'partial',
    summary: 'REM, RUN, LIST and NEW cover editing a listing.',
    instead:
      'No DELETE or RENUMBER: retype a line number on its own to remove it, and renumber by hand before typing back in.',
    example: {
      caption: 'Type the line number alone to delete it',
      code: ['100'],
    },
    reachFor: ['LIST', 'RUN', 'NEW'],
  },
  {
    to: 'atom',
    domain: 'error-handling',
    support: 'none',
    summary: 'No error trapping: an error stops the program and reports where.',
    instead:
      'No error trapping at all: guard risky operations by checking values first (e.g. test a divisor for zero) rather than catching a failure.',
    example: {
      caption: 'Guard instead of catching',
      code: [
        '10 IF D=0 THEN GOTO 40',
        '20 PRINT N/D',
        '30 GOTO 50',
        '40 PRINT"DIV0"',
      ],
    },
  },
  // --------------------------------------------------------------- trs80 --
  {
    to: 'trs80',
    domain: 'control-flow',
    support: 'full',
    summary:
      'IF…THEN…ELSE, FOR…NEXT and ON…GOTO/GOSUB give full structured jumps and loops, Microsoft-BASIC style.',
    instead:
      'No DO/WHILE/REPEAT looping keyword: build a pre- or post-test loop from IF and GOTO around a labelled line.',
    reachFor: ['ON', 'GOSUB', 'FOR'],
  },
  {
    to: 'trs80',
    domain: 'data',
    support: 'full',
    summary:
      'DATA/READ/RESTORE, DIM and DEFINT/DEFSNG/DEFDBL/DEFSTR type defaults cover constants, arrays and default typing.',
    instead:
      'Only the first two characters of a name are significant, and a name may not embed a keyword: rename anything that collides.',
    reachFor: ['DATA', 'DIM', 'DEFINT'],
  },
  {
    to: 'trs80',
    domain: 'numeric',
    support: 'full',
    summary:
      'A full trig/log/rounding set with four numeric types (%, !, #) covers integer, single- and double-precision arithmetic.',
    instead:
      'No LN: LOG is already the natural logarithm here, so drop any base conversion that assumed LOG meant base-10.',
    reachFor: ['SQR', 'LOG', 'CINT'],
  },
  {
    to: 'trs80',
    domain: 'strings',
    support: 'full',
    summary:
      'LEFT$/MID$/RIGHT$/STR$/VAL/ASC/CHR$/INSTR give full substring, search and conversion support.',
    instead:
      'No LOWER$/UPPER$ case folding: shift a character’s ASC value by 32 and rebuild the string with CHR$, or drop case-folding.',
    reachFor: ['LEFT$', 'MID$', 'INSTR'],
  },
  {
    to: 'trs80',
    domain: 'text-screen',
    support: 'full',
    summary:
      'PRINT with TAB(/POS and PRINT USING give column positioning and formatted numeric output, alongside CLS.',
    instead:
      'No AT-style row/column jump in one call: TAB( moves the column only — reach a row by counting newlines printed.',
    reachFor: ['TAB(', 'USING', 'CLS'],
  },
  {
    to: 'trs80',
    domain: 'graphics',
    support: 'partial',
    summary:
      'SET/RESET/POINT light, clear and test a single cell on the 128×48 graphics grid.',
    instead:
      'No line-draw or CIRCLE command at all: step along the line yourself and call SET(x,y) at each point.',
    example: {
      caption: 'A line from SET points',
      code: ['10 FOR X=0 TO 20', '20 SET(X,X)', '30 NEXT X'],
    },
    reachFor: ['SET', 'RESET', 'POINT'],
  },
  {
    to: 'trs80',
    domain: 'colour',
    support: 'none',
    summary:
      'No colour: the display is monochrome, so there is nothing to set.',
    instead:
      'No colour keywords at all: use character density or a highlight border of asterisks in place of ink to distinguish elements.',
    example: {
      caption: 'Emphasis without colour',
      code: ['10 PRINT "*** HELLO ***"'],
    },
  },
  {
    to: 'trs80',
    domain: 'sound',
    support: 'none',
    summary:
      'No sound hardware on the Model I: ported beeps have no direct equivalent.',
    instead:
      'No sound hardware at all: drop the effect, or if the cue matters, print it as text instead of playing it.',
    example: { caption: 'Print instead of a beep', code: ['10 PRINT"*BEEP*"'] },
  },
  {
    to: 'trs80',
    domain: 'input',
    support: 'full',
    summary:
      'INPUT reads a line and INKEY$ polls the keyboard without waiting, with LINE for a raw line without a prompt.',
    instead:
      'No GET-named single blocking key wait: poll INKEY$ in a loop until it returns a non-empty string.',
    reachFor: ['INKEY$', 'LINE', 'INPUT'],
  },
  {
    to: 'trs80',
    domain: 'storage',
    support: 'full',
    summary:
      'OPEN/FIELD/GET/PUT/LSET/RSET give full random-access file records, alongside CLOAD/CSAVE for cassette.',
    instead:
      'No CATALOG-style directory listing keyword: that is a DOS command reached via SYSTEM, not a BASIC keyword.',
    reachFor: ['FIELD', 'LSET', 'OPEN'],
  },
  {
    to: 'trs80',
    domain: 'memory-hardware',
    support: 'full',
    summary:
      "PEEK/POKE reach memory directly, VARPTR finds a variable's address, and USR calls machine code.",
    instead:
      'No CALL-named entry point: USR(x) is the machine-code call here, routed through the vector POKEd into MEM first.',
    reachFor: ['VARPTR', 'USR', 'PEEK'],
  },
  {
    to: 'trs80',
    domain: 'program-editing',
    support: 'full',
    summary:
      'AUTO, DELETE, EDIT and TRON/TROFF give full line-numbering, editing and trace tools alongside LIST/RUN.',
    instead:
      'No RENUMBER keyword: renumber by hand, or use EDIT to retype affected lines under their new numbers.',
    reachFor: ['AUTO', 'EDIT', 'TRON'],
  },
  {
    to: 'trs80',
    domain: 'error-handling',
    support: 'full',
    summary:
      'ON ERROR GOTO with RESUME traps a failure and can continue at the line that failed, or the next one.',
    instead:
      'No REPORT-style plain-English error text: read the numeric ERR and ERL and look the code up in the manual.',
    reachFor: ['RESUME', 'ERL', 'ERR'],
  },
  // ---------------------------------------------------------------- CPCS --
  {
    to: CPCS,
    domain: 'control-flow',
    support: 'full',
    summary:
      'Real ELSE, WHILE…WEND, REPEAT…UNTIL and AFTER/EVERY interrupt timers give the richest structured flow of these machines.',
    instead:
      'No PROC/FN-style named procedures: DEF FN handles single-expression functions; structure larger routines with GOSUB to a labelled block.',
    reachFor: ['WHILE', 'ELSE', 'AFTER'],
  },
  {
    to: CPCS,
    domain: 'data',
    support: 'full',
    summary:
      'DATA/READ/RESTORE, DIM and DEFINT/DEFREAL/DEFSTR type defaults cover constants, arrays and default variable typing.',
    instead:
      'No CLR-style single-word variable wipe: CLEAR does the same job here, discarding all variables and closing open files.',
    reachFor: ['DATA', 'DEFINT', 'DIM'],
  },
  {
    to: CPCS,
    domain: 'numeric',
    support: 'full',
    summary:
      'A full trig/log/rounding set, plus MAX/MIN/ROUND and CINT/FIX, covers real, integer and rounded arithmetic.',
    instead:
      'No natural-log-only LOG: LOG is base-10 and LOG10 duplicates it — use CREAL/CINT to convert between real and integer forms explicitly.',
    reachFor: ['ROUND', 'LOG10', 'MAX'],
  },
  {
    to: CPCS,
    domain: 'strings',
    support: 'full',
    summary:
      'LEFT$/MID$/RIGHT$, LOWER$/UPPER$ case folding and BIN$/DEC$/HEX$ number-base conversion cover text handling in full.',
    instead:
      'No STRING$-style single-char repeat gap: STRING$(n,c) already exists, so build padding or rules directly with it.',
    reachFor: ['LOWER$', 'UPPER$', 'INSTR'],
  },
  {
    to: CPCS,
    domain: 'text-screen',
    support: 'full',
    summary:
      'LOCATE, WINDOW and ZONE give full cursor and text-area control on top of PRINT, with CURSOR to show or hide it.',
    instead:
      "No POS-only report: POS(#stream) reports the column for any window, and VPOS the row — read both, they're not one call.",
    reachFor: ['LOCATE', 'WINDOW', 'ZONE'],
  },
  // Split from the CPCs' shared cell: FILL and MASK came with Locomotive BASIC
  // 1.1, so the 464 has neither.
  {
    to: 'cpc464',
    domain: 'graphics',
    support: 'full',
    summary:
      'DRAW/DRAWR/PLOT/PLOTR with relative and absolute forms give rich vector graphics, with no separate CIRCLE.',
    instead:
      'No named CIRCLE: approximate one with a short loop of PLOT points at computed offsets around the centre, or several DRAWR segments.',
    reachFor: ['DRAW', 'DRAWR', 'PLOTR'],
  },
  {
    to: LOCOMOTIVE_1_1S,
    domain: 'graphics',
    support: 'full',
    summary:
      'DRAW/DRAWR/PLOT/PLOTR with relative and absolute forms, plus FILL and MASK, give rich vector graphics with no separate CIRCLE.',
    instead:
      'No named CIRCLE: approximate one with a short loop of PLOT points at computed offsets around the centre, or several DRAWR segments.',
    reachFor: ['DRAWR', 'FILL', 'MASK'],
  },
  {
    to: CPCS,
    domain: 'colour',
    support: 'full',
    summary:
      'INK/PAPER/PEN/BORDER assign any of 27 hardware colours, with SPEED INK controlling the flash rate.',
    instead:
      'No ATTR-style per-cell colour read-back: track ink assignments in your own variables if a program needs to query them.',
    reachFor: ['INK', 'PAPER', 'BORDER'],
  },
  {
    to: CPCS,
    domain: 'sound',
    support: 'full',
    summary:
      'SOUND with ENV/ENT envelopes drives three channels, and SQ reports a channel’s queue status.',
    instead:
      'No single BEEP shortcut: SOUND channel,period,duration plays a plain tone — pick a channel and duration for a simple beep.',
    reachFor: ['ENV', 'ENT', 'SOUND'],
  },
  {
    to: CPCS,
    domain: 'input',
    support: 'full',
    summary:
      'INKEY/INKEY$/JOY poll the keyboard and joystick without blocking, and KEY DEF remaps keys.',
    instead:
      'No GET-style single blocking key wait: LINE INPUT or a polling loop on INKEY$ takes its place — there is no direct equivalent.',
    reachFor: ['JOY', 'INKEY', 'KEY DEF'],
  },
  {
    to: CPCS,
    domain: 'storage',
    support: 'full',
    summary:
      'OPENIN/OPENOUT with CAT, MERGE and CHAIN MERGE give full sequential file access across tape and disc.',
    instead:
      'No PTR/EXT-style random-access seek on BASIC files: structure data sequentially, or use direct disc sector access outside BASIC.',
    reachFor: ['OPENIN', 'MERGE', 'CAT'],
  },
  {
    to: CPCS,
    domain: 'memory-hardware',
    support: 'full',
    summary:
      'PEEK/POKE/OUT/INP reach memory and I/O ports directly, with CALL for machine code and DI/EI for interrupts.',
    instead:
      'No named USR-style user function vector: CALL address runs machine code directly instead of routing through a function call.',
    reachFor: ['CALL', 'OUT', 'DI'],
  },
  {
    to: CPCS,
    domain: 'program-editing',
    support: 'full',
    summary:
      'AUTO, RENUM, DELETE, EDIT and TRON/TROFF give full line-numbering, editing and trace tools.',
    instead:
      'No OLD-style undelete after NEW: keep an external copy before clearing, since a cleared program cannot be recovered.',
    reachFor: ['AUTO', 'RENUM', 'TRON'],
  },
  // Split for the same reason: DERR and ON BREAK CONT are 1.1 additions.
  {
    to: 'cpc464',
    domain: 'error-handling',
    support: 'full',
    summary:
      'ON ERROR GOTO with RESUME, plus ON BREAK GOSUB and ON BREAK STOP, give full error and break trapping.',
    instead:
      'No REPORT-style plain-English error text: read the numeric ERR code and look it up, or trap specific codes you expect.',
    reachFor: ['RESUME', 'ON ERROR GOTO', 'ERR'],
  },
  {
    to: LOCOMOTIVE_1_1S,
    domain: 'error-handling',
    support: 'full',
    summary:
      'ON ERROR GOTO with RESUME, plus ON BREAK GOSUB/CONT/STOP, give full error and break trapping.',
    instead:
      'No REPORT-style plain-English error text: read the numeric ERR code and look it up, or trap specific codes you expect.',
    reachFor: ['RESUME', 'ON ERROR GOTO', 'DERR'],
  },
  // ---------------------------------------------------------- altair8800 --
  {
    to: 'altair8800',
    domain: 'control-flow',
    support: 'partial',
    summary:
      'IF...THEN, FOR...NEXT with STEP, GOSUB/RETURN, ON...GOTO and DEF FN cover jumps, loops and single-expression functions.',
    instead:
      'No ELSE, WHILE or REPEAT: write a second IF, or invert the test and GOTO past the positive case. A loop with its test at the bottom is IF...THEN <line>.',
    example: {
      caption: 'No ELSE: split into two branches',
      code: [
        '10 IF X=0 THEN 40',
        '20 PRINT "NONZERO"',
        '30 GOTO 50',
        '40 PRINT "ZERO"',
      ],
    },
    reachFor: ['IF', 'FOR', 'GOSUB', 'ON'],
  },
  {
    to: 'altair8800',
    domain: 'data',
    support: 'partial',
    summary:
      'DATA/READ/RESTORE for constants, DIM for arrays, LET for assignment, and CLEAR to reset the variables and size the string space.',
    instead:
      'No CLR or DEFINT/DEFSTR: CLEAR does the resetting, and there is no integer or double type to declare - every number is single-precision floating point.',
    example: {
      caption: 'CLEAR resets and sizes strings',
      code: ['10 CLEAR 2000', '20 DIM A(20)', '30 READ A(1)', '40 DATA 42'],
    },
    reachFor: ['DATA', 'READ', 'DIM', 'CLEAR'],
  },
  {
    to: 'altair8800',
    domain: 'numeric',
    support: 'partial',
    summary:
      'Single-precision maths in full: SQR, LOG, EXP, the four trig functions, RND, INT, ABS, SGN and the ^ operator.',
    instead:
      'No PI, DEG, RAD, MIN/MAX or integer conversions: write PI out as a constant, convert degrees by multiplying, and use INT where FIX is meant.',
    example: {
      caption: 'PI and degrees, written out',
      code: ['10 P=3.14159265', '20 D=45', '30 R=D*P/180', '40 PRINT SIN(R)'],
    },
    reachFor: ['SQR', 'RND', 'INT', 'ATN'],
  },
  {
    to: 'altair8800',
    domain: 'strings',
    support: 'partial',
    summary:
      'LEN, LEFT$, RIGHT$, MID$, ASC, CHR$, STR$ and VAL, with + joining two strings.',
    instead:
      'No INSTR, STRING$, SPACE$ or UPPER$: search with a MID$ loop and build a run of characters by concatenating. MID$ is a function only and cannot be assigned to.',
    example: {
      caption: 'Search a string with MID$',
      code: [
        '10 FOR I=1 TO LEN(A$)',
        '20 IF MID$(A$,I,1)="X" THEN 40',
        '30 NEXT I',
        '40 PRINT I',
      ],
    },
    reachFor: ['MID$', 'LEN', 'CHR$', 'VAL'],
  },
  {
    to: 'altair8800',
    domain: 'text-screen',
    support: 'partial',
    summary:
      'PRINT with TAB( and SPC( for layout, POS for the current column, and NULL for a printing terminal line delay.',
    instead:
      'There is no screen to address - no CLS, LOCATE, WIDTH or WINDOW. Output scrolls up a terminal, so lay a line out with TAB( and let the old output scroll away.',
    example: {
      caption: 'Lay out a line with TAB(',
      code: ['10 PRINT TAB(10);"SCORE";S', '20 PRINT'],
    },
    reachFor: ['PRINT', 'TAB(', 'SPC(', 'POS'],
  },
  {
    to: 'altair8800',
    domain: 'graphics',
    support: 'none',
    summary:
      'None: the machine has no video hardware at all, so nothing plots.',
    instead:
      'Build the picture in a numeric array and PRINT it a character at a time. A terminal cell is twice as tall as it is wide, so halve the vertical axis to keep circles round.',
    example: {
      caption: 'Print a grid instead of plotting',
      code: [
        '10 DIM G(48,16)',
        '20 G(24,8)=1',
        '30 C$=" "',
        '40 IF G(X,Y)=1 THEN C$="*"',
        '50 PRINT C$;',
      ],
    },
  },
  {
    to: 'altair8800',
    domain: 'colour',
    support: 'none',
    summary: 'None: the console is monochrome text.',
    instead:
      'Nothing sets a colour. Where a program used colour to tell things apart, use different characters or a printed label instead.',
    example: {
      caption: 'Tell things apart by character',
      code: ['10 PRINT "PLAYER *"', '20 PRINT "WALL   ="'],
    },
  },
  {
    to: 'altair8800',
    domain: 'sound',
    support: 'none',
    summary: 'None: the machine has no sound hardware.',
    instead:
      'The only noise available is the terminal bell, CHR$(7) - and it is silent in this IDE, whose console counts the bell rather than sounding it.',
    example: {
      caption: 'The bell is the whole repertoire',
      code: ['10 PRINT CHR$(7);'],
    },
  },
  {
    to: 'altair8800',
    domain: 'input',
    support: 'partial',
    summary:
      'INPUT reads a whole typed line from the terminal, with an optional prompt string.',
    instead:
      'No INKEY$, GET or joystick - there is no key-at-a-time read at all, so an interactive program takes one INPUT per turn rather than polling inside a loop.',
    example: {
      caption: 'One typed line per turn',
      code: [
        '10 INPUT "L,R OR S";M$',
        '20 IF M$="L" THEN X=X-1',
        '30 IF M$="R" THEN X=X+1',
        '40 GOTO 10',
      ],
    },
    reachFor: ['INPUT'],
  },
  {
    to: 'altair8800',
    domain: 'storage',
    support: 'partial',
    summary:
      'CSAVE and CLOAD move the whole program to and from cassette through the 88-ACR board.',
    instead:
      'There is no file system: no OPEN, no PRINT#, no directory. Only the program itself can be saved, so hold data in DATA statements rather than in a file.',
    example: {
      caption: 'Constants live in DATA',
      code: [
        '10 FOR I=1 TO 3',
        '20 READ N',
        '30 PRINT N',
        '40 NEXT I',
        '50 DATA 10,20,30',
      ],
    },
    reachFor: ['CSAVE', 'CLOAD'],
  },
  {
    to: 'altair8800',
    domain: 'memory-hardware',
    support: 'partial',
    summary:
      'PEEK, POKE, INP, OUT, WAIT, USR and FRE reach the whole 64K and the 8080 I/O ports, all in decimal.',
    instead:
      'No hex literals, and no HIMEM or PAGE: addresses are written in decimal, and space is reserved with CLEAR rather than by moving a pointer.',
    example: {
      caption: 'Decimal addresses, no & prefix',
      code: ['10 POKE 16384,65', '20 PRINT PEEK(16384)'],
    },
    reachFor: ['PEEK', 'POKE', 'INP', 'USR'],
  },
  {
    to: 'altair8800',
    domain: 'program-editing',
    support: 'partial',
    summary: 'RUN, LIST, NEW and CONT at the OK prompt, with REM for comments.',
    instead:
      'No AUTO, RENUM, DELETE or TRACE, and no apostrophe shorthand for REM: retype a line to change it, and number in tens so there is room to insert.',
    example: {
      caption: 'Full REM, no apostrophe form',
      code: ['10 REM SET UP THE BOARD', '20 W=20:H=12'],
    },
    reachFor: ['RUN', 'LIST', 'NEW', 'REM'],
  },
  {
    to: 'altair8800',
    domain: 'error-handling',
    support: 'none',
    summary: 'None: an error stops the program and prints its two-letter code.',
    instead:
      'No ON ERROR, ERR or RESUME. Test the value before the operation that would fail - guard a divide with IF, and range-check a subscript yourself.',
    example: {
      caption: 'Guard instead of trapping',
      code: [
        '10 IF D=0 THEN 40',
        '20 PRINT N/D',
        '30 GOTO 50',
        '40 PRINT "CANNOT DIVIDE"',
      ],
    },
  },

  // --------------------------------------------------------------- pmd85 --
  {
    to: 'pmd85',
    domain: 'control-flow',
    support: 'partial',
    summary:
      'IF...THEN, FOR...NEXT with STEP, GOSUB/RETURN, ON...GOTO/GOSUB and DEF FNC cover jumps, loops and single-expression functions.',
    instead:
      'No ELSE, WHILE or REPEAT: write a second IF, or invert the test and GOTO past the positive case. The function keyword is FNC, and its name is a separate word: FNC A(X).',
    example: {
      caption: 'No ELSE: split into two branches',
      code: [
        '10 IF X=0 THEN 40',
        '20 PRINT "NONZERO"',
        '30 GOTO 50',
        '40 PRINT "ZERO"',
      ],
    },
    reachFor: ['IF', 'FOR', 'GOSUB', 'ON'],
  },
  {
    to: 'pmd85',
    domain: 'data',
    support: 'partial',
    summary:
      'DATA/READ/RESTORE for constants, DIM for arrays and LET for assignment, with CLEAR to erase the variables.',
    instead:
      'No CLR or DEFINT/DEFSTR, and no type tag but $: every number is single-precision floating point. CLEAR takes no size - string space is a fixed region of its own.',
    example: {
      caption: 'CLEAR takes no argument',
      code: ['10 CLEAR', '20 DIM A(20)', '30 READ A(1)', '40 DATA 42'],
    },
    reachFor: ['DATA', 'READ', 'DIM', 'CLEAR'],
  },
  {
    to: 'pmd85',
    domain: 'numeric',
    support: 'partial',
    summary:
      'Single-precision maths in full: SQR, LOG, EXP, the four trig functions, RND, INT, ABS, SGN, BIT and the ^ operator, with DEG and RAD choosing the angle unit.',
    instead:
      'No PI, MOD, DIV, MIN or MAX: write PI out as a constant, and take a remainder with A-INT(A/B)*B. DEG saves converting degrees by hand.',
    example: {
      caption: 'PI written out; degrees with DEG',
      code: ['10 P=3.14159265', '20 DEG', '30 PRINT SIN(45)'],
    },
    reachFor: ['SQR', 'RND', 'INT', 'DEG'],
  },
  {
    to: 'pmd85',
    domain: 'strings',
    support: 'partial',
    summary:
      'LEN, LEFT$, RIGHT$, MID$, ASC, CHR$, STR$, VAL and HEX$, with + joining two strings.',
    instead:
      'No INSTR, STRING$, SPACE$ or UPPER$: search with a MID$ loop and build a run of characters by concatenating. MID$ is a function only and cannot be assigned to.',
    example: {
      caption: 'Search a string with MID$',
      code: [
        '10 FOR I=1 TO LEN(A$)',
        '20 IF MID$(A$,I,1)="X" THEN 50',
        '30 NEXT I',
        '40 PRINT "NOT FOUND"',
      ],
    },
    reachFor: ['MID$', 'LEN', 'CHR$', 'HEX$'],
  },
  {
    to: 'pmd85',
    domain: 'text-screen',
    support: 'partial',
    summary:
      'PRINT with TAB( and SPC( onto a 48x26 text area, DISP onto the dialogue line at the foot of the screen, and POS to read the column back.',
    instead:
      'No CLS or LOCATE: GCLEAR clears the whole screen, and TAB( is the reliable way to reach a column. The AT keyword exists but what it positions is not established here.',
    example: {
      caption: 'Clear, then lay out with TAB(',
      code: ['10 GCLEAR', '20 PRINT TAB(10);"SCORE"'],
    },
    reachFor: ['PRINT', 'TAB(', 'DISP', 'POS'],
  },
  {
    to: 'pmd85',
    domain: 'graphics',
    support: 'partial',
    summary:
      'A real drawing set: SCALE sets a coordinate window, MOVE and PLOT draw lines in it, AXES draws axes, LABEL plots text and FILL an enlarged bit pattern.',
    instead:
      'No circle, arc or paint: draw a curve as a run of PLOT points, and fill an area with a loop of lines. BPLOT writes bytes straight into screen memory for a sprite.',
    example: {
      caption: 'A line, in a scaled window',
      code: ['10 SCALE 0,100,0,100', '20 MOVE 0,0', '30 PLOT 100,100'],
    },
    reachFor: ['PLOT', 'MOVE', 'SCALE', 'FILL'],
  },
  {
    to: 'pmd85',
    domain: 'colour',
    support: 'partial',
    summary:
      'The screen is monochrome. PEN and INK( set the two attribute bits each six-pixel cell carries: blink and reduced brightness.',
    instead:
      'No palette, ink or paper colours and no border: a program that distinguishes things by colour has to distinguish them by brightness, by blinking, or by position instead.',
    example: {
      caption: 'Attributes, not colours',
      code: ['10 PEN 2', '20 PLOT 50,50', '30 PRINT INK(1);"ALERT"'],
    },
    reachFor: ['PEN', 'INK('],
  },
  {
    to: 'pmd85',
    domain: 'sound',
    support: 'partial',
    summary:
      'BEEP, and nothing else: one fixed tone on the motherboard speaker, with no pitch, length or channel to give it.',
    instead:
      'No SOUND, PLAY or ENVELOPE. A tune has to be driven by OUT to the speaker bit of the motherboard 8255, timed by the program itself.',
    example: {
      caption: 'The whole sound repertoire',
      code: ['10 BEEP', '20 PAUSE 200', '30 BEEP'],
    },
    reachFor: ['BEEP'],
  },
  {
    to: 'pmd85',
    domain: 'input',
    support: 'partial',
    summary:
      'INPUT takes a whole typed line; INKEY reports which of the twelve function keys K0-K11 is held, or 255 for none.',
    instead:
      'No INKEY$ or GET for the letter keys: a real-time program is driven by the function-key row, and anything else waits for a whole line through INPUT.',
    example: {
      caption: 'Poll the function keys',
      code: ['10 K=INKEY', '20 IF K=255 THEN 10', '30 PRINT "KEY";K'],
    },
    reachFor: ['INPUT', 'INKEY', '_'],
  },
  {
    to: 'pmd85',
    domain: 'storage',
    support: 'partial',
    summary:
      'Cassette only: SAVE and LOAD for programs, DSAVE and DLOAD for an array, and CHECK to verify a recording against memory.',
    instead:
      'No named files, no disc and no OPEN/CLOSE: every tape command takes a file NUMBER, so SAVE 1 not SAVE "PROG". A sequential data file becomes a DSAVE array, and its separator is a semicolon.',
    example: {
      caption: 'A data file is an array, by number',
      code: ['10 DSAVE 2;A(0)', '20 DLOAD 2;B(0)'],
    },
    reachFor: ['SAVE', 'LOAD', 'DSAVE', 'CHECK'],
  },
  {
    to: 'pmd85',
    domain: 'memory-hardware',
    support: 'partial',
    summary:
      'PEEK/POKE, APEEK/APOKE for 16-bit words, INP/OUT and WAIT for ports, ADR for a variable address, and USR to call machine code at an address.',
    instead:
      'USR takes the address itself rather than a poked vector, so there is no SYS or CALL to replace. No VARPTR: ADR gives a variable’s address, and CODE assembles hex and calls it.',
    example: {
      caption: 'USR calls the address directly',
      code: ["10 A=USR('7000)", "20 PRINT PEEK('7010)"],
    },
    reachFor: ['PEEK', 'POKE', 'USR', 'ADR'],
  },
  {
    to: 'pmd85',
    domain: 'program-editing',
    support: 'partial',
    summary:
      'RUN, LIST, NEW, CONT and REM, with AUTO numbering entered lines and LLIST recalling one into the dialogue line for editing.',
    instead:
      'No RENUM, DELETE, TRON or MERGE: renumber by retyping, and trace by adding PRINT lines. LLIST is a line editor here, not a printer command.',
    example: {
      caption: 'AUTO numbers as you type',
      code: ['AUTO 100,10'],
    },
    reachFor: ['LIST', 'AUTO', 'REM', 'CONT'],
  },
  {
    to: 'pmd85',
    domain: 'error-handling',
    support: 'partial',
    summary:
      'ON ERR GOTO traps an error and jumps to a line instead of stopping the program.',
    instead:
      'No ERR value, ERL line number or RESUME: the handler cannot ask what went wrong or where, so guard what can fail and use the trap as a last resort.',
    example: {
      caption: 'Trap, then guard anyway',
      code: ['10 ON ERR GOTO 90', '20 IF D=0 THEN 90', '30 PRINT N/D'],
    },
    reachFor: ['ERR'],
  },
  // -------------------------------------------------------------- apple1 --
  {
    to: 'apple1',
    domain: 'control-flow',
    support: 'partial',
    summary:
      'IF...THEN, FOR...NEXT with STEP, GOSUB/RETURN and a GOTO whose target may be an expression.',
    instead:
      'No ELSE, WHILE or REPEAT: write a second IF, or invert the test and GOTO past the positive case. GOTO takes an expression, which is the only computed jump there is.',
    example: {
      caption: 'No ELSE: split into two branches',
      code: [
        '10 IF X=0 THEN 40',
        '20 PRINT "NONZERO"',
        '30 GOTO 50',
        '40 PRINT "ZERO"',
        '50 END',
      ],
    },
    reachFor: ['IF', 'FOR', 'GOSUB', 'GOTO'],
  },
  {
    to: 'apple1',
    domain: 'data',
    support: 'partial',
    summary: 'DIM for arrays and strings, LET for assignment, CLR to discard.',
    instead:
      'No DATA, READ or RESTORE: assign the values in a loop, or hold them in a string and read it a position at a time.',
    example: {
      caption: 'A table without DATA',
      code: ['10 DIM T(4)', '20 FOR I=1 TO 4', '30 T(I)=I*I', '40 NEXT I'],
    },
    reachFor: ['DIM', 'LET', 'CLR'],
  },
  {
    to: 'apple1',
    domain: 'numeric',
    support: 'partial',
    summary:
      'ABS, SGN, RND and MOD over 16-bit signed integers, -32767 to 32767.',
    instead:
      'No fractions and no maths library: no SQR, LOG, EXP or trig, and no power operator. Rescale to whole units - work in tenths and divide at the end - and write SQR as a search.',
    example: {
      caption: 'Rescale instead of using fractions',
      code: [
        '10 REM 3.75 AS TENTHS',
        '20 T=375',
        '30 PRINT T/100;".";T MOD 100',
      ],
    },
    reachFor: ['ABS', 'RND', 'SGN', 'MOD'],
  },
  {
    to: 'apple1',
    domain: 'strings',
    support: 'partial',
    summary: 'LEN, and A$(first,last) to read a substring of a DIMed string.',
    instead:
      'No CHR$, ASC, MID$, STR$ or VAL, and no concatenation. Build a string left to right by assigning at each position, which truncates what follows.',
    example: {
      caption: 'Build a line a character at a time',
      code: ['10 DIM A$(8)', '20 FOR I=1 TO 8', '30 A$(I)="*"', '40 NEXT I'],
    },
    reachFor: ['LEN'],
  },
  {
    to: 'apple1',
    domain: 'text-screen',
    support: 'partial',
    summary:
      'PRINT, and TAB to move the print column - which counts from 1 and moves right only.',
    instead:
      'No cursor addressing, no CLS and no screen memory: the display decodes carriage return and nothing else. Print a picture again rather than changing part of it.',
    example: {
      caption: 'TAB is a statement of its own',
      code: ['10 TAB 10', '20 PRINT "HELLO"'],
    },
    reachFor: ['PRINT', 'TAB'],
  },
  {
    to: 'apple1',
    domain: 'input',
    support: 'partial',
    summary: 'INPUT, which reads a whole typed line and takes a prompt.',
    instead:
      'No key-at-a-time read, and none can be built: any keypress stops a running program, so the interpreter has the key before the program could. One turn per typed line.',
    example: {
      caption: 'One typed line per turn',
      code: ['10 DIM K$(4)', '20 INPUT "MOVE",K$', '30 IF K$="Q" THEN 50'],
    },
    reachFor: ['INPUT'],
  },
  {
    to: 'apple1',
    domain: 'memory-hardware',
    support: 'partial',
    summary:
      'PEEK, POKE and CALL, plus HIMEM= and LOMEM= to move the ends of the workspace.',
    instead:
      'No hex literals anywhere: every address is signed decimal, which is why an I/O address is written negative. There is no port I/O - the hardware is memory-mapped.',
    example: {
      caption: 'An I/O address, written negative',
      code: ['10 PRINT PEEK(-12272)'],
    },
    reachFor: ['PEEK', 'POKE', 'CALL', 'HIMEM='],
  },
  {
    to: 'apple1',
    domain: 'program-editing',
    support: 'partial',
    summary: 'LIST, DEL, AUTO with OFF, and SCR to erase the program.',
    instead:
      'These are direct-mode commands: typed inside a numbered line every one answers *** SYNTAX ERR, so a program cannot edit or list itself.',
    example: {
      caption: 'Direct mode only',
      code: ['10 REM LIST HERE IS A SYNTAX ERR'],
    },
    reachFor: ['LIST', 'DEL', 'AUTO', 'SCR'],
  },
  {
    to: 'apple1',
    domain: 'graphics',
    support: 'none',
    summary: 'None: the machine has no graphics hardware and no glyphs for it.',
    instead:
      'No graphics of any kind, and no block characters either. Plot on the text grid with the 64 characters there are, sizing the picture 8 columns to 7 rows so it reads round.',
    example: {
      caption: 'Plot with characters',
      code: ['10 TAB 20', '20 PRINT "*"'],
    },
  },
  {
    to: 'apple1',
    domain: 'colour',
    support: 'none',
    summary:
      'None: the display is monochrome, and inverse video does not exist.',
    instead:
      'No colour and nothing standing in for it. Drop the colour, or say in words what it meant.',
    example: { caption: 'Say it instead', code: ['10 PRINT "WARNING"'] },
  },
  {
    to: 'apple1',
    domain: 'sound',
    support: 'none',
    summary: 'None: no speaker, no bell, no port to click at.',
    instead:
      'No sound keywords and no hardware under them: drop the effect, or print a message in its place.',
    example: { caption: 'Print instead of a beep', code: ['10 PRINT "BEEP"'] },
  },
  {
    to: 'apple1',
    domain: 'storage',
    support: 'none',
    summary: 'None from BASIC: saving is done from the monitor, not a program.',
    instead:
      'No LOAD, SAVE or file commands. A program is saved by leaving BASIC for the monitor and dumping two memory ranges through the cassette interface.',
    example: {
      caption: 'Saved from the monitor, not from BASIC',
      code: ['10 REM C100R THEN 4A.FF W AND 800.FFF W'],
    },
  },
  {
    to: 'apple1',
    domain: 'error-handling',
    support: 'none',
    summary: 'None: an error stops the program and prints its own report.',
    instead:
      'No ON ERROR and nothing to resume with: test for the condition before the statement that would fail, and jump past it.',
    example: {
      caption: 'Test before dividing',
      code: [
        '10 IF D=0 THEN 40',
        '20 PRINT N/D',
        '30 GOTO 50',
        '40 PRINT "NO"',
      ],
    },
  },

  // -------------------------------------------------------------- apple2 --
  // The Apple 1's interpreter with graphics, a cursor and a tape behind it.
  // Most of what a reader expects of "Apple II BASIC" is Applesoft, which is
  // the other ROM: no floating point, no hi-res, no string functions but two.
  {
    to: 'apple2',
    domain: 'control-flow',
    support: 'partial',
    summary:
      'IF...THEN, FOR...NEXT with STEP, GOSUB/RETURN with POP, and a GOTO whose target may be an expression.',
    instead:
      'No ELSE, WHILE or REPEAT: write a second IF, or invert the test and GOTO past the positive case. POP drops a return address where a subroutine must not return to its caller.',
    example: {
      caption: 'No ELSE: split into two branches',
      code: [
        '10 IF X=0 THEN 40',
        '20 PRINT "NONZERO"',
        '30 GOTO 50',
        '40 PRINT "ZERO"',
        '50 END',
      ],
    },
    reachFor: ['IF', 'FOR', 'GOSUB', 'GOTO'],
  },
  {
    to: 'apple2',
    domain: 'data',
    support: 'partial',
    summary: 'DIM for arrays and strings, LET for assignment, CLR to discard.',
    instead:
      'No DATA, READ or RESTORE: fill a table in a loop, or hold it in a string and read a position at a time. Arrays are numeric, one-dimensional and indexed from 0.',
    example: {
      caption: 'A table without DATA',
      code: ['10 DIM T(4)', '20 FOR I=0 TO 4', '30 T(I)=I*I', '40 NEXT I'],
    },
    reachFor: ['DIM', 'LET', 'CLR'],
  },
  {
    to: 'apple2',
    domain: 'numeric',
    support: 'partial',
    summary:
      'ABS, SGN, RND and MOD over 16-bit signed integers, -32767 to 32767, and ^ raises to a power.',
    instead:
      'No fractions and no maths library: no SQR, LOG, EXP, trig or INT. Rescale to whole units - work in tenths and divide at the end - and write SQR as a search.',
    example: {
      caption: 'Rescale instead of using fractions',
      code: [
        '10 REM 3.75 AS HUNDREDTHS',
        '20 T=375',
        '30 PRINT T/100;".";T MOD 100',
      ],
    },
    reachFor: ['ABS', 'RND', 'SGN', 'MOD'],
  },
  {
    to: 'apple2',
    domain: 'strings',
    support: 'partial',
    summary:
      'LEN and ASC, and A$(first,last) to read a substring of a DIMed string.',
    instead:
      'No CHR$, MID$, STR$ or VAL, and no concatenation: append by assigning past the end. ASC( answers with bit 7 set, which is how this machine stores a character.',
    example: {
      caption: 'Append by assigning past the end',
      code: ['10 DIM A$(8)', '20 A$="AB"', '30 A$(LEN(A$)+1)="CD"'],
    },
    reachFor: ['LEN', 'ASC'],
  },
  {
    to: 'apple2',
    domain: 'text-screen',
    support: 'partial',
    summary:
      'PRINT, with TAB and VTAB putting the cursor anywhere on the 40 by 24 screen.',
    instead:
      'No CLS or HOME statement: CALL -936 is the monitor call that clears the screen. TAB and VTAB are statements of their own rather than print formatters.',
    example: {
      caption: 'Clear, then write in place',
      code: ['10 CALL -936', '20 VTAB 5', '30 TAB 10', '40 PRINT "SCORE"'],
    },
    reachFor: ['PRINT', 'TAB', 'VTAB'],
  },
  {
    to: 'apple2',
    domain: 'graphics',
    support: 'partial',
    summary:
      'GR gives a 40 by 40 grid of coloured blocks; PLOT, HLIN and VLIN draw, and SCRN( reads one back.',
    instead:
      "No hi-res from BASIC - HGR, HPLOT and DRAW are Applesoft's, and the 280 by 192 page is reachable only by CALL. Redraw the shape in lo-res blocks instead.",
    example: {
      caption: 'Draw in lo-res blocks',
      code: ['10 GR', '20 COLOR=13', '30 PLOT 20,20', '40 HLIN 0,39 AT 39'],
    },
    reachFor: ['GR', 'PLOT', 'HLIN', 'SCRN'],
  },
  {
    to: 'apple2',
    domain: 'colour',
    support: 'partial',
    summary:
      'COLOR= picks one of sixteen colours for the lo-res page, and SCRN( reads a block back.',
    instead:
      'Colour belongs to the lo-res page and never to text: there is no ink, paper or border, and nothing PRINT writes can be coloured. Draw the coloured part as blocks.',
    example: {
      caption: 'Colour a block, not a string',
      code: ['10 GR', '20 COLOR=9', '30 PLOT 0,0'],
    },
    reachFor: ['COLOR='],
  },
  {
    to: 'apple2',
    domain: 'sound',
    support: 'none',
    summary: 'None: the speaker is one bit, and no keyword reaches it.',
    instead:
      'No sound keywords at all. Touching address -16336 moves the speaker cone once, so a tone is that PEEK in a loop and the loop is what sets the pitch.',
    example: {
      caption: 'A click train, in place of a note',
      code: ['10 FOR I=1 TO 50', '20 X=PEEK(-16336)', '30 NEXT I'],
    },
  },
  {
    to: 'apple2',
    domain: 'input',
    support: 'partial',
    summary:
      'INPUT reads a whole typed line, and PDL( reads a paddle, 0 to 255.',
    instead:
      'No GET or INKEY$, but the keyboard can be polled without stopping: PEEK(-16384) is the latch, over 127 means a key is waiting, and POKE -16368,0 clears the strobe.',
    example: {
      caption: 'Poll the keyboard without stopping',
      code: ['10 K=PEEK(-16384)', '20 IF K<128 THEN 10', '30 POKE -16368,0'],
    },
    reachFor: ['INPUT', 'PDL'],
  },
  {
    to: 'apple2',
    domain: 'storage',
    support: 'partial',
    summary: 'LOAD and SAVE, which read and write the program on cassette.',
    instead:
      'The tape carries the program and nothing else: no data files, no OPEN or PRINT#, and no disk. Keep the data in the listing, or in a memory block beside it.',
    example: {
      caption: 'Data in the listing, not in a file',
      code: ['10 DIM T(3)', '20 T(0)=5', '30 T(1)=9'],
    },
    reachFor: ['LOAD', 'SAVE'],
  },
  {
    to: 'apple2',
    domain: 'memory-hardware',
    support: 'partial',
    summary:
      'PEEK, POKE and CALL, with HIMEM: and LOMEM: moving the ends of the workspace.',
    instead:
      'No hex literals anywhere: every address is signed decimal, so anything above 32767 is written negative. The hardware is memory-mapped and there is no port I/O.',
    example: {
      caption: 'An I/O address, written negative',
      code: ['10 PRINT PEEK(-16384)'],
    },
    reachFor: ['PEEK', 'POKE', 'CALL', 'HIMEM:'],
  },
  {
    to: 'apple2',
    domain: 'program-editing',
    support: 'partial',
    summary:
      'LIST, DEL, AUTO with MAN, NEW and CON, plus TRACE and DSP for watching a run.',
    instead:
      'All of these but LIST are prompt commands: inside a numbered line each answers *** SYNTAX ERR. LIST is the exception, so a program really can list itself.',
    example: {
      caption: 'LIST is the one a program may run',
      code: ['10 LIST 10', '20 END'],
    },
    reachFor: ['LIST', 'DEL', 'TRACE', 'DSP'],
  },
  {
    to: 'apple2',
    domain: 'error-handling',
    support: 'none',
    summary: 'None: an error stops the program and prints its own report.',
    instead:
      'No ON ERROR and nothing a program can resume with - CON works only at the prompt. Test for the condition first and jump past the statement that would fail.',
    example: {
      caption: 'Test before dividing',
      code: [
        '10 IF D=0 THEN 40',
        '20 PRINT N/D',
        '30 GOTO 50',
        '40 PRINT "NO"',
      ],
    },
  },

  // ---------------------------------------------------------- apple2plus --
  {
    to: 'apple2plus',
    domain: 'control-flow',
    support: 'partial',
    summary:
      'IF…THEN, FOR…NEXT with a fractional STEP, GOSUB/RETURN with POP, ON…GOTO and ON…GOSUB, and DEF FN.',
    instead:
      'No ELSE, WHILE or REPEAT: write a second IF, or invert the test and GOTO past the positive case. Write the condition as a comparison — IF A THEN reads as IF, AT and HEN.',
    example: {
      caption: 'No ELSE, and a comparison rather than a bare name',
      code: [
        '10 IF X<>0 THEN 40',
        '20 PRINT "ZERO"',
        '30 GOTO 50',
        '40 PRINT "NONZERO"',
        '50 END',
      ],
    },
    reachFor: ['IF', 'FOR', 'GOSUB', 'ON'],
  },
  {
    to: 'apple2plus',
    domain: 'data',
    support: 'partial',
    summary:
      'DIM for arrays of any shape and either type, DATA/READ/RESTORE for constants, LET to assign and CLEAR to discard.',
    instead:
      'No ERASE and no DEFINT: an array lives until CLEAR, and a variable’s type is its name — a % suffix makes it a whole number and a $ makes it a string.',
    example: {
      caption: 'Constants in DATA, read into an array',
      code: [
        '10 DIM T(3)',
        '20 FOR I=0 TO 3:READ T(I):NEXT I',
        '30 DATA 5,9,2,7',
      ],
    },
    reachFor: ['DIM', 'DATA', 'READ', 'LET'],
  },
  {
    to: 'apple2plus',
    domain: 'numeric',
    support: 'partial',
    summary:
      'Floating point to nine digits, with SQR, LOG, EXP, the trig functions, ^, and RND giving a fraction below 1.',
    instead:
      'AND, OR and NOT are logical rather than bitwise: 5 AND 3 is 1. There is no MOD, DIV or XOR — take a remainder with INT, and do bit work by arithmetic.',
    example: {
      caption: 'A remainder without MOD',
      code: ['10 R=A-INT(A/B)*B', '20 PRINT R'],
    },
    reachFor: ['SQR', 'RND', 'INT', 'ABS'],
  },
  {
    to: 'apple2plus',
    domain: 'strings',
    support: 'partial',
    summary:
      'LEFT$, RIGHT$ and MID$ slice, + joins, and LEN, ASC, CHR$, STR$ and VAL convert. A string holds up to 255 characters.',
    instead:
      'No INSTR, UPPER$ or HEX$: search with a MID$ loop. Nothing assigns into the middle of a string either — rebuild it by joining the parts on both sides of the change.',
    example: {
      caption: 'Search without INSTR',
      code: [
        '10 FOR I=1 TO LEN(A$)',
        '20 IF MID$(A$,I,1)="X" THEN 40',
        '30 NEXT I',
        '40 PRINT I',
      ],
    },
    reachFor: ['MID$', 'LEN', 'CHR$', 'VAL'],
  },
  {
    to: 'apple2plus',
    domain: 'text-screen',
    support: 'partial',
    summary:
      'PRINT with TAB( and SPC(, HTAB and VTAB to reach any cell of the 40 by 24 screen, and HOME to clear it.',
    instead:
      'No PRINT USING, WINDOW or LOCATE: pad with SPC( to line a column up, and place text with HTAB and VTAB. The text window is narrowed by poking locations 32 to 35.',
    example: {
      caption: 'Place text with HTAB and VTAB',
      code: ['10 HOME', '20 VTAB 5:HTAB 10', '30 PRINT "SCORE"'],
    },
    reachFor: ['PRINT', 'HTAB', 'VTAB', 'HOME'],
  },
  {
    to: 'apple2plus',
    domain: 'graphics',
    support: 'partial',
    summary:
      'Lo-res blocks with GR, PLOT, HLIN, VLIN and SCRN(, and 280 by 192 hi-res with HGR, HPLOT and the shape table.',
    instead:
      'No CIRCLE, FILL or MODE: draw a curve as a run of HPLOTs and fill a region with HPLOT lines. A hi-res dot cannot be read back either — SCRN( is lo-res only.',
    example: {
      caption: 'A circle as a run of HPLOTs',
      code: [
        '10 HGR:HCOLOR=3',
        '20 FOR A=0 TO 6.3 STEP .05',
        '30 HPLOT 140+40*COS(A),80+40*SIN(A)',
        '40 NEXT A',
      ],
    },
    reachFor: ['HGR', 'HPLOT', 'PLOT', 'SCRN('],
  },
  {
    to: 'apple2plus',
    domain: 'colour',
    support: 'partial',
    summary:
      'COLOR= picks one of sixteen colours for the lo-res page, and HCOLOR= one of eight for hi-res.',
    instead:
      'Colour belongs to the graphics pages and never to text: no ink, paper or border, and nothing PRINT writes can be coloured. INVERSE and FLASH are all the text screen has.',
    example: {
      caption: 'Colour a block, not a string',
      code: ['10 GR', '20 COLOR=9', '30 PLOT 0,0'],
    },
    reachFor: ['COLOR=', 'HCOLOR='],
  },
  {
    to: 'apple2plus',
    domain: 'sound',
    support: 'none',
    summary:
      'None: the speaker is one bit, and Applesoft has no keyword that reaches it.',
    instead:
      'No sound keywords at all. Touching address -16336 moves the speaker cone once, so a note is that PEEK in a loop and the loop’s period is what sets the pitch.',
    example: {
      caption: 'A click train, in place of a note',
      code: ['10 FOR I=1 TO 50', '20 X=PEEK(-16336)', '30 NEXT I'],
    },
  },
  {
    to: 'apple2plus',
    domain: 'input',
    support: 'partial',
    summary:
      'INPUT reads a whole typed line, GET waits for one key, and PDL( reads a paddle, 0 to 255.',
    instead:
      'GET blocks until a key comes, so a loop that must keep moving polls the latch instead: PEEK(-16384) over 127 means a key is waiting, and POKE -16368,0 clears the strobe.',
    example: {
      caption: 'Poll the keyboard without stopping',
      code: [
        '10 K=PEEK(-16384)',
        '20 IF K<128 THEN 10',
        '30 POKE -16368,0',
        '40 K=K-128',
      ],
    },
    reachFor: ['INPUT', 'GET', 'PDL'],
  },
  {
    to: 'apple2plus',
    domain: 'storage',
    support: 'partial',
    summary:
      'LOAD and SAVE move the program on cassette; STORE and RECALL move an array, and SHLOAD a shape table.',
    instead:
      'Cassette and nothing else: no OPEN, no PRINT# and no disk, and nothing is wired to the tape port while a program runs. Keep data in DATA statements, or in a memory block beside the program.',
    example: {
      caption: 'Data in the listing, not in a file',
      code: [
        '10 DIM T(3)',
        '20 FOR I=0 TO 3:READ T(I):NEXT I',
        '30 DATA 5,9,2,7',
      ],
    },
    reachFor: ['LOAD', 'SAVE', 'STORE', 'RECALL'],
  },
  {
    to: 'apple2plus',
    domain: 'memory-hardware',
    support: 'partial',
    summary:
      'PEEK, POKE, CALL and USR reach memory and machine code; HIMEM: and LOMEM: move the ends of the workspace.',
    instead:
      'No hex literals and no port I/O: the hardware is memory-mapped, and an address above 32767 is written negative — so the keyboard latch is read as PEEK(-16384).',
    example: {
      caption: 'An I/O address, written negative',
      code: ['10 PRINT PEEK(-16384)'],
    },
    reachFor: ['PEEK', 'POKE', 'CALL', 'HIMEM:'],
  },
  {
    to: 'apple2plus',
    domain: 'program-editing',
    support: 'partial',
    summary:
      'LIST, DEL, NEW and CONT edit and restart, and TRACE prints each line number as the program reaches it.',
    instead:
      'No RENUM, AUTO or EDIT: retype a line to change it, and leave gaps in the numbering. LIST puts its own spacing back, the interpreter having thrown the typed spacing away.',
    example: {
      caption: 'Watch a run with TRACE',
      code: ['10 TRACE', '20 GOSUB 100', '30 NOTRACE'],
    },
    reachFor: ['LIST', 'DEL', 'TRACE', 'NEW'],
  },
  {
    to: 'apple2plus',
    domain: 'error-handling',
    support: 'partial',
    summary:
      'ONERR GOTO traps every error, and RESUME goes back to the statement that raised it.',
    instead:
      'No ERR or ERL keyword: the code of the error is in location 222 and its line in 218 and 219, so a handler PEEKs them. RESUME retries the statement, so fix the cause or it loops.',
    example: {
      caption: 'Read the error code with PEEK',
      code: [
        '10 ONERR GOTO 100',
        '20 READ X:GOTO 20',
        '100 PRINT "ERR";PEEK(222)',
      ],
    },
    reachFor: ['ONERR', 'RESUME'],
  },

  // -------------------------------------------------------------- ATARIS --
  {
    to: ATARIS,
    domain: 'control-flow',
    support: 'partial',
    summary:
      'IF…THEN, FOR…NEXT with STEP, GOTO/GOSUB and ON…GOTO cover jumps and loops; POP unwinds a GOSUB left early.',
    instead:
      'No ELSE, no WHILE and no REPEAT. Everything after THEN belongs to the THEN, so put the negative case on the next line and jump past the positive one.',
    example: {
      caption: 'No ELSE: split into two lines',
      code: [
        '10 IF X=0 THEN GOTO 40',
        '20 PRINT "NONZERO"',
        '30 GOTO 50',
        '40 PRINT "ZERO"',
      ],
    },
    reachFor: ['IF', 'FOR', 'GOSUB', 'ON'],
  },
  {
    to: ATARIS,
    domain: 'data',
    support: 'partial',
    summary:
      'LET, DIM, DATA/READ/RESTORE and CLR hold constants and declare arrays and strings.',
    instead:
      'No type declarations and no ERASE: a name is typed by its spelling, a trailing $ making it a string, and DIM sizes it once and for good until CLR.',
    example: {
      caption: 'Sizes are fixed at DIM and never grow',
      code: ['10 DIM A(10),N$(20)', '20 N$="BASICALLY"', '30 PRINT LEN(N$)'],
    },
    reachFor: ['DIM', 'DATA', 'READ', 'CLR'],
  },
  {
    to: ATARIS,
    domain: 'numeric',
    support: 'partial',
    summary:
      'Ten-digit decimal floating point with the usual roots, logs and trig, and DEG and RAD to choose the angle unit.',
    instead:
      'No TAN, no PI and no integer division: TAN is SIN/COS, PI is 3.14159265, and A DIV B is INT(A/B) with A-B*INT(A/B) for the remainder.',
    example: {
      caption: 'TAN, PI and integer division by hand',
      code: ['10 P=3.14159265', '20 T=SIN(X)/COS(X)', '30 D=INT(A/B):R=A-B*D'],
    },
    reachFor: ['SIN', 'SQR', 'INT', 'RND'],
  },
  {
    to: ATARIS,
    domain: 'strings',
    support: 'partial',
    summary:
      'LEN, ASC, CHR$, STR$ and VAL convert between strings and numbers.',
    instead:
      'No LEFT$/MID$/RIGHT$ and no string arrays: slice with A$(from,to), and join by assigning past the end with A$(LEN(A$)+1)=B$.',
    example: {
      caption: 'Slice and join by subscript',
      code: [
        '10 DIM A$(20),B$(10)',
        '20 A$="HELLO":B$=" THERE"',
        '30 A$(LEN(A$)+1)=B$',
        '40 PRINT A$(1,5)',
      ],
    },
    reachFor: ['LEN', 'ASC', 'CHR$', 'VAL'],
  },
  {
    to: ATARIS,
    domain: 'text-screen',
    support: 'partial',
    summary:
      'PRINT and POSITION write anywhere on the 40x24 screen; PUT sends a byte to a channel and LPRINT to the printer.',
    instead:
      'No CLS, TAB or SPC: clear by printing the {clear} escape or re-selecting GRAPHICS 0, and space text out with POSITION. Never print into column 39.',
    example: {
      caption: 'Clear and place text without CLS or TAB',
      code: ['10 PRINT "{clear}"', '20 POSITION 10,5:PRINT "SCORE";S'],
    },
    reachFor: ['PRINT', 'POSITION', 'PUT', 'LPRINT'],
  },
  {
    to: ATARIS,
    domain: 'graphics',
    support: 'partial',
    summary:
      'GRAPHICS picks one of twelve modes, PLOT and DRAWTO draw in the register COLOR selected, and LOCATE reads a point back.',
    instead:
      'No MOVE, CLG or FILL keyword: PLOT sets where a line starts, GRAPHICS clears the screen as it selects a mode, and XIO 18 fills an outlined area.',
    example: {
      caption: 'Move, clear and fill the Atari way',
      code: [
        '10 GRAPHICS 7+16:COLOR 1',
        '20 PLOT 10,10:DRAWTO 80,40',
        '30 POSITION 10,10',
        '40 XIO 18,#6,0,0,"S:"',
      ],
    },
    reachFor: ['GRAPHICS', 'PLOT', 'DRAWTO', 'LOCATE'],
  },
  {
    to: ATARIS,
    domain: 'colour',
    support: 'partial',
    summary:
      'SETCOLOR loads one of five registers with a hue and a brightness; COLOR picks which register drawing uses next.',
    instead:
      'No INK, PAPER or BORDER: register 2 is the background, 1 the text luminance and 4 the border, and a pixel names a register rather than a colour.',
    example: {
      caption: 'Background, text and border by register',
      code: ['10 SETCOLOR 2,9,4', '20 SETCOLOR 1,9,14', '30 SETCOLOR 4,0,0'],
    },
    reachFor: ['SETCOLOR', 'COLOR'],
  },
  {
    to: ATARIS,
    domain: 'sound',
    support: 'partial',
    summary:
      'SOUND plays a tone on one of four voices and holds it until the voice is changed or the program ends.',
    instead:
      'No ENVELOPE, BEEP or PLAY: shape a note by changing its volume in a loop, and silence a voice by giving it a volume of 0.',
    example: {
      caption: 'Fade a note instead of an envelope',
      code: [
        '10 FOR V=15 TO 0 STEP -1',
        '20 SOUND 0,121,10,V',
        '30 FOR W=1 TO 20:NEXT W',
        '40 NEXT V',
        '50 SOUND 0,0,0,0',
      ],
    },
    reachFor: ['SOUND'],
  },
  {
    to: ATARIS,
    domain: 'input',
    support: 'partial',
    summary:
      'INPUT reads a line, GET waits for a byte on a channel, and STICK, STRIG, PADDLE and PTRIG read the controller ports.',
    instead:
      'No INKEY$: PEEK(764) holds the last key’s hardware code, 255 for none, and keeps it until the program POKEs 764,255 to clear it.',
    example: {
      caption: 'Poll a key without waiting',
      code: [
        '10 K=PEEK(764)',
        '20 IF K=255 THEN GOTO 10',
        '30 POKE 764,255',
        '40 PRINT "KEY ";K',
      ],
    },
    reachFor: ['INPUT', 'GET', 'STICK', 'STRIG'],
  },
  {
    to: ATARIS,
    domain: 'storage',
    support: 'partial',
    summary:
      'OPEN, CLOSE, GET, PUT and XIO reach any device by name; SAVE, LOAD, CSAVE and CLOAD move whole programs.',
    instead:
      'No BGET/BPUT and no CHAIN: OPEN a channel on "C:" or "D:NAME" and move bytes with GET and PUT, and RUN "D:NEXT" chains to another program.',
    example: {
      caption: 'Open a channel and move bytes',
      code: ['10 OPEN #1,8,0,"D:SCORES"', '20 PUT #1,ASC("A")', '30 CLOSE #1'],
    },
    reachFor: ['OPEN', 'CLOSE', 'XIO', 'SAVE'],
  },
  {
    to: ATARIS,
    domain: 'memory-hardware',
    support: 'partial',
    summary:
      'PEEK and POKE reach any address in decimal, USR calls machine code, ADR finds a string’s bytes and FRE(0) reports free memory.',
    instead:
      'No CALL and no indirection operators: USR(address) is the only way in, and the routine must PLA the argument count USR pushed before anything else.',
    example: {
      caption: 'Call machine code with USR',
      code: [
        '10 FOR I=0 TO 3:READ B',
        '20 POKE 1536+I,B:NEXT I',
        '30 X=USR(1536)',
        '40 DATA 104,169,7,96',
      ],
    },
    reachFor: ['PEEK', 'POKE', 'USR', 'FRE'],
  },
  {
    to: ATARIS,
    domain: 'program-editing',
    support: 'partial',
    summary:
      'LIST, NEW, RUN and CONT drive the session, REM comments a line, and BYE leaves BASIC for the Memo Pad.',
    instead:
      'No AUTO, RENUMBER, DELETE or TRACE: typing a line number on its own deletes that line, and retyping a line replaces it. Leave gaps to insert into.',
    example: {
      caption: 'Editing without AUTO or RENUMBER',
      code: [
        '10 REM leave gaps to insert later',
        '20 REM typing 20 alone deletes it',
      ],
    },
    reachFor: ['LIST', 'NEW', 'RUN', 'CONT'],
  },
  {
    to: ATARIS,
    domain: 'error-handling',
    support: 'partial',
    summary:
      'TRAP sends the next error to a line instead of stopping, and the code and line it failed on are read back with PEEK.',
    instead:
      'No ERR, ERL or RESUME: PEEK(195) is the error code and PEEK(187)*256+PEEK(186) the line. TRAP clears itself, so the handler has to set it again.',
    example: {
      caption: 'Read the error back after a TRAP',
      code: [
        '10 TRAP 100',
        '20 X=VAL(A$)',
        '30 END',
        '100 E=PEEK(195)',
        '110 PRINT "ERROR ";E:TRAP 100',
      ],
    },
    reachFor: ['TRAP'],
  },
];
