// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { hb10p } from './index';
import { hb10pSamples } from './samples';
import { hb10pBuildTargets } from './targets';
import { BAS_TOKENIZED_MARKER } from './basfile';
import { CAS_BLOCK_MARKER } from './casfile';
import { tokenizeProgram } from './tokenizer';
import { importProgram } from '../../app/importProgram';

const SOURCE = '10 PRINT "HELLO"\n20 GOTO 10';

const target = (id: string) => hb10pBuildTargets.find((t) => t.id === id)!;

async function build(id: string, source = SOURCE): Promise<Uint8Array> {
  const files = await target(id).build(source, { programName: 'Test' });
  expect(files).toHaveLength(1);
  return new Uint8Array(await files[0]!.blob.arrayBuffer());
}

describe('hb10p build targets', () => {
  it('offers the program file and the two cassette forms', () => {
    expect(hb10pBuildTargets.map((t) => [t.id, t.fileExtension])).toEqual([
      ['hb10p-bas', 'bas'],
      ['hb10p-cas', 'cas'],
      ['hb10p-wav', 'wav'],
    ]);
    // SAVE and CSAVE both write the program area and nothing else, so no target
    // here can carry the document's memory blocks.
    expect(hb10pBuildTargets.some((t) => t.supportsBlocks)).toBe(false);
  });

  it('names every exported file after the document', async () => {
    for (const t of hb10pBuildTargets) {
      const [file] = await t.build(SOURCE, { programName: 'Test' });
      expect(file!.fileName).toBe(`test.${t.fileExtension}`);
    }
  });

  it('refuses a program the machine could not load back', async () => {
    await expect(build('hb10p-bas', 'PRINT "HI"')).rejects.toThrow(
      'Program has 1 error(s) - fix them before building',
    );
    await expect(build('hb10p-cas', '\n\n')).rejects.toThrow(
      'Program is empty',
    );
  });

  it('exports a .bas file the machine can load', async () => {
    const bytes = await build('hb10p-bas');
    expect(bytes[0]).toBe(BAS_TOKENIZED_MARKER);
    expect(Array.from(bytes.slice(1))).toEqual(
      Array.from(tokenizeProgram(SOURCE).bytes),
    );
    expect(importProgram(hb10p, bytes).source).toBe(SOURCE);
  });

  it('carries every bundled sample through a .cas and back', async () => {
    for (const sample of hb10pSamples) {
      const [file] = await target('hb10p-cas').build(sample.text, {
        programName: 'TEST',
      });
      const bytes = new Uint8Array(await file!.blob.arrayBuffer());
      expect(importProgram(hb10p, bytes).source, sample.name).toBe(
        sample.text.trimEnd(),
      );
    }
  });

  it('frames each tape block in a .cas image, and imports it back', async () => {
    const bytes = await build('hb10p-cas');
    expect(Array.from(bytes.slice(0, CAS_BLOCK_MARKER.length))).toEqual(
      Array.from(CAS_BLOCK_MARKER),
    );
    const imported = importProgram(hb10p, bytes);
    expect(imported.source).toBe(SOURCE);
    expect(imported.warnings).toEqual([]);
  });
});
