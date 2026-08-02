// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The Altair's loadable image builder (Stage 1) - this dialect's equivalent of
 * the ZX81 `.P` builder or the Commodore `.prg` builder.
 *
 * It is deliberately *not* called `pfile.ts`/`tapfile.ts`: the Altair has no
 * standard program container. A program left BASIC either as a tokenized
 * cassette record over the 88-ACR board, or as a plain-ASCII paper tape that
 * BASIC re-parsed line by line on the way back in. Stage 4 decides which of
 * those the build targets expose; Stage 1 only needs the in-memory image the
 * emulator's `loadProgram` injects - the tokenized program plus the pointer
 * fixups the interpreter expects (link chain, and the text/variable pointers
 * that follow the end of the program).
 */
export function buildBasicImage(_source: string): Uint8Array {
  throw new Error('altair8800: not implemented');
}

/**
 * Parse a built image back into its tokenized program bytes, for the import
 * path and for the pointer-consistency test Stage 1 ships alongside the builder.
 */
export function parseBasicImage(_image: Uint8Array): Uint8Array {
  throw new Error('altair8800: not implemented');
}
