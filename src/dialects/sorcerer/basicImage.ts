// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { BasicPointer } from '../../emulator/microsoftBasicLoad';
import { ARYTAB, PROGRAM_BASE, STREND, TXTTAB, VARTAB } from './addresses';

/**
 * The RAM image Exidy Standard BASIC expects at {@link PROGRAM_BASE}.
 *
 * "Image" is thinner here than on a machine with a program container: there is
 * no header, no load address and no checksum, because what the emulator injects
 * is the tokenized program byte for byte as the interpreter would have stored
 * it. The container this machine does have - the Exidy cassette record - is
 * `tapeFile.ts`, and it wraps these bytes rather than replacing them.
 *
 * The hand-over itself is `loadMicrosoftBasicProgram` in
 * `src/emulator/microsoftBasicLoad.ts`; this file supplies the bytes and the
 * pointers that describe them.
 */
export function buildBasicImage(programBytes: Uint8Array): Uint8Array {
  return programBytes.slice();
}

/**
 * The interpreter pointers that must agree with an injected image.
 *
 * Dropping the program bytes at {@link PROGRAM_BASE} is only half of a load:
 * the interpreter finds the *end* of the program - and therefore where its
 * variables start - through a handful of words in RAM, so a program whose bytes
 * are right but whose pointers still describe the previous one runs into its
 * own leftovers. The values follow from the image itself:
 *
 *  - TXTTAB is the program base, unchanged by a load. It is the one of the four
 *    that lives in the documented BASIC control area, and the cold start's own
 *    copy of that area is where {@link PROGRAM_BASE} is read from.
 *  - VARTAB, ARYTAB and STREND all sit at the byte just past the image's 0x0000
 *    end-of-program link - i.e. `PROGRAM_BASE + image.length` - which is the
 *    state a freshly-typed program leaves them in, with no variables, no arrays
 *    and no strings allocated yet. NEW is where that arithmetic comes from: it
 *    writes an empty program's two-byte null link at TXTTAB, sets VARTAB to the
 *    byte after it, and then copies VARTAB into ARYTAB and STREND.
 *
 * Returned as data rather than written here so the machine's `loadProgram` owns
 * the one place that touches machine memory, and so the pointer-consistency
 * test can check the arithmetic without a machine.
 */
export function basicImagePointers(image: Uint8Array): BasicPointer[] {
  const programEnd = PROGRAM_BASE + image.length;
  return [
    { address: TXTTAB, value: PROGRAM_BASE },
    { address: VARTAB, value: programEnd },
    { address: ARYTAB, value: programEnd },
    { address: STREND, value: programEnd },
  ];
}

/**
 * Parse a built image back into its tokenized program bytes: the link chain up
 * to and including the 0x0000 end-of-program marker, with anything after it
 * dropped (that is appended machine code, which the import path recovers as a
 * memory block). A chain that runs off the end of the data is returned as far
 * as it goes rather than throwing, per the dialect convention that structural
 * problems become warnings on the import path.
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
