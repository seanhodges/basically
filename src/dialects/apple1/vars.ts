// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MachineVariable } from '../types';

/** Walk Integer BASIC's variable table, which grows from LOMEM. */
export function readApple1Variables(_ram: Uint8Array): MachineVariable[] {
  throw new Error('apple1: not implemented');
}
