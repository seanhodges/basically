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
  forEachVariable,
  variablesInScopeAt,
  makeVariableSource,
  type VarNameRules,
  type VarToken,
} from './variables';
import { makeCrunchMatcher } from './crunch';

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
  'DATA',
  'READ',
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

describe('collectVariables - BBC scope', () => {
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

describe('collectVariables - keywords, numbers and calls are not variables', () => {
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

describe('collectVariables - per-dialect name spelling', () => {
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

describe('makeVariableSource - completion behaviour', () => {
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
    // No other names in scope here, so the source may return null outright.
    expect(res?.options.map((o) => o.label) ?? []).not.toContain('width');
  });

  it('does not offer the word being typed as its own completion', () => {
    // "PR" is the only identifier in the doc - offering it back would be
    // useless and, as an exact match, would outrank keyword suggestions
    // (breaking the "." abbreviation: "PR." must accept PRINT, not "PR").
    expect(resultAt('PR')).toBeNull();
    // A name that also occurs elsewhere is still offered.
    const res = resultAt('10 score=0\n20 PRINT sco');
    expect(res?.options.map((o) => o.label)).toContain('score');
  });
});

// Whether a DATA item is a value or an expression is a per-ROM fact, verified
// against the machines: a BBC and a CPC READ `DATA a` as the string "a", while
// a Spectrum evaluates it (and `DATA a*2` READs 14). So the same statement
// holds names on one machine and not on the other.
describe('forEachVariable - DATA items follow the machine', () => {
  function tokensOf(code: string, rules: VarNameRules): string[] {
    const out: string[] = [];
    forEachVariable(code, rules, (t) => out.push(t.text));
    return out;
  }

  const verbatimRules: VarNameRules = { ...bbcRules, dataIsVerbatim: true };

  it('skips the items where the ROM keeps them verbatim (BBC, CPC)', () => {
    expect(tokensOf('DATA RED,GREEN', verbatimRules)).toEqual([]);
  });

  it('resumes scanning at the statement after the DATA', () => {
    expect(tokensOf('DATA RED,GREEN:PRINT hue', verbatimRules)).toEqual([
      'hue',
    ]);
  });

  it('keeps verbatim DATA items out of the completion set', () => {
    const model = collectVariables(
      '10 DATA RED,GREEN\n20 READ hue',
      verbatimRules,
      bbcCaps,
    );
    expect([...model.globals].sort()).toEqual(['hue']);
  });

  it('scans the items where the ROM evaluates them (Sinclair)', () => {
    const spectrumRules = makeRules({}, ['PRINT', 'LET', 'DATA', 'READ']);
    expect(tokensOf('DATA a,b*2', spectrumRules)).toEqual(['a', 'b']);
  });

  // Only a dialect's own keyword table can trigger the skip, so a machine
  // without DATA (the ZX81, the Atom) reads the word as an ordinary name.
  it('leaves DATA as a name on a dialect whose table has no DATA', () => {
    const zx81Rules = makeRules({}, ['PRINT', 'LET', 'GOTO']);
    expect(tokensOf('LET DATA=RED', zx81Rules)).toEqual(['DATA', 'RED']);
  });
});

describe('forEachVariable - crunched (MS-BASIC) splitting', () => {
  const MS_KW = [
    'PRINT',
    'GOTO',
    'GOSUB',
    'IF',
    'THEN',
    'LET',
    'FOR',
    'NEXT',
    'TO',
    'OR',
    'AND',
    'INPUT',
    'READ',
    'GET',
    'DIM',
    'DATA',
    'REM',
    'POKE',
    'DEF',
    'FN',
    'LEFT$',
    'END',
  ];
  const msRules: VarNameRules = {
    ...makeRules({ suffixChars: '$%' }, MS_KW),
    crunch: makeCrunchMatcher(MS_KW),
    dataIsVerbatim: true,
  };

  function tokensOf(code: string): VarToken[] {
    const out: VarToken[] = [];
    forEachVariable(code, msRules, (t) => out.push(t));
    return out;
  }

  it('splits glued keywords off variables (POKEA, FORI=1TO10)', () => {
    const model = collectVariables('10 POKEA,10\n20 FORI=1TO10', msRules, {
      hasProc: false,
      hasFn: true,
      hasGosub: true,
      hasGoto: true,
    });
    expect([...model.globals].sort()).toEqual(['A', 'I']);
  });

  it('keeps the prevKeyword contract for a crunched FOR', () => {
    expect(tokensOf('FORI=1TO10')).toEqual([
      { text: 'I', index: 3, prevKeyword: 'FOR' },
    ]);
  });

  it('flags a broken name where a variable is expected (SCORE=1)', () => {
    expect(tokensOf('SCORE=1')).toEqual([
      { text: 'SCORE', index: 0, prevKeyword: null, embedsKeyword: 'OR' },
    ]);
  });

  it('flags after a statement separator and after LET/FOR', () => {
    expect(tokensOf('X=1:SCORE=2')[1]).toMatchObject({
      text: 'SCORE',
      embedsKeyword: 'OR',
    });
    expect(tokensOf('LETSCORE=1')[0]).toMatchObject({
      text: 'SCORE',
      prevKeyword: 'LET',
      embedsKeyword: 'OR',
    });
    expect(tokensOf('IFATHENSCORE=1')[1]).toMatchObject({
      text: 'SCORE',
      embedsKeyword: 'OR',
    });
  });

  it('splits silently in expression position (legit crunch)', () => {
    // Q THEN GOTO - canonical crunched IF; no name may be flagged.
    const ifTokens = tokensOf('IFP=QTHENGOTO50');
    expect(ifTokens.map((t) => t.text)).toEqual(['P', 'Q']);
    expect(ifTokens.every((t) => t.embedsKeyword === undefined)).toBe(true);
    // A TO B - crunched FOR limit.
    expect(tokensOf('FORI=ATOB').map((t) => t.text)).toEqual(['I', 'A', 'B']);
    // An intended name in expression position splits to what the ROM sees.
    expect(tokensOf('A=SCORE').map((t) => t.text)).toEqual(['A', 'SC', 'E']);
  });

  it('splits a $-suffixed keyword at the token boundary (ALEFT$)', () => {
    expect(tokensOf('B=ALEFT$(C$,1)').map((t) => t.text)).toEqual([
      'B',
      'A',
      'C$',
    ]);
  });

  it('stops at REM even when glued (REMARK)', () => {
    expect(tokensOf('REMARK NOTES')).toEqual([]);
  });

  it('skips DATA items up to the next statement', () => {
    expect(tokensOf('DATA FORWARD,5:PRINTX').map((t) => t.text)).toEqual(['X']);
    expect(tokensOf('DATA FORWARD,5')).toEqual([]);
  });

  describe('completion re-anchoring', () => {
    const source = makeVariableSource(msRules, {
      hasProc: false,
      hasFn: true,
      hasGosub: true,
      hasGoto: true,
    });

    function resultAt(doc: string, pos: number = doc.length) {
      const state = EditorState.create({ doc });
      return source(new CompletionContext(state, pos, true));
    }

    it('re-anchors past a glued keyword (POKEA completes the A)', () => {
      const doc = '10 A2=1\n20 POKEA';
      const res = resultAt(doc);
      expect(res?.from).toBe(doc.length - 1);
      expect(res?.options.map((o) => o.label)).toContain('A2');
    });

    it('keeps the whole word when a known name matches it (SCO → SCORE)', () => {
      const doc = '10 SCORE=1\n20 A=SCO';
      const res = resultAt(doc);
      expect(res?.from).toBe(doc.length - 3);
      expect(res?.options.map((o) => o.label)).toContain('SCORE');
    });
  });
});
