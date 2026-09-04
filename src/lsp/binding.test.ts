// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { dialects } from '../dialects/registry';
import { bindMachine, inferMachine } from './binding';

describe('binding a document to a machine, registry-driven', () => {
  it.each(dialects)(
    '$id: its own bundled samples bind to a machine whose tokenizer accepts them, or decline',
    (dialect) => {
      for (const sample of dialect.samples) {
        const binding = bindMachine(sample.text);
        if (binding.kind === 'declined') continue;
        // Never bound to a machine the sample's tokenizer itself rejects - the
        // inference this is built on only ever offers a machine that reads
        // the listing with zero errors.
        expect(
          binding.dialect.tokenize(sample.text).errors,
          `${dialect.id}/${sample.name} bound to ${binding.dialect.id}`,
        ).toEqual([]);
      }
    },
  );

  it('declines a listing every machine reads equally', () => {
    // An empty program tokenizes cleanly everywhere, so it names more than one
    // compatible machine and inference must decline rather than guess.
    const binding = bindMachine('');
    expect(binding.kind).toBe('declined');
    expect(inferMachine('')).toBeUndefined();
  });

  it('a configured machine wins over inference', () => {
    const binding = bindMachine('', 'zx81');
    expect(binding).toEqual({
      kind: 'bound',
      dialect: expect.objectContaining({ id: 'zx81' }),
      source: 'configured',
    });
  });

  it('a declared machine wins over configuration', () => {
    const source = '#MACHINE zx81\n10 PRINT "HI"';
    const binding = bindMachine(source, 'commodore64');
    expect(binding).toEqual({
      kind: 'bound',
      dialect: expect.objectContaining({ id: 'zx81' }),
      source: 'declared',
    });
  });

  it('declines an unregistered configured machine rather than falling back to inference', () => {
    const binding = bindMachine('', 'nosuchmachine');
    expect(binding.kind).toBe('declined');
  });

  it('declines an unregistered declared machine rather than falling back', () => {
    const source = '#MACHINE nosuchmachine\n10 PRINT "HI"';
    const binding = bindMachine(source, 'zx81');
    expect(binding.kind).toBe('declined');
  });
});
