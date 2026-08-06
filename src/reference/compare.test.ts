import { describe, expect, it } from 'vitest';
import type {
  EscapeTableData,
  FalseFriend,
  KeywordEquivalence,
  PairPortingNotes,
  PortingFacts,
  ReferenceEntry,
  ReferenceTableData,
} from './types';
import type { KeywordDomain } from './domains';
import type { DomainGuidance } from './domain-guidance';
import {
  capabilitySections,
  composeGuidance,
  diffEscapes,
  diffForProgram,
  diffKeywords,
  escapeDiffForProgram,
  escapeSections,
  escapeTableForMachine,
  falseFriendsBetween,
  falseFriendsForProgram,
  groupByDomain,
  noticeState,
  statementLayoutForProgram,
  tableForMachine,
  unsupportedCharactersForProgram,
  type ProgramVocabulary,
} from './compare';

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
const ABS: ReferenceEntry = {
  name: 'ABS',
  kind: 'function',
  syntax: 'ABS(<number>)',
  description: 'Absolute value.',
};
const DRAW: ReferenceEntry = {
  name: 'DRAW',
  kind: 'command',
  syntax: 'DRAW <number>, <number>',
  description: 'Draw a line.',
};
const LIST: ReferenceEntry = {
  name: 'LIST',
  kind: 'command',
  syntax: 'LIST [<line>]',
  description: 'List the program.',
};
const DEG: ReferenceEntry = {
  name: 'DEG',
  kind: 'function',
  syntax: 'DEG',
  description: 'Degrees.',
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

/** A row only the CPC 6128 has, standing in for any BASIC-version addition. */
const FILL: ReferenceEntry = {
  name: 'FILL',
  kind: 'command',
  syntax: 'FILL <pen>',
  description: 'Flood-fill from the graphics cursor.',
  tag: 'BASIC 1.1 only',
  onlyOn: ['cpc6128'],
};

describe('tableForMachine', () => {
  const page = refTable([PRINT, FILL]);

  it('keeps unscoped rows and drops rows another machine owns', () => {
    expect(tableForMachine(page, 'cpc464').entries).toEqual([PRINT]);
  });

  it('keeps a scoped row for the machine that owns it', () => {
    expect(tableForMachine(page, 'cpc6128').entries).toEqual([PRINT, FILL]);
  });

  it('leaves the source table untouched', () => {
    tableForMachine(page, 'cpc464');
    expect(page.entries).toEqual([PRINT, FILL]);
  });

  it('carries the rest of the table through', () => {
    const narrowed = tableForMachine(page, 'cpc464');
    expect(narrowed.title).toBe(page.title);
    expect(narrowed.machines).toEqual(page.machines);
  });

  // The whole point of the helper: diffing unions reports commands the reader's
  // machine does not have, and offers commands the target does not have.
  it('stops a sibling-only command being reported as a gain', () => {
    const union = diffKeywords(refTable([PRINT]), page);
    expect(union.newlyAvailable.map((e) => e.name)).toEqual(['FILL']);

    const perMachine = diffKeywords(
      refTable([PRINT]),
      tableForMachine(page, 'cpc464'),
    );
    expect(perMachine.newlyAvailable).toEqual([]);
  });

  it('still reports the command as a gain on the machine that has it', () => {
    const diff = diffKeywords(
      refTable([PRINT]),
      tableForMachine(page, 'cpc6128'),
    );
    expect(diff.newlyAvailable.map((e) => e.name)).toEqual(['FILL']);
  });
});

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

  // Every page draws its placeholders from one vocabulary, but a page may be more
  // specific than another about the same argument, and each names a slot in its
  // own machine's words where the machines' documentation differs. That is a
  // difference between two docs pages, not between two machines.
  it('ignores a syntax difference that is only how the pages name placeholders', () => {
    const typed: ReferenceEntry = { ...ABS, syntax: 'ABS(<number>)' };
    const looser: ReferenceEntry = { ...ABS, syntax: 'ABS(<expr>)' };
    const diff = diffKeywords(refTable([typed]), refTable([looser]));
    expect(diff.behaviourChanged).toEqual([]);
    expect(diff.unchanged).toBe(1);
  });

  it('ignores placeholder naming across a whole argument list', () => {
    const typed: ReferenceEntry = {
      ...DRAW,
      syntax: 'DRAW <number>, <number>',
    };
    const named: ReferenceEntry = { ...DRAW, syntax: 'DRAW <x>, <y>' };
    const diff = diffKeywords(refTable([typed]), refTable([named]));
    expect(diff.behaviourChanged).toEqual([]);
  });

  it('still reports a parenthesisation difference, as "parens"', () => {
    const bracketed: ReferenceEntry = { ...ABS, syntax: 'ABS(<number>)' };
    const bare: ReferenceEntry = { ...ABS, syntax: 'ABS <number>' };
    const diff = diffKeywords(refTable([bracketed]), refTable([bare]));
    expect(diff.behaviourChanged.map((c) => c.change)).toEqual(['parens']);
  });

  it('still reports an argument difference, as "arguments"', () => {
    const plain: ReferenceEntry = {
      ...DRAW,
      syntax: 'DRAW <number>, <number>',
    };
    const inked: ReferenceEntry = {
      ...DRAW,
      syntax: 'DRAW <x>, <y>, <pen>',
    };
    const diff = diffKeywords(refTable([plain]), refTable([inked]));
    expect(diff.behaviourChanged.map((c) => c.change)).toEqual(['arguments']);
  });

  it('still reports an optional-argument difference the shapes keep', () => {
    const ranged: ReferenceEntry = {
      ...LIST,
      syntax: 'LIST [<line>][-[<line>]]',
    };
    const single: ReferenceEntry = { ...LIST, syntax: 'LIST [<line>]' };
    const diff = diffKeywords(refTable([ranged]), refTable([single]));
    expect(diff.behaviourChanged.map((c) => c.change)).toEqual(['arguments']);
  });

  it('reports a changed kind as "kind", whatever the syntax says', () => {
    const asFunction: ReferenceEntry = { ...DEG, kind: 'function' };
    const asCommand: ReferenceEntry = { ...DEG, kind: 'command' };
    const diff = diffKeywords(refTable([asFunction]), refTable([asCommand]));
    expect(diff.behaviourChanged.map((c) => c.change)).toEqual(['kind']);
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

describe('escapeTableForMachine', () => {
  // The real case: the Spectrum's \a UDG rows are 48K-only, because a 128K
  // reads 0xA3/0xA4 as the SPECTRUM and PLAY tokens instead.
  const UDG: EscapeTableData['entries'][number] = {
    escape: '\\a',
    bytes: '0xA3',
    category: 'udg',
    description: 'User-defined graphic A.',
    tag: '48K only',
    onlyOn: ['zxspectrum'],
    example: { source: '\\a', bytes: [0xa3] },
  };
  const page = escTable([INK, UDG]);

  it('drops a 48K-only row for the 128K', () => {
    expect(escapeTableForMachine(page, 'zxspectrum128').entries).toEqual([INK]);
  });

  it('keeps it for the 48K', () => {
    expect(escapeTableForMachine(page, 'zxspectrum').entries).toEqual([
      INK,
      UDG,
    ]);
  });

  it('carries the categories through', () => {
    expect(escapeTableForMachine(page, 'zxspectrum128').categories).toEqual(
      page.categories,
    );
  });
});

describe('escapeSections', () => {
  const CURSOR: EscapeTableData['entries'][number] = {
    escape: '{home}',
    bytes: '0x13',
    category: 'cursor',
    description: 'Cursor home.',
    example: { source: '{home}', bytes: [0x13] },
  };
  const RAW: EscapeTableData['entries'][number] = {
    escape: '{$xx}',
    bytes: '0xnn',
    category: 'raw',
    description: 'Any raw byte.',
    example: { source: '{$aa}', bytes: [0xaa] },
  };
  /** Colour before graphics before raw, as a real escape table declares them. */
  const categories = [
    { id: 'colour', label: 'Colours' },
    { id: 'graphics', label: 'Block graphics' },
    { id: 'cursor', label: 'Cursor' },
    { id: 'raw', label: 'Raw bytes' },
  ];
  const table = (entries: EscapeTableData['entries']): EscapeTableData => ({
    title: 't',
    machines: ['m'],
    categories,
    entries,
  });

  it('groups in the table’s own category order, not alphabetically', () => {
    const sections = escapeSections(
      [RAW, BLOCK, INK, CURSOR],
      table([RAW, BLOCK, INK, CURSOR]),
    );
    expect(sections.map((s) => s.category)).toEqual([
      'colour',
      'graphics',
      'cursor',
      'raw',
    ]);
    expect(sections.map((s) => s.label)).toEqual([
      'Colours',
      'Block graphics',
      'Cursor',
      'Raw bytes',
    ]);
  });

  it('omits a category nothing landed in', () => {
    const sections = escapeSections([INK], table([INK, BLOCK]));
    expect(sections.map((s) => s.category)).toEqual(['colour']);
  });

  it('loses no code: every one lands in exactly one group', () => {
    const entries = [RAW, BLOCK, INK, CURSOR];
    const sections = escapeSections(entries, table(entries));
    const grouped = sections.flatMap((s) => s.entries.map((e) => e.escape));
    expect(grouped.sort()).toEqual(entries.map((e) => e.escape).sort());
  });

  it('counts per group', () => {
    const second = { ...INK, escape: '{PAPER n}' };
    const sections = escapeSections([INK, second, BLOCK], table([]));
    expect(sections.map((s) => s.entries.length)).toEqual([2, 1]);
  });

  it('puts a code whose category the table does not declare in a trailing bucket', () => {
    const odd = { ...INK, escape: '{odd}', category: 'unlisted' };
    const sections = escapeSections([INK, odd], table([]));
    expect(sections.map((s) => s.category)).toEqual(['colour', undefined]);
    expect(sections[1].entries.map((e) => e.escape)).toEqual(['{odd}']);
  });

  it('yields no sections for no codes', () => {
    expect(escapeSections([], table([]))).toEqual([]);
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
      basicDialect: 'Test BASIC',
      lineNumberRange: '1–9999',
      statementSeparator: null,
      elseSupported: false,
      letRequired: 'optional',
      variableNaming: 'A–Z',
      unsupportedCharacters: [],
      numberHandling: 'Floating point.',
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
    {
      from: 'zx81',
      to: 'zxspectrum',
      notes: [{ text: 'Jumps are GO TO here.' }],
    },
    {
      from: 'zxspectrum',
      to: 'zx81',
      notes: [{ text: 'Code moves back into REM.' }],
    },
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
        portingNotes: [{ text: 'No ELSE here.', topics: ['control-flow'] }],
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

  // The pair notes lead the one guidance section and the target notes follow
  // them, so a target note whose points a pair note has already made would be
  // read twice under one heading.
  describe('target notes the pair notes have already made', () => {
    const TARGET = facts({
      id: 'commodore',
      portingNotes: [
        { text: 'No ELSE here.', topics: ['control-flow'] },
        { text: 'Two significant characters.', topics: ['variable-names'] },
        {
          text: 'No graphics or sound keywords.',
          topics: ['graphics', 'sound'],
        },
      ],
    });

    function guidanceFor(notes: PairPortingNotes['notes']) {
      return composeGuidance({
        from: 'bbc',
        to: 'commodore',
        targetFacts: TARGET,
        pairNotes: [{ from: 'bbc', to: 'commodore', notes }],
        falseFriends: [],
      });
    }

    it('drops a target note whose only topic a pair note covers', () => {
      const g = guidanceFor([
        {
          text: 'Every structured block becomes IF…THEN.',
          covers: ['control-flow'],
        },
      ]);
      expect(g.targetNotes).toEqual([
        'Two significant characters.',
        'No graphics or sound keywords.',
      ]);
      expect(g.pairNotes).toEqual(['Every structured block becomes IF…THEN.']);
    });

    it('keeps a target note only partly covered', () => {
      const g = guidanceFor([
        { text: 'Graphics are POKEs.', covers: ['graphics'] },
      ]);
      expect(g.targetNotes).toContain('No graphics or sound keywords.');
    });

    it('drops it once the pair notes between them cover every topic', () => {
      const g = guidanceFor([
        { text: 'Graphics are POKEs.', covers: ['graphics'] },
        { text: 'Sound is POKEs too.', covers: ['sound'] },
      ]);
      expect(g.targetNotes).not.toContain('No graphics or sound keywords.');
    });

    it('keeps every target note when the pair covers nothing', () => {
      const g = guidanceFor([{ text: 'A steep step down.' }]);
      expect(g.targetNotes).toHaveLength(3);
    });

    it('keeps every target note for a pair with no notes of its own', () => {
      const g = composeGuidance({
        from: 'zx81',
        to: 'commodore',
        targetFacts: TARGET,
        pairNotes: [],
        falseFriends: [],
      });
      expect(g.targetNotes).toHaveLength(3);
    });
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

describe('capabilitySections', () => {
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

  it('reports a domain the target lacks entirely above one it provides', () => {
    // The target has control-flow but no sound at all.
    const target = refTable([domained('GOTO', 'control-flow')]);
    const sections = capabilitySections(
      [domained('GOSUB', 'control-flow'), domained('BEEP', 'sound')],
      [],
      target,
      ORDER,
    );
    expect(sections.map((s) => s.domain)).toEqual(['sound', 'control-flow']);
    expect(sections.map((s) => s.absentFromTarget)).toEqual([true, false]);
  });

  it('falls back to the supplied vocabulary order when the tier ties', () => {
    // The target provides neither, so both are absent and only order separates
    // them - graphics comes before sound in ORDER.
    const sections = capabilitySections(
      [domained('BEEP', 'sound'), domained('PLOT', 'graphics')],
      [],
      refTable([domained('GOTO', 'control-flow')]),
      ORDER,
    );
    expect(sections.map((s) => s.domain)).toEqual(['graphics', 'sound']);
  });

  it('still lists a group whose domain the target has nothing in', () => {
    const sections = capabilitySections(
      [domained('BEEP', 'sound'), domained('PLAY', 'sound')],
      [],
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
    const sections = capabilitySections(entries, [], refTable([]), ORDER);
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
    const sections = capabilitySections(
      [
        domained('BEEP', 'sound'),
        domained('DRAW', 'graphics'),
        domained('GOSUB', 'control-flow'),
      ],
      [],
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
    const sections = capabilitySections(
      [domained('BEEP', 'sound'), domained('PLOT', 'graphics')],
      [],
      refTable([]),
      ORDER,
      guidance,
      'x',
    );
    expect(sections.map((s) => s.domain)).toEqual(['graphics', 'sound']);
  });

  it('falls back to present/absent when no cell names the domain', () => {
    const target = refTable([domained('GOTO', 'control-flow')]);
    const sections = capabilitySections(
      [domained('BEEP', 'sound'), domained('GOSUB', 'control-flow')],
      [],
      target,
      ORDER,
      [],
      'x',
    );
    expect(sections.map((s) => s.support)).toEqual(['none', 'full']);
  });

  // The whole point of the merge: one account of a capability, not one under
  // what the port loses and another under what it gains.
  it('reports what a capability loses and gains in one section', () => {
    const sections = capabilitySections(
      [domained('CIRCLE', 'graphics')],
      [domained('DRAW', 'graphics'), domained('PLOT', 'graphics')],
      refTable([domained('DRAW', 'graphics')]),
      ORDER,
      GUIDANCE,
      'bbc',
    );
    expect(sections).toHaveLength(1);
    expect(sections[0].entries.map((e) => e.name)).toEqual(['CIRCLE']);
    expect(sections[0].gained?.count).toBe(2);
    expect(sections[0].gained?.summary).toBe('Full vector graphics.');
  });

  it('puts a capability it only gains in after the ones it loses from', () => {
    const sections = capabilitySections(
      [domained('BEEP', 'sound')],
      [domained('DRAW', 'graphics')],
      refTable([domained('DRAW', 'graphics')]),
      ORDER,
      GUIDANCE,
      'bbc',
    );
    expect(sections.map((s) => s.domain)).toEqual(['sound', 'graphics']);
    expect(sections[1].entries).toEqual([]);
    expect(sections[1].gained?.count).toBe(1);
  });

  it('orders gain-only capabilities by size of gain, largest first', () => {
    const sections = capabilitySections(
      [],
      [
        domained('BEEP', 'sound'),
        domained('DRAW', 'graphics'),
        domained('PLOT', 'graphics'),
      ],
      refTable([]),
      ORDER,
      GUIDANCE,
      'bbc',
    );
    expect(sections.map((s) => s.domain)).toEqual(['graphics', 'sound']);
  });

  it('prefers the authored reachFor names, dropping one the source already has', () => {
    const sections = capabilitySections(
      [],
      [domained('DRAW', 'graphics'), domained('CIRCLE', 'graphics')],
      refTable([]),
      ORDER,
      GUIDANCE,
      'bbc',
    );
    // MISSING is not in newlyAvailable (the source already has it), so it is
    // dropped; PLOT is authored but not gained here, so it never appears.
    expect(sections[0].gained?.reachFor).toEqual(['DRAW']);
  });

  it('falls back to the bucket’s own first names with no reachFor match', () => {
    const sections = capabilitySections(
      [],
      [domained('BEEP', 'sound'), domained('ENVELOPE', 'sound')],
      refTable([]),
      ORDER,
      GUIDANCE,
      'bbc',
    );
    expect(sections[0].gained?.reachFor).toEqual(['BEEP', 'ENVELOPE']);
  });

  it('reports no gain for a domain with no guidance cell for the target', () => {
    const sections = capabilitySections(
      [],
      [domained('GOSUB', 'control-flow')],
      refTable([]),
      ORDER,
      GUIDANCE,
      'bbc',
    );
    expect(sections).toEqual([]);
  });

  it('yields no sections for empty input', () => {
    expect(capabilitySections([], [], refTable([]), ORDER)).toEqual([]);
  });
});

/** A vocabulary reply, defaulted to the machine the diff tests port from. */
function vocab(
  keywords: string[],
  escapeCodes: number[] = [],
  dialectId = 'zx81',
  characters: string[] = [],
  multiStatementLines: number[] = [],
  writeSites: ProgramVocabulary['writeSites'] = [],
): ProgramVocabulary {
  return {
    dialectId,
    keywords,
    escapeCodes,
    characters,
    multiStatementLines,
    writeSites,
  };
}

describe('diffForProgram', () => {
  const diff = diffKeywords(
    refTable([PRINT, LET, PROC, GOTO, ABS]),
    refTable([{ ...PRINT }, { ...ABS, syntax: 'ABS <number>' }, DRAW]),
  );

  it('narrows the commands to rewrite to the ones the program uses', () => {
    expect(diff.mustReplace.map((e) => e.name)).toEqual([
      'GOTO',
      'LET',
      'PROC',
    ]);
    const narrowed = diffForProgram(diff, vocab(['LET', 'PRINT']));
    expect(narrowed.mustReplace.map((e) => e.name)).toEqual(['LET']);
  });

  it('narrows the commands whose usage differs', () => {
    expect(diff.behaviourChanged.map((c) => c.name)).toEqual(['ABS']);
    expect(diffForProgram(diff, vocab(['PRINT'])).behaviourChanged).toEqual([]);
    expect(
      diffForProgram(diff, vocab(['ABS'])).behaviourChanged.map((c) => c.name),
    ).toEqual(['ABS']);
  });

  it('narrows the renames by the source spelling, which is what the program contains', () => {
    const renamedDiff = diffKeywords(
      refTable([GOTO, LET]),
      refTable([{ ...GOTO, name: 'GO TO' }]),
      { from: 'zx81', to: 'zxspectrum', equivalences: [JUMP] },
    );
    expect(renamedDiff.renamed.map((r) => r.from.name)).toEqual(['GOTO']);
    expect(diffForProgram(renamedDiff, vocab(['GO TO'])).renamed).toEqual([]);
    expect(
      diffForProgram(renamedDiff, vocab(['GOTO'])).renamed.map(
        (r) => r.from.name,
      ),
    ).toEqual(['GOTO']);
  });

  it('leaves what the target adds and the unchanged count alone', () => {
    // The load-bearing one. Narrowing the source table before the diff would be
    // a smaller change and would report every command the program did not use
    // as newly available on the target, inverting the whole gains half of the
    // page - so these two deliberately pass straight through.
    const narrowed = diffForProgram(diff, vocab(['LET']));
    expect(narrowed.newlyAvailable.map((e) => e.name)).toEqual(
      diff.newlyAvailable.map((e) => e.name),
    );
    expect(narrowed.newlyAvailable.map((e) => e.name)).toContain('DRAW');
    expect(narrowed.unchanged).toBe(diff.unchanged);
  });

  it('narrows to nothing for a vocabulary sharing no command', () => {
    const narrowed = diffForProgram(diff, vocab(['CIRCLE']));
    expect(narrowed.mustReplace).toEqual([]);
    expect(narrowed.renamed).toEqual([]);
    expect(narrowed.behaviourChanged).toEqual([]);
  });
});

describe('falseFriendsForProgram', () => {
  const warnings = falseFriendsBetween('zx81', 'bbc', [
    {
      keyword: 'CLEAR',
      meanings: { zx81: 'Clears the screen', bbc: 'Clears variables' },
    },
    { keyword: 'DRAW', meanings: { zx81: 'Relative', bbc: 'Absolute' } },
  ]);

  it('keeps only the traps the program can hit', () => {
    expect(warnings.map((w) => w.keyword)).toEqual(['CLEAR', 'DRAW']);
    expect(
      falseFriendsForProgram(warnings, vocab(['DRAW', 'PRINT'])).map(
        (w) => w.keyword,
      ),
    ).toEqual(['DRAW']);
  });

  it('keeps none for a program that uses neither', () => {
    expect(falseFriendsForProgram(warnings, vocab(['PRINT']))).toEqual([]);
  });
});

describe('escapeDiffForProgram', () => {
  const CLR = {
    escape: '{clr}',
    bytes: '0x93',
    category: 'cursor',
    description: 'Clear the screen.',
    example: { source: '{clr}', bytes: [0x93] },
    codes: [0x93],
  };
  const WHITE = {
    escape: '{white}',
    bytes: '0x05',
    category: 'colour',
    description: 'White text.',
    example: { source: '{white}', bytes: [0x05] },
    codes: [0x05],
  };
  const INK_OP = {
    ...INK,
    // Operand-carrying: the row claims the leading byte only, which is exactly
    // what the program analyser records.
    codes: [0x10],
  };
  const RAW = {
    escape: '{$xx}',
    bytes: 'any',
    category: 'raw',
    description: 'Any other byte.',
    example: { source: '{$aa}', bytes: [0xaa] },
    codes: 'rest' as const,
  };
  const diff = diffEscapes(
    escTable([CLR, WHITE, INK_OP, RAW]),
    escTable([BLOCK]),
  );

  it('narrows the codes to replace to the bytes the program uses', () => {
    expect(diff.mustReplace.map((e) => e.escape)).toHaveLength(4);
    const narrowed = escapeDiffForProgram(diff, vocab([], [0x93]));
    expect(narrowed.mustReplace.map((e) => e.escape)).toEqual(['{clr}']);
  });

  it('matches an operand-carrying escape on its leading byte', () => {
    const narrowed = escapeDiffForProgram(diff, vocab([], [0x10]));
    expect(narrowed.mustReplace.map((e) => e.escape)).toEqual(['{INK n}']);
  });

  it('falls a used byte no row claims to the catch-all row', () => {
    const narrowed = escapeDiffForProgram(diff, vocab([], [0xaa]));
    expect(narrowed.mustReplace.map((e) => e.escape)).toEqual(['{$xx}']);
  });

  it('drops the catch-all row when every used byte is claimed', () => {
    const narrowed = escapeDiffForProgram(diff, vocab([], [0x05, 0x93]));
    expect(narrowed.mustReplace.map((e) => e.escape)).toEqual([
      '{clr}',
      '{white}',
    ]);
  });

  it('narrows to nothing for a program using no control codes', () => {
    expect(escapeDiffForProgram(diff, vocab([], [])).mustReplace).toEqual([]);
  });

  it('leaves what the target adds and the unchanged count alone', () => {
    const narrowed = escapeDiffForProgram(diff, vocab([], [0x93]));
    expect(narrowed.newlyAvailable).toEqual(diff.newlyAvailable);
    expect(narrowed.unchanged).toBe(diff.unchanged);
  });

  // The ZX80/ZX81 case: the same spelling on both machines, storing a different
  // byte. Nothing in the program's text changes, so this is the one difference a
  // reader cannot find by looking.
  describe('codes that keep their spelling and change meaning', () => {
    const changed = diffEscapes(
      escTable([CLR, WHITE]),
      escTable([{ ...CLR, bytes: '0x92' }, WHITE]),
    );

    it('narrows them to the bytes the program uses', () => {
      expect(changed.behaviourChanged.map((c) => c.escape)).toEqual(['{clr}']);
      const narrowed = escapeDiffForProgram(changed, vocab([], [0x05]));
      expect(narrowed.behaviourChanged).toEqual([]);
    });

    it('keeps one the program does use', () => {
      const narrowed = escapeDiffForProgram(changed, vocab([], [0x93]));
      expect(narrowed.behaviourChanged.map((c) => c.escape)).toEqual(['{clr}']);
    });

    it('judges the code on its source row, not the target row', () => {
      // The program's bytes are the source machine's, so the source row is the
      // one they can match. Judging on the target row would narrow a code away
      // whenever the two machines disagree about its byte - which is every code
      // in this bucket, by definition.
      const moved = diffEscapes(
        escTable([CLR]),
        escTable([{ ...CLR, bytes: '0x92', codes: [0x92] }]),
      );
      const narrowed = escapeDiffForProgram(moved, vocab([], [0x93]));
      expect(narrowed.behaviourChanged.map((c) => c.escape)).toEqual(['{clr}']);
    });
  });
});

describe('unsupportedCharactersForProgram', () => {
  const target = (unsupportedCharacters: string[]): PortingFacts =>
    ({ id: 'target', unsupportedCharacters }) as PortingFacts;

  it('reports only the characters the program actually uses', () => {
    const found = unsupportedCharactersForProgram(
      target(['!', '#', '@']),
      vocab([], [], 'zx81', ['A', '!', '@']),
    );
    expect(found).toEqual(['!', '@']);
  });

  it('reports nothing for a target that represents printable ASCII in full', () => {
    expect(
      unsupportedCharactersForProgram(target([]), vocab([], [], 'zx81', ['!'])),
    ).toEqual([]);
  });

  it('reports nothing for a program using none of them', () => {
    expect(
      unsupportedCharactersForProgram(
        target(['!']),
        vocab([], [], 'zx81', ['A', 'B']),
      ),
    ).toEqual([]);
  });

  it('folds case, because the shortest repertoires are uppercase-only', () => {
    // A lowercase letter is not a finding on a machine that folds it to a letter
    // it has; the missing character beside it still is.
    expect(
      unsupportedCharactersForProgram(
        target(['!']),
        vocab([], [], 'zx81', ['h', 'i', '!']),
      ),
    ).toEqual(['!']);
  });
});

describe('statementLayoutForProgram', () => {
  const machine = (statementSeparator: string | null): PortingFacts =>
    ({ id: 'm', statementSeparator }) as PortingFacts;

  it('reports splitting for a target that takes one statement per line', () => {
    expect(
      statementLayoutForProgram(
        machine(':'),
        machine(null),
        vocab([], [], 'commodore64', [], [3, 7]),
      ),
    ).toEqual({ kind: 'split', from: ':', to: null, lines: [3, 7] });
  });

  it('reports re-separating for a target that spells it differently', () => {
    expect(
      statementLayoutForProgram(
        machine(':'),
        machine(';'),
        vocab([], [], 'commodore64', [], [3]),
      ),
    ).toEqual({ kind: 'reseparate', from: ':', to: ';', lines: [3] });
  });

  it('reports nothing when the two machines separate statements alike', () => {
    expect(
      statementLayoutForProgram(
        machine(':'),
        machine(':'),
        vocab([], [], 'commodore64', [], [3]),
      ),
    ).toBeNull();
  });

  it('reports nothing when no line of the program carries two statements', () => {
    expect(
      statementLayoutForProgram(
        machine(':'),
        machine(null),
        vocab([], [], 'commodore64', [], []),
      ),
    ).toBeNull();
  });

  it('reports nothing when the source machine has no separator', () => {
    expect(
      statementLayoutForProgram(
        machine(null),
        machine(':'),
        vocab([], [], 'zx81', [], [3]),
      ),
    ).toBeNull();
  });
});

describe('noticeState', () => {
  const READY = vocab(['PRINT'], [], 'zx81');
  const base = {
    embedded: true,
    vocabulary: READY,
    status: 'ready' as const,
    sourceDialectId: 'zx81',
    showAll: false,
  };

  it('invites a standalone reader to open their program in the IDE', () => {
    // Whatever else is true: outside the IDE there is no program to narrow to.
    for (const showAll of [false, true]) {
      for (const status of ['ready', 'empty', 'unreadable'] as const) {
        expect(
          noticeState({ ...base, embedded: false, status, showAll }),
        ).toEqual({ kind: 'standalone', narrowed: false, offerControl: false });
      }
    }
  });

  it('says nothing is open when the editor is empty', () => {
    expect(noticeState({ ...base, status: 'empty' })).toEqual({
      kind: 'no-program',
      narrowed: false,
      offerControl: false,
    });
  });

  it('says the program cannot be read yet', () => {
    expect(noticeState({ ...base, status: 'unreadable' })).toEqual({
      kind: 'unreadable',
      narrowed: false,
      offerControl: false,
    });
  });

  it('is narrowed, offering the control, for a readable program', () => {
    expect(noticeState(base)).toEqual({
      kind: 'narrowed',
      narrowed: true,
      offerControl: true,
    });
  });

  it('keeps the control but stops narrowing once the reader asks for everything', () => {
    expect(noticeState({ ...base, showAll: true })).toEqual({
      kind: 'narrowed',
      narrowed: false,
      offerControl: true,
    });
  });

  it('is reading while no reply has arrived', () => {
    expect(noticeState({ ...base, vocabulary: null, status: null })).toEqual({
      kind: 'reading',
      narrowed: false,
      offerControl: false,
    });
  });

  it('is reading while the reply answers for another machine', () => {
    // A vocabulary describes one BASIC. Pointed at a different source machine,
    // those spellings no longer refer to the language on screen, so the page
    // waits for the answer in that language rather than filtering by one that
    // does not apply.
    expect(noticeState({ ...base, sourceDialectId: 'bbcmicro' })).toEqual({
      kind: 'reading',
      narrowed: false,
      offerControl: false,
    });
  });

  it('never narrows outside the narrowed state', () => {
    for (const status of ['empty', 'unreadable'] as const) {
      for (const showAll of [false, true]) {
        const state = noticeState({ ...base, status, showAll });
        expect(state.narrowed).toBe(false);
        expect(state.offerControl).toBe(false);
      }
    }
  });
});
