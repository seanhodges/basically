// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { ARYTAB, PROGRAM_BASE, STREND, TXTTAB, VARTAB } from './addresses';
import { tokenizeProgram } from './tokenizer';

/**
 * The Altair's loadable image builder - this dialect's equivalent of the ZX81
 * `.P` builder or the Commodore `.prg` builder.
 *
 * It is deliberately *not* called `pfile.ts`/`tapfile.ts`: the Altair has no
 * standard program container. A program left BASIC either as a tokenized
 * cassette record over the 88-ACR board, or as a plain-ASCII paper tape that
 * BASIC re-parsed line by line on the way back in (`targets.ts` exports both).
 * What the emulator's `loadProgram` injects is simply the tokenized program,
 * byte for byte as the interpreter would have stored it, placed at
 * {@link PROGRAM_BASE}.
 *
 * "Image" is therefore thinner here than elsewhere: there is no header, no load
 * address and no checksum to add, and `buildBasicImage(source)` returns exactly
 * what `tokenizeProgram` produced. The part that is *not* in the byte stream is
 * the set of interpreter pointers that have to move with it - see
 * {@link basicImagePointers}.
 */
export function buildBasicImage(source: string): Uint8Array {
  return tokenizeProgram(source).program;
}

/** One interpreter workspace word an injected image requires. */
export interface BasicImagePointer {
  /** Interpreter variable name, for readable test failures and comments. */
  name: string;
  /** Address of the little-endian word in the interpreter's workspace. */
  address: number;
  /** The value it must hold once the image is in place. */
  value: number;
}

/**
 * The interpreter pointers that must agree with an injected image.
 *
 * Dropping the program bytes at {@link PROGRAM_BASE} is only half of a load:
 * 8K BASIC finds the *end* of the program (and therefore where its variables
 * start) through a small set of words in its own RAM workspace, and a program
 * whose bytes are right but whose pointers still describe the previous one runs
 * into its own leftovers. The addresses come from `addresses.ts`; the values
 * follow from the image itself:
 *
 *  - TXTTAB is the program base, unchanged by a load.
 *  - VARTAB, ARYTAB and STREND all sit at the byte just past the image's 0x0000
 *    end-of-program link - i.e. `PROGRAM_BASE + image.length` - which is the
 *    state a freshly-typed program leaves them in, with no variables, no arrays
 *    and no strings allocated yet. (Confirmed at the console: after entering a
 *    program all three hold that address, and only VARTAB stays there once
 *    variables are assigned.)
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
