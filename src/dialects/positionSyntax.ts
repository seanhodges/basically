// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * How each machine says where on the text screen to print.
 *
 * A program's layout is written as numbers aimed at one particular screen, and
 * the screens here run from 22 columns to 80. Every one of those numbers ports
 * without an error and lands somewhere else - off the edge, wrapped, or on top
 * of something - so the porting guide checks them against the target's own
 * screen. It cannot do that without knowing which arguments of which commands
 * are positions, which is what this table is.
 *
 * Three forms, and they are not variations of one thing:
 *
 *  - **row and column**, as two arguments in the order the machine writes them
 *    (`PRINT AT row,col` on the Sinclairs, `LOCATE col,row` on a CPC);
 *  - **a column alone** (`TAB`), which the row-and-column machines also have;
 *  - **a single offset** from the start of the screen (`PRINT @ n` on a
 *    TRS-80), which is the interesting one: the offset *encodes the screen's
 *    width*, so the same number is a different place on a different machine
 *    even when it is comfortably in range.
 *
 * Keyed by dialect id and a leaf data module, in the same spirit as
 * {@link ./keywordSpellings}: the app-side program scan reads it, and
 * `positionSyntax.test.ts` pins every keyword named to the machine that names
 * it, so a form cannot come to describe a command the machine does not have.
 *
 * A machine absent from the table positions by no command at all - the
 * Commodores, the Atom, the ZX80 and the Altair, which lay text out by
 * printing, by POKEing the screen, or (on the Altair) not at all.
 */

/** What a position command's constant arguments mean. */
export type PositionKind =
  /** Two arguments, row first. */
  | 'row-column'
  /** Two arguments, column first. */
  | 'column-row'
  /** One argument: a column. */
  | 'column'
  /** One argument: cells from the start of the screen. */
  | 'offset';

/** One way a machine's BASIC states a print position. */
export interface PositionCommand {
  /**
   * The spelling to look for, upper case: a keyword (`AT`, `TAB`, `LOCATE`) or
   * a symbol the machine reads as one (`@`).
   */
  keyword: string;
  /** What its arguments mean. */
  kind: PositionKind;
  /**
   * True where the second argument may be left off, leaving a column - the
   * BBC's `TAB(x)` and `TAB(x,y)` are one keyword with two meanings, and a
   * table that had to choose would either lose the row check or report every
   * plain `TAB(x)` as a position with a missing argument.
   */
  secondOptional?: boolean;
}

/**
 * One machine's position commands, and the operand-carrying control codes that
 * do the same job inside a string.
 */
export interface PositionSyntax {
  /**
   * Which cell this machine calls the first one. The Sinclairs and the Acorns
   * count from zero and Locomotive BASIC counts from one, so `LOCATE 40,25` and
   * `PRINT AT 24,39` are both the bottom-right corner of a 40x25 screen. A size
   * check that ignored this would report every CPC layout as one column and one
   * row over.
   */
  origin: 0 | 1;
  /** Position commands in the program's code. */
  commands: PositionCommand[];
  /**
   * Position control codes, by the name inside the braces (`AT` for `{AT r,c}`).
   * The escape scan records only a code's leading byte, so these operands are
   * thrown away there and read here instead.
   *
   * Only the Sinclair 128K-era spellings have operands at all; a machine whose
   * cursor codes are one byte each (the Commodores' `{HOME}` and `{down}`)
   * states no position and so appears here as an empty list.
   */
  escapes: PositionCommand[];
}

const SINCLAIR_COMMANDS: PositionCommand[] = [
  { keyword: 'AT', kind: 'row-column' },
  { keyword: 'TAB', kind: 'column' },
];

const SPECTRUM: PositionSyntax = {
  origin: 0,
  commands: SINCLAIR_COMMANDS,
  // `{AT r,c}` and `{TAB n}` are the same two commands embedded in a string,
  // which is how a Spectrum program lays out a screen from DATA.
  escapes: [
    { keyword: 'AT', kind: 'row-column' },
    { keyword: 'TAB', kind: 'column' },
  ],
};

const BBC: PositionSyntax = {
  origin: 0,
  // TAB(x) is a column and TAB(x,y) is a whole position, in that order.
  commands: [{ keyword: 'TAB', kind: 'column-row', secondOptional: true }],
  escapes: [],
};

const LOCOMOTIVE: PositionSyntax = {
  // LOCATE 1,1 is the top-left cell, unlike every other machine here.
  origin: 1,
  commands: [
    { keyword: 'LOCATE', kind: 'column-row' },
    { keyword: 'TAB', kind: 'column' },
  ],
  escapes: [],
};

/** Machines that state positions, by dialect id. */
const POSITION_SYNTAX: Record<string, PositionSyntax> = {
  zx81: { origin: 0, commands: SINCLAIR_COMMANDS, escapes: [] },
  zxspectrum: SPECTRUM,
  zxspectrum128: SPECTRUM,
  bbcmicro: BBC,
  bbcmaster: BBC,
  cpc464: LOCOMOTIVE,
  cpc6128: LOCOMOTIVE,
  // The one single-offset machine here: `PRINT @ n` counts cells across a
  // 64-column screen, so every one of those numbers has the width baked in.
  trs80: {
    origin: 0,
    commands: [{ keyword: '@', kind: 'offset' }],
    escapes: [],
  },
  // TAB( only. BASIC-G also has an AT keyword, and the interpreter accepts
  // `PRINT AT <row>, <col>;` as two arguments (one is a syntax error) - but
  // nothing then appears on screen, not at that position and not anywhere
  // else, so what AT actually positions is not established. A guessed entry
  // would have the porting guide rewrite a working layout into that.
  pmd85: {
    origin: 0,
    commands: [{ keyword: 'TAB', kind: 'column' }],
    escapes: [],
  },
};

/** How `dialectId` states print positions, or undefined where it states none. */
export function positionSyntaxFor(
  dialectId: string,
): PositionSyntax | undefined {
  return POSITION_SYNTAX[dialectId];
}

/** Every machine with position syntax, for the crosschecks. */
export const positionSyntaxIds: string[] = Object.keys(POSITION_SYNTAX);
