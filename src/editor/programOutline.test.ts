import { describe, it, expect } from 'vitest';
import {
  buildOutline,
  outlineCapabilities,
  findRowForLineNumber,
  type OutlineCapabilities,
} from './programOutline';

const sinclair: OutlineCapabilities = {
  hasProc: false,
  hasFn: false,
  hasGosub: true,
  hasGoto: true,
};
const bbc: OutlineCapabilities = {
  hasProc: true,
  hasFn: true,
  hasGosub: true,
  hasGoto: true,
};

/** Convenience: the section of a given kind, or undefined. */
function section(source: string, caps: OutlineCapabilities, kind: string) {
  return buildOutline(source, caps).find((s) => s.kind === kind);
}

describe('outlineCapabilities', () => {
  it('reads GOSUB/GOTO presence, tolerating the Sinclair spellings', () => {
    expect(
      outlineCapabilities([
        { word: 'GO SUB', token: 0, kind: 'command' },
        { word: 'GO TO', token: 0, kind: 'command' },
        { word: 'DEF FN', token: 0, kind: 'command' },
      ]),
    ).toEqual({ hasProc: false, hasFn: true, hasGosub: true, hasGoto: true });
  });

  it('detects BBC PROC/FN', () => {
    expect(
      outlineCapabilities([
        { word: 'PROC', token: 0, kind: 'command' },
        { word: 'FN', token: 0, kind: 'function' },
        { word: 'GOSUB', token: 0, kind: 'command' },
        { word: 'GOTO', token: 0, kind: 'command' },
      ]),
    ).toEqual({ hasProc: true, hasFn: true, hasGosub: true, hasGoto: true });
  });
});

describe('buildOutline — named definitions', () => {
  it('titles procedures and functions by their name', () => {
    const src = ['10 DEF PROCdraw', '20 ENDPROC', '30 DEF FNsq(x)=x*x'].join(
      '\n',
    );
    expect(section(src, bbc, 'procedure')?.items).toEqual([
      { kind: 'procedure', title: 'PROCdraw', lineNo: 10 },
    ]);
    expect(section(src, bbc, 'function')?.items).toEqual([
      { kind: 'function', title: 'FNsq', lineNo: 30 },
    ]);
  });

  it('omits procedure/function sections for dialects without them', () => {
    const src = '10 GOSUB 100\n100 PRINT 1\n110 RETURN';
    const kinds = buildOutline(src, sinclair).map((s) => s.kind);
    expect(kinds).not.toContain('procedure');
    expect(kinds).not.toContain('function');
  });
});

describe('buildOutline — GOSUB/GOTO targets (destinations only)', () => {
  it('lists the target line, deduped, not the call sites', () => {
    const src = [
      '10 GOSUB 100',
      '20 GOSUB 100',
      '30 GOTO 10',
      '100 PRINT 1',
      '110 RETURN',
    ].join('\n');
    expect(section(src, sinclair, 'subroutine')?.items).toEqual([
      { kind: 'subroutine', title: 'PRINT 1', lineNo: 100 },
    ]);
    expect(section(src, sinclair, 'goto')?.items).toEqual([
      { kind: 'goto', title: 'GOSUB 100', lineNo: 10 },
    ]);
  });

  it('drops targets that are not real lines and computed targets', () => {
    const src = '10 GOSUB 999\n20 GOTO X+1\n30 PRINT 1';
    expect(buildOutline(src, sinclair)).toEqual([]);
  });

  it('handles ON n GOTO/GOSUB literal lists', () => {
    const src = [
      '10 ON X GOTO 100,200,300',
      '100 PRINT 1',
      '200 PRINT 2',
      '300 PRINT 3',
    ].join('\n');
    expect(section(src, bbc, 'goto')?.items.map((i) => i.lineNo)).toEqual([
      100, 200, 300,
    ]);
  });
});

describe('buildOutline — target titles', () => {
  const sub = (src: string) => section(src, sinclair, 'subroutine')?.items[0];

  it('prefers a REM on the target line', () => {
    expect(sub('10 GOSUB 100\n100 REM DRAW SCREEN\n110 RETURN')?.title).toBe(
      'DRAW SCREEN',
    );
  });

  it('falls back to the REM directly above, then below', () => {
    expect(
      sub('10 GOSUB 100\n90 REM ABOVE\n100 PRINT 1\n110 RETURN')?.title,
    ).toBe('ABOVE');
    expect(
      sub('10 GOSUB 100\n100 PRINT 1\n110 REM BELOW\n120 RETURN')?.title,
    ).toBe('BELOW');
  });

  it('falls back to the line body when no REM is nearby', () => {
    expect(sub('10 GOSUB 100\n100 FOR I=1 TO 10\n110 NEXT I')?.title).toBe(
      'FOR I=1 TO 10',
    );
  });

  it('truncates long titles with an ellipsis', () => {
    const long = 'A'.repeat(80);
    const title = sub(`10 GOSUB 100\n100 REM ${long}\n110 RETURN`)?.title ?? '';
    expect(title.endsWith('…')).toBe(true);
    expect(title.length).toBeLessThanOrEqual(60);
  });
});

describe('buildOutline — false positives', () => {
  it('ignores GOTO/GOSUB inside strings and after REM', () => {
    const src = [
      '10 PRINT "GOTO 99"',
      '20 REM SEE GOSUB 99',
      '99 PRINT 1',
    ].join('\n');
    expect(buildOutline(src, sinclair)).toEqual([]);
  });

  it('returns [] for an empty program', () => {
    expect(buildOutline('', sinclair)).toEqual([]);
  });
});

describe('findRowForLineNumber', () => {
  const doc = ['10 PRINT 1', '', '20 GOSUB 100', '100 PRINT 2'].join('\n');

  it('maps a BASIC line number to its 1-based physical row', () => {
    expect(findRowForLineNumber(doc, 10)).toBe(1);
    expect(findRowForLineNumber(doc, 20)).toBe(3);
    expect(findRowForLineNumber(doc, 100)).toBe(4);
  });

  it('returns null for absent line numbers', () => {
    expect(findRowForLineNumber(doc, 50)).toBeNull();
  });
});
