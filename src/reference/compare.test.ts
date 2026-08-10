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
import type { EscapeGuidance } from './escape-guidance';
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
  lineNumbersForProgram,
  noticeState,
  programFitForTarget,
  shortSpellingsForFit,
  spellingExpansionsForProgram,
  statementLayoutForProgram,
  truncatedArithmeticForProgram,
  variableCollisionsForProgram,
  tableForMachine,
  unsupportedCharactersForProgram,
  writeLandingsForProgram,
  type ProgramFit,
  type ProgramVocabulary,
} from './compare';
// Real maps, for the write-landing verdicts: see that describe block. Type-only
// for `MemoryMap`, as in the module under test.
import type { MemoryMap } from '../dialects/types';
import { c64MemoryMap } from '../dialects/commodore64/memoryMap';
import { spectrumMemoryMap } from '../dialects/zxspectrum/memoryMap';
import { zx81MemoryMap } from '../dialects/zx81/memoryMap';

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

  // Every page now carries a row for every operator its machine has, so an
  // operator the target lacks is a real finding rather than an editorial one.
  // A `**` that has to become `↑`, or a lost `MOD`, is what a porter came for.
  it('reports an operator the target lacks', () => {
    const diff = diffKeywords(refTable([PRINT, NOT_OP]), refTable([PRINT]));
    expect(diff.mustReplace.map((e) => e.name)).toEqual(['NOT']);
    expect(diff.unchanged).toBe(1);
  });

  it('reports an operator the target adds', () => {
    const diff = diffKeywords(refTable([PRINT]), refTable([PRINT, NOT_OP]));
    expect(diff.newlyAvailable.map((e) => e.name)).toEqual(['NOT']);
  });

  // The exception, and the only one: `+ - * / = < >` are on every machine here,
  // so a diff that carried them would report nothing but unchanged rows.
  it('says nothing about the operators every machine has', () => {
    const diff = diffKeywords(refTable([PRINT, PLUS]), refTable([PRINT]));
    expect(diff.mustReplace).toEqual([]);
    expect(diff.unchanged).toBe(1);

    const gained = diffKeywords(refTable([PRINT]), refTable([PRINT, PLUS]));
    expect(gained.newlyAvailable).toEqual([]);
  });

  // NOT is an operator row on the BBC page and a function row on the ZX81's.
  // Both machines have the word; only the classification differs, so reporting
  // it as a behaviour change would report an editorial decision. A command that
  // became a function still reports - see the kind test above.
  it('ignores a kind disagreement where one side calls it an operator', () => {
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
  const categories: EscapeTableData['categories'] = [
    { id: 'colour', label: 'Colours', class: 'colour' },
    { id: 'graphics', label: 'Block graphics', class: 'block-graphics' },
    { id: 'cursor', label: 'Cursor', class: 'cursor' },
    { id: 'raw', label: 'Raw bytes', class: 'raw-byte' },
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

  it('carries each group’s class, and none for the trailing bucket', () => {
    const odd = { ...INK, escape: '{odd}', category: 'unlisted' };
    const sections = escapeSections([INK, BLOCK, odd], table([]));
    expect(sections.map((s) => s.class)).toEqual([
      'colour',
      'block-graphics',
      undefined,
    ]);
  });

  const advice = (
    to: string,
    cls: EscapeGuidance['class'],
    support: EscapeGuidance['support'],
  ): EscapeGuidance => ({
    to,
    class: cls,
    support,
    instead: `${cls} on ${to}`,
  });
  const guidance: EscapeGuidance[] = [
    advice('zxspectrum', 'colour', 'full'),
    advice('zxspectrum', 'block-graphics', 'partial'),
    advice('zx81', 'colour', 'none'),
  ];

  it('selects the guidance cell for the target, by class', () => {
    const sections = escapeSections(
      [INK, BLOCK],
      table([]),
      guidance,
      'zxspectrum',
    );
    expect(sections.map((s) => s.class)).toEqual(['block-graphics', 'colour']);
    expect(sections.map((s) => s.guidance?.support)).toEqual([
      'partial',
      'full',
    ]);
    expect(sections[1]!.guidance?.instead).toBe('colour on zxspectrum');
  });

  it('omits the cell for a class the target has no advice for', () => {
    const sections = escapeSections([INK, BLOCK], table([]), guidance, 'zx81');
    expect(sections.map((s) => s.guidance?.support)).toEqual([
      'none',
      undefined,
    ]);
  });

  it('omits every cell when no table or no target is supplied', () => {
    expect(
      escapeSections([INK], table([]), guidance)[0]!.guidance,
    ).toBeUndefined();
    expect(
      escapeSections([INK], table([]), undefined, 'zxspectrum')[0]!.guidance,
    ).toBeUndefined();
  });

  it('leads with the classes the target places worst, like the capabilities', () => {
    const sections = escapeSections(
      [RAW, BLOCK, INK, CURSOR],
      table([]),
      guidance,
      'zxspectrum',
    );
    // Block graphics are only partly expressible on the Spectrum, so they lead
    // the colour codes it has under its own spellings. Cursor and raw bytes
    // have no cell at all, which is not a verdict: they rank with the mildest
    // and keep the source page's order behind the classes that are judged.
    expect(sections.map((s) => s.category)).toEqual([
      'graphics',
      'colour',
      'cursor',
      'raw',
    ]);
  });

  it('keeps the source page’s category order where nothing is judged', () => {
    const sections = escapeSections(
      [RAW, BLOCK, INK, CURSOR],
      table([]),
      [],
      'zxspectrum',
    );
    expect(sections.map((s) => s.category)).toEqual([
      'colour',
      'graphics',
      'cursor',
      'raw',
    ]);
  });

  it('ranks a class the target cannot express at all above every other', () => {
    const sections = escapeSections(
      [INK, BLOCK, CURSOR],
      table([]),
      [
        advice('zxspectrum', 'colour', 'full'),
        advice('zxspectrum', 'block-graphics', 'partial'),
        advice('zxspectrum', 'cursor', 'none'),
      ],
      'zxspectrum',
    );
    expect(sections.map((s) => s.guidance?.support)).toEqual([
      'none',
      'partial',
      'full',
    ]);
  });

  it('still omits a category the diff does not touch when guidance is supplied', () => {
    const sections = escapeSections([INK], table([]), guidance, 'zxspectrum');
    expect(sections.map((s) => s.category)).toEqual(['colour']);
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
      lineNumbers: { min: 1, max: 9999 },
      statementSeparator: null,
      elseSupported: false,
      letRequired: 'optional',
      variableNaming: 'A–Z',
      variableSignificance: {
        plain: null,
        marked: null,
        markerDistinguishes: true,
        markers: '$',
      },
      abbreviatedEntry: { style: 'none', symbols: [], shrinksProgram: false },
      unsupportedCharacters: [],
      numberHandling: 'Floating point.',
      numbers: { fractions: true },
      logicalOperators: 'bitwise',
      comparisonTrue: -1,
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
  /** The facts the remaining findings read, none of them positional. */
  rest: {
    extraStatements?: number;
    lineNumbers?: ProgramVocabulary['lineNumbers'];
    variables?: string[];
    divides?: boolean;
    fractionalLiteral?: boolean;
    spellings?: ProgramVocabulary['spellings'];
  } = {},
): ProgramVocabulary {
  return {
    dialectId,
    keywords,
    spellings: rest.spellings ?? [],
    variables: rest.variables ?? [],
    divides: rest.divides ?? false,
    fractionalLiteral: rest.fractionalLiteral ?? false,
    escapeCodes,
    characters,
    multiStatementLines,
    extraStatements: rest.extraStatements ?? 0,
    lineNumbers: rest.lineNumbers ?? null,
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
  const machine = (
    statementSeparator: string | null,
    lineNumbers = { min: 1, max: 9999 },
  ): PortingFacts =>
    ({ id: 'm', statementSeparator, lineNumbers }) as PortingFacts;

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

  describe('what a split does to the line count', () => {
    /** 40 numbered lines, 12 of them carrying one extra statement each. */
    const program = (count: number, extraStatements: number) =>
      vocab([], [], 'commodore64', [], [3, 7], [], {
        extraStatements,
        lineNumbers: { lowest: 10, highest: count * 10, count },
      });

    it('projects the line count a split produces', () => {
      const change = statementLayoutForProgram(
        machine(':'),
        machine(null),
        program(40, 12),
      );
      expect(change?.projected).toEqual({ from: 40, to: 52, overflows: false });
    });

    it('reports an overflow the target cannot be renumbered out of', () => {
      // 9,999 numbers available, and 12,000 lines to place in them: no scheme
      // fits, so this is reported rather than left to the reader to try.
      const change = statementLayoutForProgram(
        machine(':'),
        machine(null),
        program(6000, 6000),
      );
      expect(change?.projected).toMatchObject({ to: 12000, overflows: true });
    });

    it('measures the overflow against the tightest renumbering', () => {
      // Exactly as many lines as the target has numbers, starting at its own
      // minimum: the last line lands on the ceiling, which fits.
      const exact = statementLayoutForProgram(
        machine(':'),
        machine(null, { min: 1, max: 100 }),
        program(60, 40),
      );
      expect(exact?.projected).toMatchObject({ to: 100, overflows: false });

      const oneMore = statementLayoutForProgram(
        machine(':'),
        machine(null, { min: 1, max: 100 }),
        program(60, 41),
      );
      expect(oneMore?.projected).toMatchObject({ to: 101, overflows: true });
    });

    it('projects nothing for a re-separation, which adds no lines', () => {
      const change = statementLayoutForProgram(
        machine(':'),
        machine(';'),
        program(40, 12),
      );
      expect(change?.kind).toBe('reseparate');
      expect(change?.projected).toBeUndefined();
    });

    it('projects nothing when the program carries no numbered line', () => {
      const change = statementLayoutForProgram(
        machine(':'),
        machine(null),
        vocab([], [], 'commodore64', [], [1], [], { extraStatements: 2 }),
      );
      expect(change?.kind).toBe('split');
      expect(change?.projected).toBeUndefined();
    });
  });
});

describe('lineNumbersForProgram', () => {
  const target = (min: number, max: number): PortingFacts =>
    ({ id: 'm', lineNumbers: { min, max } }) as PortingFacts;
  const numbered = (lowest: number, highest: number) =>
    vocab([], [], 'commodore64', [], [], [], {
      lineNumbers: { lowest, highest, count: 2 },
    });

  it('reports a program numbered past the target’s ceiling', () => {
    // A BBC program numbered to 32,767 arriving on a ZX81.
    expect(lineNumbersForProgram(target(1, 9999), numbered(10, 32767))).toEqual(
      {
        lowest: 10,
        highest: 32767,
        min: 1,
        max: 9999,
        belowMinimum: false,
        aboveMaximum: true,
      },
    );
  });

  it('reports a program numbered below the target’s floor', () => {
    // Line 0 is ordinary on a Commodore and a BBC, and typable on neither
    // Sinclair machine.
    expect(
      lineNumbersForProgram(target(1, 9999), numbered(0, 500)),
    ).toMatchObject({ belowMinimum: true, aboveMaximum: false });
  });

  it('reports both ends where both are outside', () => {
    expect(
      lineNumbersForProgram(target(1, 9999), numbered(0, 32767)),
    ).toMatchObject({ belowMinimum: true, aboveMaximum: true });
  });

  it('reports nothing when every number lies inside the range', () => {
    expect(
      lineNumbersForProgram(target(0, 63999), numbered(10, 32767)),
    ).toBeNull();
    // The endpoints themselves are inside it.
    expect(
      lineNumbersForProgram(target(1, 9999), numbered(1, 9999)),
    ).toBeNull();
  });

  it('reports nothing for a program with no numbered line', () => {
    expect(lineNumbersForProgram(target(1, 9999), vocab([]))).toBeNull();
  });
});

describe('variableCollisionsForProgram', () => {
  /** A machine that keeps `plain`/`marked` characters of a name. */
  const machine = (
    plain: number | null,
    marked: number | null = plain,
    markers = '$%',
  ): PortingFacts =>
    ({
      id: 'm',
      variableSignificance: {
        plain,
        marked,
        markerDistinguishes: markers !== '',
        markers,
      },
    }) as PortingFacts;

  const using = (...variables: string[]) =>
    vocab([], [], 'commodore64', [], [], [], { variables });

  it('names the program’s own names and what the target reduces them to', () => {
    // The headline case: a long-name machine to a two-significant one.
    expect(
      variableCollisionsForProgram(
        machine(null),
        machine(2),
        using('COUNT', 'COLOUR', 'SCORE'),
      ),
    ).toEqual([{ key: 'CO', names: ['COLOUR', 'COUNT'] }]);
  });

  it('reports nothing when the target keeps every character', () => {
    expect(
      variableCollisionsForProgram(
        machine(2),
        machine(null),
        using('COUNT', 'COLOUR'),
      ),
    ).toEqual([]);
  });

  it('keeps apart the names the target’s type markers keep apart', () => {
    // `COUNT` and `COUNT$` are two variables wherever the marker is part of the
    // name, so a rule that ignored it would invent a collision.
    expect(
      variableCollisionsForProgram(
        machine(null),
        machine(2),
        using('COUNT', 'COUNT$', 'COST%'),
      ),
    ).toEqual([]);
    // …while two names sharing both prefix and marker do collide.
    expect(
      variableCollisionsForProgram(
        machine(null),
        machine(2),
        using('COUNT$', 'COLOUR$'),
      ),
    ).toEqual([{ key: 'CO$', names: ['COLOUR$', 'COUNT$'] }]);
  });

  it('collides harder on a single-letter target', () => {
    expect(
      variableCollisionsForProgram(
        machine(null),
        machine(1),
        using('AX', 'AY', 'BX'),
      ),
    ).toEqual([{ key: 'A', names: ['AX', 'AY'] }]);
  });

  it('reports a collision the source machine does not already have', () => {
    // A Sinclair source: long numeric names, single-letter string names. The
    // numeric pair is new work on a two-significant target; the string pair is
    // one variable on the source already, and the editor has flagged it there.
    expect(
      variableCollisionsForProgram(
        machine(null, 1, '$'),
        machine(2),
        using('COUNT', 'COLOUR', 'TOTAL$', 'TOP$'),
      ),
    ).toEqual([{ key: 'CO', names: ['COLOUR', 'COUNT'] }]);
  });

  it('reports nothing for a program with no names', () => {
    expect(
      variableCollisionsForProgram(machine(null), machine(2), using()),
    ).toEqual([]);
  });
});

describe('truncatedArithmeticForProgram', () => {
  const integerOnly = (min: number, max: number): PortingFacts =>
    ({
      id: 'm',
      numbers: { fractions: false, range: { min, max } },
    }) as PortingFacts;
  const floating = { id: 'm', numbers: { fractions: true } } as PortingFacts;
  const doing = (divides: boolean, fractionalLiteral: boolean) =>
    vocab([], [], 'commodore64', [], [], [], { divides, fractionalLiteral });

  it('reports a division into a machine with no fractions', () => {
    expect(
      truncatedArithmeticForProgram(
        integerOnly(-32768, 32767),
        doing(true, false),
      ),
    ).toEqual({
      divides: true,
      fractionalLiteral: false,
      min: -32768,
      max: 32767,
    });
  });

  it('reports a fractional value on its own', () => {
    expect(
      truncatedArithmeticForProgram(
        integerOnly(-32768, 32767),
        doing(false, true),
      ),
    ).toMatchObject({ divides: false, fractionalLiteral: true });
  });

  it('reports nothing when the program does neither', () => {
    expect(
      truncatedArithmeticForProgram(
        integerOnly(-32768, 32767),
        doing(false, false),
      ),
    ).toBeNull();
  });

  it('reports nothing when the target has fractions', () => {
    expect(
      truncatedArithmeticForProgram(floating, doing(true, true)),
    ).toBeNull();
  });
});

/**
 * Built from three real machines' maps rather than from invented regions: the
 * verdicts are only as good as the region boundaries, and the boundaries are
 * what these dialects actually declare (each pinned by
 * `src/dialects/memoryMap.test.ts`). A synthetic map would test the arithmetic
 * against itself.
 *
 * C64 → ZX81 is the pair that produces three of the four verdicts on its own:
 * the C64's screen at $0400 is ZX81 ROM, and its chip registers at $D000-$DFFF
 * are the ZX81's echo region.
 */
describe('writeLandingsForProgram', () => {
  const site = (address: number, approximate = false) => ({
    address,
    expr: String(address),
    computed: false,
    approximate,
  });
  const landings = (
    fromMap: MemoryMap | undefined,
    toMap: MemoryMap | undefined,
    sites: ProgramVocabulary['writeSites'],
  ) =>
    writeLandingsForProgram(
      fromMap,
      toMap,
      vocab([], [], 'commodore64', [], [], sites),
    );

  it('reports a write that reaches something else, naming both sides', () => {
    // 53280/$D020 is the C64's border colour register; the ZX81 has the mirror
    // of its own RAM there, which a write reaches and corrupts.
    const found = landings(c64MemoryMap, zx81MemoryMap, [site(0xd020)]);
    expect(found).toHaveLength(1);
    expect(found[0]!.verdict).toBe('different-kind');
    expect(found[0]!.from?.label).toBe('VIC-II registers');
    expect(found[0]!.to?.label).toBe('Echo of RAM');
    expect(found[0]!.addresses).toEqual([0xd020]);
    expect(found[0]!.approximate).toBe(false);
  });

  it('reports a write into read-only memory distinctly', () => {
    // 1024/$0400 is the C64's screen and the ZX81's ROM: the write does
    // nothing at all rather than reaching the wrong thing.
    const found = landings(c64MemoryMap, zx81MemoryMap, [site(0x0400)]);
    expect(found).toHaveLength(1);
    expect(found[0]!.verdict).toBe('read-only');
    expect(found[0]!.to?.kind).toBe('rom');
  });

  it('reports an address the target does not contain', () => {
    // Every machine registered today spans the same 64K, so the verdict is
    // reached by an address above that space rather than by a smaller target -
    // and `src/dialects/memoryMap.test.ts` is what will say so by name when a
    // machine with a different address space arrives.
    const found = landings(c64MemoryMap, zx81MemoryMap, [site(0x12000)]);
    expect(found).toHaveLength(1);
    expect(found[0]!.verdict).toBe('outside');
    expect(found[0]!.to).toBeUndefined();
  });

  it('reports a write that reaches the same kind of thing rather than nothing', () => {
    // $6000 is BASIC program RAM on both the C64 and the Spectrum. The address
    // still has to be checked - the two machines put their program areas in
    // different places - so it is the mildest verdict, not silence.
    const found = landings(c64MemoryMap, spectrumMemoryMap, [site(0x6000)]);
    expect(found).toHaveLength(1);
    expect(found[0]!.verdict).toBe('same-kind');
    expect(found[0]!.from?.kind).toBe('program');
    expect(found[0]!.to?.kind).toBe('program');
  });

  it('carries an approximate address into its verdict', () => {
    const found = landings(c64MemoryMap, zx81MemoryMap, [site(0xd020, true)]);
    expect(found[0]!.approximate).toBe(true);
  });

  it('reports a run of writes into one region as one finding', () => {
    // A loop over the SID's registers: eight addresses, one thing to say about
    // them. The border register is aimed at a different chip, so it stays its
    // own finding even though both land in the ZX81's echo region.
    const sid = [0xd400, 0xd401, 0xd402, 0xd403].map((a) => site(a));
    const found = landings(c64MemoryMap, zx81MemoryMap, [
      ...sid,
      site(0xd020),
      // The same register twice is one address, not two.
      site(0xd400),
    ]);
    expect(found).toHaveLength(2);
    const bySource = new Map(found.map((l) => [l.from?.label, l.addresses]));
    expect(bySource.get('SID registers')).toEqual([
      0xd400, 0xd401, 0xd402, 0xd403,
    ]);
    expect(bySource.get('VIC-II registers')).toEqual([0xd020]);
  });

  it('marks the group approximate when any of its addresses was estimated', () => {
    const found = landings(c64MemoryMap, zx81MemoryMap, [
      site(0xd400),
      site(0xd401, true),
    ]);
    expect(found).toHaveLength(1);
    expect(found[0]!.approximate).toBe(true);
  });

  it('reports the worst-placed writes first and the mildest last', () => {
    const found = landings(c64MemoryMap, spectrumMemoryMap, [
      site(0x6000), // program → program
      site(0x0400), // screen → ROM
      site(0x0100), // stack → ROM, a second read-only group
      site(0x5900), // BASIC program text → the Spectrum's attributes
    ]);
    expect(found.map((l) => l.verdict)).toEqual([
      'different-kind',
      'read-only',
      'read-only',
      'same-kind',
    ]);
    // Within a verdict, by address: the two ROM groups are ordered $0100 first.
    expect(found[1]!.addresses).toEqual([0x0100]);
    expect(found[2]!.addresses).toEqual([0x0400]);
  });

  it('reports nothing when either machine has no described layout', () => {
    const sites = [site(0xd020)];
    expect(landings(undefined, zx81MemoryMap, sites)).toEqual([]);
    expect(landings(c64MemoryMap, undefined, sites)).toEqual([]);
    expect(landings(undefined, undefined, sites)).toEqual([]);
  });

  it('reports nothing when the program writes to nothing', () => {
    expect(landings(c64MemoryMap, zx81MemoryMap, [])).toEqual([]);
  });
});

describe('programFitForTarget', () => {
  const machine = (id: string, freeRamBytes: number): PortingFacts =>
    ({ id, freeRamBytes }) as PortingFacts;
  const size = (dialectId: string, bytes: number, clean = true) => ({
    dialectId,
    bytes,
    clean,
  });

  it('reports a program that fits, with both figures', () => {
    expect(
      programFitForTarget(machine('zx81', 15360), size('zx81', 3072)),
    ).toEqual({
      bytes: 3072,
      freeBytes: 15360,
      percent: 20,
      severity: 'ok',
      verdict: 'fits',
      lowerBound: false,
    });
  });

  it('warns at the same share of the budget the editor warns at', () => {
    // 80% exactly: the editor's own threshold, shared rather than restated.
    const fit = programFitForTarget(
      machine('zx81', 15360),
      size('zx81', 12288),
    );
    expect(fit).toMatchObject({
      percent: 80,
      severity: 'warn',
      verdict: 'tight',
    });
  });

  it('separates no room left from close to the limit by severity', () => {
    // Both still fit, so both are `tight`; the severity is what grades them.
    expect(
      programFitForTarget(machine('zx81', 15360), size('zx81', 15000)),
    ).toMatchObject({ severity: 'crit', verdict: 'tight' });
  });

  it('reports a program that will not fit', () => {
    const fit = programFitForTarget(
      machine('vic20', 3583),
      size('vic20', 12000),
    );
    // The share is clamped, as the status bar clamps it; the two byte figures
    // are what say by how much.
    expect(fit).toEqual({
      bytes: 12000,
      freeBytes: 3583,
      percent: 100,
      severity: 'crit',
      verdict: 'over',
      lowerBound: false,
    });
  });

  it('never calls a lower bound a fit, however far under the budget', () => {
    // A tokenizer that cannot express a line drops the whole line, so the
    // unmeasured part is unbounded - and it is exactly the part that would push
    // the program over.
    expect(
      programFitForTarget(machine('zx81', 15360), size('zx81', 3072, false)),
    ).toMatchObject({ bytes: 3072, verdict: 'at-least', lowerBound: true });
  });

  it('still calls a lower bound over the budget a failure to fit', () => {
    // The doubt only runs towards a larger program, so this conclusion is safe.
    expect(
      programFitForTarget(machine('vic20', 3583), size('vic20', 9000, false)),
    ).toMatchObject({ verdict: 'over', lowerBound: true });
  });

  it('reports nothing when the target could store no part of the program', () => {
    // "At least 0 bytes" is not a finding; what made it zero is reported by the
    // characters and commands the target cannot express.
    expect(
      programFitForTarget(machine('zx81', 15360), size('zx81', 0, false)),
    ).toBeNull();
  });

  it('reports nothing for a size measured on another machine', () => {
    // The state between choosing a new target and being told what the program
    // measures on that one.
    expect(
      programFitForTarget(machine('vic20', 3583), size('commodore64', 12000)),
    ).toBeNull();
  });

  it('reports nothing when there is no program to size', () => {
    expect(programFitForTarget(machine('vic20', 3583), null)).toBeNull();
  });

  it('finds the port that every other bucket calls free', () => {
    // C64 → VIC-20: byte-identical Commodore BASIC V2, so the keyword diff is
    // empty, and 38,911 bytes of program landing in 3,583.
    const diff = diffKeywords(refTable([PRINT]), refTable([PRINT]));
    expect(diff.mustReplace).toEqual([]);
    expect(
      programFitForTarget(machine('vic20', 3583), size('vic20', 9000)),
    ).toMatchObject({ severity: 'crit' });
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

describe('spellingExpansionsForProgram', () => {
  const machine = (
    entry: PortingFacts['abbreviatedEntry'],
    memoryWriteSyntax = 'POKE <addr>, <byte>',
  ): PortingFacts =>
    ({ id: 'm', abbreviatedEntry: entry, memoryWriteSyntax }) as PortingFacts;

  type Entry = PortingFacts['abbreviatedEntry'];
  const NONE: Entry = { style: 'none', symbols: [], shrinksProgram: false };
  const DOT: Entry = { style: 'dot', symbols: [], shrinksProgram: false };
  const PRINTS: Entry = {
    style: 'none',
    symbols: [{ spelling: '?', keyword: 'PRINT' }],
    shrinksProgram: false,
  };

  const using = (...spellings: { spelling: string; keyword: string }[]) =>
    vocab([], [], 'bbcmicro', [], [], [], { spellings });

  it('reports a dotted program moving to a machine without dot entry', () => {
    expect(
      spellingExpansionsForProgram(
        machine(NONE),
        using(
          { spelling: 'P.', keyword: 'PRINT' },
          { spelling: 'G.', keyword: 'GOTO' },
        ),
      ),
    ).toEqual([
      { spelling: 'P.', keyword: 'PRINT' },
      { spelling: 'G.', keyword: 'GOTO' },
    ]);
  });

  it('reports nothing about a spelling the target reads the same way', () => {
    expect(
      spellingExpansionsForProgram(
        machine(DOT),
        using({ spelling: 'P.', keyword: 'PRINT' }),
      ),
    ).toEqual([]);
    expect(
      spellingExpansionsForProgram(
        machine(PRINTS),
        using({ spelling: '?', keyword: 'PRINT' }),
      ),
    ).toEqual([]);
  });

  it('warns where the target reads the symbol as an operator of its own', () => {
    // `?` prints on the Microsoft-family machines and is byte indirection on
    // the Acorns, so the unexpanded program does not fail there - it writes to
    // memory instead, silently.
    expect(
      spellingExpansionsForProgram(
        machine(DOT, '?<addr>=<byte>'),
        using({ spelling: '?', keyword: 'PRINT' }),
      ),
    ).toEqual([
      { spelling: '?', keyword: 'PRINT', differentMeaning: 'byte indirection' },
    ]);
  });

  it('reports nothing where there is no program', () => {
    expect(spellingExpansionsForProgram(machine(NONE))).toEqual([]);
  });
});

describe('shortSpellingsForFit', () => {
  const machine = (shrinksProgram: boolean): PortingFacts =>
    ({
      id: 'm',
      abbreviatedEntry: {
        style: 'dot',
        symbols: [] as PortingFacts['abbreviatedEntry']['symbols'],
        shrinksProgram,
      },
    }) as PortingFacts;

  const fit = (over: Partial<ProgramFit>): ProgramFit => ({
    bytes: 100,
    freeBytes: 100,
    percent: 100,
    severity: 'crit',
    verdict: 'over',
    lowerBound: false,
    ...over,
  });

  it('offers the target’s short spellings on a pressed port', () => {
    expect(shortSpellingsForFit(machine(true), fit({}))).toEqual({
      style: 'dot',
      verdict: 'over',
    });
  });

  it('offers nothing where the program has room to spare', () => {
    expect(
      shortSpellingsForFit(
        machine(true),
        fit({ verdict: 'fits', severity: 'ok', percent: 20 }),
      ),
    ).toBeNull();
  });

  it('never offers it on a machine whose stored program is the same size', () => {
    // The gate that keeps this a fit measure rather than advice to write
    // unreadable code: on a tokenizing machine abbreviating saves nothing.
    expect(shortSpellingsForFit(machine(false), fit({}))).toBeNull();
  });

  it('offers nothing where there is no fit report', () => {
    expect(shortSpellingsForFit(machine(true), null)).toBeNull();
  });
});
