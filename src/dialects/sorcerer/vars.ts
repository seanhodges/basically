// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MachineVariable } from '../types';
import type {
  MsBasicMemPort,
  MsBasicVarsLayout,
} from '../../emulator/microsoftBasicVars';

/**
 * The variable watcher's view of Exidy Standard BASIC's workspace. Not
 * implemented yet.
 *
 * The decoding is already written - `readMsBasicVariables` in
 * `src/emulator/microsoftBasicVars.ts` walks the scalar and array stores for
 * every Microsoft 8K BASIC here. What this file owes is the layout: this
 * machine's `vartab`, `arytab` and `strend` inside the 0x0100-0x014E control
 * area, plus its own `plainChar`. Read those addresses off the booted machine
 * and cross-check them against the Software Internals Manual - the Altair's and
 * the PMD 85's are not this machine's.
 */
export function sorcererVarsLayout(): MsBasicVarsLayout {
  throw new Error('sorcerer: variable layout not implemented');
}

export function readSorcererVariables(_mem: MsBasicMemPort): MachineVariable[] {
  throw new Error('sorcerer: variable reader not implemented');
}
