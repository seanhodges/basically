// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { BasicPointer } from '../../emulator/microsoftBasicLoad';

/**
 * Not implemented yet. The RAM image Exidy Standard BASIC expects at
 * {@link import('./addresses').PROGRAM_BASE}, and the control-area words that
 * have to agree with it.
 *
 * The hand-over itself is `loadMicrosoftBasicProgram` in
 * `src/emulator/microsoftBasicLoad.ts` - this file only supplies the bytes and
 * the pointers that describe them.
 */
export function buildBasicImage(_programBytes: Uint8Array): Uint8Array {
  throw new Error('sorcerer: BASIC image builder not implemented');
}

/** The workspace words an injected image requires, derived from the image. */
export function basicImagePointers(_image: Uint8Array): BasicPointer[] {
  throw new Error('sorcerer: BASIC image pointers not implemented');
}
