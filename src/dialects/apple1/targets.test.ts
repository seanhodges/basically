// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { apple1 } from './index';
import { apple1BuildTargets } from './targets';
import { ZP_BLOCK_BYTES } from './addresses';
import { buildCassetteImage } from './audio/aciEncoder';
import { importProgram } from '../../app/importProgram';

const SOURCE = '10 A=1\n20 PRINT A\n30 GOTO 10';

const target = (id: string) => apple1BuildTargets.find((t) => t.id === id)!;

async function build(id: string, source = SOURCE): Promise<Blob> {
  const files = await target(id).build(source, {
    programName: 'Test',
    blocks: [],
    loader: false,
  });
  expect(files).toHaveLength(1);
  return files[0]!.blob;
}

describe('apple1 targets', () => {
  it('offers the cassette dump, its audio and the listing', () => {
    expect(apple1BuildTargets.map((t) => [t.id, t.fileExtension])).toEqual([
      ['apple1-cassette-dump', 'bin'],
      ['apple1-wav', 'wav'],
      ['apple1-listing', 'bas'],
    ]);
    // The ranges the interface writes start at $0800; memory blocks live below
    // LOMEM, so nothing here carries them.
    expect(apple1BuildTargets.some((t) => t.supportsBlocks)).toBe(false);
  });

  it('names the exported file after the document', async () => {
    const files = await target('apple1-cassette-dump').build(SOURCE, {
      programName: 'Test',
      blocks: [],
      loader: false,
    });
    expect(files[0]!.fileName).toBe('test.bin');
  });

  it('exports the two ranges an ACI dump holds', async () => {
    const bytes = new Uint8Array(
      await (await build('apple1-cassette-dump')).arrayBuffer(),
    );
    expect([...bytes]).toEqual([...buildCassetteImage(SOURCE)]);
    expect(bytes).toHaveLength(ZP_BLOCK_BYTES + 2048);
  });

  it('imports its own cassette dump back', async () => {
    const bytes = new Uint8Array(
      await (await build('apple1-cassette-dump')).arrayBuffer(),
    );
    expect(importProgram(apple1, bytes).source).toBe(SOURCE);
    expect(apple1.binaryImports).toEqual([
      { extension: '.bin', label: 'Import cassette dump…' },
    ]);
  });

  it('exports the listing as text the editor reads straight back', async () => {
    expect(await (await build('apple1-listing')).text()).toBe(`${SOURCE}\n`);
  });

  it('refuses to export a program the machine could not load', async () => {
    await expect(build('apple1-listing', '10 PRINT "')).rejects.toThrow(
      /error/i,
    );
    await expect(build('apple1-cassette-dump', '')).rejects.toThrow(/empty/i);
  });
});
