// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The container, checked field by field. What proves the *layout* is right is
 * `emulator/tape.test.ts`, which makes the shipped ROM write a tape and
 * compares it with what this module builds; here the concern is the two
 * framings, the checksums, and what a damaged tape reports.
 */

import { describe, expect, it } from 'vitest';
import {
  BASIC_FILE_TYPE,
  DEFAULT_FILE_NUMBER,
  HEADER_BLOCK_BYTES,
  buildHeaderBlock,
  buildPmdImage,
  buildPtpImage,
  firstProgramFile,
  isPtpImage,
  isFlatTapeImage,
  parseTapeImage,
  programFromTapeFile,
  programTapeFile,
  tapeChecksum,
  tapeHeaderName,
  type Pmd85TapeFile,
} from './tape';
import { PROGRAM_BASE } from './addresses';

const PROGRAM = Uint8Array.of(0x0a, 0x24, 0x0a, 0x00, 0x8e, 0x00, 0x00, 0x00);

function file(name = 'GAME', number = DEFAULT_FILE_NUMBER): Pmd85TapeFile {
  return programTapeFile(PROGRAM, { name, number, start: PROGRAM_BASE });
}

describe('pmd85 tape container', () => {
  it('lays the header block out as the machine writes it', () => {
    const block = buildHeaderBlock(file());
    expect(block).toHaveLength(HEADER_BLOCK_BYTES);
    expect(Array.from(block.subarray(0, 16))).toEqual(
      Array<number>(16).fill(0xff),
    );
    expect(Array.from(block.subarray(16, 32))).toEqual(
      Array<number>(16).fill(0x00),
    );
    expect(Array.from(block.subarray(32, 48))).toEqual(
      Array<number>(16).fill(0x55),
    );
    expect(block[48]).toBe(DEFAULT_FILE_NUMBER);
    expect(block[49]).toBe(BASIC_FILE_TYPE);
    expect(block[50]! | (block[51]! << 8)).toBe(PROGRAM_BASE);
    // The length field is one less than the body, and the body is one longer
    // than the program - so the field is the program's own length.
    expect(block[52]! | (block[53]! << 8)).toBe(PROGRAM.length);
    expect(String.fromCharCode(...block.subarray(54, 62))).toBe('GAME    ');
    expect(block[62]).toBe(tapeChecksum(block.subarray(48, 62)));
  });

  it('saves one byte more than the program, the one at VARTAB', () => {
    const saved = file();
    expect(saved.bytes).toHaveLength(PROGRAM.length + 1);
    expect(Array.from(programFromTapeFile(saved))).toEqual(Array.from(PROGRAM));
  });

  it('trims and pads a name to the eight characters the header holds', () => {
    expect(tapeHeaderName('kaleido')).toBe('KALEIDO ');
    expect(tapeHeaderName('a very long name')).toBe('A VERY L');
    // Nothing the Monitor's character generator cannot draw travels in a name.
    expect(tapeHeaderName('cafè')).toBe('CAF-    ');
  });

  it('frames a .ptp with a length in front of every block', () => {
    const image = buildPtpImage([file()]);
    expect(isPtpImage(image)).toBe(true);
    expect(isFlatTapeImage(image)).toBe(false);
    expect(image[0]! | (image[1]! << 8)).toBe(HEADER_BLOCK_BYTES);
    const bodyAt = 2 + HEADER_BLOCK_BYTES;
    expect(image[bodyAt]! | (image[bodyAt + 1]! << 8)).toBe(PROGRAM.length + 2);
    expect(image).toHaveLength(2 + 63 + 2 + PROGRAM.length + 2);
  });

  it('frames a .pmd with the blocks back to back', () => {
    const image = buildPmdImage(file());
    expect(isFlatTapeImage(image)).toBe(true);
    expect(isPtpImage(image)).toBe(false);
    expect(image).toHaveLength(63 + PROGRAM.length + 2);
  });

  it('reads both framings back to the same file', () => {
    for (const image of [buildPtpImage([file()]), buildPmdImage(file())]) {
      const parse = parseTapeImage(image);
      expect(parse.warnings).toEqual([]);
      expect(parse.files).toHaveLength(1);
      expect(parse.files[0]!.header).toEqual({
        number: DEFAULT_FILE_NUMBER,
        type: BASIC_FILE_TYPE,
        start: PROGRAM_BASE,
        name: 'GAME',
      });
      expect(Array.from(parse.files[0]!.bytes)).toEqual(
        Array.from(file().bytes),
      );
    }
  });

  it('reads a multi-file .ptp and opens the program on it', () => {
    const data: Pmd85TapeFile = {
      header: { number: 7, type: 0x44, start: 0x7000, name: 'SCORES' },
      bytes: Uint8Array.of(1, 2, 3, 4),
    };
    const parse = parseTapeImage(buildPtpImage([data, file()]));
    expect(parse.warnings).toEqual([]);
    expect(parse.files.map((f) => f.header.name)).toEqual(['SCORES', 'GAME']);

    const { file: program, warnings } = firstProgramFile(parse);
    expect(program!.header.name).toBe('GAME');
    expect(warnings).toEqual([
      '1 other file on the tape was kept with the document; the program is ' +
        'what opened for editing.',
    ]);
  });

  it('keeps a headerless block rather than losing it', () => {
    const raw = Uint8Array.of(9, 8, 7);
    const image = new Uint8Array(2 + raw.length);
    image.set([raw.length, 0]);
    image.set(raw, 2);
    const both = new Uint8Array(image.length + buildPtpImage([file()]).length);
    both.set(image);
    both.set(buildPtpImage([file()]), image.length);

    const parse = parseTapeImage(both);
    expect(parse.headerless).toHaveLength(1);
    expect(Array.from(parse.headerless[0]!)).toEqual([9, 8, 7]);
    expect(parse.files).toHaveLength(1);
    expect(parse.warnings).toEqual([
      'A 3-byte block with no header was not opened — what is in one is the ' +
        'business of the program that wrote it.',
    ]);
  });

  it('reports a bad checksum but keeps the bytes', () => {
    const image = buildPmdImage(file());
    image[image.length - 1] = (image[image.length - 1]! + 1) & 0xff;
    const parse = parseTapeImage(image);
    expect(parse.warnings).toEqual([
      'The body of file 1 did not checksum — it may have read back with errors.',
    ]);
    expect(Array.from(parse.files[0]!.bytes)).toEqual(Array.from(file().bytes));
  });

  it('says so when a tape has no program on it', () => {
    const data: Pmd85TapeFile = {
      header: { number: 3, type: 0x44, start: 0x7000, name: 'DATA' },
      bytes: Uint8Array.of(1, 2),
    };
    const { file: found, warnings } = firstProgramFile(
      parseTapeImage(buildPtpImage([data])),
    );
    expect(found).toBeNull();
    expect(warnings).toEqual([
      'The tape holds no BASIC-G program — its files are of type "D".',
    ]);
  });

  it('stops on a tape that ends mid-file', () => {
    const image = buildPmdImage(file()).subarray(0, 63 + 2);
    const parse = parseTapeImage(image);
    expect(parse.files).toHaveLength(1);
    expect(parse.warnings.join(' ')).toContain('carries 1 bytes where its');
  });
});
