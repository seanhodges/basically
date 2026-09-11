// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MachineVariable } from '../types';
import {
  readMsBasicVariables,
  type MsBasicMemPort,
  type MsBasicVarsLayout,
} from '../../emulator/microsoftBasicVars';
import { ARYTAB, STREND, VARTAB } from './addresses';
import { plainChar } from './charset';

/**
 * Where Exidy Standard BASIC keeps its variables, for the shared Microsoft 8K
 * BASIC decoder in `emulator/microsoftBasicVars.ts`.
 *
 * Only the three pointers and the character set are this machine's; the walk
 * between them is the family's, and is shared with the Altair and the PMD 85.
 * The addresses were read off the booted machine and then confirmed in the ROM
 * PAC, which is the pair of readings this file owes: NEW stores an empty
 * program's link and writes the byte after it to 0x01B7, then copies that
 * straight to 0x01B9 and 0x01BB (`LD (0x01B7),HL / LD HL,(0x01B7) /
 * LD (0x01B9),HL / LD (0x01BB),HL` at 0xC423), which is the three pointers
 * meeting at the top of an empty program - exactly what a machine at its prompt
 * shows.
 *
 * They are *not* the Altair's or the PMD 85's, and are nowhere near them. This
 * interpreter keeps them above its documented control area rather than inside
 * it: the area the Software Manual tables ends at 0x014E, and these are at
 * 0x01B7 upwards, a few dozen bytes below where the program text starts.
 *
 * There is no integer type to decode. `%` did not exist in 8K BASIC, so every
 * numeric variable here is a 4-byte float and the two-flag type encoding the
 * Commodores use never arises.
 */
const SORCERER_VARS_LAYOUT: MsBasicVarsLayout = {
  vartab: VARTAB,
  arytab: ARYTAB,
  strend: STREND,
  plainChar,
};

/** The layout the shared decoder is driven with, for the tests that pin it. */
export function sorcererVarsLayout(): MsBasicVarsLayout {
  return SORCERER_VARS_LAYOUT;
}

/** Every variable the interpreter currently holds, scalars first. */
export function readSorcererVariables(mem: MsBasicMemPort): MachineVariable[] {
  return readMsBasicVariables(mem, SORCERER_VARS_LAYOUT);
}
