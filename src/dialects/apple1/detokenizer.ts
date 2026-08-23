// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { DetokenizeResult } from '../types';

/** Stored program bytes back to the listing LIST would print. */
export function detokenizeProgram(_image: Uint8Array): string {
  throw new Error('apple1: not implemented');
}

export function detokenizeProgramWithReport(
  _image: Uint8Array,
): DetokenizeResult {
  throw new Error('apple1: not implemented');
}
