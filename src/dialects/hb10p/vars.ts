// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MachineVariable } from '../types';

/**
 * The running program's variables, walked from the interpreter's own pointers.
 *
 * MSX BASIC is BASIC-80 derived and carries four value types (integer, single,
 * double and string) plus long names, so its entry layout is not the one the
 * shared Microsoft 8K decoder walks. The real layout is read off the booted
 * machine byte for byte before anything here assumes a shape.
 */
export function readVariables(): MachineVariable[] {
  throw new Error('hb10p: variable reader not implemented');
}
