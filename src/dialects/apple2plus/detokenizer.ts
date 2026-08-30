// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { DetokenizeResult } from '../types';

export function detokenizeProgram(_program: Uint8Array): string {
  throw new Error('apple2plus: not implemented');
}

export function detokenizeProgramWithReport(
  _program: Uint8Array,
): DetokenizeResult {
  throw new Error('apple2plus: not implemented');
}
