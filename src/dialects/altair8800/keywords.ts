// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { KeywordInfo } from '../types';

/**
 * Altair 8K BASIC's keyword table - the token byte the tokenizer emits for each
 * reserved word, plus the signature and one-line doc the editor shows.
 *
 * Empty until Stage 1 derives the table. Altair BASIC is the ancestor of every
 * Microsoft BASIC in this project, so the *shape* is familiar - high-bit tokens
 * from 0x80 up, in the interpreter's own reserved-word order - but the exact
 * byte for each word differs from the C64's and the TRS-80's and must come from
 * a disassembly or the MITS manual rather than from a sibling dialect.
 *
 * The 8K reserved words (a superset of 4K's) are the target: the 4K set plus
 * ASC, AND, ATN, CHR$, CLOAD, CONT, COS, CSAVE, DEF, EXP, FN, FRE, INP, LEFT$,
 * LEN, LOG, MID$, NULL, ON, OR, NOT, OUT and the rest of the string/maths
 * library. Deliberately left empty rather than half-guessed: a wrong token byte
 * produces a program that tokenizes cleanly and then fails on real hardware.
 */
export const altair8800Keywords: KeywordInfo[] = [];
