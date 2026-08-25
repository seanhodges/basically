// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The conversion report, read as errors.
 *
 * The load-bearing claim is that the two are the *same* findings: the count the
 * status bar shows and the errors the editor raises come from one detection, so
 * they can never disagree about one program. The last test here is that claim,
 * on a program mixing text, notation and a Commodore set switch.
 */
import { describe, expect, it } from 'vitest';
import { getDialect } from '../dialects/registry';
import { fatalErrors } from '../dialects/types';
import { convertedCharacters } from './convertedCharacters';
import { strictCharacterErrors } from './strictCharacters';
import { countProgramErrors } from './useProgramStats';

const strict = (dialectId: string, source: string, on = true) =>
  strictCharacterErrors(source, getDialect(dialectId), on);

describe('strict characters as errors', () => {
  it('reports a lower-case letter at its own column', () => {
    const errors = strict('zx81', '10 PRINT "hi"');
    expect(errors).toHaveLength(2);
    expect(errors[0]).toEqual({
      line: 1,
      column: 10,
      endColumn: 11,
      message: 'The ZX81 has no "h" - it stores "H"',
      fatal: false,
    });
  });

  it('reports nothing while the setting is off, and the count is unchanged', () => {
    const source = '10 PRINT "hi"';
    expect(strict('zx81', source, false)).toEqual([]);
    expect(convertedCharacters(source, getDialect('zx81')).count).toBe(2);
  });

  it('raises exactly what the report counts, notation and set switch included', () => {
    // Text the machine folds, an escape spelled in lower case, a shifted-letter
    // keyword abbreviation, and a switch to the lower-case set - only the first
    // of which is a character the machine changes.
    const source = ['10 pRINT "{white}hello"', '20 PRINT "{lower}world"'].join(
      '\n',
    );
    const dialect = getDialect('commodore64');
    const found = convertedCharacters(source, dialect);
    const errors = strictCharacterErrors(source, dialect, true);
    expect(errors.map((e) => [e.line, e.column])).toEqual(
      found.findings.map((f) => [f.line, f.column]),
    );
    expect(errors).toHaveLength(found.count);
  });

  it('says nothing about a machine that stores every character as written', () => {
    expect(strict('zxspectrum', '10 PRINT "hello"')).toEqual([]);
  });
});

describe('what a strict finding blocks', () => {
  const source = '10 PRINT "hi"';
  const dialect = getDialect('zx81');

  it('refuses the Run gate, whether or not the lint gate is on', () => {
    expect(countProgramErrors(dialect, source, true, true)).toBe(2);
    expect(countProgramErrors(dialect, source, false, true)).toBe(2);
    expect(countProgramErrors(dialect, source, true, false)).toBe(0);
  });

  it('refuses a share link, which gates on the tokenizer plus these', () => {
    const shareErrors =
      dialect.tokenize(source).errors.length +
      strictCharacterErrors(source, dialect, true).length;
    expect(shareErrors).toBeGreaterThan(0);
  });

  it('still exports: export gates on fatal errors, and these are not', () => {
    // The characters build a perfectly good image - the machine simply stores
    // something else - so the hardware export path is untouched by the setting.
    const result = dialect.tokenize(source);
    expect(fatalErrors(result.errors)).toEqual([]);
    expect(fatalErrors(strictCharacterErrors(source, dialect, true))).toEqual(
      [],
    );
    expect(result.image.length).toBeGreaterThan(0);
  });
});
