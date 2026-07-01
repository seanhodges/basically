import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { CompletionContext } from '@codemirror/autocomplete';
import {
  buildIdentifierRegexes,
  type BasicLanguageOptions,
} from './basicLanguage';
import type { OutlineCapabilities } from './programOutline';
import {
  collectVariables,
  variablesInScopeAt,
  makeVariableSource,
  type VarNameRules,
} from './variables';

/** Build a dialect rule-set for the scanner from its lexical options + keywords. */
function makeRules(
  options: BasicLanguageOptions,
  keywordList: string[],
  hexPrefix?: string,
): VarNameRules {
  const { headRe, varRe } = buildIdentifierRegexes(options);
  const keywords = new Set(keywordList);
  return {
    headRe,
    varRe,
    keywords,
    maxWordLen: Math.max(...keywordList.map((w) => w.length)),
    hexRe: hexPrefix ? new RegExp(`^${hexPrefix}[0-9A-Fa-f]+`) : null,
    callPrefixes: ['PROC', 'FN'].filter((w) => keywords.has(w)),
  };
}

const BBC_KW = [
  'PRINT',
  'GOTO',
  'GOSUB',
  'LET',
  'FOR',
  'NEXT',
  'INPUT',
  'DEF',
  'PROC',
  'FN',
  'LOCAL',
  'ENDPROC',
  'CHR$',
  'DIM',
  'END',
  'IF',
  'THEN',
  'TO',
];
const bbcRules = makeRules(
  { nameChars: '_', suffixChars: '$%', graphicsEscapes: false, hexPrefix: '&' },
  BBC_KW,
  '&',
);
const bbcCaps: OutlineCapabilities = {
  hasProc: true,
  hasFn: true,
  hasGosub: true,
  hasGoto: true,
};

const C64_KW = ['PRINT', 'GOTO', 'GOSUB', 'LET', 'DEF', 'FN', 'CHR$', 'END'];
const c64Rules = makeRules(
  { suffixChars: '$%', graphicsEscapes: false },
  C64_KW,
);
const c64Caps: OutlineCapabilities = {
  hasProc: false,
  hasFn: true,
  hasGosub: true,
  hasGoto: true,
};

describe('collectVariables — BBC scope', () => {
  const src = [
    '10 score=0',
    '20 name$="X"',
    '30 END',
    '40 DEF PROCfoo(x%,n)',
    '50 LOCAL i',
    '60 score=x%+n+i',
    '70 ENDPROC',
    '80 DEF PROCbar(z)',
    '90 total=z',
    '100 ENDPROC',
  ].join('\n');
  const model = collectVariables(src, bbcRules, bbcCaps);

  it('keeps procedure params/locals out of the global set', () => {
    expect([...model.globals].sort()).toEqual(['name$', 'score', 'total']);
  });

  it('records each procedure region with its params and LOCALs', () => {
    expect(model.procs.map((p) => p.name)).toEqual(['PROCfoo', 'PROCbar']);
    expect([...model.procs[0]!.locals].sort()).toEqual(['i', 'n', 'x%']);
    expect([...model.procs[1]!.locals].sort()).toEqual(['z']);
    expect(model.procs[0]!.startRow).toBe(3);
    expect(model.procs[0]!.endRow).toBe(6);
  });

  it('offers globals + own params/locals inside a proc, only globals outside', () => {
    // Row 5 is inside PROCfoo.
    expect(variablesInScopeAt(model, 5)).toEqual([
      'i',
      'n',
      'name$',
      'score',
      'total',
      'x%',
    ]);
    // Row 0 is top-level.
    expect(variablesInScopeAt(model, 0)).toEqual(['name$', 'score', 'total']);
  });

  it("does not leak one procedure's locals into another", () => {
    // Inside PROCbar (row 8): PROCfoo's i/n/x% are not in scope; z is.
    const inBar = variablesInScopeAt(model, 8);
    expect(inBar).toContain('z');
    expect(inBar).not.toContain('i');
    expect(inBar).not.toContain('x%');
  });
});

describe('collectVariables — keywords, numbers and calls are not variables', () => {
  const src = [
    '10 PRINT score',
    '20 GOTO100',
    '30 x=CHR$(65)',
    '40 y=1E5',
    '50 z=&FF',
    '60 PROCdraw(x)',
  ].join('\n');
  const model = collectVariables(src, bbcRules, bbcCaps);

  it('collects only real variable names', () => {
    expect([...model.globals].sort()).toEqual(['score', 'x', 'y', 'z']);
  });

  it('never treats keywords, glued line numbers, literals or PROC calls as vars', () => {
    for (const noise of [
      'PRINT',
      'GOTO',
      'GOTO100',
      'CHR$',
      'E5',
      'FF',
      'PROCdraw',
    ]) {
      expect(model.globals.has(noise)).toBe(false);
    }
  });
});

describe('collectVariables — per-dialect name spelling', () => {
  it('honours BBC _ and % / $ suffixes', () => {
    const model = collectVariables('10 count%=total_sum+1', bbcRules, bbcCaps);
    expect([...model.globals].sort()).toEqual(['count%', 'total_sum']);
  });

  it('honours the TRS-80 !/#/%/$ suffix set', () => {
    const trs80Rules = makeRules({ suffixChars: '$%!#' }, ['PRINT', 'LET']);
    const model = collectVariables('10 X!=1', trs80Rules, c64Caps);
    expect(model.globals.has('X!')).toBe(true);
  });

  it('treats a trailing $ as separate when the dialect has no suffixes (Atom)', () => {
    const atomRules = makeRules({ suffixChars: '' }, ['PRINT', 'LET']);
    const model = collectVariables('10 A$=5', atomRules, c64Caps);
    expect(model.globals.has('A')).toBe(true);
    expect(model.globals.has('A$')).toBe(false);
  });

  it('offers a single-line DEF FN parameter only on its own line (C64)', () => {
    const model = collectVariables('10 DEF FNsq(x)=x*x', c64Rules, c64Caps);
    expect(model.procs).toHaveLength(1);
    expect([...model.procs[0]!.locals]).toEqual(['x']);
    expect(variablesInScopeAt(model, 0)).toContain('x');
    expect(variablesInScopeAt(model, 1)).not.toContain('x');
  });
});

describe('makeVariableSource — completion behaviour', () => {
  const source = makeVariableSource(bbcRules, bbcCaps);

  function resultAt(doc: string, pos: number = doc.length) {
    const state = EditorState.create({ doc });
    return source(new CompletionContext(state, pos, true));
  }

  it('offers a defined variable as a typed prefix is entered', () => {
    const res = resultAt('10 score=0\n20 PRINT sc');
    const score = res?.options.find((o) => o.label === 'score');
    expect(score).toBeDefined();
    expect(score!.type).toBe('variable');
  });

  it('is suppressed inside a string literal', () => {
    expect(resultAt('10 PRINT "hi')).toBeNull();
  });

  it('offers an enclosing proc parameter inside its body', () => {
    const res = resultAt('10 DEF PROCfoo(width)\n20 PRINT w');
    expect(res?.options.map((o) => o.label)).toContain('width');
  });

  it('hides a proc parameter once outside the proc', () => {
    const res = resultAt('10 DEF PROCfoo(width)\n20 ENDPROC\n30 PRINT w');
    expect(res?.options.map((o) => o.label)).not.toContain('width');
  });
});
