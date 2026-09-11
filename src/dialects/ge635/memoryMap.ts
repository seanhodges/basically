// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MemoryMap } from '../types';

/**
 * The GE-635's store as a program can know it, which is a budget rather than a
 * floor plan - and that is the whole character of this map.
 *
 * **Every address here is a word, not a byte**, and the word is thirty-six
 * bits: section 2.9 counts a program's characters as `C/4`, four to a word.
 * Almost every other machine here addresses bytes, and the difference is not
 * cosmetic - the same span looks eight times smaller and every figure in a
 * note is a word count.
 *
 * **Why this map has one region where the GE-235's has nine.** That machine's
 * February 1965 compiler listing survives, and its map is arithmetic over the
 * listing's own allocation table - `work` at 0o1400, the save area at 0o4000,
 * the symbol table at 0o17326. Nothing equivalent survives for this machine.
 * *BASIC, Fourth Edition* states the size of the user's space and nothing at
 * all about where anything sits inside it, and the viewer would draw an
 * invented boundary as confidently as a read one. So the one span the manual
 * does give is the one span drawn, and the three claims on it are described in
 * the note rather than partitioned into bands nobody can place.
 *
 * Nothing is lost by that which a program could have observed anyway: this
 * BASIC has no `PEEK`, no `POKE`, no `USR` and no machine code, so there is no
 * address a program can name. What a user can ask for is the size, which the
 * terminal's `LENGTH` command reports as `C`.
 *
 * The executive, the compiler and the rest of the GE-600 line's core are
 * deliberately absent rather than sketched. They are a machine room's worth of
 * store that the manual never describes and that no user's program shares a
 * page with.
 */

/**
 * Words of user space a program and its data must fit between them. Section
 * 2.9 states the rule outright: "let C = no. of characters in program, M = no.
 * of components in all vectors and matrices, S = no. of strings; then
 * C/4 + M + S < 8000 is a requirement." The machine's answer for a program
 * that fails it is `OUT OF ROOM`, which `profile.ts` checks before a run as
 * `limits.maxProgramWords`.
 */
export const USER_WORDS = 8000;

/** Characters packed into one thirty-six-bit word, from section 2.9's `C/4`. */
export const CHARACTERS_PER_WORD = 4;

/**
 * Constants a program may declare, from section 2.9: "Only 100 constants may
 * occur in the program." The figure is not enforced anywhere, and deliberately
 * so - the same sentence exempts "certain simple constants - such as small
 * integers" without saying which, so the count a real program is measured by
 * cannot be worked out from the manual. It is quoted in the note below because
 * a reader budgeting a program should know the rule exists, not because
 * anything here can hold a program to it.
 */
export const MAX_CONSTANTS = 100;

export const ge635MemoryMap: MemoryMap = {
  addressSpace: USER_WORDS,
  // Words, not bytes - and thirty-six-bit ones, where the GE-235's are twenty.
  addressUnit: 'word',
  regions: [
    {
      start: 0,
      end: USER_WORDS - 1,
      label: 'User program space',
      kind: 'program',
      note: `${USER_WORDS} words shared by three things at once: the program text at ${CHARACTERS_PER_WORD} characters a word, one word for every component of every vector and matrix, and one for every string. Past the sum of them the compiler answers OUT OF ROOM. Only ${MAX_CONSTANTS} constants may occur in a program, small integers excepted. The boundaries between the three move as the program is edited, so the manual gives their total and never their addresses.`,
    },
  ],
  // No udgBase: no character generator and no graphics, so nothing to point at.
};
