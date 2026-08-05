// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { altair8800BuildTargets, buildPaperTape } from './targets';
import { altair8800 } from './index';
import { detokenizeProgram } from './detokenizer';
import { decodeCassette } from './audio/cassetteDecoder';
import { CASSETTE_SAMPLE_RATE } from './audio/cassetteEncoder';

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
  const target = altair8800BuildTargets.find((t) => t.id === id)!;
  const files = await target.build(source, { programName });
  expect(files).toHaveLength(1);
  return {
    fileName: files[0]!.fileName,
    bytes: new Uint8Array(await files[0]!.blob.arrayBuffer()),
  };
}

describe('altair8800 build targets', () => {
  it('offers the three formats the machine actually had', () => {
    expect(altair8800BuildTargets.map((t) => t.id)).toEqual([
      'altair-csave',
      'wav',
      'altair-paper-tape',
    ]);
    // Nothing here carries memory blocks: CSAVE wrote the program area only.
    expect(altair8800BuildTargets.some((t) => t.supportsBlocks)).toBe(false);
  });

  it('exports a CSAVE image that imports back byte-exact', async () => {
    const { fileName, bytes } = await build('altair-csave');
    expect(fileName).toBe('hello.bin');
    expect(Array.from(bytes.subarray(0, 4))).toEqual([0xd3, 0xd3, 0xd3, 0x48]);
    expect(detokenizeProgram(bytes)).toBe(SOURCE);
  });

  it('exports cassette audio that decodes back to the program', async () => {
    const { fileName, bytes } = await build('wav');
    expect(fileName).toBe('hello.wav');
    const { samples, sampleRate } = readWav(bytes);
    expect(sampleRate).toBe(CASSETTE_SAMPLE_RATE);
    const { programName, data } = decodeCassette(samples, sampleRate);
    expect(programName).toBe('H');
    expect(detokenizeProgram(data)).toBe(SOURCE);
  });

  it('exports a paper tape as CR LF ASCII', async () => {
    const { fileName, bytes } = await build('altair-paper-tape');
    expect(fileName).toBe('hello.txt');
    expect(String.fromCharCode(...bytes)).toBe('10 PRINT "HI"\r\n20 END\r\n');
  });

  it('punches escaped bytes as themselves', () => {
    // {0x07} is a bell: the tape carries the control code, not its spelling.
    const tape = buildPaperTape('10 PRINT "{0x07}"\n');
    expect(Array.from(tape.slice(-5))).toEqual([0x22, 0x07, 0x22, 0x0d, 0x0a]);
  });

  it('refuses an empty or broken program on every target', () => {
    for (const target of altair8800BuildTargets) {
      // The targets raise from the build call itself, as the other dialects'
      // do; the Transfer dialog awaits them inside its own try/catch.
      expect(() => target.build('', { programName: 'X' })).toThrow(/empty/i);
      expect(() =>
        target.build('10 PRINT "{0x00}"\n', { programName: 'X' }),
      ).toThrow(/error/i);
    }
  });

  it('reads the exported image back through the dialect seam', async () => {
    const { bytes } = await build('altair-csave');
    const report = altair8800.detokenizeWithReport!(bytes);
    expect(report.warnings).toEqual([]);
    expect(altair8800.tokenize(report.source).errors).toEqual([]);
  });
});
