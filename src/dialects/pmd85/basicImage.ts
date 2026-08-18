// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Tokenized program bytes to the RAM image BASIC-G expects, and back.
 *
 * Unlike the Sinclair machines there is no fixed load address baked into a file
 * header: the program area is plain RAM below 0x8000, and where inside it
 * BASIC-G puts a program is a property of the interpreter, still to be
 * established from an image.
 */
export function buildBasicImage(_program: Uint8Array): Uint8Array {
  throw new Error('pmd85: not implemented');
}

/** The program bytes carried by a built image. */
export function parseBasicImage(_image: Uint8Array): Uint8Array {
  throw new Error('pmd85: not implemented');
}
