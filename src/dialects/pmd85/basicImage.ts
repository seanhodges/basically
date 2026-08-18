// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { ARYTAB, PROGRAM_BASE, STREND, TXTTAB, VARTAB } from './addresses';
import { tokenizeProgram } from './tokenizer';

/**
 * The PMD 85's loadable image builder - this dialect's equivalent of the ZX81
 * `.P` builder or the Commodore `.prg` builder.
 *
 * There is less to it than on those machines, because there is no container to
 * build: BASIC-G's program area is plain RAM above the interpreter, with no
 * load-address word, no length word and no checksum in front of it. So
 * `buildBasicImage(source)` returns exactly what `tokenizeProgram` produced,
 * ready to be dropped at {@link PROGRAM_BASE}.
 *
 * The part that is *not* in the byte stream is the set of interpreter pointers
 * that have to move with it - see {@link basicImagePointers}.
 */
export function buildBasicImage(source: string): Uint8Array {
  return tokenizeProgram(source).program;
}

/** One interpreter workspace word an injected image requires. */
export interface BasicImagePointer {
  /** Interpreter variable name, for readable test failures and comments. */
  name: string;
  /** Address of the little-endian word holding it. */
  address: number;
  /** The value it must hold once the image is in place. */
  value: number;
}

/**
 * The interpreter pointers that must agree with an injected image.
 *
 * Dropping the program bytes at {@link PROGRAM_BASE} is only half of a load.
 * BASIC-G finds the *end* of the program - and therefore where its variables
 * start - through a small set of words rather than by walking the link chain,
 * so a program whose bytes are right but whose pointers still describe the
 * previous one runs into its own leftovers. The values follow from the image:
 *
 *  - TXTTAB is the program base, unchanged by a load. It is included because it
 *    lives inside the interpreter image itself (the interpreter is copied into
 *    RAM, so its constants are writable), which makes it exactly as capable of
 *    being wrong as the rest.
 *  - VARTAB, ARYTAB and STREND all sit at the byte just past the image's 0x0000
 *    end-of-program link - `PROGRAM_BASE + image.length` - which is the state
 *    the interpreter's own line-insert leaves them in: it stores the new end of
 *    program in VARTAB and then runs its CLEAR equivalent, which sets the other
 *    two from it, with no variables or arrays allocated yet.
 *
 * Returned as data rather than written here so the machine's `loadProgram` owns
 * the one place that touches machine memory, and so the pointer-consistency
 * test can check the arithmetic without a machine.
 */
export function basicImagePointers(image: Uint8Array): BasicImagePointer[] {
  const programEnd = PROGRAM_BASE + image.length;
  return [
    { name: 'TXTTAB', address: TXTTAB, value: PROGRAM_BASE },
    { name: 'VARTAB', address: VARTAB, value: programEnd },
    { name: 'ARYTAB', address: ARYTAB, value: programEnd },
    { name: 'STREND', address: STREND, value: programEnd },
  ];
}

/**
 * Parse a built image back into its tokenized program bytes: the link chain up
 * to and including the 0x0000 end-of-program marker, with anything after it
 * dropped (that is appended machine code, which the import path recovers as a
 * memory block - see `detokenizer.ts`). A chain that runs off the end of the
 * data is returned as far as it goes rather than throwing, per the dialect
 * convention that structural problems become warnings on the import path.
 */
export function parseBasicImage(image: Uint8Array): Uint8Array {
  let p = 0;
  while (p + 2 <= image.length) {
    const link = image[p]! | (image[p + 1]! << 8);
    if (link === 0) return image.slice(0, p + 2);
    if (p + 4 > image.length) break;
    let i = p + 4;
    while (i < image.length && image[i] !== 0x00) i++;
    if (i >= image.length) break;
    p = i + 1;
  }
  return image.slice();
}
