// Per-(target dialect, control-code class) porting advice: whether the target
// can express that class of code at all, and what to write instead where it
// cannot.
//
// Cells are keyed by (target, class) and never by pair, for the reason
// domain-guidance.ts is: a target-anchored note like "the Spectrum carries
// colour in the string as {INK n}" is equally correct arriving from a C64, a
// BBC or a CPC. The target is a machine, not the page it reads from - a ZX81
// and a Spectrum share the Sinclair page and share almost no control code -
// and machines that do share a cell are named together through the lists in
// porting.ts. The class is what makes the codes addressable across pages -
// escape *categories* are page-scoped, so `colour` and `cursor` are Commodore
// chips while the Spectrum files its {INK n} under `control`.
//
// Advice is per class rather than per code because that is the unit a reader
// acts on: the same sentence answers all 52 of the Commodore's key-graphics
// codes, and repeating it against each would make the group longer without
// making it clearer.
//
// Completeness is enforced from the real diff by
// escape-guidance-crosscheck.test.ts rather than from a hand-maintained list,
// so a cell here either answers a question the comparison can actually ask, or
// the crosscheck rejects it as dead.
//
// Edit by hand, grounded in each machine's own escape page and reference table
// - the same discipline domain-guidance.ts and facts.ts already follow.
import type { EscapeClass } from './escape-classes';
import { ATARIS, BBCS, COMMODORES, CPCS, SPECTRUMS } from './porting';

/** A short worked example of how the job is done on the target machine. */
export interface EscapeGuidanceExample {
  /** One line above the code, e.g. "Position with AT". */
  caption: string;
  /** Program lines, capped at MAX_EXAMPLE_LINES of MAX_EXAMPLE_LINE_CHARS each. */
  code: string[];
}

/** Advice for one (target dialect, control-code class) pair. */
export interface EscapeGuidance {
  /**
   * The machine this cell advises for, or the machines it reads the same for.
   * Several are named only where the advice is genuinely shared.
   */
  to: string | readonly string[];
  /** The class of control code this cell covers. */
  class: EscapeClass;
  /**
   * How well the target expresses this class on its own: `full` where it has
   * the class under its own spellings, `partial` where it reaches some of what
   * the class does, `none` where it has no way to express it at all.
   */
  support: 'full' | 'partial' | 'none';
  /**
   * "What to write instead" - rendered once against the group. Required on
   * every cell: a cell exists only because some source loses codes of this
   * class into this target, so there is always work, even where the target
   * covers the class and the job is only a respelling.
   */
  instead: string;
  /** A worked example, where the replacement is not obvious from the sentence. */
  example?: EscapeGuidanceExample;
}

/** Said once per target: a hidden numeric form is a Sinclair thing. */
const NO_HIDDEN_NUMBER =
  'Numbers are stored as the digits you type — there is no hidden form to override. Delete the override and keep the digits.';

/** Said once per target: how the catch-all raw byte is respelled. */
const RESPELL_HEX = 'Respell the byte as {0xNN} — two hex digits.';

/** Said once per Sinclair target: the backslash opens an escape there. */
const SINCLAIR_LITERAL = (machine: string) =>
  `Type the character itself; a shifted space becomes an ordinary one. The ${machine} has no backslash — a lone \\ opens a graphics escape — so use / where one was printed.`;

/** Said once per target whose space and backslash are ordinary characters. */
const PLAIN_LITERAL =
  "Type the character itself: space and backslash need no escape here. A second space character like the Commodore's shifted space becomes an ordinary space.";

export const escapeGuidance: EscapeGuidance[] = [
  // ---------------------------------------------------------- altair8800 --
  // A printing terminal with no display: almost every class is 'none', and the
  // advice is usually to drop the code rather than to replace it.
  {
    to: 'altair8800',
    class: 'colour',
    support: 'none',
    instead:
      'No colour anywhere — the console is a printing terminal. Drop the code, or mark the text some other way where the colour carried meaning.',
    example: {
      caption: 'Mark the text instead of colouring it',
      code: ['10 PRINT "*** ALERT ***"'],
    },
  },
  {
    to: 'altair8800',
    class: 'cursor',
    support: 'none',
    instead:
      'No addressable cursor: output only ever moves forward. Print each line whole, in the order it appears, and reach a column with TAB(n).',
    example: {
      caption: 'Reach a column with TAB(',
      code: ['10 PRINT TAB(10);"SCORE"'],
    },
  },
  {
    to: 'altair8800',
    class: 'editing',
    support: 'none',
    instead:
      'Nothing can be erased once printed. Replace a screen clear with a run of blank PRINTs, and re-print a whole line where the original deleted part of it.',
  },
  {
    to: 'altair8800',
    class: 'mode',
    support: 'none',
    instead:
      'One character set and no display modes: drop the switch. The console prints ASCII 0x20-0x7E and nothing else.',
  },
  {
    to: 'altair8800',
    class: 'screen-effect',
    support: 'none',
    instead:
      'No attribute to flash, conceal or double: drop the effect, or give the text a line of its own where it has to catch the eye.',
  },
  {
    to: 'altair8800',
    class: 'function-keys',
    support: 'none',
    instead:
      'No function keys and no code for one: ask with INPUT and branch on what was typed.',
  },
  {
    to: 'altair8800',
    class: 'block-graphics',
    support: 'none',
    instead:
      'No graphics characters at all — printable ASCII is the whole set. Redraw the shape from punctuation, or drop the picture.',
    example: { caption: 'A bar from ASCII', code: ['10 PRINT "##########"'] },
  },
  {
    to: 'altair8800',
    class: 'user-defined-graphics',
    support: 'none',
    instead:
      'No redefinable characters: the console has one fixed face. Build the shape from several ordinary characters, or drop it.',
  },
  {
    to: 'altair8800',
    class: 'inverse-video',
    support: 'none',
    instead:
      'Nothing is reversible on a printing terminal. Use capitals, or bracket the text with punctuation, where inverse marked it out.',
  },
  {
    to: 'altair8800',
    class: 'compression',
    support: 'none',
    instead:
      'No space compression: print the spaces, or skip to the column with TAB(n) or SPC(n).',
  },
  {
    to: 'altair8800',
    class: 'embedded-number',
    support: 'none',
    instead: NO_HIDDEN_NUMBER,
  },
  {
    to: 'altair8800',
    class: 'literal',
    support: 'partial',
    instead: PLAIN_LITERAL,
  },
  {
    to: 'altair8800',
    class: 'control',
    support: 'partial',
    instead:
      'Only five codes reach the console — {0x07} bell, {0x08} backspace, {0x0A} line feed, {0x0D} carriage return and {0x7F} rub out. Drop anything else.',
  },
  {
    to: 'altair8800',
    class: 'raw-byte',
    support: 'full',
    instead: RESPELL_HEX,
  },

  // ---------------------------------------------------------------- atom --
  // Semigraphics 6 and inverse forms, but no printable control codes at all
  // and no way to position the cursor.
  {
    to: 'atom',
    class: 'colour',
    support: 'none',
    instead:
      'No colour: the MC6847 output is monochrome here. Use contrast instead — inverse text, or a denser block-graphics cell.',
    example: {
      caption: 'Contrast instead of colour',
      code: ['10 PRINT "█ ALERT █"'],
    },
  },
  {
    to: 'atom',
    class: 'cursor',
    support: 'none',
    instead:
      "No AT and no TAB: the cursor only moves forward. Print each row whole in order — a comma reaches the next print field and a quote ' starts a new line.",
    example: {
      caption: 'Rows in order, no positioning',
      code: ['10 PRINT "TOP"\'"NEXT ROW"'],
    },
  },
  {
    to: 'atom',
    class: 'editing',
    support: 'partial',
    instead:
      'CLEAR n clears the screen as it selects the mode, but nothing deletes or inserts within a line. Re-print the whole line where the original edited part of it.',
  },
  {
    to: 'atom',
    class: 'mode',
    support: 'partial',
    instead:
      'CLEAR 0-4 selects the screen mode, and the inverse forms stand in for reverse video. There is no lower case, so a character-set switch is dropped.',
  },
  {
    to: 'atom',
    class: 'screen-effect',
    support: 'none',
    instead:
      'No flash, conceal or double height. Alternate the text with blanks in a loop where it has to catch the eye.',
  },
  {
    to: 'atom',
    class: 'function-keys',
    support: 'none',
    instead:
      'No function-key code goes in a string: read a key with GET and branch on what it returns.',
  },
  {
    to: 'atom',
    class: 'block-graphics',
    support: 'partial',
    instead:
      'The Atom draws 64 Semigraphics 6 cells, typed as their block glyphs — redraw the shape on that 2x3 grid. {0xA0} is the blank cell.',
    example: {
      caption: 'Block glyphs, typed directly',
      code: ['10 PRINT "▛▜"\'"▙▟"'],
    },
  },
  {
    to: 'atom',
    class: 'user-defined-graphics',
    support: 'none',
    instead:
      'No redefinable characters: build the shape from Semigraphics 6 cells, or draw it with MOVE, DRAW and PLOT on the graphics screen.',
  },
  {
    to: 'atom',
    class: 'inverse-video',
    support: 'partial',
    instead:
      'Inverse digits and punctuation are {0x80}…{0x9F}, and the lower-case codes display as inverse capitals — but there is no on/off switch, so reverse each character.',
  },
  {
    to: 'atom',
    class: 'compression',
    support: 'none',
    instead:
      'No space compression: print the spaces, or use a comma to reach the next print field.',
  },
  {
    to: 'atom',
    class: 'embedded-number',
    support: 'none',
    instead: NO_HIDDEN_NUMBER,
  },
  { to: 'atom', class: 'literal', support: 'partial', instead: PLAIN_LITERAL },
  {
    to: 'atom',
    class: 'control',
    support: 'none',
    instead:
      'No printable control codes: the Atom acts on none of 0x00-0x1F. Clear the screen with CLEAR and drop the rest.',
  },
  { to: 'atom', class: 'raw-byte', support: 'full', instead: RESPELL_HEX },

  // ---------------------------------------------------------------- BBCS --
  // Teletext MODE 7 carries colour and effects in the string; everything else
  // is a VDU call or a TAB.
  {
    to: BBCS,
    class: 'colour',
    support: 'full',
    instead:
      'MODE 7 has the same teletext codes: {RED}…{WHITE} colour the text from there on, {GRAPHICS RED}… colour the mosaics. Outside MODE 7 use COLOUR n and GCOL.',
  },
  {
    to: BBCS,
    class: 'cursor',
    support: 'full',
    instead:
      'PRINT TAB(x,y) positions absolutely, which is what a run of cursor codes was building up to; VDU 30 homes the cursor.',
    example: {
      caption: 'Position with TAB(x,y)',
      code: ['10 PRINT TAB(10,5);"HERE"'],
    },
  },
  {
    to: BBCS,
    class: 'editing',
    support: 'partial',
    instead:
      'CLS clears the screen and VDU 127 deletes the character behind the cursor; there is no insert, so re-print the line where the original inserted into it.',
  },
  {
    to: BBCS,
    class: 'mode',
    support: 'partial',
    instead:
      'MODE n selects the screen mode. Both cases are always on screen, so a character-set switch is dropped, and reverse video is a COLOUR swap rather than a mode.',
  },
  {
    to: BBCS,
    class: 'screen-effect',
    support: 'full',
    instead:
      'MODE 7 carries the effect as a code of its own: {FLASH} starts flashing text and {STEADY} ends it. In the other modes flashing is a palette pairing set with VDU 19.',
  },
  {
    to: BBCS,
    class: 'function-keys',
    support: 'none',
    instead:
      'No function-key code goes in a string: read the key with GET or INKEY and branch on the value.',
  },
  {
    to: BBCS,
    class: 'block-graphics',
    support: 'partial',
    instead:
      'MODE 7 draws 64 teletext mosaic cells, typed as their block glyphs — redraw the shape on that 2x3 grid, or use MOVE, DRAW and PLOT in a graphics mode.',
  },
  {
    to: BBCS,
    class: 'user-defined-graphics',
    support: 'full',
    instead:
      'VDU 23,c and eight row bit-patterns redefines character c; PRINT CHR$(c) then draws it.',
    example: {
      caption: 'Define a character, then print it',
      code: ['10 VDU 23,240,24,60,126,255,0,0,0,0', '20 PRINT CHR$(240)'],
    },
  },
  {
    to: BBCS,
    class: 'inverse-video',
    support: 'partial',
    instead:
      'No inverse characters: print with the colours swapped instead — COLOUR 128+n sets the background, so COLOUR 0 with COLOUR 135 gives black on white.',
  },
  {
    to: BBCS,
    class: 'compression',
    support: 'none',
    instead:
      'No space compression: print the spaces, or skip with SPC(n) or TAB(n).',
  },
  {
    to: BBCS,
    class: 'embedded-number',
    support: 'none',
    instead: NO_HIDDEN_NUMBER,
  },
  { to: BBCS, class: 'literal', support: 'partial', instead: PLAIN_LITERAL },
  {
    to: BBCS,
    class: 'control',
    support: 'partial',
    instead:
      'No named escapes below 0x80, but the VDU driver still acts on bytes 0-31: write one as {0xNN} inside the string, or send it with VDU n.',
  },
  { to: BBCS, class: 'raw-byte', support: 'full', instead: RESPELL_HEX },

  // ---------------------------------------------------------- COMMODORES --
  // PETSCII carries colour, cursor and editing itself, so what arrives here is
  // mostly a respelling; the gaps are attributes and redefinable characters.
  {
    to: COMMODORES,
    class: 'colour',
    support: 'full',
    instead:
      'PETSCII has its own colour codes — {black}, {white}, {red} and the rest — embedded in the PRINT string exactly where the original ones were.',
  },
  {
    to: COMMODORES,
    class: 'screen-effect',
    support: 'none',
    instead:
      'No flash, conceal or double-height attribute. Alternate {rvon} and {rvoff} in a loop where text has to blink, or POKE colour RAM directly.',
    example: {
      caption: 'Blink by alternating reverse video',
      code: [
        '10 PRINT "{home}{rvon}HIT!"',
        '20 PRINT "{home}{rvoff}HIT!"',
        '30 GOTO 10',
      ],
    },
  },
  {
    to: COMMODORES,
    class: 'block-graphics',
    support: 'partial',
    instead:
      'PETSCII draws 64 keycap shapes — {CBM-a}…, {SHIFT-a}… and the shaded blocks — but they are a different set, so redraw the shape from what PETSCII has.',
  },
  {
    to: COMMODORES,
    class: 'user-defined-graphics',
    support: 'none',
    instead:
      'No SYMBOL or VDU 23: copy the character ROM into RAM, POKE the eight rows of the shape over a character, and point the video chip at the copy.',
  },
  {
    to: COMMODORES,
    class: 'inverse-video',
    support: 'full',
    instead:
      '{rvon} turns reverse video on from that point in the string and {rvoff} turns it off again.',
  },
  {
    to: COMMODORES,
    class: 'compression',
    support: 'none',
    instead:
      'No space compression: print the spaces, or skip with TAB(n) or SPC(n).',
  },
  {
    to: COMMODORES,
    class: 'embedded-number',
    support: 'none',
    instead: NO_HIDDEN_NUMBER,
  },
  {
    to: COMMODORES,
    class: 'literal',
    support: 'partial',
    instead:
      'Type the character itself. PETSCII has no backslash — 0x5C is £ — so use / or £ where one was printed.',
  },
  {
    to: COMMODORES,
    class: 'control',
    support: 'partial',
    instead:
      "PETSCII acts on its own codes, not another machine's: {stop} plus the colour, cursor, editing and mode codes. Match the effect to one of those, or drop it.",
  },
  {
    to: COMMODORES,
    class: 'raw-byte',
    support: 'full',
    instead:
      'Respell the byte as {$xx} in hex or {nnn} in decimal — the petcat spellings.',
  },

  // ---------------------------------------------------------------- CPCS --
  // 32 firmware codes cover almost everything a control code does elsewhere,
  // so most classes arrive here as a respelling onto {0xNN} plus operands.
  {
    to: CPCS,
    class: 'colour',
    support: 'full',
    instead:
      'The firmware carries colour in the string: {0x0F} then a pen byte sets the text ink and {0x0E} then a pen sets the paper — or call PEN and PAPER.',
  },
  {
    to: CPCS,
    class: 'cursor',
    support: 'full',
    instead:
      '{0x1F} followed by a column and a row byte is LOCATE inside a string, and {0x1E} is home; or call LOCATE x,y before the PRINT.',
    example: {
      caption: 'Position with LOCATE',
      code: ['10 LOCATE 10,5', '20 PRINT "HERE"'],
    },
  },
  {
    to: CPCS,
    class: 'editing',
    support: 'partial',
    instead:
      '{0x0C} clears the window, {0x10} deletes the character under the cursor and {0x0D} is a carriage return. There is no insert: re-print the line instead.',
  },
  {
    to: CPCS,
    class: 'mode',
    support: 'partial',
    instead:
      '{0x04} then a mode byte selects MODE 0-2, and {0x18} exchanges PEN and PAPER for reverse video. Both cases are always available, so a case switch is dropped.',
  },
  {
    to: CPCS,
    class: 'screen-effect',
    support: 'partial',
    instead:
      '{0x1C} gives an ink two colours, which flashes it, and SPEED INK sets the rate. There is no conceal, box or double height.',
  },
  {
    to: CPCS,
    class: 'function-keys',
    support: 'none',
    instead:
      'No function-key code goes in a string: read the key with INKEY(n) and branch on the value.',
  },
  {
    to: CPCS,
    class: 'block-graphics',
    support: 'partial',
    instead:
      'The CPC draws 64 mosaic cells, typed as their block glyphs — redraw the shape on that 2x3 grid, or define your own character with SYMBOL.',
  },
  {
    to: CPCS,
    class: 'user-defined-graphics',
    support: 'full',
    instead:
      'SYMBOL c and eight row bit-patterns redefines character c — raise SYMBOL AFTER first so that code is redefinable.',
    example: {
      caption: 'Define a character, then print it',
      code: [
        '10 SYMBOL AFTER 240',
        '20 SYMBOL 240,24,60,126,255,0,0,0,0',
        '30 PRINT CHR$(240)',
      ],
    },
  },
  {
    to: CPCS,
    class: 'inverse-video',
    support: 'full',
    instead:
      '{0x18} exchanges PEN and PAPER from that point in the string, and a second {0x18} puts them back.',
  },
  {
    to: CPCS,
    class: 'compression',
    support: 'none',
    instead:
      'No space compression: print the spaces, skip with TAB(n) or SPC(n), or LOCATE the column.',
  },
  {
    to: CPCS,
    class: 'embedded-number',
    support: 'none',
    instead: NO_HIDDEN_NUMBER,
  },
  { to: CPCS, class: 'literal', support: 'partial', instead: PLAIN_LITERAL },
  {
    to: CPCS,
    class: 'control',
    support: 'full',
    instead:
      'The firmware acts on all of 0x00-0x1F, spelled {0x00}…{0x1F} — colour, cursor, mode, window, SYMBOL and sound. Match the effect to the code that does it.',
  },
  { to: CPCS, class: 'raw-byte', support: 'full', instead: RESPELL_HEX },

  // --------------------------------------------------------------- trs80 --
  // A monochrome 64x16 screen with PRINT @ and ten display codes; no colour
  // and no inverse at all.
  {
    to: 'trs80',
    class: 'colour',
    support: 'none',
    instead:
      'The display is monochrome, so there is nothing to set. Use the block-graphics shades for contrast where colour separated things.',
  },
  {
    to: 'trs80',
    class: 'cursor',
    support: 'full',
    instead:
      'PRINT @ n, positions output at any of the 1024 cells of the 64x16 screen; {0x1C} homes the cursor and {0x1D} returns to the start of the row.',
    example: {
      caption: 'Position with PRINT @',
      code: ['10 PRINT @ 5*64+10,"HERE"'],
    },
  },
  {
    to: 'trs80',
    class: 'editing',
    support: 'partial',
    instead:
      '{0x1F} clears to the end of the screen, {0x1E} to the end of the row and {0x08} backspaces and erases; CLS clears everything. There is no insert.',
  },
  {
    to: 'trs80',
    class: 'mode',
    support: 'partial',
    instead:
      '{0x17} switches to the 32-character double-width display and {0x0E}/{0x0F} turn the cursor on and off. There is one character set, so a case switch is dropped.',
  },
  {
    to: 'trs80',
    class: 'screen-effect',
    support: 'none',
    instead:
      'No flash, conceal or double height — the double-width mode {0x17} is the only attribute. Blink text by re-printing it against spaces in a loop.',
  },
  {
    to: 'trs80',
    class: 'function-keys',
    support: 'none',
    instead:
      'No function keys and no code for one: read a key with INKEY$ and branch on what it returns.',
  },
  {
    to: 'trs80',
    class: 'block-graphics',
    support: 'partial',
    instead:
      'The TRS-80 draws 64 2x3 cells, typed as their block glyphs — redraw the shape on that grid, or SET(x,y) points on the 128x48 graphics grid.',
  },
  {
    to: 'trs80',
    class: 'user-defined-graphics',
    support: 'none',
    instead:
      'No redefinable characters: build the shape from the 2x3 block cells, or SET points on the 128x48 graphics grid.',
  },
  {
    to: 'trs80',
    class: 'inverse-video',
    support: 'none',
    instead:
      'No inverse characters and no reverse-video mode. Put a filled block cell behind the text, or use capitals, where inverse marked it out.',
  },
  {
    to: 'trs80',
    class: 'embedded-number',
    support: 'none',
    instead: NO_HIDDEN_NUMBER,
  },
  { to: 'trs80', class: 'literal', support: 'partial', instead: PLAIN_LITERAL },
  {
    to: 'trs80',
    class: 'control',
    support: 'partial',
    instead:
      'Ten display codes reach the screen — {0x08}, {0x0D}, {0x0E}, {0x0F}, {0x12}, {0x17} and {0x1C}…{0x1F}. Match the effect to one of those, or drop it.',
  },
  { to: 'trs80', class: 'raw-byte', support: 'full', instead: RESPELL_HEX },

  // ---------------------------------------------------------------- zx80 --
  // 21 quadrant cells and the %c inverse prefix; no AT, no TAB, no control
  // codes and no hidden numeric form.
  {
    to: 'zx80',
    class: 'colour',
    support: 'none',
    instead:
      'No colour: black on white. Use inverse video (%c) or a denser block-graphics cell where colour separated things.',
    example: {
      caption: 'Inverse instead of ink',
      code: ['10 PRINT "%H%I%T"'],
    },
  },
  {
    to: 'zx80',
    class: 'cursor',
    support: 'none',
    instead:
      'No AT and no TAB: the cursor only moves forward. Print each row whole in the order it appears, padding with spaces to reach a column.',
  },
  {
    to: 'zx80',
    class: 'editing',
    support: 'partial',
    instead:
      'CLS clears the whole screen, but nothing deletes or inserts within a line. Re-print the line where the original edited part of it.',
  },
  {
    to: 'zx80',
    class: 'mode',
    support: 'partial',
    instead:
      'One screen mode and no lower case, so a character-set switch is dropped. Reverse video is the %c prefix rather than a mode to turn on.',
  },
  {
    to: 'zx80',
    class: 'screen-effect',
    support: 'none',
    instead:
      'No flash, conceal or double height. Alternate a line with blanks in a loop where the text has to catch the eye.',
  },
  {
    to: 'zx80',
    class: 'function-keys',
    support: 'none',
    instead:
      'No function keys and no code for one: ask with INPUT and branch on what was typed.',
  },
  {
    to: 'zx80',
    class: 'block-graphics',
    support: 'partial',
    instead:
      'The ZX80 draws 21 quadrant cells, typed as their block glyphs or as the two-character \\ escapes — redraw the shape on that 2x2 grid.',
  },
  {
    to: 'zx80',
    class: 'user-defined-graphics',
    support: 'none',
    instead:
      'No redefinable characters and no PLOT: build the shape from the 21 quadrant cells, or drop it.',
  },
  {
    to: 'zx80',
    class: 'inverse-video',
    support: 'full',
    instead:
      '%c is the inverse form of character c — %A is an inverse A. Prefix each character that was reversed.',
  },
  {
    to: 'zx80',
    class: 'compression',
    support: 'none',
    instead: 'No space compression and no TAB: print the spaces you need.',
  },
  {
    to: 'zx80',
    class: 'embedded-number',
    support: 'none',
    instead:
      'The ZX80 stores numbers as the digits you type — there is no hidden form to override. Delete the override and keep the digits.',
  },
  {
    to: 'zx80',
    class: 'literal',
    support: 'partial',
    instead: SINCLAIR_LITERAL('ZX80'),
  },
  {
    to: 'zx80',
    class: 'control',
    support: 'none',
    instead:
      'No printable control codes: the ZX80 acts on none of them. Clear the screen with CLS and drop the rest.',
  },
  {
    to: 'zx80',
    class: 'raw-byte',
    support: 'full',
    instead:
      'Respell the byte as \\{NN} — a backslash, then two hex digits in braces.',
  },

  // ---------------------------------------------------------------- zx81 --
  // The ZX80 plus PRINT AT, TAB, SCROLL, PLOT and the hidden 5-byte number.
  {
    to: 'zx81',
    class: 'colour',
    support: 'none',
    instead:
      'No colour: black on white. Use inverse video (%c) or a denser block-graphics cell where colour separated things.',
    example: {
      caption: 'Inverse instead of ink',
      code: ['10 PRINT "%H%I%T"'],
    },
  },
  {
    to: 'zx81',
    class: 'cursor',
    support: 'full',
    instead:
      'PRINT AT row,column positions absolutely, which is what a run of cursor codes was building up to; TAB moves the column and SCROLL moves the screen.',
    example: { caption: 'Position with AT', code: ['10 PRINT AT 5,10;"HERE"'] },
  },
  {
    to: 'zx81',
    class: 'editing',
    support: 'partial',
    instead:
      'CLS clears the whole screen, but nothing deletes or inserts within a line. Re-print the line, or overwrite it with PRINT AT.',
  },
  {
    to: 'zx81',
    class: 'mode',
    support: 'partial',
    instead:
      'One screen mode and no lower case, so a character-set switch is dropped. Reverse video is the %c prefix rather than a mode to turn on.',
  },
  {
    to: 'zx81',
    class: 'screen-effect',
    support: 'none',
    instead:
      'No flash, conceal or double height. Alternate a line with blanks in a loop where the text has to catch the eye.',
  },
  {
    to: 'zx81',
    class: 'function-keys',
    support: 'none',
    instead:
      'No function keys and no code for one: read a key with INKEY$ and branch on what it returns.',
  },
  {
    to: 'zx81',
    class: 'block-graphics',
    support: 'partial',
    instead:
      'The ZX81 draws 21 quadrant cells, typed as their block glyphs or as the two-character \\ escapes — redraw the shape on that 2x2 grid, or PLOT it point by point.',
  },
  {
    to: 'zx81',
    class: 'user-defined-graphics',
    support: 'none',
    instead:
      'No redefinable characters: build the shape from the 21 quadrant cells, or PLOT it point by point on the 64x44 grid.',
  },
  {
    to: 'zx81',
    class: 'inverse-video',
    support: 'full',
    instead:
      '%c is the inverse form of character c — %A is an inverse A. Prefix each character that was reversed.',
  },
  {
    to: 'zx81',
    class: 'compression',
    support: 'none',
    instead:
      'No space compression: print the spaces, skip with TAB, or place the text with PRINT AT.',
  },
  {
    to: 'zx81',
    class: 'embedded-number',
    support: 'full',
    instead:
      'Respell it as \\{=n}: the ZX81 keeps the same hidden 5-byte form after a printed number.',
  },
  {
    to: 'zx81',
    class: 'literal',
    support: 'partial',
    instead: SINCLAIR_LITERAL('ZX81'),
  },
  {
    to: 'zx81',
    class: 'control',
    support: 'none',
    instead:
      'No printable control codes: the ZX81 acts on none of them. Use CLS, PRINT AT and SCROLL, and drop what has no equivalent.',
  },
  {
    to: 'zx81',
    class: 'raw-byte',
    support: 'full',
    instead:
      'Respell the byte as \\{NN} — a backslash, then two hex digits in braces.',
  },

  // ----------------------------------------------------------- SPECTRUMS --
  // Colour, position and attributes all travel inside the string as control
  // directives, so most classes arrive as a respelling.
  {
    to: SPECTRUMS,
    class: 'colour',
    support: 'full',
    instead:
      'The Spectrum carries colour in the string: {INK n} and {PAPER n} set it from that point, with {BRIGHT n} and {FLASH n} beside them.',
    example: {
      caption: 'Colour inside the string',
      code: ['10 PRINT "{INK 2}{PAPER 7}RED"'],
    },
  },
  {
    to: SPECTRUMS,
    class: 'cursor',
    support: 'full',
    instead:
      '{AT r,c} positions inside the string and {TAB n} moves the column — or write PRINT AT row,column before the text.',
    example: { caption: 'Position with AT', code: ['10 PRINT AT 5,10;"HERE"'] },
  },
  {
    to: SPECTRUMS,
    class: 'editing',
    support: 'partial',
    instead:
      'CLS clears the screen, but nothing deletes or inserts within a line. Re-print the line, or overwrite it with {AT r,c}.',
  },
  {
    to: SPECTRUMS,
    class: 'mode',
    support: 'partial',
    instead:
      'One screen mode, and both cases are always available, so a character-set switch is dropped. Reverse video is {INVERSE 1} rather than a mode.',
  },
  {
    to: SPECTRUMS,
    class: 'screen-effect',
    support: 'partial',
    instead:
      '{FLASH 1} blinks a region and {BRIGHT 1} intensifies it; {OVER 1} merges what is printed with what is already there. No conceal, box or double height.',
  },
  {
    to: SPECTRUMS,
    class: 'function-keys',
    support: 'none',
    instead:
      'No function keys and no code for one: read a key with INKEY$ and branch on what it returns.',
  },
  {
    to: SPECTRUMS,
    class: 'block-graphics',
    support: 'partial',
    instead:
      'The Spectrum draws 16 quadrant cells, typed as their block glyphs — redraw the shape on that 2x2 grid, or define a UDG (\\a…\\u) for it.',
  },
  {
    to: SPECTRUMS,
    class: 'inverse-video',
    support: 'full',
    instead:
      '{INVERSE 1} swaps ink and paper from that point in the string, and {INVERSE 0} puts them back.',
  },
  {
    to: SPECTRUMS,
    class: 'compression',
    support: 'none',
    instead:
      'No space compression: print the spaces, skip with {TAB n}, or place the text with {AT r,c}.',
  },
  {
    to: SPECTRUMS,
    class: 'embedded-number',
    support: 'full',
    instead:
      'Respell it as {=n}: the Spectrum keeps the same hidden 5-byte form after a printed number.',
  },
  {
    to: SPECTRUMS,
    class: 'literal',
    support: 'partial',
    instead:
      "A lone backslash opens a UDG escape, so write \\\\ for a literal one. A second space character like the Commodore's shifted space becomes an ordinary space.",
  },
  {
    to: SPECTRUMS,
    class: 'control',
    support: 'partial',
    instead:
      'The directives are {INK n}, {PAPER n}, {FLASH n}, {BRIGHT n}, {INVERSE n}, {OVER n}, {AT r,c} and {TAB n} — match the effect to one of those, or drop it.',
  },
  {
    to: SPECTRUMS,
    class: 'raw-byte',
    support: 'full',
    instead: RESPELL_HEX,
  },
  // The one class only the 128 can be asked about: 0xA3 and 0xA4 are UDGs T and
  // U on a 48K and the SPECTRUM and PLAY tokens here, so the port between the
  // two Spectrums loses exactly two graphics. No other machine has UDG codes to
  // lose into this one.
  {
    to: 'zxspectrum128',
    class: 'user-defined-graphics',
    support: 'partial',
    instead:
      'UDGs A-S carry over unchanged, but T and U do not exist here: 0xA3 and 0xA4 are the SPECTRUM and PLAY tokens. Redraw those two shapes from A-S.',
  },

  // --------------------------------------------------------------- pmd85 --
  // A bitmap screen with an ASCII font: the display controls exist but the
  // character set carries no pictures, so the graphics classes are all 'none'.
  {
    to: 'pmd85',
    class: 'colour',
    support: 'none',
    instead:
      'The screen is monochrome. Each six-pixel cell carries only blink and reduced brightness, set by PEN when drawing and INK( when printing - so mark text out with those, or by position.',
    example: {
      caption: 'Brightness where colour was',
      code: ['10 PRINT INK(2);"DIM"'],
    },
  },
  {
    to: 'pmd85',
    class: 'cursor',
    support: 'none',
    instead:
      'No cursor codes inside a string. Reach a column with TAB(n) in the PRINT list, and clear the screen with GCLEAR rather than by printing a control character.',
    example: {
      caption: 'Reach a column with TAB(',
      code: ['10 PRINT TAB(10);"SCORE"'],
    },
  },
  {
    to: 'pmd85',
    class: 'editing',
    support: 'partial',
    instead:
      'Only {0x08} backspace and {0x1C} clear-screen do anything, and GCLEAR is the readable way to write the second. Anything finer - delete line, insert - has to be re-printed instead.',
  },
  {
    to: 'pmd85',
    class: 'mode',
    support: 'none',
    instead:
      'One screen mode, always: 288x256 pixels with 48x26 characters of text on it. Drop the mode code, and lay the program out for that size.',
  },
  {
    to: 'pmd85',
    class: 'screen-effect',
    support: 'none',
    instead:
      'No flash, bright or over-print codes in a string. The blink and dim attributes are the nearest thing, and they are set by PEN and INK( rather than by a character.',
  },
  {
    to: 'pmd85',
    class: 'function-keys',
    support: 'none',
    instead:
      'The K0-K11 keys send codes the program reads with INKEY; they carry no string a program can redefine. Test INKEY and branch, where the source printed a function-key token.',
    example: {
      caption: 'Read the key rather than a token',
      code: ['10 K=INKEY', '20 IF K=148 THEN 100'],
    },
  },
  {
    to: 'pmd85',
    class: 'block-graphics',
    support: 'partial',
    instead:
      'The font holds one picture: the solid cell, written as the block character itself. Anything finer is drawn rather than printed - PLOT a shape, or BPLOT a string of bytes into screen memory.',
    example: {
      caption: 'The one graphics character',
      code: ['10 PRINT "██████"'],
    },
  },
  {
    to: 'pmd85',
    class: 'user-defined-graphics',
    support: 'none',
    instead:
      'The character generator is in ROM and cannot be redefined. Draw the shape instead: BPLOT writes bytes straight into video RAM at the BMOVE cursor, six pixels to the byte.',
  },
  {
    to: 'pmd85',
    class: 'inverse-video',
    support: 'none',
    instead:
      'No inverse characters and no reverse-video code. Use the dim or blinking attribute where inverse marked text out, or bracket it with punctuation.',
  },
  {
    to: 'pmd85',
    class: 'compression',
    support: 'none',
    instead:
      'No space compression: print the spaces, or skip to the column with TAB(n) or SPC(n).',
  },
  {
    to: 'pmd85',
    class: 'embedded-number',
    support: 'none',
    instead: NO_HIDDEN_NUMBER,
  },
  {
    to: 'pmd85',
    class: 'literal',
    support: 'partial',
    instead: PLAIN_LITERAL,
  },
  {
    to: 'pmd85',
    class: 'control',
    support: 'partial',
    instead:
      'Four codes reach the screen driver - {0x08} backspace, {0x0D} carriage return, {0x1C} clear screen, and {0x0A} which it ignores. Drop anything else; it prints a placeholder.',
  },
  {
    to: 'pmd85',
    class: 'raw-byte',
    support: 'full',
    instead: RESPELL_HEX,
  },
  // -------------------------------------------------------------- apple1 --
  // 64 characters, no colour, and a display that decodes carriage return and
  // nothing else: every class but the raw byte is 'none' or a respelling.
  {
    to: 'apple1',
    class: 'colour',
    support: 'none',
    instead:
      'No colour anywhere — the display is monochrome. Drop the code, or mark the text some other way where the colour carried meaning.',
    example: {
      caption: 'Mark the text instead of colouring it',
      code: ['10 PRINT "*** ALERT ***"'],
    },
  },
  {
    to: 'apple1',
    class: 'cursor',
    support: 'none',
    instead:
      'No addressable cursor: the display decodes carriage return and nothing else, so output only moves forward. Reach a column with TAB, which is a statement of its own.',
    example: {
      caption: 'Reach a column with TAB',
      code: ['10 TAB 10', '20 PRINT "SCORE"'],
    },
  },
  {
    to: 'apple1',
    class: 'editing',
    support: 'none',
    instead:
      'Nothing can be erased once printed, and only the board’s own CLEAR SCREEN button blanks the display. Print a run of blank lines, or print the picture again.',
  },
  {
    to: 'apple1',
    class: 'mode',
    support: 'none',
    instead:
      'One character set and one screen: drop the switch. The display draws 64 characters — ASCII 0x20-0x5F, upper case only — and has no second mode.',
  },
  {
    to: 'apple1',
    class: 'screen-effect',
    support: 'none',
    instead:
      'No attribute to flash, conceal or double: drop the effect, or give the text a line of its own where it has to catch the eye.',
  },
  {
    to: 'apple1',
    class: 'function-keys',
    support: 'none',
    instead:
      'No function keys, and no key read at all from a program — any keypress stops it. Ask with INPUT and branch on what was typed.',
  },
  {
    to: 'apple1',
    class: 'block-graphics',
    support: 'none',
    instead:
      'No graphics characters at all — the 64 the character generator holds are ASCII and nothing else. Redraw the shape from punctuation, or drop the picture.',
    example: {
      caption: 'A bar from punctuation',
      code: ['10 PRINT "##########"'],
    },
  },
  {
    to: 'apple1',
    class: 'user-defined-graphics',
    support: 'none',
    instead:
      'No redefinable characters: the shapes are in a chip the CPU cannot address. Build the shape from several ordinary characters, or drop it.',
  },
  {
    to: 'apple1',
    class: 'inverse-video',
    support: 'none',
    instead:
      'No inverse range and nothing to reverse it with — every code is drawn one way. Use capitals, or bracket the text with punctuation, where inverse marked it out.',
  },
  {
    to: 'apple1',
    class: 'compression',
    support: 'none',
    instead:
      'No space compression: print the spaces, or skip to the column with TAB. Each space costs a video field either way.',
  },
  {
    to: 'apple1',
    class: 'embedded-number',
    support: 'none',
    instead: NO_HIDDEN_NUMBER,
  },
  {
    to: 'apple1',
    class: 'literal',
    support: 'partial',
    instead:
      'Type the character itself where the machine has it. There is no backslash, backtick, brace, bar or tilde, and no lower case — a lower-case letter folds to its capital, the rest have to be dropped.',
  },
  {
    to: 'apple1',
    class: 'control',
    support: 'partial',
    instead:
      'Only three codes mean anything — {0x8D} carriage return, {0x83} CTRL-C and {0x9B} escape, all with bit 7 set as this machine carries every character. Drop anything else.',
  },
  {
    to: 'apple1',
    class: 'raw-byte',
    support: 'full',
    instead: RESPELL_HEX,
  },

  // -------------------------------------------------------------- apple2 --
  // Two named escapes and a raw byte. The character generator holds 64 shapes
  // and the top two bits of a screen byte pick the video mode rather than
  // another shape, so inverse and flashing are the only codes with names -
  // and both are screen bytes to POKE, not codes PRINT acts on.
  {
    to: 'apple2',
    class: 'colour',
    support: 'none',
    instead:
      'No colour in the character stream: colour belongs to the lo-res page. Draw the coloured part with COLOR= and PLOT, and leave the text alone.',
    example: {
      caption: 'Colour a block, not a string',
      code: ['10 GR', '20 COLOR=9', '30 PLOT 0,0'],
    },
  },
  {
    to: 'apple2',
    class: 'cursor',
    support: 'none',
    instead:
      'The cursor moves by statement rather than by code: VTAB picks the row, 1 to 24, and TAB the column, 1 to 40. CALL -936 clears the screen and homes it.',
    example: {
      caption: 'Position with VTAB and TAB',
      code: ['10 VTAB 5', '20 TAB 10', '30 PRINT "SCORE"'],
    },
  },
  {
    to: 'apple2',
    class: 'editing',
    support: 'partial',
    instead:
      'Only backspace, {0x88}, is acted on inside a string. Clear the screen with CALL -936, and overwrite a field by printing spaces over it rather than deleting.',
  },
  {
    to: 'apple2',
    class: 'mode',
    support: 'none',
    instead:
      'The display mode is a statement, not a code: GR switches the lo-res screen on and TEXT switches it back. There is no second character set to select.',
  },
  {
    to: 'apple2',
    class: 'screen-effect',
    support: 'partial',
    instead:
      'Flashing is a byte range, not a code: POKE a byte 0x40-0x7F into the text page, or set the monitor output mask with POKE 50,127 and everything printed flashes until POKE 50,255.',
    example: {
      caption: 'Flash what is printed, with the output mask',
      code: ['10 POKE 50,127', '20 PRINT "ALERT"', '30 POKE 50,255'],
    },
  },
  {
    to: 'apple2',
    class: 'function-keys',
    support: 'none',
    instead:
      'No function keys on this keyboard. Poll the latch with PEEK(-16384) and branch on the letter, which is what a program uses for its controls anyway.',
  },
  {
    to: 'apple2',
    class: 'block-graphics',
    support: 'none',
    instead:
      'No graphics characters: the 64 shapes are ASCII 0x20-0x5F and nothing more. Draw the picture on the lo-res page with PLOT, HLIN and VLIN instead.',
    example: {
      caption: 'A bar as lo-res blocks',
      code: ['10 GR', '20 COLOR=15', '30 HLIN 0,9 AT 0'],
    },
  },
  {
    to: 'apple2',
    class: 'user-defined-graphics',
    support: 'none',
    instead:
      'No redefinable characters: the shapes live in a character generator the CPU cannot address. Build the shape from lo-res blocks, or from several ordinary characters.',
  },
  {
    to: 'apple2',
    class: 'inverse-video',
    support: 'partial',
    instead:
      'Inverse is a byte range, not a code: POKE a byte 0x00-0x3F into the text page, or POKE 50,63 to print inverse until POKE 50,255. A program line cannot hold one: below 0x80 a byte is a token.',
    example: {
      caption: 'An inverse A at the top left',
      code: ['10 POKE 1024,1'],
    },
  },
  {
    to: 'apple2',
    class: 'compression',
    support: 'none',
    instead:
      'No space compression: print the spaces, or skip to the column with TAB, which moves the cursor without writing anything on the way.',
  },
  {
    to: 'apple2',
    class: 'embedded-number',
    support: 'none',
    instead: NO_HIDDEN_NUMBER,
  },
  {
    to: 'apple2',
    class: 'literal',
    support: 'partial',
    instead:
      'Type the character itself where the machine has it. There is no backslash, backtick, brace, bar or tilde, and no lower case - a lower-case letter folds to its capital.',
  },
  {
    to: 'apple2',
    class: 'control',
    support: 'partial',
    instead:
      'A string holds only codes with bit 7 set, and three of them do anything: {0x8D} carriage return, {0x88} backspace and {0x87} the bell. Drop the rest.',
  },
  {
    to: 'apple2',
    class: 'raw-byte',
    support: 'full',
    instead: RESPELL_HEX,
  },

  // ---------------------------------------------------------- apple2plus --
  {
    to: 'apple2plus',
    class: 'colour',
    support: 'none',
    instead:
      'No colour in the character stream: colour belongs to the graphics pages. Draw the coloured part with COLOR= and PLOT, or with HCOLOR= and HPLOT, and leave the text alone.',
    example: {
      caption: 'Colour a block, not a string',
      code: ['10 GR', '20 COLOR=9', '30 PLOT 0,0'],
    },
  },
  {
    to: 'apple2plus',
    class: 'cursor',
    support: 'none',
    instead:
      'The cursor moves by statement rather than by code: VTAB picks the row, 1 to 24, and HTAB the column, 1 to 40. HOME clears the text window and homes the cursor in it.',
    example: {
      caption: 'Position with VTAB and HTAB',
      code: ['10 HOME', '20 VTAB 5:HTAB 10', '30 PRINT "SCORE"'],
    },
  },
  {
    to: 'apple2plus',
    class: 'editing',
    support: 'partial',
    instead:
      'Only backspace, {0x88}, is acted on inside a string. Clear the screen with HOME, and overwrite a field by printing spaces over it rather than by deleting what is there.',
  },
  {
    to: 'apple2plus',
    class: 'mode',
    support: 'none',
    instead:
      'The display mode is a statement, not a code: GR opens the lo-res screen, HGR and HGR2 the hi-res pages, and TEXT switches back. There is no second character set to select.',
  },
  {
    to: 'apple2plus',
    class: 'screen-effect',
    support: 'partial',
    instead:
      'Flashing is a statement here rather than a code: FLASH makes everything printed afterwards flash and NORMAL puts it back. The bytes 0x40-0x7F still flash when POKEd into the text page.',
    example: {
      caption: 'Flash what is printed',
      code: ['10 FLASH', '20 PRINT "ALERT"', '30 NORMAL'],
    },
  },
  {
    to: 'apple2plus',
    class: 'function-keys',
    support: 'none',
    instead:
      'No function keys on this keyboard. Poll the latch with PEEK(-16384) and branch on the letter, which is what a program uses for its controls anyway.',
  },
  {
    to: 'apple2plus',
    class: 'block-graphics',
    support: 'none',
    instead:
      'No graphics characters: the 64 shapes are ASCII 0x20-0x5F and nothing more. Draw the picture on the lo-res page with PLOT, HLIN and VLIN, or in hi-res with HPLOT.',
    example: {
      caption: 'A bar as lo-res blocks',
      code: ['10 GR', '20 COLOR=15', '30 HLIN 0,9 AT 0'],
    },
  },
  {
    to: 'apple2plus',
    class: 'user-defined-graphics',
    support: 'none',
    instead:
      'No redefinable characters — but there is a shape table: DRAW and XDRAW put a shape anywhere on the hi-res page, at any SCALE= and ROT=, which is what a redefined character was for.',
    example: {
      caption: 'A shape instead of a redefined character',
      code: ['10 HGR:HCOLOR=3', '20 SCALE=2:ROT=0', '30 DRAW 1 AT 100,80'],
    },
  },
  {
    to: 'apple2plus',
    class: 'inverse-video',
    support: 'partial',
    instead:
      'Inverse is a statement here rather than a code: INVERSE prints inverse until NORMAL. The bytes 0x00-0x3F still work POKEd into the text page; a program line cannot carry one, being tokens below 0x80.',
    example: {
      caption: 'Print inverse, then back to normal',
      code: ['10 INVERSE', '20 PRINT "ALERT"', '30 NORMAL'],
    },
  },
  {
    to: 'apple2plus',
    class: 'compression',
    support: 'none',
    instead:
      'No space compression: print the spaces with SPC(, or skip to the column with TAB(, which moves the cursor forward without writing anything on the way.',
  },
  {
    to: 'apple2plus',
    class: 'embedded-number',
    support: 'none',
    instead: NO_HIDDEN_NUMBER,
  },
  {
    to: 'apple2plus',
    class: 'literal',
    support: 'partial',
    instead:
      'Type the character itself where the machine has it. There is no backslash, backtick, brace, bar or tilde, and no lower case — a lower-case letter folds to its capital.',
  },
  {
    to: 'apple2plus',
    class: 'control',
    support: 'partial',
    instead:
      'A string holds only codes with bit 7 set, and three of them do anything: {0x8D} carriage return, {0x88} backspace and {0x87} the bell. Drop the rest.',
  },
  {
    to: 'apple2plus',
    class: 'raw-byte',
    support: 'full',
    instead: RESPELL_HEX,
  },

  // -------------------------------------------------------------- ATARIS --
  // ATASCII carries its graphics as ordinary characters rather than as escapes,
  // and everything the screen editor acts on is a cursor or an editing code, so
  // the two classes it really has are those - plus inverse video, which is a
  // bit rather than a code.
  {
    to: ATARIS,
    class: 'colour',
    support: 'none',
    instead:
      'No colour in the character stream: colour is a property of the screen, not of the text. Set a colour register with SETCOLOR before printing, and change it again afterwards.',
    example: {
      caption: 'Colour the screen, not the string',
      code: ['10 SETCOLOR 2,4,4', '20 PRINT "WARNING"', '30 SETCOLOR 2,9,4'],
    },
  },
  {
    to: ATARIS,
    class: 'cursor',
    support: 'full',
    instead:
      'Respell as {up}, {down}, {left} and {right}. There is no home code: POSITION 0,0 puts the cursor in the corner, and it is usually what {home} meant.',
    example: {
      caption: 'Home the cursor with POSITION',
      code: ['10 POSITION 0,0:PRINT "TOP LEFT";'],
    },
  },
  {
    to: ATARIS,
    class: 'editing',
    support: 'full',
    instead:
      'Respell as {clear}, {insert line}, {delete line}, {insert char}, {delete char}, {set tab} and {clear tab}. A carriage return becomes {eol}, which is code 155 here rather than 13.',
  },
  {
    to: ATARIS,
    class: 'mode',
    support: 'none',
    instead:
      'One character set with both letter cases in it, so there is no case switch to make. Reverse video is a bit on each character rather than a mode: see the inverse-video advice.',
  },
  {
    to: ATARIS,
    class: 'screen-effect',
    support: 'none',
    instead:
      'No attribute to flash, conceal or double: drop the effect. Inverse video is the one emphasis this machine has in the character stream, and animating a colour register is the other.',
  },
  {
    to: ATARIS,
    class: 'function-keys',
    support: 'none',
    instead:
      'No function keys on a 400 or an 800. Read the console keys with PEEK(53279) — START, SELECT and OPTION — or branch on an ordinary key from PEEK(764).',
  },
  {
    to: ATARIS,
    class: 'block-graphics',
    support: 'full',
    instead:
      'The block and line shapes are ordinary characters here, codes 0 to 26 plus three on punctuation keys, so type the character rather than an escape. Each has an inverse twin 128 higher.',
    example: {
      caption: 'Draw a box from ATASCII characters',
      code: ['10 PRINT "┌──┐"', '20 PRINT "└──┘"'],
    },
  },
  {
    to: ATARIS,
    class: 'user-defined-graphics',
    support: 'none',
    instead:
      'No redefinable characters from BASIC. Copy the ROM character set into RAM, change the shapes there and POKE 756 with its page — machine-code work, and 1K of RAM.',
  },
  {
    to: ATARIS,
    class: 'inverse-video',
    support: 'full',
    instead:
      'Inverse video is the top bit of the code, not a switch: write {$a0} for an inverse space, or add 128 to any code. CHR$(160) is the same solid block computed.',
    example: {
      caption: 'A solid block is an inverse space',
      code: ['10 PRINT "{$a0}{$a0}{$a0}"', '20 PRINT CHR$(160);'],
    },
  },
  {
    to: ATARIS,
    class: 'compression',
    support: 'none',
    instead:
      'No space compression: print the spaces, or move to the column with POSITION and print nothing in between, which is faster and shorter.',
  },
  {
    to: ATARIS,
    class: 'embedded-number',
    support: 'none',
    instead: NO_HIDDEN_NUMBER,
  },
  {
    to: ATARIS,
    class: 'literal',
    support: 'partial',
    instead:
      'Type the character itself: space and backslash are ordinary here. Three ASCII positions are not: 96 is a diamond, 123 a spade, and 126 and 127 the backspace and tab arrows.',
  },
  {
    to: ATARIS,
    class: 'control',
    support: 'partial',
    instead:
      'Respell as {eol} for a line ending, {bell} for the buzzer and {esc} for the escape code. A line feed, a backspace or a form feed has no code of its own here — drop it.',
  },
  {
    to: ATARIS,
    class: 'raw-byte',
    support: 'full',
    instead:
      'Respell the byte as {$xx} — a dollar and two hex digits, lower case. It is the only place hexadecimal appears on this machine; BASIC itself has none.',
  },
  // ------------------------------------------------- COMMODORES, editing --
  // Added with the Atari page: its screen editor has tab-stop and line-opening
  // codes the Commodore's has no spelling for, so the class became losable.
  {
    to: COMMODORES,
    class: 'editing',
    support: 'partial',
    instead:
      'Respell as {clr}, {del}, {inst} and {cr}. There are no tab-stop codes and no insert- or delete-line code: open a line by printing {inst} once per column, or redraw the screen.',
  },

  // ---------------------------------------------------------------- hb10p --
  // Six classes of its own - cursor, editing, screen effects, the graphic
  // characters, the other control codes and the raw byte - and the rest are
  // statements rather than characters in a string.
  {
    to: 'hb10p',
    class: 'colour',
    support: 'none',
    instead:
      'No colour code goes in a string: COLOR foreground,background,border is a statement, and in SCREEN 1 it recolours all the text at once rather than what follows it.',
    example: {
      caption: 'Colour is a statement here',
      code: ['10 COLOR 15,4,4', '20 PRINT "WHITE ON BLUE"'],
    },
  },
  {
    to: 'hb10p',
    class: 'cursor',
    support: 'full',
    instead:
      'The same jobs, respelled: {0x1C} right, {0x1D} left, {0x1E} up, {0x1F} down, {0x0B} home and {0x0D} carriage return. LOCATE column,row is the readable way to reach a cell.',
    example: {
      caption: 'Position with LOCATE, not with codes',
      code: ['10 LOCATE 10,5', '20 PRINT "SCORE"'],
    },
  },
  {
    to: 'hb10p',
    class: 'editing',
    support: 'partial',
    instead:
      'Only {0x7F} rubs a character out, and {0x0C} clears the screen (CLS is the readable form). Anything finer - delete line, insert - is done by printing the line again.',
  },
  {
    to: 'hb10p',
    class: 'mode',
    support: 'none',
    instead:
      'No mode code in a string: SCREEN 0-3 picks the mode and WIDTH the line length, and both are statements. Neither text screen opens at its full width, so follow SCREEN with WIDTH.',
    example: {
      caption: 'The mode is a statement',
      code: ['10 SCREEN 1:WIDTH 32'],
    },
  },
  {
    to: 'hb10p',
    class: 'screen-effect',
    support: 'partial',
    instead:
      'Only {0x0C}, which clears the screen. There is no flash, bright or over-print code: mark the text out by position or by colour, both of which are statements here.',
  },
  {
    to: 'hb10p',
    class: 'function-keys',
    support: 'none',
    instead:
      'No token stands for a function key in a string. KEY n,"text" sets what f1-f10 type and KEY OFF hides the strip at the foot of the screen, which a full-screen program wants anyway.',
    example: {
      caption: 'Set the key rather than print a token',
      code: ['10 KEY 1,"RUN"+CHR$(13)', '20 KEY OFF'],
    },
  },
  {
    to: 'hb10p',
    class: 'block-graphics',
    support: 'partial',
    instead:
      'The blocks are ordinary characters at 0xC0-0xDF, typed with GRAPH from the palette rather than escaped. Where the shape has no MSX equivalent, draw it: SCREEN 2 has PSET and LINE.',
    example: {
      caption: 'Blocks are characters, not escapes',
      code: ['10 PRINT "▄▄▄▄"'],
    },
  },
  {
    to: 'hb10p',
    class: 'user-defined-graphics',
    support: 'none',
    instead:
      'No redefinable character in a string, but the pattern table is writable: VPOKE the eight bytes of a code’s shape into it, or use a sprite, which is what the machine has instead.',
    example: {
      caption: 'Redefine a character in the pattern table',
      code: [
        '10 SCREEN 1',
        '20 FOR I=0 TO 7',
        '30 VPOKE 65*8+I,255',
        '40 NEXT',
      ],
    },
  },
  {
    to: 'hb10p',
    class: 'inverse-video',
    support: 'none',
    instead:
      'No inverse code and no inverse half of the character set. Swap the two colours with COLOR where inverse marked text out, or bracket the text with punctuation.',
  },
  {
    to: 'hb10p',
    class: 'compression',
    support: 'none',
    instead:
      'No space-compression codes: a run of spaces is stored as spaces. SPACE$(n) writes them from a count where the source packed them into one byte.',
  },
  {
    to: 'hb10p',
    class: 'embedded-number',
    support: 'none',
    instead: NO_HIDDEN_NUMBER,
  },
  {
    to: 'hb10p',
    class: 'literal',
    support: 'none',
    instead: PLAIN_LITERAL,
  },
  {
    to: 'hb10p',
    class: 'control',
    support: 'partial',
    instead:
      'Two of its own: {0x07} sounds the beeper and {0x01} is the graphic header, which prints the shape of the byte after it less 0x40. Anything else is a statement rather than a code.',
  },
  {
    to: 'hb10p',
    class: 'raw-byte',
    support: 'full',
    instead: RESPELL_HEX,
  },
  // The MSX carries cursor codes the Commodore KERNAL has no answer for - it
  // moves the cursor with its own {up}/{left} pair and has nothing for tab,
  // line feed or a carriage return that does not also move down a row.
  {
    to: COMMODORES,
    class: 'cursor',
    support: 'partial',
    instead:
      'The four moves are respelled {up}, {down}, {left}, {right} and {home}. There is no tab or bare carriage return: PRINT TAB(n) reaches a column, and a trailing semicolon holds the line.',
    example: {
      caption: 'Reach a column with TAB(',
      code: ['10 PRINT "{home}";', '20 PRINT TAB(10);"SCORE"'],
    },
  },
];
