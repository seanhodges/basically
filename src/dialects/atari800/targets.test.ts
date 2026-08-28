// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { atari800 } from './index';
import { atari400 } from '../atari400/index';
import { atariBuildTargets, buildTokenizedImage } from './targets';
import { tokenizeProgram } from './tokenizer';
import { ATASCII_EOL } from './atascii';
import { importProgram } from '../../app/importProgram';

const SOURCE = '10 PRINT "HELLO"\n20 GOTO 10';

const target = (id: string) => atariBuildTargets.find((t) => t.id === id)!;

async function build(id: string, source = SOURCE): Promise<Uint8Array> {
  const files = await target(id).build(source, {
    programName: 'Test',
    blocks: [],
    loader: false,
  });
  expect(files).toHaveLength(1);
  return new Uint8Array(await files[0]!.blob.arrayBuffer());
}

describe('atari build targets', () => {
  it('offers the two program files and the two cassette forms', () => {
    expect(atariBuildTargets.map((t) => [t.id, t.fileExtension])).toEqual([
      ['atari-bas', 'bas'],
      ['atari-lst', 'lst'],
      ['atari-cas', 'cas'],
      ['atari-wav', 'wav'],
    ]);
    // Neither SAVE nor CSAVE writes anything outside BASIC's program area, so
    // no target here can carry the document's memory blocks.
    expect(atariBuildTargets.some((t) => t.supportsBlocks)).toBe(false);
  });

  it('names every exported file after the document', async () => {
    for (const t of atariBuildTargets) {
      const [file] = await t.build(SOURCE, { programName: 'Test' });
      expect(file!.fileName).toBe(`test.${t.fileExtension}`);
    }
  });

  it('refuses a program the machine could not load back', async () => {
    await expect(build('atari-bas', 'PRINT "HELLO"')).rejects.toThrow(
      'Program has 1 error(s) - fix them before building',
    );
    await expect(build('atari-cas', '\n\n')).rejects.toThrow(
      'Program is empty',
    );
  });

  it('exports the tokenized image SAVE writes, and imports it back', async () => {
    const bytes = await build('atari-bas');
    expect(Array.from(bytes)).toEqual(
      Array.from(tokenizeProgram(SOURCE).image),
    );
    expect(importProgram(atari800, bytes).source).toBe(SOURCE);
  });

  it('exports an ATASCII listing, and imports it back', async () => {
    const bytes = await build('atari-lst');
    // One `$9B`-terminated record per line, and no other terminator.
    expect([...bytes].filter((b) => b === ATASCII_EOL)).toHaveLength(2);
    expect(bytes[bytes.length - 1]).toBe(ATASCII_EOL);
    expect(String.fromCharCode(...bytes.subarray(0, 16))).toBe(
      '10 PRINT "HELLO"',
    );
    expect(importProgram(atari800, bytes).source).toBe(SOURCE);
  });

  it('exports a .cas cassette image, and imports it back', async () => {
    const bytes = await build('atari-cas');
    expect(String.fromCharCode(...bytes.subarray(0, 4))).toBe('FUJI');
    // The FUJI chunk carries the document's name, the tape itself having none.
    expect(String.fromCharCode(...bytes.subarray(8, 12))).toBe('Test');
    const imported = importProgram(atari800, bytes);
    expect(imported.warnings).toEqual([]);
    expect(imported.source).toBe(SOURCE);
  });

  it('exports a .wav of the same program', async () => {
    const bytes = await build('atari-wav');
    expect(String.fromCharCode(...bytes.subarray(0, 4))).toBe('RIFF');
    expect(String.fromCharCode(...bytes.subarray(8, 12))).toBe('WAVE');
  });
});

describe('atari imports', () => {
  it('says so when the file is not a program at all', () => {
    const noise = Uint8Array.from({ length: 64 }, (_, i) => 0xa0 + i);
    expect(importProgram(atari800, noise).warnings).toEqual([
      'This is not a tokenized Atari BASIC program: its pointer header does not check out.',
    ]);
  });

  it('recovers a listing whose last line was never terminated', () => {
    const listing = Uint8Array.from([
      ...'10 END'.split('').map((c) => c.charCodeAt(0)),
      ATASCII_EOL,
      ...'20 END'.split('').map((c) => c.charCodeAt(0)),
    ]);
    expect(importProgram(atari800, listing).source).toBe('10 END\n20 END');
  });

  it('offers the same three formats on both machines', () => {
    expect(atari400.binaryImports).toEqual(atari800.binaryImports);
    expect(atari800.binaryImports).toEqual([
      { extension: '.bas', label: 'Import tokenized .BAS…' },
      { extension: '.lst', label: 'Import .LST listing…' },
      { extension: '.cas', label: 'Import .CAS cassette…' },
    ]);
  });
});

describe('the cassette route', () => {
  it('is the same on both machines, the recorder being the same', () => {
    expect(atari400.audio).toBe(atari800.audio);
    expect(atari400.buildTargets).toBe(atari800.buildTargets);
  });

  it('decodes what it plays out, and names no program', () => {
    const audio = atari800.audio!;
    const samples = audio.buildSamples(SOURCE, 'TEST', false);
    const decoded = audio.decodeSamples!(samples, audio.sampleRate);
    expect(decoded.programName).toBe('');
    expect(decoded.warnings).toEqual([]);
    expect(decoded.source).toBe(SOURCE);
  });

  it('exports every bundled sample as a loadable image', () => {
    for (const sample of atari800.samples) {
      expect(buildTokenizedImage(sample.text).length).toBeGreaterThan(0);
    }
  });
});
