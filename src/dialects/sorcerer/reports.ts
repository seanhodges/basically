// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MachineReport } from '../types';

/** How a run ended, as the interpreter reported it. Not implemented yet. */
export function readSorcererReport(): MachineReport | null {
  throw new Error('sorcerer: report reader not implemented');
}
