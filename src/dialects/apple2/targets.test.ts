// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { apple2 } from './index';
import { apple2BuildTargets } from './targets';
import { buildCassetteImage } from './audio/cassetteEncoder';
import { IMAGE_HEADER_BYTES } from './basicImage';
import { tokenizeProgram } from './tokenizer';
import { importProgram } from '../../app/importProgram';

const SOURCE = '10 A=1\n20 PRINT A\n30 GOTO 10';

const target = (id: string) => apple2BuildTargets.find((t) => t.id === id)!;

async function build(id: string, source = SOURCE): Promise<Blob> {
  const files = await target(id).build(source, {
    programName: 'Test',
    blocks: [],
    loader: false,
  });
  expect(files).toHaveLength(1);
  return files[0]!.blob;
}

describe('apple2 build targets', () => {
  it('offers the cassette record, its audio and the listing', () => {
    expect(apple2BuildTargets.map((t) => [t.id, t.fileExtension])).toEqual([
      ['apple2-cassette-record', 'bin'],
      ['apple2-wav', 'wav'],
      ['apple2-listing', 'bas'],
    ]);
    // `SAVE` writes the program workspace and nothing else, and the block
    // window is page 3, so no target here carries the document's blocks.
    expect(apple2BuildTargets.some((t) => t.supportsBlocks)).toBe(false);
  });

  it('names the exported file after the document', async () => {
    const files = await target('apple2-cassette-record').build(SOURCE, {
      programName: 'Test',
      blocks: [],
      loader: false,
    });
    expect(files[0]!.fileName).toBe('test.bin');
  });

  it('exports the length-prefixed record SAVE writes', async () => {
    const bytes = new Uint8Array(
      await (await build('apple2-cassette-record')).arrayBuffer(),
    );
    const { program } = tokenizeProgram(SOURCE);
    expect([...bytes]).toEqual([...buildCassetteImage(SOURCE)]);
    expect(bytes).toHaveLength(IMAGE_HEADER_BYTES + program.length);
  });

  it('imports its own cassette record back', async () => {
    const bytes = new Uint8Array(
      await (await build('apple2-cassette-record')).arrayBuffer(),
    );
    expect(importProgram(apple2, bytes).source).toBe(SOURCE);
    expect(apple2.binaryImports).toEqual([
      { extension: '.bin', label: 'Import cassette record…' },
    ]);
  });

  it('exports the listing as text the editor reads straight back', async () => {
    expect(await (await build('apple2-listing')).text()).toBe(`${SOURCE}\n`);
  });

  it('refuses to export a program the machine could not load', async () => {
    await expect(build('apple2-listing', '10 PRINT "')).rejects.toThrow(
      /error/i,
    );
    await expect(build('apple2-cassette-record', '')).rejects.toThrow(/empty/i);
  });
});
