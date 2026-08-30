// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { BasicPointer } from '../../emulator/microsoftBasicLoad';

/**
 * The loadable image, and the way back out of it.
 *
 * A linked list from `$0801`: two-byte link, two-byte line number, tokenized
 * text, `$00`, ending on a zero link.
 */
export function buildBasicImage(_program: Uint8Array): Uint8Array {
  throw new Error('apple2plus: not implemented');
}

export function parseBasicImage(_image: Uint8Array): { program: Uint8Array } {
  throw new Error('apple2plus: not implemented');
}

/** The workspace words an injected image requires, derived from the image. */
export function basicImagePointers(_image: Uint8Array): BasicPointer[] {
  throw new Error('apple2plus: not implemented');
}
