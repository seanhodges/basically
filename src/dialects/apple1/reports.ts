// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MachineReport } from '../types';

/** Integer BASIC's terse errors (*** SYNTAX ERR and friends), read off screen. */
export function readApple1Report(
  _lines: readonly string[],
): MachineReport | null {
  throw new Error('apple1: not implemented');
}
