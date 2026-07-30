// Per-(target dialect, capability) porting advice: what to do when a program
// being ported needs something the target has no command for, plus a short
// worked example of how that job is done on the target where its support for
// the capability is absent or partial.
//
// Cells are keyed by (target, capability) and never by pair: a target-anchored
// note like "the ZX81 has no pixel graphics, rescale to the 64x44 block grid"
// is equally correct arriving from a CPC, a BBC or a Spectrum. `summary`
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

/** A short worked example of how a job is done on the target machine. */
export interface DomainGuidanceExample {
  /** One line above the code, e.g. "No ELSE: split into two branches". */
  caption: string;
  /** Program lines, capped at MAX_EXAMPLE_LINES of MAX_EXAMPLE_LINE_CHARS each. */
  code: string[];
}

/** Advice for one (target dialect, capability) pair. */
export interface DomainGuidance {
  /** Target page slug this cell advises for. */
  to: string;
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
  // ---------------------------------------------------------- zxspectrum --
  {
    to: 'zxspectrum',
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
    to: 'zxspectrum',
    domain: 'data',
    support: 'full',
    summary:
      'READ/DATA/RESTORE, DIM and LET cover constant tables, arrays and assignment.',
    instead:
      'No DEFINT-style type defaults: every string/array name is fixed with a trailing $, so there is nothing to declare up front.',
    reachFor: ['DATA', 'READ', 'DIM'],
  },
  {
    to: 'zxspectrum',
    domain: 'numeric',
    support: 'full',
    summary:
      'A full trig/log set plus <=, >= and <> covers real arithmetic and complete comparisons.',
    instead:
      'No base-only quirks: SIN/COS/TAN and the rest already take radians directly.',
    reachFor: ['SIN', 'SQR', 'RND'],
  },
  {
    to: 'zxspectrum',
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
    to: 'zxspectrum',
    domain: 'text-screen',
    support: 'full',
    summary:
      'AT positions text by row and column, TAB moves the column, and SCREEN$ reads a character back off the display.',
    instead:
      'No LOCATE-named command: AT row,column is the equivalent, written directly inside a PRINT statement.',
    reachFor: ['AT', 'SCREEN$', 'TAB'],
  },
  {
    to: 'zxspectrum',
    domain: 'graphics',
    support: 'full',
    summary:
      'PLOT/DRAW/CIRCLE cover point, line and circle drawing over the full 256×176 pixel screen.',
    instead:
      'No named FILL command: OVER 1 with repeated PLOT/DRAW builds a filled shape, or draw it as adjacent line segments.',
    reachFor: ['DRAW', 'CIRCLE', 'PLOT'],
  },
  {
    to: 'zxspectrum',
    domain: 'colour',
    support: 'full',
    summary:
      'INK/PAPER/BORDER/BRIGHT/FLASH set the 8-colour attribute for a region.',
    instead:
      'No per-pixel colour: one ink/paper pair applies to a whole 8×8 cell, so redesign artwork that relies on finer colour granularity.',
    reachFor: ['INK', 'PAPER', 'FLASH'],
  },
  {
    to: 'zxspectrum',
    domain: 'sound',
    support: 'partial',
    summary:
      'BEEP plays a tone at a given duration and pitch on a single channel, with PLAY for simple tunes.',
    instead:
      'No multi-channel envelope like SOUND/ENVELOPE: BEEP duration,pitch plays one note at a time — sequence several for a tune.',
    example: {
      caption: 'A tune from sequential BEEPs',
      code: ['10 BEEP .2,0', '20 BEEP .2,4'],
    },
    reachFor: ['BEEP', 'PLAY'],
  },
  {
    to: 'zxspectrum',
    domain: 'input',
    support: 'full',
    summary:
      'INKEY$ polls the keyboard without waiting, INPUT reads a whole line or expression.',
    instead:
      'No LINE INPUT-style raw read: INPUT already accepts a full expression or string, quoted or not.',
    reachFor: ['INKEY$', 'INPUT'],
  },
  {
    to: 'zxspectrum',
    domain: 'storage',
    support: 'full',
    summary:
      'SAVE/LOAD/VERIFY/MERGE with CAT and FORMAT give full cassette (and +3 disk) file handling.',
    instead:
      'No random-access record keyword in BASIC: structure tape data sequentially, since there is no direct-access file mode.',
    reachFor: ['SAVE', 'VERIFY', 'CAT'],
  },
  {
    to: 'zxspectrum',
    domain: 'memory-hardware',
    support: 'full',
    summary:
      'PEEK and POKE read and write memory, USR calls machine code, and IN/OUT reach I/O ports.',
    instead:
      'No indirection operators: address every read/write with PEEK/POKE directly rather than ?addr/!addr-style shortcuts.',
    reachFor: ['PEEK', 'POKE', 'IN'],
  },
  {
    to: 'zxspectrum',
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
    to: 'zxspectrum',
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
  // ----------------------------------------------------------------- bbc --
  {
    to: 'bbc',
    domain: 'control-flow',
    support: 'full',
    summary:
      'IF…THEN…ELSE, FOR…NEXT, REPEAT…UNTIL and DEF PROC/FN with ON…GOSUB give full structured control flow.',
    instead:
      'No WHILE/WEND or AFTER/EVERY timers: rewrite a while-loop as REPEAT…UNTIL with an inverted test, and poll TIME instead of a timer interrupt.',
    reachFor: ['PROC', 'REPEAT', 'ON'],
  },
  {
    to: 'bbc',
    domain: 'data',
    support: 'full',
    summary:
      'LET, DIM, DATA/READ/RESTORE and CLEAR cover assignment, arrays and constant tables.',
    instead:
      "No DEFINT/DEFSTR type defaults: every variable's type is fixed by its own %, $ or plain suffix, so declare each explicitly.",
    reachFor: ['DATA', 'DIM', 'READ'],
  },
  {
    to: 'bbc',
    domain: 'numeric',
    support: 'full',
    summary:
      'A full set of trig, log and rounding functions plus DIV/MOD/EOR covers real and integer arithmetic.',
    instead:
      'No CINT/FIX/ROUND functions: truncate with INT, and round by adding 0.5 before INT for positive values.',
    reachFor: ['SQR', 'LOG', 'RND'],
  },
  {
    to: 'bbc',
    domain: 'strings',
    support: 'full',
    summary:
      'LEFT$/MID$/RIGHT$/STR$/VAL/INSTR/EVAL give full substring, conversion and expression-evaluation support.',
    instead:
      'No LOWER$/UPPER$ case conversion: shift a character’s ASC value by 32 and rebuild the string with CHR$, or drop the case-folding.',
    reachFor: ['LEFT$', 'MID$', 'INSTR'],
  },
  {
    to: 'bbc',
    domain: 'text-screen',
    support: 'full',
    summary:
      'VDU drives the display directly, with TAB, SPC, POS/VPOS and WIDTH for layout on top of PRINT.',
    instead:
      'No LOCATE/WINDOW text areas: position each PRINT with TAB(x,y) and manage margins by hand.',
    reachFor: ['VDU', 'TAB', 'WIDTH'],
  },
  {
    to: 'bbc',
    domain: 'graphics',
    support: 'full',
    summary:
      'MOVE/DRAW/PLOT cover the whole 1280×1024 graphics space, with POINT to read a pixel back and CLG to clear it.',
    instead:
      "No named CIRCLE or FILL command: PLOT's plot-code argument draws circles and filled shapes — check the PLOT reference for the code.",
    reachFor: ['DRAW', 'PLOT', 'POINT'],
  },
  {
    to: 'bbc',
    domain: 'colour',
    support: 'full',
    summary:
      'COLOUR sets text ink/paper and GCOL sets graphics ink, both from up to 16 mode-dependent colours.',
    instead:
      "No PEN/PAPER-style pair: COLOUR n for text, GCOL n for graphics — pick the right one for what you're drawing.",
    reachFor: ['COLOUR', 'GCOL'],
  },
  {
    to: 'bbc',
    domain: 'sound',
    support: 'full',
    summary:
      'SOUND drives up to four channels by amplitude, pitch and duration, shaped by an ENVELOPE.',
    instead:
      "No SQ-style channel query: SOUND's own channel argument already selects which of the four voices plays.",
    reachFor: ['SOUND', 'ENVELOPE'],
  },
  {
    to: 'bbc',
    domain: 'input',
    support: 'full',
    summary:
      'INKEY/INKEY$ poll the keyboard without blocking, GET/GET$ wait for a key, and ADVAL reads analogue/joystick input.',
    instead:
      'No SPEED KEY-style typematic control: read the keyboard as often as needed with INKEY rather than configuring a repeat rate.',
    reachFor: ['INKEY', 'GET', 'ADVAL'],
  },
  {
    to: 'bbc',
    domain: 'storage',
    support: 'full',
    summary:
      'OPENIN/OPENOUT/OPENUP with BGET/BPUT and PTR/EXT give full random-access file I/O alongside LOAD/SAVE/CHAIN.',
    instead:
      'No CAT/directory keyword: use *CAT (a star command via OSCLI) rather than a BASIC keyword.',
    reachFor: ['OPENIN', 'BPUT', 'CHAIN'],
  },
  {
    to: 'bbc',
    domain: 'memory-hardware',
    support: 'full',
    summary:
      '?addr and !addr read/write a byte or word directly, and CALL/USR/OSCLI reach machine code and the OS.',
    instead:
      'No POKE/PEEK: write ?addr=val for a byte, !addr=val for a word, and read them back the same way.',
    reachFor: ['CALL', 'USR', 'OSCLI'],
  },
  {
    to: 'bbc',
    domain: 'program-editing',
    support: 'full',
    summary:
      'AUTO, RENUMBER, DELETE and TRACE give full listing-editing and debugging tools alongside LIST/NEW.',
    instead:
      'No CONT to resume after Escape: catch the break in an error handler, or rerun from a saved restart point.',
    reachFor: ['AUTO', 'RENUMBER', 'TRACE'],
  },
  {
    to: 'bbc',
    domain: 'error-handling',
    support: 'full',
    summary:
      'ON ERROR traps a failure, ERR/ERL/REPORT identify it, and the handler can recover with normal control flow.',
    instead:
      'No RESUME to continue at the failing line: the handler must GOTO back explicitly, since ON ERROR does not resume on its own.',
    reachFor: ['ERROR', 'ERR', 'REPORT'],
  },
  // ------------------------------------------------------------ commodore --
  {
    to: 'commodore',
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
    to: 'commodore',
    domain: 'data',
    support: 'full',
    summary:
      'DATA/READ/RESTORE hold constant tables, and DIM/LET declare arrays and variables.',
    instead:
      'Only the first two characters of a name are significant: rename any DIM/LET variable that collides with another under that rule.',
    reachFor: ['DATA', 'READ', 'RESTORE'],
  },
  {
    to: 'commodore',
    domain: 'numeric',
    support: 'full',
    summary:
      'A full trig/log/rounding set covers real arithmetic, though LOG is natural rather than base-10.',
    instead:
      'No LN: LOG is already the natural logarithm here, so drop any base conversion that assumed LOG meant base-10.',
    reachFor: ['SQR', 'LOG', 'RND'],
  },
  {
    to: 'commodore',
    domain: 'strings',
    support: 'full',
    summary:
      'LEFT$/MID$/RIGHT$/STR$/VAL/ASC/CHR$ give full substring extraction and numeric-string conversion.',
    instead:
      'No INSTR-style search built in: scan with a FOR loop comparing MID$(A$,I,LEN(B$)) against B$ at each position.',
    reachFor: ['LEFT$', 'MID$', 'ASC'],
  },
  {
    to: 'commodore',
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
    to: 'commodore',
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
    to: 'commodore',
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
    to: 'commodore',
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
    to: 'commodore',
    domain: 'input',
    support: 'full',
    summary:
      'INPUT reads a line and GET reads one pending key without waiting, covering blocking and polled input.',
    instead:
      'No INKEY$-named function: GET A$ is the equivalent — it returns an empty string immediately when no key is waiting.',
    reachFor: ['GET', 'INPUT'],
  },
  {
    to: 'commodore',
    domain: 'storage',
    support: 'full',
    summary:
      'OPEN/PRINT#/INPUT# give full sequential file I/O, alongside disk commands like DSAVE, DLOAD and CATALOG.',
    instead:
      'No random-access RECORD-style shortcut on cassette: use OPEN with a channel and PRINT#/INPUT# for sequential access instead.',
    reachFor: ['OPEN', 'DSAVE', 'CATALOG'],
  },
  {
    to: 'commodore',
    domain: 'memory-hardware',
    support: 'full',
    summary:
      'PEEK/POKE read and write memory directly, and SYS/USR call machine code.',
    instead:
      'No CALL-named entry point: SYS address runs machine code directly, and USR(x) is a separate user-function vector.',
    reachFor: ['SYS', 'USR', 'PEEK'],
  },
  {
    to: 'commodore',
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
    to: 'commodore',
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
  // ----------------------------------------------------------------- cpc --
  {
    to: 'cpc',
    domain: 'control-flow',
    support: 'full',
    summary:
      'Real ELSE, WHILE…WEND, REPEAT…UNTIL and AFTER/EVERY interrupt timers give the richest structured flow of these machines.',
    instead:
      'No PROC/FN-style named procedures: DEF FN handles single-expression functions; structure larger routines with GOSUB to a labelled block.',
    reachFor: ['WHILE', 'ELSE', 'AFTER'],
  },
  {
    to: 'cpc',
    domain: 'data',
    support: 'full',
    summary:
      'DATA/READ/RESTORE, DIM and DEFINT/DEFREAL/DEFSTR type defaults cover constants, arrays and default variable typing.',
    instead:
      'No CLR-style single-word variable wipe: CLEAR does the same job here, discarding all variables and closing open files.',
    reachFor: ['DATA', 'DEFINT', 'DIM'],
  },
  {
    to: 'cpc',
    domain: 'numeric',
    support: 'full',
    summary:
      'A full trig/log/rounding set, plus MAX/MIN/ROUND and CINT/FIX, covers real, integer and rounded arithmetic.',
    instead:
      'No natural-log-only LOG: LOG is base-10 and LOG10 duplicates it — use CREAL/CINT to convert between real and integer forms explicitly.',
    reachFor: ['ROUND', 'LOG10', 'MAX'],
  },
  {
    to: 'cpc',
    domain: 'strings',
    support: 'full',
    summary:
      'LEFT$/MID$/RIGHT$, LOWER$/UPPER$ case folding and BIN$/DEC$/HEX$ number-base conversion cover text handling in full.',
    instead:
      'No STRING$-style single-char repeat gap: STRING$(n,c) already exists, so build padding or rules directly with it.',
    reachFor: ['LOWER$', 'UPPER$', 'INSTR'],
  },
  {
    to: 'cpc',
    domain: 'text-screen',
    support: 'full',
    summary:
      'LOCATE, WINDOW and ZONE give full cursor and text-area control on top of PRINT, with CURSOR to show or hide it.',
    instead:
      "No POS-only report: POS(#stream) reports the column for any window, and VPOS the row — read both, they're not one call.",
    reachFor: ['LOCATE', 'WINDOW', 'ZONE'],
  },
  {
    to: 'cpc',
    domain: 'graphics',
    support: 'full',
    summary:
      'DRAW/DRAWR/PLOT/PLOTR with relative and absolute forms, plus FILL and MASK, give rich vector graphics with no separate CIRCLE.',
    instead:
      'No named CIRCLE: approximate one with a short loop of PLOT points at computed offsets around the centre, or several DRAWR segments.',
    reachFor: ['DRAWR', 'FILL', 'MASK'],
  },
  {
    to: 'cpc',
    domain: 'colour',
    support: 'full',
    summary:
      'INK/PAPER/PEN/BORDER assign any of 27 hardware colours, with SPEED INK controlling the flash rate.',
    instead:
      'No ATTR-style per-cell colour read-back: track ink assignments in your own variables if a program needs to query them.',
    reachFor: ['INK', 'PAPER', 'BORDER'],
  },
  {
    to: 'cpc',
    domain: 'sound',
    support: 'full',
    summary:
      'SOUND with ENV/ENT envelopes drives three channels, and SQ reports a channel’s queue status.',
    instead:
      'No single BEEP shortcut: SOUND channel,period,duration plays a plain tone — pick a channel and duration for a simple beep.',
    reachFor: ['ENV', 'ENT', 'SOUND'],
  },
  {
    to: 'cpc',
    domain: 'input',
    support: 'full',
    summary:
      'INKEY/INKEY$/JOY poll the keyboard and joystick without blocking, and KEY DEF remaps keys.',
    instead:
      'No GET-style single blocking key wait: LINE INPUT or a polling loop on INKEY$ takes its place — there is no direct equivalent.',
    reachFor: ['JOY', 'INKEY', 'KEY DEF'],
  },
  {
    to: 'cpc',
    domain: 'storage',
    support: 'full',
    summary:
      'OPENIN/OPENOUT with CAT, MERGE and CHAIN MERGE give full sequential file access across tape and disc.',
    instead:
      'No PTR/EXT-style random-access seek on BASIC files: structure data sequentially, or use direct disc sector access outside BASIC.',
    reachFor: ['OPENIN', 'MERGE', 'CAT'],
  },
  {
    to: 'cpc',
    domain: 'memory-hardware',
    support: 'full',
    summary:
      'PEEK/POKE/OUT/INP reach memory and I/O ports directly, with CALL for machine code and DI/EI for interrupts.',
    instead:
      'No named USR-style user function vector: CALL address runs machine code directly instead of routing through a function call.',
    reachFor: ['CALL', 'OUT', 'DI'],
  },
  {
    to: 'cpc',
    domain: 'program-editing',
    support: 'full',
    summary:
      'AUTO, RENUM, DELETE, EDIT and TRON/TROFF give full line-numbering, editing and trace tools.',
    instead:
      'No OLD-style undelete after NEW: keep an external copy before clearing, since a cleared program cannot be recovered.',
    reachFor: ['AUTO', 'RENUM', 'TRON'],
  },
  {
    to: 'cpc',
    domain: 'error-handling',
    support: 'full',
    summary:
      'ON ERROR GOTO with RESUME, plus ON BREAK GOSUB/CONT/STOP, give full error and break trapping.',
    instead:
      'No REPORT-style plain-English error text: read the numeric ERR code and look it up, or trap specific codes you expect.',
    reachFor: ['RESUME', 'ON ERROR GOTO', 'DERR'],
  },
];
