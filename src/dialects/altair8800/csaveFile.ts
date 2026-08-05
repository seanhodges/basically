// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { plainChar } from './charset';

/**
 * The byte stream 8K BASIC's `CSAVE` writes and its `CLOAD` reads back - the
 * Altair's one and only program file format.
 *
 * There is no container here in the sense the other dialects have one: no load
 * address, no block structure, no length field and no checksum. A saved program
 * is four header bytes and then the tokenized program exactly as it sits in
 * memory from `PROGRAM_BASE`, terminated by its own 0x0000 end-of-program link:
 *
 * ```
 *   D3 D3 D3 <name>  <tokenized program …>  00 00
 *   ^^^^^^^^ ^^^^^^  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
 *   marker   1 char  exactly what tokenizeProgram() produces
 * ```
 *
 * **Derived, not guessed.** The MITS *Altair 8800 BASIC Reference Manual*
 * (4.1, July 1977), Appendix F, gives the ports and the rule that "the program
 * currently in memory is saved on cassette under the name specified by the
 * first character of the string expression", and that on the way back in
 * "reading continues until 3 consecutive zeros are read". The byte layout above
 * was read off the running interpreter: the 8K BASIC 4.0 image booted on this
 * dialect's own emulator with a stub 88-ACR on ports 6/7, `10 PRINT "HI" /
 * 20 END` typed at its console, and `CSAVE"ABC"` captured at the data port -
 * which wrote, in order,
 *
 * ```
 *   D3 D3 D3 41 | 44 19 0A 00 96 20 22 48 49 22 00 | 4A 19 14 00 80 00 | 00 00
 * ```
 *
 * i.e. the marker, `A` (the *first* character of "ABC", not the whole string),
 * and then the two line records and the null link, byte for byte. `CSAVE` on an
 * empty program writes `D3 D3 D3 <name> 00 00` and nothing else, which is why
 * the "3 consecutive zeros" the manual describes are the last line's 0x00
 * terminator plus the end-of-program link rather than a separate trailer.
 * Feeding the captured bytes back to `CLOAD"A"` reproduces the program, and a
 * tape holding a file named `B` ahead of the wanted `A` is skipped rather than
 * loaded - which is what the marker scan below models.
 *
 * The three 0xD3 bytes are the same tokenized-BASIC marker Microsoft went on to
 * use in TRS-80 Level II (`src/dialects/trs80/casfile.ts`, behind a 0xA5 sync)
 * and in MSX; the Altair is where it starts, with no leader and no sync byte in
 * front of it because the 88-ACR's idle mark tone already gives the receiver
 * something to lock onto.
 */

/** The tokenized-BASIC file marker, written three times. */
export const CSAVE_MARKER = 0xd3;

/** How many {@link CSAVE_MARKER} bytes precede the name. */
export const CSAVE_MARKER_COUNT = 3;

/** Header length: the marker bytes plus the one-character name. */
export const CSAVE_HEADER_BYTES = CSAVE_MARKER_COUNT + 1;

/** Name used when a document's title has no character the tape can carry. */
const DEFAULT_NAME = 'A';

/**
 * The single byte that names a program on tape.
 *
 * BASIC takes the first character of the `CSAVE` argument verbatim, so a
 * lower-case name really does store a lower-case byte. This folds to upper case
 * anyway: the console is an ASR-33, whose keyboard cannot produce lower case at
 * all, so a tape named `h` could never be asked for again from the machine
 * itself. A title with no printable ASCII in it falls back to {@link
 * DEFAULT_NAME} rather than writing a byte the terminal cannot show.
 */
export function csaveNameByte(programName: string): number {
  for (const ch of programName.toUpperCase()) {
    const code = ch.codePointAt(0)!;
    if (plainChar(code) !== undefined && code !== 0x20) return code;
  }
  return DEFAULT_NAME.charCodeAt(0);
}

/** Wrap tokenized program bytes in the `CSAVE` header. */
export function buildCsaveStream(
  program: Uint8Array,
  programName: string,
): Uint8Array {
  const out = new Uint8Array(CSAVE_HEADER_BYTES + program.length);
  out.fill(CSAVE_MARKER, 0, CSAVE_MARKER_COUNT);
  out[CSAVE_MARKER_COUNT] = csaveNameByte(programName);
  out.set(program, CSAVE_HEADER_BYTES);
  return out;
}

/** One program recovered from a `CSAVE` byte stream. */
export interface CsaveFile {
  /** The one-character name from the header. */
  name: string;
  /** Tokenized program bytes, from the header to the end of the stream. */
  program: Uint8Array;
  /** Index of the first marker byte, so a caller can report where it started. */
  start: number;
}

/**
 * Find the first `CSAVE` file in a byte stream and return its name and program
 * bytes.
 *
 * Modelled on what `CLOAD` does with the tape: scan forward for the marker run
 * rather than assuming the file starts at byte 0, because a recording usually
 * opens with whatever noise the decoder made of the leader tone, and a tape can
 * hold several programs one after another. Everything from just past the name
 * to the end of the stream is handed back as program bytes - trimming it to the
 * end-of-program link is `parseBasicImage`'s job, and keeping the tail means an
 * appended machine-code block survives to be reported by the importer.
 *
 * Returns null when no marker run is present, which is the caller's cue that
 * this is not an Altair tape at all.
 */
export function findCsaveFile(bytes: Uint8Array): CsaveFile | null {
  for (let i = 0; i + CSAVE_HEADER_BYTES <= bytes.length; i++) {
    let marked = true;
    for (let m = 0; m < CSAVE_MARKER_COUNT; m++) {
      if (bytes[i + m] !== CSAVE_MARKER) {
        marked = false;
        break;
      }
    }
    if (!marked) continue;
    const nameByte = bytes[i + CSAVE_MARKER_COUNT]!;
    return {
      name: plainChar(nameByte) ?? '',
      program: bytes.slice(i + CSAVE_HEADER_BYTES),
      start: i,
    };
  }
  return null;
}

/** True when `bytes` open with the `CSAVE` marker run. */
export function hasCsaveHeader(bytes: Uint8Array): boolean {
  if (bytes.length < CSAVE_HEADER_BYTES) return false;
  for (let m = 0; m < CSAVE_MARKER_COUNT; m++) {
    if (bytes[m] !== CSAVE_MARKER) return false;
  }
  return true;
}
