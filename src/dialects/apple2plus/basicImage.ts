// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { BasicPointer } from '../../emulator/microsoftBasicLoad';
import { ARYTAB, PROGRAM_BASE, STREND, VARTAB } from './addresses';

/**
 * The loadable image, and the workspace words that have to agree with it.
 *
 * There is nothing to build. Applesoft's program is a linked list from a fixed
 * `$0801` - two-byte absolute link, two-byte line number, tokenized text, a
 * `$00`, and a zero link to finish - which is exactly what the tokenizer
 * already emits, so the image is those bytes and `buildBasicImage` exists to
 * say so rather than to do anything. That is the real difference from the
 * sibling next door, whose image carries a two-byte length header because its
 * interpreter grows the program *down* from `HIMEM:` and has to be told how far.
 *
 * What does take care is {@link basicImagePointers}. Writing the bytes is half
 * a load: BASIC finds the end of the program - and so where its variables start
 * - through the zero-page words below, and a program whose bytes are right but
 * whose pointers still describe the last one runs into its own leftovers.
 */

/** The image is the program. Present as the seam, not as a transformation. */
export function buildBasicImage(program: Uint8Array): Uint8Array {
  return program;
}

/** And back again, for symmetry with the machines that do wrap their images. */
export function parseBasicImage(image: Uint8Array): { program: Uint8Array } {
  return { program: image };
}

/**
 * Where the program ends, as the interpreter records it.
 *
 * **The byte after the zero link, and no further.** Typing a program in at the
 * `]` prompt and reading `VARTAB` back gives `$0801 + length` exactly, the
 * length counting the two-byte zero link the tokenizer already emits. The
 * figure is also what `SAVE` puts on tape as its length field, so a pointer a
 * byte out here writes a record a byte longer than the machine's.
 */
export function programEnd(image: Uint8Array): number {
  return PROGRAM_BASE + image.length;
}

/**
 * The workspace words an injected image requires, for
 * `loadMicrosoftBasicProgram`'s `pointers`.
 *
 * The three that describe the program are set and no others: `FRETOP` and
 * `MEMSIZ` are the cold start's and a load does not move them, and `RUN` clears
 * the variables itself the moment it starts - which is why the machine types
 * `RUN` rather than jumping into the program.
 */
export function basicImagePointers(image: Uint8Array): BasicPointer[] {
  const end = programEnd(image);
  return [
    { address: VARTAB, value: end },
    { address: ARYTAB, value: end },
    { address: STREND, value: end },
  ];
}
