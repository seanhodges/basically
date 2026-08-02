// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MachineVariable } from '../types';

/**
 * Read the running program's BASIC variables out of RAM for the variable
 * watcher (Stage 5), behind the machine's `readVariables()`.
 *
 * Microsoft BASIC keeps scalars in a simple table between its VARTAB and ARYTAB
 * pointers - name bytes then value - which the C64 and TRS-80 implementations
 * already walk, so the traversal is familiar. What has to be derived here is
 * where those pointers live in the Altair's RAM-resident interpreter, and the
 * exact float format 8K BASIC stores numbers in.
 *
 * Not every dialect ships this: the ZX80 and the Acorn Atom both omit variable
 * watching where the machine makes it impractical, and that is an acceptable
 * outcome here too if the pointers cannot be pinned down from a primary source.
 */
export function readVariables(_memory: Uint8Array): MachineVariable[] {
  throw new Error('altair8800: not implemented');
}
