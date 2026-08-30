// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The loadable image, and the way back out of it.
 *
 * The program sits at the top of the workspace and grows down, so the image is
 * built around it rather than from a base address.
 */
export function buildBasicImage(_program: Uint8Array): Uint8Array {
  throw new Error('apple2: not implemented');
}

export function parseBasicImage(_image: Uint8Array): {
  program: Uint8Array;
  lomem: number;
  himem: number;
} {
  throw new Error('apple2: not implemented');
}
