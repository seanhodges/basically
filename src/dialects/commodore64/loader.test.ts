// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { loaderSource, loaderProgramBytes } from './loader';
import { detokenizeProgram } from './detokenizer';
import type { MemoryBlock } from '../types';

function block(name: string, address: number): MemoryBlock {
  return { id: name, name, address, bytes: Uint8Array.of(0x60), kind: 'code' };
}

describe('loaderSource', () => {
  it('loads each block from tape, then chains into the main program', () => {
    const src = loaderSource('game', [
      block('sprites', 0xc000),
      block('music', 0xd000),
    ]);
    expect(src).toBe(
      '10 IF A=0 THEN A=1:LOAD"SPRITES",1,1\n' +
        '20 IF A=1 THEN A=2:LOAD"MUSIC",1,1\n' +
        '30 LOAD"GAME",1\n',
    );
  });

  it('with no blocks is just the final LOAD of the main program', () => {
    expect(loaderSource('game', [])).toBe('10 LOAD"GAME",1\n');
  });
});

describe('loaderProgramBytes', () => {
  it('tokenizes to a valid program that detokenizes back to the source', () => {
    const blocks = [block('sprites', 0xc000)];
    const bytes = loaderProgramBytes('game', blocks);
    expect(bytes.length).toBeGreaterThan(2);
    // Bare program bytes (no load-address word) round-trip through detokenize.
    expect(detokenizeProgram(bytes)).toBe(loaderSource('game', blocks));
  });
});
