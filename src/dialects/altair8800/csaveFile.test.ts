// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import {
  CSAVE_HEADER_BYTES,
  buildCsaveStream,
  csaveNameByte,
  findCsaveFile,
  hasCsaveHeader,
} from './csaveFile';
import { buildCsaveImage } from './audio/cassetteEncoder';
import { detokenizeProgram, detokenizeProgramWithReport } from './detokenizer';
import { tokenizeProgram } from './tokenizer';

/**
 * The console-derived reference tape.
 *
 * These are the exact bytes the real 8K BASIC 4.0 image wrote to the 88-ACR
 * data port when `CSAVE"ABC"` was typed at its console with
 *
 *     10 PRINT "HI"
 *     20 END
 *
 * in memory - captured by booting the image on this dialect's own emulator with
 * a stub ACR on ports 6/7 (the same method the token table came from).
 * It pins three separate claims at once: the marker is three 0xD3 bytes, the
 * name is the *first* character of the argument and nothing else, and the body
 * is the tokenizer's own output byte for byte with no length, checksum or
 * trailer around it.
 */
const REFERENCE_SOURCE = '10 PRINT "HI"\n20 END\n';
const REFERENCE_TAPE = Uint8Array.from([
  0xd3, 0xd3, 0xd3, 0x41, 0x44, 0x19, 0x0a, 0x00, 0x96, 0x20, 0x22, 0x48, 0x49,
  0x22, 0x00, 0x4a, 0x19, 0x14, 0x00, 0x80, 0x00, 0x00, 0x00,
]);

describe('CSAVE tape stream', () => {
  it('matches the bytes the real interpreter wrote', () => {
    expect(Array.from(buildCsaveImage(REFERENCE_SOURCE, 'ABC'))).toEqual(
      Array.from(REFERENCE_TAPE),
    );
  });

  it('carries the tokenizer output verbatim after the header', () => {
    const { program } = tokenizeProgram(REFERENCE_SOURCE);
    expect(Array.from(REFERENCE_TAPE.subarray(CSAVE_HEADER_BYTES))).toEqual(
      Array.from(program),
    );
  });

  it('names a tape with one upper-case character', () => {
    expect(csaveNameByte('ABC')).toBe(0x41);
    expect(csaveNameByte('hello')).toBe(0x48); // the ASR-33 has no lower case
    expect(csaveNameByte('  maze')).toBe(0x4d); // leading spaces are not a name
    expect(csaveNameByte('')).toBe(0x41); // fall back rather than punch nothing
    expect(csaveNameByte('café'.slice(3))).toBe(0x41); // no printable ASCII
  });

  it('finds a file after leading noise, and skips nothing else', () => {
    const noisy = Uint8Array.from([0xff, 0x00, 0x7f, ...REFERENCE_TAPE]);
    const file = findCsaveFile(noisy)!;
    expect(file.start).toBe(3);
    expect(file.name).toBe('A');
    expect(Array.from(file.program)).toEqual(
      Array.from(REFERENCE_TAPE.subarray(CSAVE_HEADER_BYTES)),
    );
  });

  it('reports no file when the marker is absent', () => {
    expect(findCsaveFile(Uint8Array.from([0xd3, 0xd3, 0x41, 0x00]))).toBeNull();
    expect(hasCsaveHeader(Uint8Array.from([0xd3, 0xd3, 0x41, 0x00]))).toBe(
      false,
    );
  });

  it('imports as either a tape image or a bare program image', () => {
    const bare = REFERENCE_TAPE.subarray(CSAVE_HEADER_BYTES);
    expect(detokenizeProgram(REFERENCE_TAPE)).toBe(detokenizeProgram(bare));
    expect(detokenizeProgram(REFERENCE_TAPE)).toBe(REFERENCE_SOURCE);
  });

  it('reports appended bytes on a tape image at the right address', () => {
    const withCode = Uint8Array.from([...REFERENCE_TAPE, 0xc9]);
    const report = detokenizeProgramWithReport(withCode);
    expect(report.blocks).toHaveLength(1);
    // The block sits just past the program, not past the tape header too.
    expect(report.blocks![0]!.address).toBe(
      0x1939 + REFERENCE_TAPE.length - CSAVE_HEADER_BYTES,
    );
  });

  it('round-trips a name through build and find', () => {
    const { program } = tokenizeProgram(REFERENCE_SOURCE);
    const file = findCsaveFile(buildCsaveStream(program, 'MAZE'))!;
    expect(file.name).toBe('M');
  });
});
