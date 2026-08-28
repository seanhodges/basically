// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { atari400 } from './index';
import { atari800 } from '../atari800';

/**
 * The 400 is a delegation sibling of the 800, so most of this file is about
 * what it does *not* own: a difference that appears here and is not one of the
 * three below means the two machines have drifted apart in a way the hardware
 * does not justify.
 */
describe('Atari 400', () => {
  it('shares the whole language layer with the 800', () => {
    expect(atari400.keywords).toBe(atari800.keywords);
    expect(atari400.operators).toBe(atari800.operators);
    expect(atari400.charset).toBe(atari800.charset);
    expect(atari400.keyboardLayout).toBe(atari800.keyboardLayout);
    expect(atari400.samples).toBe(atari800.samples);
    expect(atari400.buildTargets).toBe(atari800.buildTargets);
    expect(atari400.completionSource).toBe(atari800.completionSource);
    expect(atari400.statementSeparator).toBe(atari800.statementSeparator);
  });

  it('tokenizes a program to the same bytes the 800 does', () => {
    const source = '10 GRAPHICS 8\n20 PLOT 0,0:DRAWTO 100,50';
    expect([...atari400.tokenize(source).image]).toEqual([
      ...atari800.tokenize(source).image,
    ]);
  });

  it('shares one reference page with the 800', () => {
    expect(atari400.docsReference).toBe('atari');
    expect(atari800.docsReference).toBe('atari');
  });

  // 16K against 48K, and with the BASIC cartridge covering everything from
  // $A000 the 800's usable RAM stops well short of what is fitted.
  it('offers a quarter of the 800’s memory', () => {
    expect(atari400.programRamBytes).toBeLessThan(atari800.programRamBytes);
    expect(atari400.programRamBytes).toBe(13344);
    expect(atari800.programRamBytes).toBe(37920);
  });

  it('stops a memory block where its own RAM stops', () => {
    // The block linter is the one place the 16K shows up as an address rather
    // than as a total: a block the 800 accepts at $8000 has nothing to live in
    // here. The free page both machines share is the same either way.
    const [range] = atari400.memoryBlocks!.validRanges;
    expect(range!.end).toBe(0x3fff);
    expect(atari800.memoryBlocks!.validRanges[0]!.end).toBe(0x9fff);
    expect(atari400.memoryBlocks!.defaultAddress).toBe(
      atari800.memoryBlocks!.defaultAddress,
    );
  });

  it('tells the assistant which machine it is writing for', () => {
    expect(atari400.aiProfile.systemPrompt).toContain('Atari 400');
    expect(atari400.aiProfile.systemPrompt).not.toContain('Atari 800');
    expect(atari400.aiProfile.systemPrompt).toContain('16K');
  });

  it('keeps its own identity in the machine picker', () => {
    expect(atari400.id).toBe('atari400');
    expect(atari400.name).toBe('400');
    expect(atari400.manufacturer).toBe('Atari');
    expect(atari400.blurb.length).toBeLessThanOrEqual(72);
    expect(atari800.blurb.length).toBeLessThanOrEqual(72);
  });
});
