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
import type { KeywordDomain } from '../../reference/data/domains';
import type { DomainGuidance } from '../../reference/data/domain-guidance';
import {
  capabilityBrief,
  composeGuidance,
  diffEscapes,
  diffKeywords,
  domainSections,
  falseFriendsBetween,
  groupByDomain,
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

  const SOUND_CELL: DomainGuidance = {
    to: 'zx81',
    domain: 'sound',
    support: 'none',
    summary: 'No sound.',
    instead: 'Drop the effect.',
  };
  const GRAPHICS_CELL: DomainGuidance = {
    to: 'zxspectrum',
    domain: 'graphics',
    support: 'full',
    summary: 'PLOT/DRAW/CIRCLE cover it.',
  };

  it('scopes the domains map to the target, keyed by domain', () => {
    const g = composeGuidance({
      from: 'bbc',
      to: 'zx81',
      pairNotes: [],
      falseFriends: [],
      domainGuidance: [SOUND_CELL, GRAPHICS_CELL],
    });
    expect([...g.domains.keys()]).toEqual(['sound']);
    expect(g.domains.get('sound')).toBe(SOUND_CELL);
  });

  it('is empty when domainGuidance is omitted', () => {
    const g = composeGuidance({
      from: 'bbc',
      to: 'zx81',
      pairNotes: [],
      falseFriends: [],
    });
    expect(g.domains.size).toBe(0);
  });
});

/** A bare entry carrying just the fields the grouping cares about. */
function domained(name: string, domain?: KeywordDomain): ReferenceEntry {
  return {
    name,
    kind: 'command',
    syntax: name,
    description: `${name}.`,
    ...(domain ? { domain } : {}),
  };
}

// Deliberately not the canonical vocabulary order, so "honours the order given"
// is distinguishable from "happens to match the real order".
const ORDER: KeywordDomain[] = ['graphics', 'control-flow', 'sound'];

describe('groupByDomain', () => {
  it('returns buckets in the supplied order, not alphabetically', () => {
    const buckets = groupByDomain(
      [
        domained('BEEP', 'sound'),
        domained('GOTO', 'control-flow'),
        domained('PLOT', 'graphics'),
      ],
      ORDER,
    );
    expect(buckets.map((b) => b.domain)).toEqual([
      'graphics',
      'control-flow',
      'sound',
    ]);
  });

  it('omits domains nothing landed in', () => {
    const buckets = groupByDomain([domained('PLOT', 'graphics')], ORDER);
    expect(buckets.map((b) => b.domain)).toEqual(['graphics']);
  });

  it('preserves the input order within a bucket', () => {
    const buckets = groupByDomain(
      [
        domained('PLOT', 'graphics'),
        domained('DRAW', 'graphics'),
        domained('CIRCLE', 'graphics'),
      ],
      ORDER,
    );
    expect(buckets[0].entries.map((e) => e.name)).toEqual([
      'PLOT',
      'DRAW',
      'CIRCLE',
    ]);
  });

  it('puts an undomained entry in a trailing bucket rather than dropping it', () => {
    const buckets = groupByDomain(
      [domained('PLOT', 'graphics'), domained('LDA')],
      ORDER,
    );
    expect(buckets.map((b) => b.domain)).toEqual(['graphics', undefined]);
    expect(buckets[1].entries.map((e) => e.name)).toEqual(['LDA']);
  });

  it('yields no buckets for empty input', () => {
    expect(groupByDomain([], ORDER)).toEqual([]);
  });
});

describe('domainSections', () => {
  it('reports a domain the target lacks entirely above one it provides', () => {
    // The target has control-flow but no sound at all.
    const target = refTable([domained('GOTO', 'control-flow')]);
    const sections = domainSections(
      [domained('GOSUB', 'control-flow'), domained('BEEP', 'sound')],
      target,
      ORDER,
    );
    expect(sections.map((s) => s.domain)).toEqual(['sound', 'control-flow']);
    expect(sections.map((s) => s.absentFromTarget)).toEqual([true, false]);
  });

  it('falls back to the supplied vocabulary order when the tier ties', () => {
    // The target provides neither, so both are absent and only order separates
    // them - graphics comes before sound in ORDER.
    const sections = domainSections(
      [domained('BEEP', 'sound'), domained('PLOT', 'graphics')],
      refTable([domained('GOTO', 'control-flow')]),
      ORDER,
    );
    expect(sections.map((s) => s.domain)).toEqual(['graphics', 'sound']);
  });

  it('still lists a group whose domain the target has nothing in', () => {
    const sections = domainSections(
      [domained('BEEP', 'sound'), domained('PLAY', 'sound')],
      refTable([domained('GOTO', 'control-flow')]),
      ORDER,
    );
    expect(sections).toHaveLength(1);
    expect(sections[0].entries.map((e) => e.name)).toEqual(['BEEP', 'PLAY']);
  });

  it('loses no entry: every command lands in exactly one group', () => {
    const entries = [
      domained('BEEP', 'sound'),
      domained('PLOT', 'graphics'),
      domained('GOSUB', 'control-flow'),
      domained('DRAW', 'graphics'),
    ];
    const sections = domainSections(entries, refTable([]), ORDER);
    const grouped = sections.flatMap((s) => s.entries.map((e) => e.name));
    expect(grouped.sort()).toEqual(entries.map((e) => e.name).sort());
  });

  it('orders none above partial above full when given a guidance table', () => {
    const target = refTable([
      domained('GOTO', 'control-flow'),
      domained('PLOT', 'graphics'),
    ]);
    const guidance: DomainGuidance[] = [
      { to: 'x', domain: 'graphics', support: 'partial', summary: 's' },
      { to: 'x', domain: 'control-flow', support: 'full', summary: 's' },
      { to: 'x', domain: 'sound', support: 'none', summary: 's' },
    ];
    const sections = domainSections(
      [
        domained('BEEP', 'sound'),
        domained('DRAW', 'graphics'),
        domained('GOSUB', 'control-flow'),
      ],
      target,
      ORDER,
      guidance,
      'x',
    );
    expect(sections.map((s) => s.support)).toEqual(['none', 'partial', 'full']);
    expect(sections.map((s) => s.domain)).toEqual([
      'sound',
      'graphics',
      'control-flow',
    ]);
  });

  it('ties by the supplied vocabulary order within a support tier', () => {
    // Both graphics and sound are 'none' - only ORDER separates them.
    const guidance: DomainGuidance[] = [
      { to: 'x', domain: 'graphics', support: 'none', summary: 's' },
      { to: 'x', domain: 'sound', support: 'none', summary: 's' },
    ];
    const sections = domainSections(
      [domained('BEEP', 'sound'), domained('PLOT', 'graphics')],
      refTable([]),
      ORDER,
      guidance,
      'x',
    );
    expect(sections.map((s) => s.domain)).toEqual(['graphics', 'sound']);
  });

  it('falls back to present/absent when no cell names the domain', () => {
    const target = refTable([domained('GOTO', 'control-flow')]);
    const sections = domainSections(
      [domained('BEEP', 'sound'), domained('GOSUB', 'control-flow')],
      target,
      ORDER,
      [],
      'x',
    );
    expect(sections.map((s) => s.support)).toEqual(['none', 'full']);
  });
});

describe('capabilityBrief', () => {
  const GUIDANCE: DomainGuidance[] = [
    {
      to: 'bbc',
      domain: 'graphics',
      support: 'full',
      summary: 'Full vector graphics.',
      reachFor: ['DRAW', 'PLOT', 'MISSING'],
    },
    {
      to: 'bbc',
      domain: 'sound',
      support: 'full',
      summary: 'Four-channel sound.',
    },
  ];

  it('reports one line per capability with its gain count', () => {
    const briefs = capabilityBrief(
      [
        domained('DRAW', 'graphics'),
        domained('PLOT', 'graphics'),
        domained('CIRCLE', 'graphics'),
      ],
      'bbc',
      GUIDANCE,
      ORDER,
    );
    expect(briefs).toHaveLength(1);
    expect(briefs[0].domain).toBe('graphics');
    expect(briefs[0].count).toBe(3);
    expect(briefs[0].summary).toBe('Full vector graphics.');
  });

  it('prefers the authored reachFor names, dropping one the source already has', () => {
    const briefs = capabilityBrief(
      [domained('DRAW', 'graphics'), domained('CIRCLE', 'graphics')],
      'bbc',
      GUIDANCE,
      ORDER,
    );
    // MISSING is not in newlyAvailable (the source already has it), so it is
    // dropped; PLOT is authored but not gained here, so it never appears.
    expect(briefs[0].reachFor).toEqual(['DRAW']);
  });

  it('falls back to the bucket’s own first names with no reachFor match', () => {
    const briefs = capabilityBrief(
      [domained('BEEP', 'sound'), domained('ENVELOPE', 'sound')],
      'bbc',
      GUIDANCE,
      ORDER,
    );
    expect(briefs[0].reachFor).toEqual(['BEEP', 'ENVELOPE']);
  });

  it('orders lines by size of gain, largest first', () => {
    const briefs = capabilityBrief(
      [
        domained('BEEP', 'sound'),
        domained('DRAW', 'graphics'),
        domained('PLOT', 'graphics'),
      ],
      'bbc',
      GUIDANCE,
      ORDER,
    );
    expect(briefs.map((b) => b.domain)).toEqual(['graphics', 'sound']);
  });

  it('yields no lines for empty input', () => {
    expect(capabilityBrief([], 'bbc', GUIDANCE, ORDER)).toEqual([]);
  });

  it('skips a domain with no guidance cell for the target', () => {
    const briefs = capabilityBrief(
      [domained('GOSUB', 'control-flow')],
      'bbc',
      GUIDANCE,
      ORDER,
    );
    expect(briefs).toEqual([]);
  });
});
