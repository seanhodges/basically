// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { dialects } from './registry';
import { zx81 } from './zx81';
import { commodore64 } from './commodore64';
import { hasFatalErrors } from './types';
import { resolveListing, resolveLint, resolveTokenize } from './resolveListing';

describe('resolveListing', () => {
  it('declares nothing for a listing with no directive', () => {
    const resolved = resolveListing('10 PRINT "HI"', zx81);
    expect(resolved.dialect).toBe(zx81);
    expect(resolved.source).toBe('10 PRINT "HI"');
    expect(resolved.problems).toEqual([]);
  });

  it('resolves the dialect from the declaration when none is given', () => {
    const resolved = resolveListing('#MACHINE commodore64\n10 PRINT "HI"');
    expect(resolved.dialect).toBe(commodore64);
    expect(resolved.source).toBe('10 PRINT "HI"');
    expect(resolved.problems).toEqual([]);
  });

  it('accepts the declaration by id, case-insensitively, or by display name', () => {
    for (const spelling of ['commodore64', 'Commodore64', commodore64.name]) {
      const resolved = resolveListing(`#MACHINE ${spelling}\n10 PRINT`);
      expect(resolved.dialect, spelling).toBe(commodore64);
    }
  });

  it('an explicitly given dialect wins over a different declaration', () => {
    const resolved = resolveListing(
      '#MACHINE commodore64\n10 PRINT "HI"',
      zx81,
    );
    expect(resolved.dialect).toBe(zx81);
    expect(resolved.source).toBe('10 PRINT "HI"');
  });

  it('leaves the dialect undefined when neither says', () => {
    const resolved = resolveListing('10 PRINT "HI"');
    expect(resolved.dialect).toBeUndefined();
    expect(resolved.problems).toEqual([]);
  });

  it('reports an unregistered declared machine as a problem, even with a dialect given', () => {
    const resolved = resolveListing('#MACHINE nosuchmachine\n10 PRINT', zx81);
    expect(resolved.dialect).toBe(zx81);
    expect(resolved.problems).toEqual([
      {
        line: 1,
        column: 9,
        message: 'No registered machine "nosuchmachine"',
      },
    ]);
  });

  it('leaves the dialect undefined for an unregistered declaration with none given', () => {
    const resolved = resolveListing('#MACHINE nosuchmachine\n10 PRINT');
    expect(resolved.dialect).toBeUndefined();
    expect(resolved.problems).toHaveLength(1);
  });

  it('carries a malformed directive as a problem', () => {
    const resolved = resolveListing('#MACHINE\n10 PRINT', zx81);
    expect(resolved.problems).toEqual([
      { line: 1, column: 8, message: 'Missing machine name after #MACHINE' },
    ]);
  });
});

describe('resolveTokenize / resolveLint', () => {
  it('tokenizes the stripped source and remaps error lines', () => {
    const source = '#MACHINE zx81\n10 REM \u{1F4A5}\n';
    const result = resolveTokenize(zx81, source);
    expect(hasFatalErrors(result.errors)).toBe(true);
    expect(result.errors.some((e) => e.line === 2)).toBe(true);
  });

  it('lints the stripped source and remaps error lines', () => {
    const source = '#MACHINE zx81\n10 REM \u{1F4A5}\n';
    const errors = resolveLint(zx81, source);
    expect(errors.some((e) => e.line === 2)).toBe(true);
  });

  it('prepends the declaration problems ahead of the dialect ones', () => {
    const source = '#MACHINE nosuchmachine\n10 REM \u{1F4A5}\n';
    const errors = resolveTokenize(zx81, source).errors;
    expect(errors[0]!.message).toBe('No registered machine "nosuchmachine"');
  });
});

describe('every registered machine, every bundled sample', () => {
  for (const dialect of dialects) {
    for (const sample of dialect.samples) {
      it(`${dialect.id}: ${sample.name} costs nothing declared`, () => {
        const plain = dialect.tokenize(sample.text);
        const declared = resolveTokenize(
          dialect,
          `#MACHINE ${dialect.id}\n${sample.text}`,
        );
        expect(Array.from(declared.image)).toEqual(Array.from(plain.image));
        expect(declared.byteSize).toBe(plain.byteSize);
        expect(declared.errors).toEqual(plain.errors);
      });
    }
  }

  for (const dialect of dialects) {
    it(`${dialect.id}: a problem after the declaration lands on the line the user sees`, () => {
      const withoutDeclaration = `10 REM \u{1F4A5}\n`;
      const plain = dialect.tokenize(withoutDeclaration);
      expect(hasFatalErrors(plain.errors)).toBe(true);
      const plainLine = plain.errors.find((e) => e.fatal !== false)!.line;

      const declared = `#MACHINE ${dialect.id}\n10 REM \u{1F4A5}\n`;
      const result = resolveTokenize(dialect, declared);
      const declaredLine = result.errors.find((e) => e.fatal !== false)!.line;
      // The declaration occupies line 1 in the typed text, so the same
      // problem - on line `plainLine` without a declaration - is one line
      // further down with one present, and must be reported there rather
      // than at the line it fell on in the stripped source.
      expect(declaredLine).toBe(plainLine + 1);
    });
  }
});
