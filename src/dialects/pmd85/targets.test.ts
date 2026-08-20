// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { pmd85BuildTargets } from './targets';
import { pmd85 } from './index';
import { detokenizeProgram } from './detokenizer';
import { tokenizeProgram } from './tokenizer';
import { CASSETTE_SAMPLE_RATE } from './audio/cassetteEncoder';
import { decodePmd85Tape } from './audio/cassetteDecoder';
import {
  BASIC_FILE_TYPE,
  DEFAULT_FILE_NUMBER,
  HEADER_BLOCK_BYTES,
  parseTapeImage,
  programFromTapeFile,
} from './tape';
import { PROGRAM_BASE } from './addresses';

const SOURCE = '10 PRINT "HI"\n20 END\n';

/** Unpack the 16-bit mono PCM `samplesToWav` writes, header and all. */
function readWav(bytes: Uint8Array): {
  samples: Float32Array;
  sampleRate: number;
} {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const sampleRate = view.getUint32(24, true);
  const count = view.getUint32(40, true) / 2;
  const samples = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    samples[i] = view.getInt16(44 + i * 2, true) / 0x7fff;
  }
  return { samples, sampleRate };
}

async function build(id: string, source = SOURCE, programName = 'HELLO') {
  const target = pmd85BuildTargets.find((t) => t.id === id)!;
  const files = await target.build(source, { programName });
  expect(files).toHaveLength(1);
  return {
    fileName: files[0]!.fileName,
    bytes: new Uint8Array(await files[0]!.blob.arrayBuffer()),
  };
}

describe('pmd85 build targets', () => {
  it('offers the two tape framings and the cassette audio', () => {
    expect(pmd85BuildTargets.map((t) => t.id)).toEqual([
      'pmd85-ptp',
      'pmd85-pmd',
      'wav',
    ]);
    // Nothing here carries memory blocks: BASIC-G's SAVE writes the program
    // area and nothing else.
    expect(pmd85BuildTargets.some((t) => t.supportsBlocks)).toBe(false);
    // Both file formats are offered back on the Import dialog.
    expect(pmd85.binaryImports?.map((f) => f.extension)).toEqual([
      '.ptp',
      '.pmd',
    ]);
  });

  it('exports a .ptp tape that imports back byte-exact', async () => {
    const { fileName, bytes } = await build('pmd85-ptp');
    expect(fileName).toBe('hello.ptp');
    // A length in front of every block: 63 for the header, then the body.
    expect(bytes[0]! | (bytes[1]! << 8)).toBe(HEADER_BLOCK_BYTES);
    const { files, warnings } = parseTapeImage(bytes);
    expect(warnings).toEqual([]);
    expect(files[0]!.header).toEqual({
      number: DEFAULT_FILE_NUMBER,
      type: BASIC_FILE_TYPE,
      start: PROGRAM_BASE,
      name: 'HELLO',
    });
    expect(Array.from(programFromTapeFile(files[0]!))).toEqual(
      Array.from(tokenizeProgram(SOURCE).program),
    );
    expect(detokenizeProgram(bytes)).toBe(SOURCE);
  });

  it('exports a .pmd file that imports back byte-exact', async () => {
    const { fileName, bytes } = await build('pmd85-pmd');
    expect(fileName).toBe('hello.pmd');
    // No length fields: the header block starts at byte zero.
    expect(bytes[0]).toBe(0xff);
    expect(detokenizeProgram(bytes)).toBe(SOURCE);
  });

  it('exports cassette audio that decodes back to the program', async () => {
    const { fileName, bytes } = await build('wav');
    expect(fileName).toBe('hello.wav');
    const { samples, sampleRate } = readWav(bytes);
    expect(sampleRate).toBe(CASSETTE_SAMPLE_RATE);
    const tape = parseTapeImage(decodePmd85Tape(samples, sampleRate));
    expect(tape.warnings).toEqual([]);
    expect(detokenizeProgram(programFromTapeFile(tape.files[0]!))).toBe(SOURCE);
  });

  it('refuses to export a program with errors', async () => {
    // The checksum in the header would agree with a half-built image, so a
    // broken program has to fail here rather than on tape.
    await expect(
      build('pmd85-ptp', 'PRINT "NO LINE NUMBER"\n'),
    ).rejects.toThrow(/error/i);
  });
});
