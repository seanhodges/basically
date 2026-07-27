import { describe, expect, it } from 'vitest';
import type {
  EscapeTableData,
  FalseFriend,
  KeywordEquivalence,
  PairPortingNotes,
  PortingFacts,
  ReferenceEntry,
  ReferenceTableData,
} from '../../reference/data/types';
import {
  composeGuidance,
  diffEscapes,
  diffKeywords,
  falseFriendsBetween,
} from './dialectCompare';

/** Build a minimal reference table from bare entries (title/machines unused by the diff). */
function refTable(entries: ReferenceEntry[]): ReferenceTableData {
  return { title: 't', machines: ['m'], entries };
}

const PRINT: ReferenceEntry = {
  name: 'PRINT',
  kind: 'command',
  syntax: 'PRINT [<expr>]',
  description: 'Write to the screen.',
};
const LET: ReferenceEntry = {
  name: 'LET',
  kind: 'command',
  syntax: 'LET <var>=<expr>',
  description: 'Assign a variable.',
};
const PROC: ReferenceEntry = {
  name: 'PROC',
  kind: 'command',
  syntax: 'PROC<name>',
  description: 'Call a procedure.',
};
const GOTO: ReferenceEntry = {
  name: 'GOTO',
  kind: 'command',
  syntax: 'GOTO <line>',
  description: 'Jump to a line.',
};
const JUMP: KeywordEquivalence = {
  concept: 'unconditional-jump',
  spellings: { zx81: 'GOTO', zxspectrum: 'GO TO', bbc: 'GOTO' },
};
const PLUS: ReferenceEntry = {
  name: '+',
  kind: 'operator',
  syntax: '<expr> + <expr>',
  description: 'Add.',
};
const NOT_OP: ReferenceEntry = {
  name: 'NOT',
  kind: 'operator',
  syntax: 'NOT <expr>',
  description: 'Logical negation.',
};

describe('diffKeywords', () => {
  it('buckets source-only names into mustReplace', () => {
    const diff = diffKeywords(refTable([PRINT, LET]), refTable([PRINT]));
    expect(diff.mustReplace.map((e) => e.name)).toEqual(['LET']);
    expect(diff.newlyAvailable).toEqual([]);
    expect(diff.unchanged).toBe(1);
  });

  it('buckets target-only names into newlyAvailable', () => {
    const diff = diffKeywords(refTable([PRINT]), refTable([PRINT, PROC]));
    expect(diff.newlyAvailable.map((e) => e.name)).toEqual(['PROC']);
    expect(diff.mustReplace).toEqual([]);
  });

  it('flags a differing kind as a behaviour change', () => {
    const asFunction: ReferenceEntry = { ...PRINT, kind: 'function' };
    const diff = diffKeywords(refTable([PRINT]), refTable([asFunction]));
    expect(diff.behaviourChanged).toHaveLength(1);
    expect(diff.behaviourChanged[0]!.from.kind).toBe('command');
    expect(diff.behaviourChanged[0]!.to.kind).toBe('function');
    expect(diff.unchanged).toBe(0);
  });

  // The reference tables disagree about which operators earn a row, so diffing
  // them reports editorial choices as language differences - "the ZX81 lacks
  // `(`". They are excluded from every bucket instead.
  it('never reports an operator as missing, gained or changed', () => {
    const diff = diffKeywords(
      refTable([PRINT, PLUS, NOT_OP]),
      refTable([PRINT]),
    );
    expect(diff.mustReplace).toEqual([]);
    expect(diff.newlyAvailable).toEqual([]);
    expect(diff.behaviourChanged).toEqual([]);
    expect(diff.unchanged).toBe(1);
  });

  it('ignores an operator the target tabulates and the source does not', () => {
    const diff = diffKeywords(refTable([PRINT]), refTable([PRINT, PLUS]));
    expect(diff.newlyAvailable).toEqual([]);
  });

  // NOT is an operator row on the BBC page and a function row on the ZX81's.
  // Filtering each page on its own would report it as newly available on a
  // machine that has had it all along, so the exclusion spans both pages.
  it('ignores a keyword either page calls an operator', () => {
    const asFunction: ReferenceEntry = { ...NOT_OP, kind: 'function' };
    const diff = diffKeywords(refTable([NOT_OP]), refTable([asFunction]));
    expect(diff.behaviourChanged).toEqual([]);
    expect(diff.newlyAvailable).toEqual([]);
    expect(diff.mustReplace).toEqual([]);

    const reverse = diffKeywords(refTable([asFunction]), refTable([NOT_OP]));
    expect(reverse.newlyAvailable).toEqual([]);
    expect(reverse.mustReplace).toEqual([]);
  });

  it('reports an equivalent spelling as a rename, not a loss and a gain', () => {
    const goTo: ReferenceEntry = { ...GOTO, name: 'GO TO' };
    const diff = diffKeywords(refTable([GOTO]), refTable([goTo]), {
      from: 'zx81',
      to: 'zxspectrum',
      equivalences: [JUMP],
    });
    expect(diff.renamed).toHaveLength(1);
    expect(diff.renamed[0]!.from.name).toBe('GOTO');
    expect(diff.renamed[0]!.to.name).toBe('GO TO');
    expect(diff.mustReplace).toEqual([]);
    expect(diff.newlyAvailable).toEqual([]);
  });

  it('leaves a genuinely absent command in mustReplace', () => {
    const diff = diffKeywords(refTable([GOTO]), refTable([PRINT]), {
      from: 'zx81',
      to: 'zxspectrum',
      equivalences: [JUMP],
    });
    expect(diff.mustReplace.map((e) => e.name)).toEqual(['GOTO']);
    expect(diff.renamed).toEqual([]);
  });

  it('ignores an equivalence group that does not name both pages', () => {
    const goTo: ReferenceEntry = { ...GOTO, name: 'GO TO' };
    const diff = diffKeywords(refTable([GOTO]), refTable([goTo]), {
      from: 'atom',
      to: 'bbc',
      equivalences: [JUMP],
    });
    expect(diff.renamed).toEqual([]);
    expect(diff.mustReplace.map((e) => e.name)).toEqual(['GOTO']);
  });

  it('flags a differing syntax as a behaviour change', () => {
    const wider: ReferenceEntry = { ...PRINT, syntax: 'PRINT [<expr>][;|,]' };
    const diff = diffKeywords(refTable([PRINT]), refTable([wider]));
    expect(diff.behaviourChanged).toHaveLength(1);
  });

  it('ignores whitespace-only syntax differences', () => {
    const respaced: ReferenceEntry = { ...PRINT, syntax: 'PRINT   [<expr>]' };
    const diff = diffKeywords(refTable([PRINT]), refTable([respaced]));
    expect(diff.behaviourChanged).toEqual([]);
    expect(diff.unchanged).toBe(1);
  });

  it('ignores description differences', () => {
    const reworded: ReferenceEntry = {
      ...PRINT,
      description: 'Different prose.',
    };
    const diff = diffKeywords(refTable([PRINT]), refTable([reworded]));
    expect(diff.behaviourChanged).toEqual([]);
    expect(diff.unchanged).toBe(1);
  });

  it('returns empty buckets for a self-compare', () => {
    const table = refTable([PRINT, LET, PROC]);
    const diff = diffKeywords(table, table);
    expect(diff.mustReplace).toEqual([]);
    expect(diff.newlyAvailable).toEqual([]);
    expect(diff.behaviourChanged).toEqual([]);
    expect(diff.unchanged).toBe(3);
  });

  it('sorts each bucket by name', () => {
    const diff = diffKeywords(
      refTable([PROC, LET, PRINT]),
      refTable([{ ...PRINT }]),
    );
    // LET and PROC are source-only; PRINT is unchanged.
    expect(diff.mustReplace.map((e) => e.name)).toEqual(['LET', 'PROC']);
  });
});

/** Build a minimal escape table from bare entries. */
function escTable(entries: EscapeTableData['entries']): EscapeTableData {
  return { title: 't', machines: ['m'], categories: [], entries };
}

const INK: EscapeTableData['entries'][number] = {
  escape: '{INK n}',
  bytes: '0x10 n',
  category: 'colour',
  description: 'Set ink colour.',
  example: { source: '{INK 2}', bytes: [0x10, 2] },
};
const BLOCK: EscapeTableData['entries'][number] = {
  escape: '▘',
  bytes: '0x01',
  category: 'graphics',
  description: 'Top-left block.',
  example: { source: '▘', bytes: [0x01] },
};

describe('diffEscapes', () => {
  it('buckets source-only, target-only and changed escapes', () => {
    const changedBlock = { ...BLOCK, bytes: '0x81' };
    const diff = diffEscapes(escTable([INK, BLOCK]), escTable([changedBlock]));
    expect(diff.mustReplace.map((e) => e.escape)).toEqual(['{INK n}']);
    expect(diff.behaviourChanged.map((c) => c.escape)).toEqual(['▘']);
    expect(diff.newlyAvailable).toEqual([]);
  });

  it('treats a differing category as a change', () => {
    const recat = { ...INK, category: 'control' };
    const diff = diffEscapes(escTable([INK]), escTable([recat]));
    expect(diff.behaviourChanged).toHaveLength(1);
    expect(diff.unchanged).toBe(0);
  });

  it('counts identical escapes as unchanged', () => {
    const diff = diffEscapes(escTable([INK, BLOCK]), escTable([INK, BLOCK]));
    expect(diff.unchanged).toBe(2);
    expect(diff.mustReplace).toEqual([]);
  });
});

describe('falseFriendsBetween', () => {
  const LOG: FalseFriend = {
    keyword: 'LOG',
    meanings: {
      bbc: 'Base-10 logarithm.',
      atom: 'Base-10 logarithm.',
      commodore: 'Natural logarithm.',
    },
  };

  it('warns when both pages have the spelling with different meanings', () => {
    const warnings = falseFriendsBetween('bbc', 'commodore', [LOG]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.keyword).toBe('LOG');
    expect(warnings[0]!.from).toBe('Base-10 logarithm.');
    expect(warnings[0]!.to).toBe('Natural logarithm.');
  });

  it('stays silent when the two pages agree', () => {
    expect(falseFriendsBetween('bbc', 'atom', [LOG])).toEqual([]);
  });

  it('stays silent when either page has nothing to say', () => {
    expect(falseFriendsBetween('bbc', 'zx81', [LOG])).toEqual([]);
    expect(falseFriendsBetween('zx81', 'commodore', [LOG])).toEqual([]);
  });
});

describe('composeGuidance', () => {
  /** Minimal PortingFacts; only the guidance-bearing fields matter here. */
  function facts(over: Partial<PortingFacts> & { id: string }): PortingFacts {
    return {
      lineNumberRange: '1–9999',
      statementSeparator: null,
      elseSupported: false,
      letRequired: 'optional',
      variableNaming: 'A–Z',
      screen: 'text',
      freeRamBytes: 1024,
      colour: 'none',
      sound: 'none',
      memoryWriteSyntax: 'POKE addr,val',
      addressNotation: 'dec',
      portingNotes: [],
      substitutions: [],
      ...over,
    };
  }

  const LOG: FalseFriend = {
    keyword: 'LOG',
    meanings: { bbc: 'Base-10 logarithm.', commodore: 'Natural logarithm.' },
  };
  const PAIRS: PairPortingNotes[] = [
    { from: 'zx81', to: 'zxspectrum', notes: ['Jumps are GO TO here.'] },
    { from: 'zxspectrum', to: 'zx81', notes: ['Code moves back into REM.'] },
  ];

  it('selects the notes for exactly this ordered pair', () => {
    const g = composeGuidance({
      from: 'zx81',
      to: 'zxspectrum',
      targetFacts: facts({ id: 'zxspectrum' }),
      pairNotes: PAIRS,
      falseFriends: [],
    });
    expect(g.pairNotes).toEqual(['Jumps are GO TO here.']);
  });

  it('is directional: the reverse pair gets its own notes', () => {
    const g = composeGuidance({
      from: 'zxspectrum',
      to: 'zx81',
      targetFacts: facts({ id: 'zx81' }),
      pairNotes: PAIRS,
      falseFriends: [],
    });
    expect(g.pairNotes).toEqual(['Code moves back into REM.']);
  });

  it('returns no pair notes when the pair has none', () => {
    const g = composeGuidance({
      from: 'zx81',
      to: 'bbc',
      targetFacts: facts({ id: 'bbc' }),
      pairNotes: PAIRS,
      falseFriends: [],
    });
    expect(g.pairNotes).toEqual([]);
  });

  it('surfaces the target notes, substitutions and false friends', () => {
    const g = composeGuidance({
      from: 'bbc',
      to: 'commodore',
      targetFacts: facts({
        id: 'commodore',
        portingNotes: ['No ELSE here.'],
        substitutions: [{ keyword: 'ELSE', note: 'Invert the test.' }],
      }),
      pairNotes: PAIRS,
      falseFriends: [LOG],
    });
    expect(g.targetNotes).toEqual(['No ELSE here.']);
    expect(g.substitutions.get('ELSE')).toBe('Invert the test.');
    expect(g.falseFriends.map((f) => f.keyword)).toEqual(['LOG']);
  });

  it('is empty-safe when the target facts are missing', () => {
    const g = composeGuidance({
      from: 'zx81',
      to: 'zxspectrum',
      targetFacts: undefined,
      pairNotes: PAIRS,
      falseFriends: [LOG],
    });
    expect(g.targetNotes).toEqual([]);
    expect(g.substitutions.size).toBe(0);
    // Pair notes and false friends do not depend on the target facts.
    expect(g.pairNotes).toEqual(['Jumps are GO TO here.']);
  });
});
