// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * What the machine will change about a listing, and - just as much - what it
 * will not.
 *
 * The false positives are the risk here, not the misses: the escapes are full
 * of lower case and it is load-bearing (a Commodore control code is spelled in
 * lower case, and its shifted-letter abbreviation *requires* a lower-case
 * prefix), so a walk that read notation as text would report a conversion on
 * every archive listing that carries one. Each of those forms is pinned below.
 */
import { describe, expect, it } from 'vitest';
import { getDialect } from '../dialects/registry';
import { convertedCharacters } from './convertedCharacters';

const report = (dialectId: string, source: string) =>
  convertedCharacters(source, getDialect(dialectId));
const count = (dialectId: string, source: string) =>
  report(dialectId, source).count;

describe('characters the machine will change', () => {
  it('counts the lower case a folding machine stores as capitals', () => {
    const found = report('zx81', '10 PRINT "hello"');
    expect(found.count).toBe(5);
    expect(found.findings[0]).toEqual({
      from: 'h',
      to: 'H',
      line: 1,
      column: 10,
    });
  });

  it('reports each finding where it is, not just how many', () => {
    // The status bar needs only the count; the positions are here because
    // recovering them later would mean walking the source a second time.
    const found = report('zx81', '10 PRINT "a"\n20 PRINT "b"');
    expect(found.findings.map((f) => [f.line, f.column])).toEqual([
      [1, 10],
      [2, 10],
    ]);
  });

  it('counts nothing on a machine that stores every character as written', () => {
    expect(count('bbcmicro', '10 PRINT "hello"')).toBe(0);
    expect(count('trs80', '10 PRINT "hello"')).toBe(0);
  });

  it('counts a character the machine stores as another of its own', () => {
    // Not case at all: the Acorn charset has no backtick and stores `£` for
    // it, and the CPC stores its own `↑` for a caret.
    expect(report('bbcmicro', '10 PRINT "`"').findings[0]).toMatchObject({
      from: '`',
      to: '£',
    });
    expect(report('cpc464', '10 PRINT "^"').findings[0]).toMatchObject({
      from: '^',
      to: '↑',
    });
  });

  it('counts none of the notation a listing is written in', () => {
    // An escape naming a control code, a raw byte, a graphics character, and a
    // short keyword spelling - every one of them spelled with lower case that
    // is part of the notation rather than text the machine stores as written.
    expect(count('commodore64', '10 PRINT "{white}"')).toBe(0);
    expect(count('commodore64', '10 PRINT "{$e0}"')).toBe(0);
    expect(count('commodore64', '10 PRINT "♠"')).toBe(0);
    expect(count('commodore64', '10 pO53280,1')).toBe(0);
    expect(count('zx81', '10 PRINT "\\{80}"')).toBe(0);
  });

  it('honours a switch to the machine’s lower-case set, in both directions', () => {
    expect(count('commodore64', '10 PRINT "hello"')).toBe(5);
    // The escape form, which is how this IDE's own text spells the switch...
    expect(count('commodore64', '10 PRINT "{lower}hello"')).toBe(0);
    // ...and CHR$(14), which is how an archive listing spells it.
    expect(count('commodore64', '10 PRINT CHR$(14):PRINT "hello"')).toBe(0);
    // Switched back, and counted again.
    expect(count('commodore64', '10 PRINT "{lower}hello{upper}world"')).toBe(5);
  });

  it('carries the set across lines, in source order', () => {
    expect(count('commodore64', '10 PRINT "{lower}"\n20 PRINT "hi"')).toBe(0);
    expect(
      count('commodore64', '10 PRINT "{lower}"\n20 PRINT "{upper}hi"'),
    ).toBe(2);
  });

  it('says nothing about a program with nothing to convert', () => {
    // Nothing rather than a report of none: an empty finding list is what the
    // status bar reads as "do not mention this".
    expect(report('zx81', '10 PRINT "HELLO"')).toEqual({
      count: 0,
      findings: [],
    });
    expect(report('bbcmicro', '')).toEqual({ count: 0, findings: [] });
  });

  it('steps over what the machine cannot store at all', () => {
    // Already a build error, reported where it occurs, and not this report's
    // business - but it must not stop the walk either.
    const found = report('zx81', '10 PRINT "éhello"');
    expect(found.count).toBe(5);
  });

  it('takes no character from a #BIN payload', () => {
    expect(count('zx81', '10 PRINT "A"\n#BIN 4000 QUJDREVGRw==')).toBe(0);
  });

  it('takes no character from a #MACHINE declaration', () => {
    // A dialect whose lower case folds to upper would otherwise flag "machine"
    // in a lower-case-spelled declaration as characters it converts.
    expect(count('zx81', '#machine zx81\n10 PRINT "A"')).toBe(0);
  });
});
