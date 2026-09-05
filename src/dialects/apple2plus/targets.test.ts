// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { apple2plus } from './index';
import { apple2plusBuildTargets } from './targets';
import { buildCassetteImage } from './audio/cassette';
import { tokenizeProgram } from './tokenizer';
import { importProgram } from '../../app/importProgram';

const SOURCE = '10 A = 1\n20 PRINT A\n30 GOTO 10\n';

const target = (id: string) => apple2plusBuildTargets.find((t) => t.id === id)!;

async function build(id: string, source = SOURCE): Promise<Blob> {
  const files = await target(id).build(source, {
    programName: 'Test',
    blocks: [],
    loader: false,
  });
  expect(files).toHaveLength(1);
  return files[0]!.blob;
}

describe('apple2plus build targets', () => {
  it('offers the cassette record, its audio and the listing', () => {
    expect(apple2plusBuildTargets.map((t) => [t.id, t.fileExtension])).toEqual([
      ['apple2plus-cassette-record', 'bin'],
      ['apple2plus-wav', 'wav'],
      ['apple2plus-listing', 'bas'],
    ]);
    // `SAVE` writes the program workspace and nothing else, and the block
    // window is page 3, so no target here carries the document's blocks.
    expect(apple2plusBuildTargets.some((t) => t.supportsBlocks)).toBe(false);
  });

  it('names the exported file after the document', async () => {
    const files = await target('apple2plus-cassette-record').build(SOURCE, {
      programName: 'Test',
      blocks: [],
      loader: false,
    });
    expect(files[0]!.fileName).toBe('test.bin');
  });

  it('exports the program exactly as it sits in memory', async () => {
    const bytes = new Uint8Array(
      await (await build('apple2plus-cassette-record')).arrayBuffer(),
    );
    // No container: the file is the load format, which is what lets the
    // importer hand it straight to `detokenize`.
    expect([...bytes]).toEqual([...tokenizeProgram(SOURCE).program]);
    expect([...bytes]).toEqual([...buildCassetteImage(SOURCE)]);
  });

  it('imports its own cassette record back', async () => {
    const bytes = new Uint8Array(
      await (await build('apple2plus-cassette-record')).arrayBuffer(),
    );
    const imported = importProgram(apple2plus, bytes);
    expect(imported.source).toBe(SOURCE);
    expect(imported.warnings).toEqual([]);
    expect(apple2plus.binaryImports).toEqual([
      { extension: '.bin', label: 'Import cassette record…' },
    ]);
  });

  it('exports the listing as text the editor reads straight back', async () => {
    expect(await (await build('apple2plus-listing')).text()).toBe(SOURCE);
  });

  it('refuses to export a program the machine could not load', async () => {
    await expect(build('apple2plus-listing', 'PRINT 1\n')).rejects.toThrow(
      /error/i,
    );
    await expect(build('apple2plus-cassette-record', '')).rejects.toThrow(
      /empty/i,
    );
  });
});

describe('the apple2plus tape seam', () => {
  it('round-trips a program through the audio the dialect offers', () => {
    const audio = apple2plus.audio!;
    const samples = audio.buildSamples(SOURCE, 'Test', false);
    const decoded = audio.decodeSamples!(samples, audio.sampleRate);
    expect(decoded.programName).toBe('');
    expect(decoded.source).toBe(SOURCE);
    expect(decoded.warnings).toEqual([]);
  });

  it('exports the .wav a sound card plays back, not the robust timings', async () => {
    // The file target builds at the ROM's own leader lengths; robust is the
    // Transfer dialog's play path, where a second pass costs the user nothing.
    const audio = apple2plus.audio!;
    const wav = new Uint8Array(
      await (await build('apple2plus-wav')).arrayBuffer(),
    );
    expect(String.fromCharCode(...wav.subarray(0, 4))).toBe('RIFF');
    const plain = audio.buildSamples(SOURCE, 'Test', false);
    // 44 bytes of WAV header, then 16-bit mono samples.
    expect(wav.length).toBe(44 + plain.length * 2);
  });

  it('tells the user which prompt to type LOAD and SAVE at', () => {
    const audio = apple2plus.audio!;
    const load =
      typeof audio.loadInstructions === 'string'
        ? audio.loadInstructions
        : audio.loadInstructions(SOURCE);
    // Applesoft's prompt, not the sibling's `>`, and no workspace bounds to
    // type first: this machine's program is always at $0801.
    expect(load).toContain('LOAD at the ] prompt');
    expect(load).not.toMatch(/LOMEM|HIMEM/);
    expect(audio.saveInstructions).toContain('SAVE at the ] prompt');
  });

  it('reports silence rather than importing an empty program', () => {
    // The seam's contract: a recording with nothing on it throws, because an
    // empty result would look to the Import dialog like a successful load.
    // What a *damaged* tape does - warn, and hand the bytes over - is
    // `audio/cassette.ts`'s own question and is checked there.
    const audio = apple2plus.audio!;
    expect(() =>
      audio.decodeSamples!(new Float32Array(44_100), audio.sampleRate),
    ).toThrow(/No cassette signal/);
  });
});
