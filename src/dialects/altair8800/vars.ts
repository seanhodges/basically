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
 * Where Altair 8K BASIC keeps its variables, for the shared Microsoft 8K BASIC
 * decoder in `emulator/microsoftBasicVars.ts`.
 *
 * The encoding behind these pointers was read off a booted machine - a program
 * assigning one of each kind, then the bytes between the pointers - and came
 * back identical to the PMD 85's in every field, which is why the walk itself
 * is shared and only the addresses are here. That is the expected answer rather
 * than a lucky one: BASIC-G is a Microsoft 8K BASIC too, and this is the
 * Microsoft 8K BASIC.
 *
 * There is no integer type to decode. `%` did not exist in 8K BASIC (see the
 * marker traps in `src/reference/facts.ts`), so every numeric variable here is
 * a 4-byte float and the two-flag type encoding the Commodores use never
 * arises.
 */
const ALTAIR_VARS_LAYOUT: MsBasicVarsLayout = {
  vartab: VARTAB,
  arytab: ARYTAB,
  strend: STREND,
  plainChar,
};

/** Every 8K BASIC variable the machine currently holds, scalars first. */
export function readAltair8800Variables(
  mem: MsBasicMemPort,
): MachineVariable[] {
  return readMsBasicVariables(mem, ALTAIR_VARS_LAYOUT);
}
