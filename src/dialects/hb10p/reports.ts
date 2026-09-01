// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MachineReport } from '../types';

/** The interpreter's current report: Ok, an error message, or Break in nn. */
export function readReport(): MachineReport | null {
  throw new Error('hb10p: report reader not implemented');
}
