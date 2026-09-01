// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Addresses this dialect's own language layer needs.
 *
 * The MSX BASIC *workspace* pointers - VARTAB, CURLIN and the rest - are not
 * here: they are fixed by the MSX standard rather than by this machine, and
 * live with the machine that reads them, in `src/emulator/msx/workspace.ts`.
 */

/**
 * Where the program area starts on an unexpanded 64 KB machine: the link word
 * of the first line, with the zero byte the interpreter wants before it at
 * 0x8000. The tokenizer needs it because a line's link is an absolute address,
 * so the whole program is written for one base and relinked on import.
 */
export const TXTTAB = 0x8001;
