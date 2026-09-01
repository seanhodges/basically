// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { KeywordInfo } from '../types';

/**
 * Dartmouth BASIC's whole vocabulary as of 8 February 1965, read off the
 * compiler source rather than inferred from any later BASIC.
 *
 * The statement set is the `q` jump table in `BA-1`, which branches on the
 * first letter of a line and rejects every letter that opens nothing: only
 * `d`, `e`, `f`, `g`, `i`, `l`, `n`, `p`, `r`, `s` and `t` have a decoder, and
 * `t` (`TIME`) is guarded by a flag the source calls "not legal in regular
 * basic". The library functions are the `q2*` chain in the same file, which
 * dispatches on the first letter of a name followed by `(`.
 *
 * What is *not* here is the interesting half, because every one of these
 * arrives later and a program written for a microcomputer will reach for them:
 *
 *  - **No `RESTORE`.** After `r` the decoder accepts `e` and nothing else, so
 *    `READ`, `REM` and `RETURN` are the whole `r` set and the DATA pointer
 *    cannot be rewound.
 *  - **No `SGN`.** The ten library functions are `ABS`, `ATN`, `COS`, `EXP`,
 *    `INT`, `LOG`, `RND`, `SIN`, `SQR` and `TAN`; there is no eleventh.
 *  - **No `ON`, no `RANDOMIZE`, no `TAB`, no string function of any kind** -
 *    this version has no strings at all beyond the literal `PRINT` writes.
 *  - **`LET` is not optional.** A line opening with a letter reaches the jump
 *    table's `a` slot and stops there, so `10 A=1` is an illegal instruction.
 *
 * The `token` field is an ordinal, not a byte the machine stores. BASIC was
 * compiled here rather than tokenized: the program stayed as characters and
 * `RUN` translated it, so no keyword has a byte of its own. The shared
 * {@link KeywordInfo} type requires the field, so it holds the entry's index in
 * this table and nothing reads it as hardware.
 */

/** Raw table: [spelling, kind, signature, doc]. */
const TABLE: [string, KeywordInfo['kind'], string, string][] = [
  // Statements, in the order the `q` jump table decodes their first letter.
  ['DATA', 'command', 'DATA c1,c2,...', 'Constants READ takes in turn.'],
  ['DEF', 'command', 'DEF FNx(v)=expr', 'Define a one-line function.'],
  ['DIM', 'command', 'DIM a(n[,m])', 'Declare an array bigger than 10 by 10.'],
  ['END', 'command', 'END', 'Stop. Must be the last line of the program.'],
  ['FOR', 'command', 'FOR v=a TO b [STEP c]', 'Begin a counting loop.'],
  ['GOSUB', 'command', 'GOSUB line', 'Call a subroutine.'],
  ['GOTO', 'command', 'GOTO line', 'Jump to a line number.'],
  ['IF', 'command', 'IF a<b THEN line', 'Jump when the comparison holds.'],
  ['INPUT', 'command', 'INPUT v1,v2,...', 'Read numbers from the teletype.'],
  ['LET', 'command', 'LET v=expr', 'Assign a value. Never optional here.'],
  ['NEXT', 'command', 'NEXT v', 'Close the innermost FOR loop.'],
  ['PRINT', 'command', 'PRINT [expr][,|;]', 'Print to the teletype.'],
  ['READ', 'command', 'READ v1,v2,...', 'Take the next DATA constants.'],
  ['REM', 'command', 'REM text', 'A comment to end of line.'],
  ['RETURN', 'command', 'RETURN', 'Return from a subroutine.'],
  ['STOP', 'command', 'STOP', 'Halt as though the program had reached END.'],

  // Clause words. They open no statement of their own: the expression
  // compiler stops when it meets one.
  ['STEP', 'operator', 'STEP c', 'Amount a FOR loop adds each time.'],
  ['THEN', 'operator', 'THEN line', 'Line an IF jumps to when it holds.'],
  ['TO', 'operator', 'TO b', 'Limit of a FOR loop.'],

  // The library, plus the user functions DEF defines.
  ['ABS', 'function', 'ABS(x)', 'Absolute value.'],
  ['ATN', 'function', 'ATN(x)', 'Arctangent, in radians.'],
  ['COS', 'function', 'COS(x)', 'Cosine of an angle in radians.'],
  ['EXP', 'function', 'EXP(x)', 'e raised to the power x.'],
  ['FN', 'function', 'FNx(v)', 'Call a function DEF defined.'],
  ['INT', 'function', 'INT(x)', 'Greatest integer not above x.'],
  ['LOG', 'function', 'LOG(x)', 'Natural logarithm.'],
  ['RND', 'function', 'RND(x)', 'The next random number; x is ignored.'],
  ['SIN', 'function', 'SIN(x)', 'Sine of an angle in radians.'],
  ['SQR', 'function', 'SQR(x)', 'Square root.'],
  ['TAN', 'function', 'TAN(x)', 'Tangent of an angle in radians.'],
];

export const ge235Keywords: KeywordInfo[] = TABLE.map(
  ([word, kind, signature, doc], token) => ({
    word,
    token,
    kind,
    signature,
    doc,
  }),
);

/**
 * The statement words, longest first - what the tokenizer matches at the head
 * of a line, and the set the `q` jump table can decode.
 */
export const ge235Statements: readonly string[] = ge235Keywords
  .filter((k) => k.kind === 'command')
  .map((k) => k.word)
  .sort((a, b) => b.length - a.length);

/**
 * The operators, which the table above cannot carry because none of them is
 * stored as anything but its own character.
 *
 * The arithmetic five are the negative entries in `BA-3`'s `s` table, whose
 * order is their precedence: `↑` binds tightest, then `*` and `/`, then `+`
 * and `-`. `↑` is the up arrow the ASR-33 has where a modern keyboard has `^`,
 * and it is the only way to raise to a power - there is no `**`.
 *
 * The six relations are the `if` decoder in `BA-1`, which reads `=`, then `<`
 * optionally followed by `=` or `>`, then `>` optionally followed by `=`. So
 * `<>` is the not-equal spelling and `=<` and `=>` are not accepted.
 */
export const ge235Operators: readonly string[] = [
  '↑',
  '*',
  '/',
  '+',
  '-',
  '<=',
  '>=',
  '<>',
  '=',
  '<',
  '>',
];
