// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The question these pin is "which occurrences are the *same variable*", which
 * is a machine question, not a text one. The per-machine facts they rely on are
 * stated and cross-checked in `variableLexis.test.ts`; here they are exercised
 * through the real dialects, so a machine that changes its lexis fails here too.
 */
import { describe, expect, it } from 'vitest';
import { dialects, getDialect } from '../dialects/registry';
import { findVariableUsages } from './variableUsages';

/**
 * Pick the variable at the `|` marker and report what would be highlighted.
 * Returns the matched text of each usage, in document order.
 */
function pick(dialectId: string, marked: string) {
  const pos = marked.indexOf('|');
  if (pos === -1) throw new Error('the source needs a | marking the caret');
  const src = marked.replace('|', '');
  const result = findVariableUsages(
    src,
    dialectId,
    getDialect(dialectId).keywords,
    pos,
  );
  if (!result) return null;
  return {
    name: result.name,
    texts: result.ranges.map((r) => src.slice(r.from, r.to)),
    count: result.ranges.length,
  };
}

describe('findVariableUsages - what is not a variable', () => {
  it('returns nothing when the caret is not on a name', () => {
    expect(pick('bbcmicro', '10 PRI|NT "hi"')).toBeNull();
    expect(pick('bbcmicro', '10 score|=0')).not.toBeNull();
  });

  it('ignores the name inside keywords, strings and comments', () => {
    const found = pick(
      'bbcmicro',
      [
        '10 sc|ore=0',
        '20 PRINT "score is"',
        '30 REM score again',
        '40 END',
      ].join('\n'),
    );
    expect(found?.count).toBe(1);
  });

  it('ignores a PROC call that ends in the same letters', () => {
    const found = pick(
      'bbcmicro',
      ['10 bl|ob=1', '20 PROCblob', '30 PRINT blob'].join('\n'),
    );
    expect(found?.texts).toEqual(['blob', 'blob']);
  });
});

describe('findVariableUsages - identity follows the machine', () => {
  // A Spectrum folds case: `10 LET a=1:LET A=2` leaves it holding one A.
  it('folds case where the ROM does (Spectrum)', () => {
    const found = pick(
      'zxspectrum',
      ['10 LET s|core=0', '20 LET SCORE=SCORE+1', '30 PRINT Score'].join('\n'),
    );
    expect(found?.texts).toEqual(['score', 'SCORE', 'SCORE', 'Score']);
  });

  // ...but a BBC does not: the same program prints 1 and 2 there.
  it('keeps case apart where the ROM does (BBC)', () => {
    const found = pick(
      'bbcmicro',
      ['10 s|core=0', '20 SCORE=1', '30 PRINT score'].join('\n'),
    );
    expect(found?.texts).toEqual(['score', 'score']);
  });

  // Two significant characters: a C64 running `HPX=11:HPY=22` is left holding
  // one variable, HP. The lint reports the same collision.
  it('merges names the machine cannot tell apart (C64)', () => {
    const found = pick(
      'commodore64',
      ['10 HP|X=11', '20 HPY=22', '30 PRINT HPX'].join('\n'),
    );
    expect(found?.texts).toEqual(['HPX', 'HPY', 'HPX']);
  });

  it('keeps those names apart where the whole name counts (BBC)', () => {
    const found = pick(
      'bbcmicro',
      ['10 hp|x=11', '20 hpy=22', '30 PRINT hpx'].join('\n'),
    );
    expect(found?.texts).toEqual(['hpx', 'hpx']);
  });

  it('treats each type marker as its own variable', () => {
    const src = ['10 a=1', '20 a$="x"', '30 a%=2', '40 PRINT a'].join('\n');
    expect(pick('bbcmicro', src.replace('10 a', '10 |a'))?.texts).toEqual([
      'a',
      'a',
    ]);
    expect(pick('bbcmicro', src.replace('20 a$', '20 |a$'))?.texts).toEqual([
      'a$',
    ]);
  });

  it('keeps an array apart from a scalar of the same name', () => {
    const src = ['10 DIM a(5)', '20 a=1', '30 a(2)=3', '40 PRINT a'].join('\n');
    expect(pick('bbcmicro', src.replace('10 DIM a', '10 DIM |a'))?.count).toBe(
      2,
    );
    expect(pick('bbcmicro', src.replace('20 a=1', '20 |a=1'))?.count).toBe(2);
  });

  it('reads a space before the bracket as the array it is', () => {
    const found = pick(
      'commodore64',
      ['10 DIM A(5)', '20 PRINT A| (2)'].join('\n'),
    );
    expect(found?.count).toBe(2);
  });
});

describe('findVariableUsages - crunched machines split ROM-style', () => {
  it('counts the A the ROM reads out of POKEA', () => {
    const found = pick(
      'commodore64',
      ['10 A|=1', '20 POKEA,10', '30 PRINTA'].join('\n'),
    );
    expect(found?.count).toBe(3);
  });

  it('does not read TOTAL as a name of its own (TO TAL)', () => {
    // The ROM splits the run, so nothing here is a use of a variable TOTAL.
    const found = pick('commodore64', ['10 FORI=1TOT|AL'].join('\n'));
    expect(found?.name).not.toBe('TOTAL');
  });
});

describe('findVariableUsages - DATA follows the machine', () => {
  it('counts a name inside DATA where the ROM evaluates it (Spectrum)', () => {
    const found = pick(
      'zxspectrum',
      ['10 LET a|=7', '20 DATA a', '30 READ b'].join('\n'),
    );
    expect(found?.count).toBe(2);
  });

  it('ignores the words where the ROM takes them literally (BBC)', () => {
    const found = pick(
      'bbcmicro',
      ['10 hue|=0', '20 DATA hue,red', '30 READ hue'].join('\n'),
    );
    expect(found?.texts).toEqual(['hue', 'hue']);
  });
});

describe('findVariableUsages - procedure scope (BBC)', () => {
  const src = [
    '10 total=0',
    '20 PROCtally(3)',
    '30 PRINT total',
    '40 END',
    '50 DEF PROCtally(total)',
    '60 LOCAL idx',
    '70 FOR idx=1 TO total',
    '80 NEXT idx',
    '90 ENDPROC',
  ].join('\n');

  it("confines a procedure's parameter to that procedure", () => {
    const found = pick(
      'bbcmicro',
      src.replace('PROCtally(total)', 'PROCtally(t|otal)'),
    );
    expect(found?.count).toBe(2); // the header and the FOR limit
  });

  it('leaves the global out of the procedure that shadows it', () => {
    const found = pick('bbcmicro', src.replace('10 total=0', '10 t|otal=0'));
    expect(found?.count).toBe(2); // lines 10 and 30 only
  });

  it('confines a LOCAL to its procedure', () => {
    const found = pick(
      'bbcmicro',
      src.replace('60 LOCAL idx', '60 LOCAL |idx'),
    );
    expect(found?.count).toBe(3); // the LOCAL, the FOR and the NEXT
  });
});

describe('findVariableUsages - every registered machine answers', () => {
  // Nothing dialect-specific here beyond the lexis, so a new machine gets this
  // for free - but a lexis that stops recognising names at all would fail.
  it.each(dialects.map((d) => [d.id] as const))(
    '%s finds its own name',
    (id) => {
      const found = pick(id, '10 |a=1');
      expect(found).not.toBeNull();
      expect(found!.count).toBeGreaterThanOrEqual(1);
    },
  );
});
