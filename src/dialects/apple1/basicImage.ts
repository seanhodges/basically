// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The machine's program image: the two regions the cassette interface dumps -
 * the zero-page housekeeping block that carries LOMEM, HIMEM and the
 * interpreter's pointers, and the program-and-variable area between them.
 */
export function buildBasicImage(_program: Uint8Array): Uint8Array {
  throw new Error('apple1: not implemented');
}

export function parseBasicImage(_image: Uint8Array): {
  program: Uint8Array;
  lomem: number;
  himem: number;
} {
  throw new Error('apple1: not implemented');
}
