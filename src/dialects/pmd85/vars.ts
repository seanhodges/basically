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
 * Where BASIC-G keeps its variables, for the shared Microsoft 8K BASIC decoder
 * in `emulator/microsoftBasicVars.ts`.
 *
 * Every field of the encoding behind these pointers was read off a booted
 * machine, and matches the Altair's byte for byte - which is why the walk
 * itself lives in the shared module and only the addresses are here.
 */
const PMD85_VARS_LAYOUT: MsBasicVarsLayout = {
  vartab: VARTAB,
  arytab: ARYTAB,
  strend: STREND,
  plainChar,
};

/** Every BASIC-G variable the machine currently holds, scalars first. */
export function readPmd85Variables(mem: MsBasicMemPort): MachineVariable[] {
  return readMsBasicVariables(mem, PMD85_VARS_LAYOUT);
}
