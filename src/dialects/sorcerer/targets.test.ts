// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { sorcerer } from './index';
import { sorcererBuildTargets } from './targets';
import { sorcererSamples } from './samples';
import { PROGRAM_BASE } from './addresses';
import {
  TAPE_BASIC_MARK,
  TAPE_FILE_TYPE,
  parseTapeRecords,
  tapeName,
} from './tapeFile';
import { materializeSampleBlocks } from '../../app/sampleBlocks';
import type { Block } from '../types';

const HELLO = sorcererSamples.find((s) => s.name === 'hello.bas')!;

const target = (id: string) => sorcererBuildTargets.find((t) => t.id === id)!;

const build = async (
  id: string,
  source: string,
  opts: { programName: string; blocks?: readonly Block[] },
): Promise<Uint8Array> => {
  const [file] = await target(id).build(source, opts);
  return new Uint8Array(await file!.blob.arrayBuffer());
};

describe('sorcerer build targets', () => {
  it('offers the tape image first and cassette audio beside it', () => {
    expect(sorcererBuildTargets.map((t) => t.id)).toEqual([
      'sorcerer-tape',
      'wav',
    ]);
    expect(sorcererBuildTargets.map((t) => t.fileExtension)).toEqual([
      'tape',
      'wav',
    ]);
    // Both carry the document's memory blocks, so the Transfer dialog never
    // warns that exporting one of the block-carrying samples would drop them.
    expect(sorcererBuildTargets.every((t) => t.supportsBlocks)).toBe(true);
  });

  it('exports an Exidy tape record CSAVE would have written', async () => {
    const bytes = await build('sorcerer-tape', HELLO.text, {
      programName: 'hello',
    });
    const [record, ...rest] = parseTapeRecords(bytes);
    expect(rest).toEqual([]);
    expect(record!.name).toBe(tapeName('hello'));
    expect(record!.loadAddress).toBe(PROGRAM_BASE);
    expect(record!.execAddress).toBe(0);
    expect(record!.basic).toBe(true);

    // The payload is the program plus the one byte CSAVE saves past its end,
    // which is what leaves VARTAB right on the way back in.
    const { image } = sorcerer.tokenize(HELLO.text);
    expect(record!.payload).toHaveLength(image.length + 1);
    expect([...record!.payload.subarray(0, image.length)]).toEqual([...image]);
    expect(record!.payload.at(-1)).toBe(0);
  });

  it('writes one further record per memory block', async () => {
    const sample = sorcererSamples.find((s) => s.name === 'kaleido.bas')!;
    const blocks = materializeSampleBlocks(sorcerer, sample);
    expect(blocks.length).toBeGreaterThan(0);

    const bytes = await build('sorcerer-tape', sample.text, {
      programName: 'kaleido',
      blocks,
    });
    const records = parseTapeRecords(bytes);
    expect(records).toHaveLength(1 + blocks.length);
    expect(records[0]!.basic).toBe(true);

    records.slice(1).forEach((record, i) => {
      const block = blocks[i]!;
      // A memory-range file, not a CSAVE: the Monitor's own type mark and no
      // BASIC stamp on it.
      expect(record.basic).toBe(false);
      expect(record.name).toBe(tapeName(block.name));
      expect(record.loadAddress).toBe(block.address);
      expect([...record.payload]).toEqual([...block.bytes]);
    });
  });

  it('stamps the file type on every record', async () => {
    const bytes = await build('sorcerer-tape', HELLO.text, {
      programName: 'hello',
    });
    // The one byte that is not addressed through the parser: the type mark sits
    // at header offset 5 and the BASIC stamp at 6, both after the opening lead.
    const headerAt = bytes.indexOf(0x01) + 1;
    expect(bytes[headerAt + 5]).toBe(TAPE_FILE_TYPE);
    expect(bytes[headerAt + 6]).toBe(TAPE_BASIC_MARK);
  });

  it('refuses to export a program the machine could not load', async () => {
    // A line with no line number has nowhere to go in the program area, which
    // is the tokenizer's one fatal error here.
    await expect(
      build('sorcerer-tape', 'PRINT "HI"', { programName: 'bad' }),
    ).rejects.toThrow(/error/);
    await expect(
      build('sorcerer-tape', '', { programName: 'empty' }),
    ).rejects.toThrow(/empty/);
  });

  it('names the file after the document, not after the tape header', async () => {
    const [file] = await target('sorcerer-tape').build(HELLO.text, {
      programName: 'Kaleidoscope',
    });
    // The five-character limit is the tape header's, and it must not reach the
    // download name the browser saves.
    expect(file!.fileName).toBe('kaleidoscope.tape');
  });
});
