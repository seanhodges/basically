// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, it, expect } from 'vitest';
import { Disc, DiscConfig, loadSsd, toSsdOrDsd } from 'jsbeeb/src/disc.js';
import { buildBbcDisc, readBbcDisc, isBbcDisc, type BbcFile } from './bbcDisc';

function bytes(...vals: number[]): Uint8Array {
  return Uint8Array.from(vals);
}

const SAMPLE: BbcFile[] = [
  { name: 'MAIN', load: 0x1900, exec: 0x1900, bytes: bytes(0x0d, 0xff) },
  {
    name: 'SPRITE',
    load: 0x2e00,
    exec: 0x2e00,
    bytes: Uint8Array.from({ length: 300 }, (_, i) => i & 0xff),
  },
  { name: 'RUNME', load: 0x2000, exec: 0x2010, bytes: bytes(1, 2, 3, 4) },
];

describe('bbcDisc', () => {
  it('is a 200K single-sided image', () => {
    const img = buildBbcDisc(SAMPLE);
    expect(img.length).toBe(256 * 10 * 80);
  });

  it('round-trips files with load/exec through build/read', () => {
    const img = buildBbcDisc(SAMPLE, { title: 'DEMO', bootOption: 3 });
    const { files, bootOption, title } = readBbcDisc(img);
    expect(title).toBe('DEMO');
    expect(bootOption).toBe(3);
    // Read order is catalogue order (descending sector); match by name.
    for (const original of SAMPLE) {
      const got = files.find((f) => f.name === original.name);
      expect(got, original.name).toBeDefined();
      expect(got!.load).toBe(original.load);
      expect(got!.exec).toBe(original.exec);
      expect([...got!.bytes]).toEqual([...original.bytes]);
    }
  });

  it('recognises a disc image and rejects a raw .bbc program', () => {
    expect(isBbcDisc(buildBbcDisc(SAMPLE))).toBe(true);
    // A raw tokenized .bbc starts with 0x0D and is not a catalogue.
    const bbc = bytes(0x0d, 0x00, 0x0a, 0x08, 0xf4, 0x0d, 0xff);
    expect(isBbcDisc(bbc)).toBe(false);
  });

  it('rejects more than 31 files', () => {
    const many: BbcFile[] = Array.from({ length: 32 }, (_, i) => ({
      name: `F${i}`,
      load: 0x1900,
      exec: 0x1900,
      bytes: bytes(0),
    }));
    expect(() => buildBbcDisc(many)).toThrow(/at most/);
  });

  it('survives a jsbeeb loadSsd / toSsdOrDsd mount round-trip', () => {
    const img = buildBbcDisc(SAMPLE, { title: 'DEMO' });
    const disc = loadSsd(
      new Disc(true, new DiscConfig(), 'demo.ssd'),
      img,
      false,
    );
    const readBack = toSsdOrDsd(disc);
    // The mounted-then-extracted image must re-parse to the same files.
    const { files } = readBbcDisc(readBack);
    for (const original of SAMPLE) {
      const got = files.find((f) => f.name === original.name);
      expect(got, original.name).toBeDefined();
      expect(got!.load).toBe(original.load);
      expect(got!.exec).toBe(original.exec);
      expect([...got!.bytes]).toEqual([...original.bytes]);
    }
  });
});
