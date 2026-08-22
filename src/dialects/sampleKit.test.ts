import { describe, expect, it } from 'vitest';
import { standardSamples } from './sampleKit';
import { dialects } from './registry';
import type { SampleBlockDef } from './types';

const BLOCK: SampleBlockDef = {
  name: 'kaleido',
  address: 0x8000,
  kind: 'code',
  asmSource: 'ORG $8000',
  entry: 0x8003,
};

describe('standardSamples', () => {
  it('builds the canonical five in the canonical order', () => {
    expect(
      standardSamples({
        hello: 'H',
        circles: 'C',
        breakout: 'B',
        maze: 'M',
        kaleido: 'K',
      }),
    ).toEqual([
      { name: 'hello.bas', title: 'Hello world', text: 'H' },
      { name: 'circles.bas', title: 'Circles', text: 'C' },
      { name: 'breakout.bas', title: 'Breakout', text: 'B' },
      { name: 'maze.bas', title: 'Maze', text: 'M' },
      { name: 'kaleido.bas', title: 'Kaleidoscope', text: 'K' },
    ]);
  });

  it('omits a sample the dialect does not ship, keeping the rest in order', () => {
    const samples = standardSamples({ hello: 'H', circles: 'C', maze: 'M' });
    expect(samples.map((s) => s.name)).toEqual([
      'hello.bas',
      'circles.bas',
      'maze.bas',
    ]);
  });

  it('attaches the kaleidoscope block to kaleido and to nothing else', () => {
    const samples = standardSamples(
      { hello: 'H', kaleido: 'K' },
      { kaleidoBlock: BLOCK },
    );
    expect(samples[0]!.blocks).toBeUndefined();
    expect(samples[1]!.blocks).toEqual([BLOCK]);
  });

  it('leaves kaleido blockless when the dialect carries no block', () => {
    expect(standardSamples({ kaleido: 'K' })[0]).toEqual({
      name: 'kaleido.bas',
      title: 'Kaleidoscope',
      text: 'K',
    });
  });

  it('inserts an extra sample ahead of the canonical one it is keyed by', () => {
    const files = { name: 'files.bas', title: 'Data files', text: 'F' };
    const samples = standardSamples(
      { hello: 'H', maze: 'M', kaleido: 'K' },
      { insertBefore: { kaleido: [files] } },
    );
    expect(samples.map((s) => s.name)).toEqual([
      'hello.bas',
      'maze.bas',
      'files.bas',
      'kaleido.bas',
    ]);
  });

  it('names and titles each canonical sample the same way on every dialect', () => {
    const titles = new Map<string, Set<string>>();
    for (const dialect of dialects) {
      for (const sample of dialect.samples) {
        const seen = titles.get(sample.name) ?? new Set<string>();
        seen.add(sample.title);
        titles.set(sample.name, seen);
      }
    }
    for (const [name, seen] of titles) {
      expect([...seen], `${name} is titled inconsistently`).toHaveLength(1);
    }
  });
});
