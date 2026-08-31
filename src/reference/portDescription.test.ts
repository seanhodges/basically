/**
 * Pins what a port request carries to what the comparison actually found.
 *
 * Two properties matter more than any individual sentence here, because they
 * are what the whole change exists for:
 *
 * - **The narrowing holds.** A command the program never used must not reach
 *   the request. Un-narrowed, the report is both machines in general with the
 *   comparison's authority stamped on it - the assistant's own recollection in
 *   better clothes.
 * - **The recipe stays the comparison page's recipe.** `describePort` mirrors
 *   `DialectCompare.vue` call for call, and nothing typechecks between a Vue
 *   script block and this. So the results are asserted against the real tables:
 *   the rename the page shows is the rename the request carries.
 */
import { describe, expect, it } from 'vitest';
import { escapePages as ESCAPES, referencePages as REFERENCES } from './pages';
import {
  diffEscapes,
  diffKeywords,
  escapeTableForMachine,
  tableForMachine,
  type ProgramVocabulary,
} from './compare';
import { domainGuidance } from './domain-guidance';
import { machines } from './machines';
import { keywordEquivalences } from './porting';
import { describePort, type PortSide } from './portDescription';
import type { ReferenceTableData } from './types';
import type { MemoryMap } from '../dialects/types';
import { c64MemoryMap } from '../dialects/commodore64/memoryMap';
import { spectrumMemoryMap } from '../dialects/zxspectrum/memoryMap';
import { zx81MemoryMap } from '../dialects/zx81/memoryMap';

/**
 * The memory layouts the write-landing verdicts are judged against, for the
 * machines these tests port between. Keyed by machine id, not by page: two
 * machines on one page can lay their memory out quite differently.
 *
 * `src/ai/portReport.ts` takes each from the dialect itself; here they are
 * imported directly, which is the same data by a shorter route.
 */
const MEMORY_MAPS: Record<string, MemoryMap> = {
  commodore64: c64MemoryMap,
  zxspectrum: spectrumMemoryMap,
  zx81: zx81MemoryMap,
};

/** One end of a port, assembled the way `src/ai/portReport.ts` assembles it. */
function side(id: string): PortSide {
  const machine = machines.find((m) => m.id === id);
  if (!machine) throw new Error(`no machine "${id}"`);
  return {
    ...machine,
    table: REFERENCES[machine.page]!,
    escapes: ESCAPES[machine.page],
    memoryMap: MEMORY_MAPS[machine.id],
  };
}

function vocabulary(
  dialectId: string,
  keywords: string[],
  escapeCodes: number[] = [],
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
    largeNumbers?: number[];
    spellings?: ProgramVocabulary['spellings'];
    screenModes?: ProgramVocabulary['screenModes'];
    readSites?: ProgramVocabulary['readSites'];
    callSites?: ProgramVocabulary['callSites'];
    codeBlocks?: ProgramVocabulary['codeBlocks'];
    positions?: ProgramVocabulary['positions'];
    emptyLoopLines?: number[];
  } = {},
): ProgramVocabulary {
  return {
    dialectId,
    keywords,
    spellings: rest.spellings ?? [],
    variables: rest.variables ?? [],
    divides: rest.divides ?? false,
    fractionalLiteral: rest.fractionalLiteral ?? false,
    largeNumbers: rest.largeNumbers ?? [],
    escapeCodes,
    characters,
    multiStatementLines,
    extraStatements: rest.extraStatements ?? 0,
    lineNumbers: rest.lineNumbers ?? null,
    writeSites,
    readSites: rest.readSites ?? [],
    callSites: rest.callSites ?? [],
    codeBlocks: rest.codeBlocks ?? [],
    screenModes: rest.screenModes ?? null,
    positions: rest.positions ?? null,
    emptyLoopLines: rest.emptyLoopLines ?? [],
  };
}

/**
 * One section of the report by its heading. Sections are separated by a blank
 * line, so assertions can be scoped to the section that is actually about the
 * thing being asserted - which matters for the exclusion tests, since the
 * guidance prose legitimately names commands the target adds ("those routines
 * become PLOT, DRAW, CIRCLE") and that is the advice, not a finding.
 */
function section(report: string, heading: string): string {
  return report.split('\n\n').find((b) => b.startsWith(heading)) ?? '';
}

/** Every section that lists commands or codes as work - the narrowed part. */
function findings(report: string): string {
  return report
    .split('\n\n')
    .filter(
      (b) =>
        b.startsWith('SAME WORD') ||
        b.startsWith('COMMANDS ') ||
        b.startsWith('SPELLINGS ') ||
        b.startsWith('CONTROL CODES '),
    )
    .join('\n\n');
}

/** `PRINT` matches `PRINT` but not `PRINTER`; `LEFT$`/`SPC(` are literal. */
function mentions(text: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^A-Z0-9$#])${escaped}([^A-Z0-9$#(]|$)`, 'm').test(
    text,
  );
}

describe('describePort over the real tables', () => {
  const c64 = side('commodore64');
  const spectrum = side('zxspectrum');
  // A Commodore program with a clear-screen control code, the case the porting
  // e2e is written around: `{clr}` is PETSCII with no Spectrum equivalent.
  const c64Program = vocabulary(
    'commodore64',
    ['PRINT', 'POKE', 'CLR', 'GET', 'CHR$'],
    [0x93],
  );

  it('names both machines and the BASIC each runs', () => {
    const report = describePort(c64, spectrum, c64Program);
    expect(report.startsWith('PORTING THIS PROGRAM\n')).toBe(true);
    expect(report).toContain(
      'Commodore C64 (1982), running Commodore BASIC V2',
    );
    expect(report).toContain(
      'Sinclair Spectrum (1982), running 48K Sinclair BASIC',
    );
  });

  it('reports the rename the comparison reports', () => {
    const report = describePort(c64, spectrum, c64Program);
    expect(section(report, 'COMMANDS TO RENAME')).toContain('CLR → CLEAR');
  });

  it('reports the control code the target has no equivalent of', () => {
    const report = describePort(c64, spectrum, c64Program);
    const codes = section(report, 'CONTROL CODES THIS PROGRAM USES');
    expect(codes).toContain('{clr}');
    // Named for the machine that lacks them, not for the pair in general.
    expect(codes).toContain('SPECTRUM DOES NOT HAVE');
  });

  it('gives the substitution written for a command the program uses', () => {
    // POKE has no BBC equivalent and the BBC's facts say what to write instead;
    // PEEK carries a substitution too, and this program never uses it.
    const report = describePort(
      side('zx81'),
      side('bbcmicro'),
      vocabulary('zx81', ['POKE', 'PRINT']),
    );
    expect(report).toContain('POKE → Write ?addr=val for a byte');
    expect(report).not.toContain('Read ?addr for a byte');
  });
});

describe('the narrowing holds', () => {
  const c64 = side('commodore64');
  const spectrum = side('zxspectrum');
  const program = vocabulary('commodore64', ['GET'], []);
  const report = describePort(c64, spectrum, program);

  /** Everything a C64 → Spectrum port loses, before narrowing. */
  const fullDiff = diffKeywords(
    tableForMachine(c64.table, c64.id),
    tableForMachine(spectrum.table, spectrum.id),
    { from: c64.page, to: spectrum.page, equivalences: keywordEquivalences },
  );

  it('never names a lost command the program does not use', () => {
    const unused = fullDiff.mustReplace
      .map((e) => e.name)
      .filter((name) => !program.keywords.includes(name));
    expect(unused.length).toBeGreaterThan(0);
    const lost = section(report, 'COMMANDS THIS PROGRAM USES');
    expect(unused.filter((name) => mentions(lost, name))).toEqual([]);
  });

  it('omits a capability the program loses no commands in', () => {
    const lost = section(report, 'COMMANDS THIS PROGRAM USES');
    // GET is the program's one lost command, so Input is the one capability
    // with work in it. Storage has plenty to say on this pair and none of it
    // is this program's problem.
    expect(lost).toContain('Input:');
    expect(lost).not.toContain('Storage:');
  });

  it('never names a control code the program does not use', () => {
    const fullEscapes = diffEscapes(
      escapeTableForMachine(c64.escapes!, c64.id),
      escapeTableForMachine(spectrum.escapes!, spectrum.id),
    );
    expect(fullEscapes.mustReplace.length).toBeGreaterThan(0);
    // This program uses no control codes at all, so the section cannot exist.
    expect(section(report, 'CONTROL CODES THIS PROGRAM USES')).toBe('');
  });
});

describe('what the port does not require stays out', () => {
  const c64 = side('commodore64');
  const spectrum = side('zxspectrum');
  const program = vocabulary(
    'commodore64',
    ['PRINT', 'POKE', 'CLR', 'GET', 'CHR$'],
    [0x93],
  );
  const report = describePort(c64, spectrum, program);

  it('offers none of the commands the target adds', () => {
    const diff = diffKeywords(
      tableForMachine(c64.table, c64.id),
      tableForMachine(spectrum.table, spectrum.id),
      { from: c64.page, to: spectrum.page, equivalences: keywordEquivalences },
    );
    expect(diff.newlyAvailable.length).toBeGreaterThan(0);
    // Scanned over what the report *offers*, which is not the same as what it
    // mentions. Two parts of it quote the target's own vocabulary while
    // answering for a command the program does use: the guidance advice ("AT
    // positions text by row and column" is what to write instead of a lost
    // cursor command) and the usage section, which prints the target's argument
    // shape verbatim - `PRINT [AT <row>, <col>;]…`. Neither offers AT.
    const work = findings(report)
      .split('\n\n')
      .filter((block) => !block.startsWith('COMMANDS WHOSE USAGE DIFFERS'))
      .join('\n\n')
      .split('\n')
      .filter((line) => !line.startsWith('  Instead: '))
      .join('\n');
    const leaked = diff.newlyAvailable
      .map((e) => e.name)
      .filter((name) => mentions(work, name));
    expect(leaked).toEqual([]);
  });

  it('offers none of the control codes the target adds', () => {
    const diff = diffEscapes(
      escapeTableForMachine(c64.escapes!, c64.id),
      escapeTableForMachine(spectrum.escapes!, spectrum.id),
    );
    expect(diff.newlyAvailable.length).toBeGreaterThan(0);
    const codes = section(report, 'CONTROL CODES THIS PROGRAM USES');
    const leaked = diff.newlyAvailable
      .map((e) => e.escape)
      .filter((escape) => codes.includes(escape));
    expect(leaked).toEqual([]);
  });

  it('repeats none of the worked examples the system prompt already carries', () => {
    const lines = domainGuidance
      .filter((g) => g.to === spectrum.page)
      .flatMap((g) => g.example?.code ?? []);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.filter((line) => report.includes(line))).toEqual([]);
  });
});

describe('the shape of the report', () => {
  const c64 = side('commodore64');
  const spectrum = side('zxspectrum');
  const program = vocabulary('commodore64', ['PRINT', 'CLR', 'GET'], [0x93]);

  it('drops only the control codes when a side has no escape table', () => {
    const withCodes = describePort(c64, spectrum, program);
    const withoutCodes = describePort(
      { ...c64, escapes: undefined },
      spectrum,
      program,
    );
    expect(section(withCodes, 'CONTROL CODES THIS PROGRAM USES')).not.toBe('');
    expect(
      withCodes
        .split('\n\n')
        .filter((b) => !b.startsWith('CONTROL CODES '))
        .join('\n\n'),
    ).toBe(withoutCodes);
  });

  it('says so when the comparison found nothing, rather than trailing off', () => {
    // A machine the porting data says nothing about, ported to itself: no
    // diff, no guidance, no facts. The one case where "no findings" is the
    // finding - and, incidentally, that a machine with no facts entry is named
    // without its BASIC rather than throwing.
    const table: ReferenceTableData = {
      title: 't',
      machines: ['m'],
      entries: [
        {
          name: 'PRINT',
          kind: 'command',
          syntax: 'PRINT <expr>',
          description: 'Write to the screen.',
          domain: 'text-screen',
        },
      ],
    };
    const from: PortSide = {
      id: 'nowhere-one',
      name: 'One',
      manufacturer: 'Nobody',
      year: 1979,
      page: 'nowhere-one',
      table,
    };
    const to: PortSide = { ...from, id: 'nowhere-two', name: 'Two' };
    const report = describePort(from, to, vocabulary('nowhere-one', ['PRINT']));
    expect(report).toBe(
      'PORTING THIS PROGRAM\n' +
        '- From: Nobody One (1979).\n' +
        '- To: Nobody Two (1979).\n' +
        "- What follows is this project's own reference data for these two machines, narrowed to the commands and control codes this program actually uses. Prefer it to your recollection of either machine.\n" +
        '\n' +
        'Nothing this program uses is missing from the Two, spelled differently there, or treated differently there.',
    );
  });

  it('describes the same port identically every time', () => {
    expect(describePort(c64, spectrum, program)).toBe(
      describePort(c64, spectrum, program),
    );
  });
});

describe('the spellings to write out in full', () => {
  const bbc = side('bbcmicro');
  const c64 = side('commodore64');

  /** A dotted BBC program, as an archive listing writes one. */
  const dotted = vocabulary('bbcmicro', ['PRINT', 'GOTO'], [], [], [], [], {
    spellings: [
      { spelling: 'P.', keyword: 'PRINT' },
      { spelling: 'G.', keyword: 'GOTO' },
    ],
  });

  it('reports each spelling with the command it stands for', () => {
    const report = describePort(bbc, c64, dotted);
    const spellings = section(report, 'SPELLINGS TO WRITE OUT IN FULL');
    expect(spellings).toContain('P. → PRINT');
    expect(spellings).toContain('G. → GOTO');
  });

  it('puts them with the mechanical work, ahead of the renames', () => {
    const report = describePort(bbc, c64, dotted);
    const headings = report.split('\n\n').map((b) => b.split('\n')[0]);
    const spellings = headings.indexOf('SPELLINGS TO WRITE OUT IN FULL');
    const lost = headings.findIndex((h) => h?.startsWith('COMMANDS THIS'));
    expect(spellings).toBeGreaterThan(-1);
    expect(spellings).toBeGreaterThan(lost);
  });

  it('warns where the target reads the spelling as something of its own', () => {
    const report = describePort(
      c64,
      bbc,
      vocabulary('commodore64', ['PRINT'], [], [], [], [], {
        spellings: [{ spelling: '?', keyword: 'PRINT' }],
      }),
    );
    const spellings = section(report, 'SPELLINGS TO WRITE OUT IN FULL');
    expect(spellings).toContain('? → PRINT');
    expect(spellings).toContain('byte indirection');
  });

  it('says nothing where the target reads the spellings alike', () => {
    // Two Acorns: `P.` means PRINT on both, so there is no work in it.
    const report = describePort(bbc, side('bbcmaster'), dotted);
    expect(section(report, 'SPELLINGS TO WRITE OUT IN FULL')).toBe('');
  });

  it('never hands over the spellings the target would also accept', () => {
    // Conversions are written in full spellings; the abbreviated-entry rule is
    // deliberately absent from the language-rules section too.
    const report = describePort(c64, bbc, vocabulary('commodore64', ['PRINT']));
    expect(report).not.toContain('SPELLINGS TO WRITE OUT IN FULL');
    expect(report).not.toContain('Abbreviated entry');
    expect(report).not.toContain('Dotted prefix');
  });
});

describe('the language rules that change', () => {
  const c64 = side('commodore64');
  const zx81 = side('zx81');
  const program = vocabulary('commodore64', ['PRINT']);
  const HEADING = 'LANGUAGE RULES THAT CHANGE';

  it('states the statement rule the port has to restructure for', () => {
    const s = section(describePort(c64, zx81, program), HEADING);
    expect(s).toContain('Statements per line: several, separated by : → one');
    expect(s).toContain('LET on assignment: optional → required');
  });

  it('reports differences, not the target’s whole rule set', () => {
    // The target's own rules are already in the system prompt; restating them
    // every turn is what this section is narrowed against. Both machines POKE,
    // so that row is not a difference and does not appear.
    const s = section(describePort(c64, zx81, program), HEADING);
    expect(s).not.toContain('Writing memory:');
  });

  it('says nothing where the two machines have the same rules', () => {
    // Same BASIC on different hardware: every language row matches, and the
    // hardware differences are reported through the capability sections rather
    // than under a heading that says they are language rules.
    const vic20 = side('vic20');
    const s = section(describePort(c64, vic20, program), HEADING);
    expect(s).toBe('');
  });

  it('is not narrowed away by a program that uses nothing', () => {
    // A rule holds whatever commands a program uses - narrowing this to a
    // vocabulary would drop it exactly when the port needs it.
    const empty = vocabulary('commodore64', []);
    expect(section(describePort(c64, zx81, empty), HEADING)).toContain(
      'Statements per line',
    );
  });
});

describe('the characters to replace', () => {
  const c64 = side('commodore64');
  const zx81 = side('zx81');
  const HEADING = 'CHARACTERS THIS PROGRAM USES THAT ZX81 DOES NOT HAVE';

  it('names the characters the program uses that the target lacks', () => {
    const program = vocabulary('commodore64', ['PRINT'], [], ['A', '!', '#']);
    const s = section(describePort(c64, zx81, program), HEADING);
    expect(s).toContain('! #');
    expect(s).toContain('cannot appear anywhere in the converted program');
  });

  it('is absent for a program using none of them', () => {
    const program = vocabulary('commodore64', ['PRINT'], [], ['A', 'B']);
    expect(section(describePort(c64, zx81, program), HEADING)).toBe('');
  });

  it('is absent for a target that represents printable ASCII in full', () => {
    const trs80 = side('trs80');
    const program = vocabulary('commodore64', ['PRINT'], [], ['!', '#']);
    const report = describePort(c64, trs80, program);
    expect(report).not.toContain('DOES NOT HAVE\n- !');
  });
});

describe('the statement layout', () => {
  const c64 = side('commodore64');
  const zx81 = side('zx81');
  const atom = side('atom');
  const HEADING = 'STATEMENT LAYOUT';

  it('names the lines to split for a one-statement-per-line target', () => {
    // The program's own line numbers, as its listing prints them - the reader
    // matches these against a listing, not against an editor's line count.
    const program = vocabulary('commodore64', ['PRINT'], [], [], [30, 70]);
    const s = section(describePort(c64, zx81, program), HEADING);
    expect(s).toContain('takes one statement per line');
    expect(s).toContain('Lines to change: 30, 70');
  });

  it('names the separator to swap for a target that has its own', () => {
    const program = vocabulary('commodore64', ['PRINT'], [], [], [3]);
    const s = section(describePort(c64, atom, program), HEADING);
    expect(s).toContain('separates statements with ";"');
    expect(s).toContain('only the separator changes');
  });

  it('is absent for a program with no line to restructure', () => {
    const program = vocabulary('commodore64', ['PRINT'], [], [], []);
    expect(section(describePort(c64, zx81, program), HEADING)).toBe('');
  });

  it('is absent where the two machines separate statements alike', () => {
    const spectrum = side('zxspectrum');
    const program = vocabulary('commodore64', ['PRINT'], [], [], [3]);
    expect(section(describePort(c64, spectrum, program), HEADING)).toBe('');
  });

  it('reports what the split does to the line count', () => {
    const program = vocabulary('commodore64', ['PRINT'], [], [], [3], [], {
      extraStatements: 12,
      lineNumbers: { lowest: 10, highest: 400, count: 40 },
    });
    const s = section(describePort(c64, zx81, program), HEADING);
    expect(s).toContain('turns 40 lines into 52');
  });

  it('reports a split the target cannot be renumbered out of', () => {
    // 12,000 lines needing numbers on a machine whose editor stops at 9,999.
    const program = vocabulary('commodore64', ['PRINT'], [], [], [3], [], {
      extraStatements: 6000,
      lineNumbers: { lowest: 10, highest: 60000, count: 6000 },
    });
    const s = section(describePort(c64, zx81, program), HEADING);
    expect(s).toContain('cannot hold');
  });
});

describe('the line numbers', () => {
  const c64 = side('commodore64');
  const zx81 = side('zx81');
  const HEADING = 'LINE NUMBERS';

  it('reports a program numbered past the target’s ceiling', () => {
    const program = vocabulary('commodore64', ['PRINT'], [], [], [], [], {
      lineNumbers: { lowest: 10, highest: 32767, count: 20 },
    });
    const s = section(describePort(c64, zx81, program), HEADING);
    expect(s).toContain('highest is 32767, above 9999');
    expect(s).toContain('Renumber');
  });

  it('reports a program numbered below the target’s floor', () => {
    // Line 0 is ordinary on a Commodore and untypable on a ZX81.
    const program = vocabulary('commodore64', ['PRINT'], [], [], [], [], {
      lineNumbers: { lowest: 0, highest: 500, count: 20 },
    });
    const s = section(describePort(c64, zx81, program), HEADING);
    expect(s).toContain('lowest is 0, below 1');
  });

  it('is absent where every number lies inside the target’s range', () => {
    const program = vocabulary('commodore64', ['PRINT'], [], [], [], [], {
      lineNumbers: { lowest: 10, highest: 9999, count: 20 },
    });
    expect(section(describePort(c64, zx81, program), HEADING)).toBe('');
  });

  it('is absent for a program with no numbered line', () => {
    const program = vocabulary('commodore64', ['PRINT']);
    expect(section(describePort(c64, zx81, program), HEADING)).toBe('');
  });
});

describe('the variable names that become one', () => {
  const bbc = side('bbcmicro');
  const c64 = side('commodore64');
  const HEADING = 'VARIABLE NAMES C64 CANNOT TELL APART';

  it('names the collision and what the target reduces it to', () => {
    // Any-length BBC names arriving on a machine that keeps two characters.
    const program = vocabulary('bbcmicro', ['PRINT'], [], [], [], [], {
      variables: ['COUNT', 'COLOUR', 'SCORE'],
    });
    const s = section(describePort(bbc, c64, program), HEADING);
    expect(s).toContain('COLOUR and COUNT');
    expect(s).toContain('"CO"');
    expect(s).not.toContain('SCORE');
  });

  it('is absent where the names stay distinct on the target', () => {
    const program = vocabulary('bbcmicro', ['PRINT'], [], [], [], [], {
      variables: ['COUNT', 'SCORE'],
    });
    expect(section(describePort(bbc, c64, program), HEADING)).toBe('');
  });

  it('is absent where the target keeps more of a name than the source', () => {
    const program = vocabulary('commodore64', ['PRINT'], [], [], [], [], {
      variables: ['COUNT', 'COLOUR'],
    });
    expect(
      section(
        describePort(c64, bbc, program),
        'VARIABLE NAMES BBC MICRO CANNOT TELL APART',
      ),
    ).toBe('');
  });
});

describe('the arithmetic that truncates', () => {
  const c64 = side('commodore64');
  const zx80 = side('zx80');
  const zx81 = side('zx81');
  const HEADING = 'ARITHMETIC THAT TRUNCATES';

  it('names the range the integer-only target holds', () => {
    const program = vocabulary('commodore64', ['PRINT'], [], [], [], [], {
      divides: true,
    });
    const s = section(describePort(c64, zx80, program), HEADING);
    expect(s).toContain('-32768 to 32767');
    expect(s).toContain('divides');
  });

  it('says which of the two the program does', () => {
    const program = vocabulary('commodore64', ['PRINT'], [], [], [], [], {
      fractionalLiteral: true,
    });
    const s = section(describePort(c64, zx80, program), HEADING);
    expect(s).toContain('carries fractional values');
    expect(s).not.toContain('divides and');
  });

  it('is absent for a program that neither divides nor holds a fraction', () => {
    const program = vocabulary('commodore64', ['PRINT']);
    expect(section(describePort(c64, zx80, program), HEADING)).toBe('');
  });

  it('is absent for a target that has fractions', () => {
    const program = vocabulary('commodore64', ['PRINT'], [], [], [], [], {
      divides: true,
      fractionalLiteral: true,
    });
    expect(section(describePort(c64, zx81, program), HEADING)).toBe('');
  });

  it('poses the choice where the target reaches reals another way', () => {
    // The Atom's floating-point ROM. Whether the fractions are essential is not
    // in the program's text, so the section states both readings and settles
    // neither - and drops the instruction to rescale, which would settle it.
    const atom = side('atom');
    const program = vocabulary('commodore64', ['PRINT'], [], [], [], [], {
      divides: true,
    });
    const s = section(describePort(c64, atom, program), HEADING);
    expect(s).toContain('Decide:');
    expect(s).toContain("the floating-point ROM's %A–%Z variables");
    expect(s).toContain('incidental');
    expect(s).not.toContain('so rescale that arithmetic');
  });

  it('advises rescaling where the target has no other way to hold a fraction', () => {
    const program = vocabulary('commodore64', ['PRINT'], [], [], [], [], {
      divides: true,
    });
    const s = section(describePort(c64, zx80, program), HEADING);
    expect(s).toContain('so rescale that arithmetic');
    expect(s).not.toContain('Decide:');
  });
});

describe('the values the target cannot hold', () => {
  const atom = side('atom');
  const zx80 = side('zx80');
  const c64 = side('commodore64');
  const HEADING = 'VALUES ZX80 CANNOT HOLD';

  it('reports both ranges and the program’s own offending values', () => {
    const program = vocabulary('atom', ['PRINT'], [], [], [], [], {
      largeNumbers: [40000, 100000],
    });
    const s = section(describePort(atom, zx80, program), HEADING);
    expect(s).toContain('-2147483648 to 2147483647');
    expect(s).toContain('-32768 to 32767');
    expect(s).toContain('40000, 100000');
    expect(s).toContain('Decide:');
  });

  it('is present with no offending value, since a result can still overflow', () => {
    const program = vocabulary('atom', ['PRINT']);
    const s = section(describePort(atom, zx80, program), HEADING);
    expect(s).not.toBe('');
    expect(s).toContain('has to be checked');
  });

  it('is absent moving to the machine with the wider range', () => {
    const program = vocabulary('zx80', ['PRINT'], [], [], [], [], {
      largeNumbers: [100000],
    });
    expect(
      section(describePort(zx80, atom, program), 'VALUES ATOM CANNOT HOLD'),
    ).toBe('');
  });

  it('is absent where either machine has fractions', () => {
    const program = vocabulary('commodore64', ['PRINT'], [], [], [], [], {
      largeNumbers: [100000],
    });
    expect(section(describePort(c64, zx80, program), HEADING)).toBe('');
  });
});

describe('the type markers the target does not have', () => {
  const trs80 = side('trs80');
  const altair = side('altair8800');
  const bbc = side('bbcmicro');
  const c64 = side('commodore64');
  const HEADING = 'TYPE MARKERS ALTAIR 8800 DOES NOT HAVE';

  it('warns that an integer marker is taken and fails when the line runs', () => {
    const program = vocabulary('trs80', ['PRINT'], [], [], [], [], {
      variables: ['COUNT%'],
    });
    const s = section(describePort(trs80, altair, program), HEADING);
    expect(s).toContain('COUNT%');
    expect(s).toContain('integer');
    expect(s).toContain('?SN ERROR when the line runs');
    expect(s).toContain('Decide:');
  });

  it('says a double-precision name loses its digits silently', () => {
    const program = vocabulary('trs80', ['PRINT'], [], [], [], [], {
      variables: ['TOTAL#'],
    });
    const s = section(describePort(trs80, altair, program), HEADING);
    expect(s).toContain('double precision');
    expect(s).toContain('silently');
  });

  it('is absent for a marker both machines have', () => {
    const program = vocabulary('bbcmicro', ['PRINT'], [], [], [], [], {
      variables: ['COUNT%'],
    });
    expect(
      section(
        describePort(bbc, c64, program),
        'TYPE MARKERS C64 DOES NOT HAVE',
      ),
    ).toBe('');
  });

  it('is absent for a program whose names carry no marker the target lacks', () => {
    const program = vocabulary('trs80', ['PRINT'], [], [], [], [], {
      variables: ['COUNT', 'NAME$'],
    });
    expect(section(describePort(trs80, altair, program), HEADING)).toBe('');
  });
});

describe('the control codes that change meaning', () => {
  const HEADING = 'CONTROL CODES THAT KEEP THEIR SPELLING AND CHANGE MEANING';

  it('reports the ZX80/ZX81 block graphics, which port silently wrong', () => {
    // The two closest machines in the set: the same escape spellings, different
    // byte values behind them. Nothing in the program's text changes, so this is
    // the one finding a reader cannot reach by looking.
    const zx80 = side('zx80');
    const zx81 = side('zx81');
    const program = vocabulary('zx80', ['PRINT'], [0x01, 0x02, 0x03, 0x04]);
    const s = section(describePort(zx80, zx81, program), HEADING);
    expect(s).not.toBe('');
    expect(s).toContain('stores');
    expect(s).toContain('on ZX80');
    expect(s).toContain('on ZX81');
  });

  it('is narrowed to the codes the program uses', () => {
    const zx80 = side('zx80');
    const zx81 = side('zx81');
    const none = vocabulary('zx80', ['PRINT'], []);
    expect(section(describePort(zx80, zx81, none), HEADING)).toBe('');
  });
});

describe('the control codes to replace are ranked like the capabilities', () => {
  it('leads with the class the target cannot express at all', () => {
    // A C64 program using a function key (0x85), a clear-screen (0x93) and a
    // colour (0x05). The Spectrum has no function keys at all, reaches only
    // part of what the editing codes do, and carries colour under its own
    // spellings - so the page order of the Commodore's own escape table
    // (colours, then editing, then function keys) is exactly reversed by the
    // ranking, which is what makes this worth asserting on the real tables.
    const report = describePort(
      side('commodore64'),
      side('zxspectrum'),
      vocabulary('commodore64', ['PRINT'], [0x85, 0x93, 0x05]),
    );
    const groups = section(report, 'CONTROL CODES THIS PROGRAM USES')
      .split('\n')
      .flatMap((l) => l.match(/\(([^)]+)\):/)?.[1] ?? []);
    expect(groups.slice(0, 3)).toEqual(['Function keys', 'Editing', 'Colours']);
  });
});

describe('where the program’s writes land', () => {
  const HEADING = "WHERE THIS PROGRAM'S WRITES LAND ON THE";
  const site = (address: number, approximate = false) => ({
    address,
    expr: String(address),
    computed: false,
    approximate,
  });
  const poking = (dialectId: string, addresses: number[]) =>
    vocabulary(
      dialectId,
      ['POKE'],
      [],
      [],
      [],
      addresses.map((a) => site(a)),
    );

  it('reports a write into the target’s ROM as having no effect', () => {
    // 1024/$0400 is the C64's screen and the ZX81's ROM. Nothing else in the
    // report can say this: POKE exists on both machines, so the statement
    // survives the port and quietly does nothing.
    const s = section(
      describePort(
        side('commodore64'),
        side('zx81'),
        poking('commodore64', [1024]),
      ),
      HEADING,
    );
    expect(s).toContain('ON THE ZX81');
    expect(s).toContain('1024:');
    expect(s).toContain('Screen memory on C64');
    expect(s).toContain('read-only');
  });

  it('names both what a write aimed at and what it reaches', () => {
    // 53280/$D020 is the C64's border colour; the ZX81 mirrors its own RAM
    // there, so the write corrupts something rather than doing nothing.
    const s = section(
      describePort(
        side('commodore64'),
        side('zx81'),
        poking('commodore64', [53280]),
      ),
      HEADING,
    );
    expect(s).toContain('VIC-II registers on C64');
    expect(s).toContain('Echo of RAM on ZX81');
  });

  it('reports an estimated address as an estimate', () => {
    const program = vocabulary(
      'commodore64',
      ['POKE'],
      [],
      [],
      [],
      [site(53280, true)],
    );
    const s = section(
      describePort(side('commodore64'), side('zx81'), program),
      HEADING,
    );
    expect(s).toContain('only be estimated');
  });

  it('reports several writes into one region as one finding', () => {
    const s = section(
      describePort(
        side('commodore64'),
        side('zx81'),
        poking('commodore64', [54272, 54273, 54274]),
      ),
      HEADING,
    );
    expect(s.split('\n').filter((l) => l.startsWith('- '))).toHaveLength(1);
    expect(s).toContain('54272, 54273, 54274:');
  });

  it('reports nothing where a machine has no described layout', () => {
    // The TRS-80's layout is undescribed, so the writes are left unjudged
    // rather than judged against a guess - the same rule that leaves the
    // comparison page drawing no maps at all for such a pair.
    const program = poking('commodore64', [1024]);
    expect(
      section(
        describePort(side('commodore64'), side('trs80'), program),
        HEADING,
      ),
    ).toBe('');
    expect(
      section(describePort(side('trs80'), side('zx81'), program), HEADING),
    ).toBe('');
  });

  it('reports nothing where the program writes to nothing', () => {
    const program = vocabulary('commodore64', ['PRINT']);
    expect(
      section(
        describePort(side('commodore64'), side('zx81'), program),
        HEADING,
      ),
    ).toBe('');
  });
});

describe('where the program’s reads land', () => {
  const HEADING = "WHERE THIS PROGRAM'S READS LAND ON THE";
  const site = (address: number, approximate = false) => ({
    address,
    expr: `PEEK ${address}`,
    computed: false,
    approximate,
  });
  const peeking = (dialectId: string, addresses: number[]) =>
    vocabulary(dialectId, ['PEEK'], [], [], [], [], {
      readSites: addresses.map((a) => site(a)),
    });

  it('names both what a read asked for and what it would reach', () => {
    // 56320/$DC00 is the C64's keyboard and joystick port; the ZX81 mirrors
    // its own RAM there, so the read returns program bytes and the program
    // computes with them.
    const s = section(
      describePort(
        side('commodore64'),
        side('zx81'),
        peeking('commodore64', [56320]),
      ),
      HEADING,
    );
    expect(s).toContain('ON THE ZX81');
    expect(s).toContain('56320:');
    expect(s).toContain('CIA 1 on C64');
    expect(s).toContain('Echo of RAM on ZX81');
  });

  it('has no read-only verdict, because a read of ROM returns real bytes', () => {
    // 1024 is the C64's screen and the ZX81's ROM. A write there is reported
    // as having no effect; a read is reported as returning something else.
    const s = section(
      describePort(
        side('commodore64'),
        side('zx81'),
        peeking('commodore64', [1024]),
      ),
      HEADING,
    );
    expect(s).toContain('returns something else entirely');
    expect(s).not.toContain('read-only');
  });

  it('reports an estimated address as an estimate', () => {
    const program = vocabulary('commodore64', ['PEEK'], [], [], [], [], {
      readSites: [site(56320, true)],
    });
    const s = section(
      describePort(side('commodore64'), side('zx81'), program),
      HEADING,
    );
    expect(s).toContain('only be estimated');
  });

  it('reports nothing where a machine has no described layout', () => {
    const program = peeking('commodore64', [1024]);
    expect(
      section(
        describePort(side('commodore64'), side('trs80'), program),
        HEADING,
      ),
    ).toBe('');
  });

  it('reports nothing where the program reads nothing', () => {
    expect(
      section(
        describePort(
          side('commodore64'),
          side('zx81'),
          vocabulary('commodore64', ['PRINT']),
        ),
        HEADING,
      ),
    ).toBe('');
  });

  it('leaves the write landings byte-for-byte unchanged', () => {
    // The reads land beside the writes and do not touch them: a program that
    // only writes reports exactly what it reported before.
    const writing = vocabulary(
      'commodore64',
      ['POKE'],
      [],
      [],
      [],
      [{ address: 53280, expr: '53280', computed: false, approximate: false }],
    );
    const report = describePort(side('commodore64'), side('zx81'), writing);
    expect(section(report, "WHERE THIS PROGRAM'S WRITES LAND ON THE")).toBe(
      "WHERE THIS PROGRAM'S WRITES LAND ON THE ZX81\n" +
        '- 53280: VIC-II registers on C64; Echo of RAM on ZX81 — the write ' +
        'reaches something else entirely.',
    );
    expect(section(report, HEADING)).toBe('');
  });
});

describe('the machine code the program reaches', () => {
  const HEADING = 'MACHINE CODE THIS PROGRAM REACHES';
  const calling = (
    dialectId: string,
    callSites: ProgramVocabulary['callSites'],
    codeBlocks: ProgramVocabulary['codeBlocks'] = [],
  ) =>
    vocabulary(dialectId, ['SYS'], [], [], [], [], { callSites, codeBlocks });
  const call = (address: number, expr: string) => ({
    address,
    expr,
    computed: false,
    approximate: false,
  });

  it('states what the routines are and poses the decision for each', () => {
    const s = section(
      describePort(
        side('commodore64'),
        side('zx81'),
        calling('commodore64', [call(49152, 'SYS 49152')]),
      ),
      HEADING,
    );
    expect(s).toContain('C64 processor code, not BASIC');
    expect(s).toContain('SYS 49152');
    expect(s).toContain('Decide: establish what this routine does');
    expect(s).toContain("the ZX81's own means");
  });

  it('names a block by name, address and size, and the call into it', () => {
    const s = section(
      describePort(
        side('commodore64'),
        side('zx81'),
        calling(
          'commodore64',
          [call(49155, 'SYS 49155')],
          [{ name: 'SCROLL', address: 49152, size: 64, kind: 'code' }],
        ),
      ),
      HEADING,
    );
    expect(s).toContain(
      'inside the attached block "SCROLL" (64 bytes at 49152)',
    );
    // One routine, not two: the call and the block it lands in are one thing
    // to answer for.
    expect(s.split('\n').filter((l) => l.startsWith('- '))).toHaveLength(1);
  });

  it('reports a block that no call in the listing reaches', () => {
    const s = section(
      describePort(
        side('commodore64'),
        side('zx81'),
        calling(
          'commodore64',
          [],
          [{ name: 'MUSIC', address: 49152, size: 256, kind: 'code' }],
        ),
      ),
      HEADING,
    );
    expect(s).toContain('the block "MUSIC"');
  });

  it('points at the pair’s own carrier guidance rather than restating it', () => {
    // The Sinclair pairs already say how machine code travels between them -
    // hidden-REM records against .TAP CODE blocks - and the finding is about
    // re-achieving the routine, not about carrying it.
    const s = section(
      describePort(
        side('zx81'),
        side('zxspectrum'),
        vocabulary('zx81', ['USR'], [], [], [], [], {
          callSites: [call(32768, 'USR 32768')],
        }),
      ),
      HEADING,
    );
    expect(s).toContain('guidance above already says how machine code travels');
  });

  it('says nothing about carriers for a pair whose guidance does not', () => {
    const s = section(
      describePort(
        side('commodore64'),
        side('zx81'),
        calling('commodore64', [call(49152, 'SYS 49152')]),
      ),
      HEADING,
    );
    expect(s).not.toContain('guidance above');
  });

  it('reports nothing for a program with no calls and no blocks', () => {
    expect(
      section(
        describePort(
          side('commodore64'),
          side('zx81'),
          vocabulary('commodore64', ['PRINT']),
        ),
        HEADING,
      ),
    ).toBe('');
  });
});

describe('memory the target holds beyond the program area', () => {
  const c64 = side('commodore64');
  const atom = side('atom');
  const HEADING = 'MEMORY THE ATOM HOLDS';
  // An Atom has 4,864 bytes free for BASIC. A C64 program selects no Atom mode,
  // so its text leaves the video RAM untouched by the boot-mode rule.
  const program = vocabulary('commodore64', ['PRINT']);
  const size = (bytes: number, clean = true) => ({
    dialectId: 'atom',
    bytes,
    clean,
  });

  it('reports the memory and the condition for a pressed program', () => {
    const s = section(describePort(c64, atom, program, size(4500)), HEADING);
    expect(s).toContain('#8400-#97FF');
    expect(s).toContain('5,120 bytes');
    expect(s).toContain('free while the program stays in text mode (CLEAR 0)');
  });

  // The alternatives are real and the choice is the reader's, so the section
  // poses it rather than issuing an instruction.
  it('ends by posing the decision rather than settling it', () => {
    const s = section(describePort(c64, atom, program, size(4500)), HEADING);
    expect(s.trimEnd().split('\n').at(-1)).toContain(
      "Decide: put this program's data and machine code there",
    );
    expect(s).toContain('or shorten the program instead');
  });

  it('reports it for a program already over the budget', () => {
    expect(
      section(describePort(c64, atom, program, size(9000)), HEADING),
    ).toContain('5,120 bytes');
  });

  // Memory the target can free is a target addition until fit pressure makes it
  // part of the answer to "does it fit". Under no pressure it is neither.
  it('is absent for a program with room to spare', () => {
    expect(section(describePort(c64, atom, program, size(500)), HEADING)).toBe(
      '',
    );
  });

  it('is absent where no size was measured at all', () => {
    expect(section(describePort(c64, atom, program), HEADING)).toBe('');
  });

  it('is absent once the program fails the condition', () => {
    // Read as an Atom, so `CLEAR 4` is the machine's own graphics mode.
    const graphics = vocabulary('atom', ['CLEAR'], [], [], [], [], {
      screenModes: { command: 'CLEAR', modes: [4], computed: false },
    });
    expect(
      section(describePort(side('atom'), atom, graphics, size(4500)), HEADING),
    ).toBe('');
  });

  it('is absent for a target that holds no such memory', () => {
    const zx81 = side('zx81');
    const report = describePort(c64, zx81, program, {
      dialectId: 'zx81',
      bytes: 15000,
      clean: true,
    });
    expect(section(report, 'MEMORY THE ZX81 HOLDS')).toBe('');
  });
});

describe('where the program prints', () => {
  const HEADING = 'WHERE THIS PROGRAM PRINTS ON THE';
  const laidOut = (
    dialectId: string,
    positions: ProgramVocabulary['positions'],
    screenModes: ProgramVocabulary['screenModes'] = null,
  ) =>
    vocabulary(dialectId, ['PRINT'], [], [], [], [], {
      positions,
      screenModes,
    });

  it('names the positions and poses the choice once', () => {
    // A Spectrum layout at column 30, on a machine 22 columns wide.
    const report = describePort(
      side('zxspectrum'),
      side('vic20'),
      laidOut('zxspectrum', {
        cells: [
          { row: 5, column: 30 },
          { row: 9, column: 28 },
        ],
        columns: [],
        rows: [],
        offsets: [],
        origin: 0,
        computed: false,
      }),
    );
    const block = section(report, HEADING);
    expect(block).toContain('row 5, column 30');
    expect(block).toContain('row 9, column 28');
    expect(block).toContain('32×22');
    expect(block).toContain('22×23');
    // Once, not per position: which way a layout goes is one decision about
    // what the screen is for.
    expect(block.match(/Decide:/g)).toHaveLength(1);
    expect(block).toContain('reflow the layout');
  });

  it('says offsets encode the width they were written for', () => {
    const report = describePort(
      side('trs80'),
      side('zxspectrum'),
      laidOut('trs80', {
        cells: [],
        columns: [],
        rows: [],
        offsets: [200],
        origin: 0,
        computed: false,
      }),
    );
    const block = section(report, HEADING);
    expect(block).toContain('recomputed');
    expect(block).toContain('64 columns here, 32 there');
  });

  it('says its check is of the boot screen where the program leaves it', () => {
    const report = describePort(
      side('bbcmicro'),
      side('vic20'),
      laidOut(
        'bbcmicro',
        {
          cells: [{ row: 5, column: 30 }],
          columns: [],
          rows: [],
          offsets: [],
          origin: 0,
          computed: false,
        },
        { command: 'MODE', modes: [0], computed: false },
      ),
    );
    expect(section(report, HEADING)).toContain('selects screen modes');
  });

  it('says nothing where the layout fits', () => {
    const report = describePort(
      side('zxspectrum'),
      side('bbcmicro'),
      laidOut('zxspectrum', {
        cells: [{ row: 5, column: 3 }],
        columns: [],
        rows: [],
        offsets: [],
        origin: 0,
        computed: false,
      }),
    );
    expect(section(report, HEADING)).toBe('');
  });

  it('says nothing where there is no program to read positions from', () => {
    const report = describePort(
      side('zxspectrum'),
      side('vic20'),
      vocabulary('zxspectrum', ['PRINT']),
    );
    expect(section(report, HEADING)).toBe('');
  });
});

describe('the loops that only pass time', () => {
  const HEADING = 'LOOPS THAT ONLY PASS TIME';
  const delaying = (dialectId: string, ...emptyLoopLines: number[]) =>
    vocabulary(dialectId, ['FOR', 'NEXT'], [], [], [], [], {
      emptyLoopLines,
    });

  it('names the lines, quotes the ratio as the emulators’ own, and poses the choice', () => {
    // A ZX81 at 66 iterations a second to an Atom at 1880: every pause the
    // program counts out becomes a twenty-eighth of itself.
    const report = describePort(
      side('zx81'),
      side('atom'),
      delaying('zx81', 40, 120),
    );
    const block = section(report, HEADING);
    expect(block).toContain('40, 120');
    expect(block).toContain('faster');
    expect(block).toContain("this IDE's emulators");
    expect(block).toContain('not a claim about the original hardware');
    expect(block).toContain('Decide, for each');
    // The target's own way of waiting, which is half the decision.
    expect(block).toContain('WAIT');
  });

  it('offers no second course to a machine with no clock', () => {
    const report = describePort(
      side('atom'),
      side('trs80'),
      delaying('atom', 40),
    );
    const block = section(report, HEADING);
    expect(block).toContain('slower');
    expect(block).toContain('Retune each count');
    expect(block).not.toContain('Decide, for each');
  });

  it('says nothing when the program has no empty loops', () => {
    const report = describePort(side('zx81'), side('atom'), delaying('zx81'));
    expect(section(report, HEADING)).toBe('');
  });

  it('says nothing between two machines of similar speed', () => {
    const report = describePort(
      side('commodore64'),
      side('pet'),
      delaying('commodore64', 40),
    );
    expect(section(report, HEADING)).toBe('');
  });
});

describe('the capabilities the target does not have at all', () => {
  const HEADING = 'COMMANDS THIS PROGRAM USES THAT';

  it('poses the decoration-or-information decision where colour is lost', () => {
    const report = describePort(
      side('zxspectrum'),
      side('zx81'),
      vocabulary('zxspectrum', ['INK', 'PAPER', 'BEEP']),
    );
    const block = section(report, HEADING);
    expect(block).toContain('where the colour was decoration, drop it');
    expect(block).toContain('where the sound was decoration, drop it');
  });

  it('adds nothing where the target has the capability by other means', () => {
    // The Commodores have no colour keywords and sixteen colours: the commands
    // are lost and the capability is not.
    const report = describePort(
      side('zxspectrum'),
      side('commodore64'),
      vocabulary('zxspectrum', ['INK', 'PAPER']),
    );
    expect(section(report, HEADING)).not.toContain('was decoration');
  });

  it('adds nothing where the program never used the capability', () => {
    const report = describePort(
      side('zxspectrum'),
      side('zx81'),
      vocabulary('zxspectrum', ['DRAW']),
    );
    expect(section(report, HEADING)).not.toContain('was decoration');
  });
});

/**
 * The assertion that this cannot break on a machine nobody thought to try, in
 * the style of perMachineCompare.test.ts: every ordered pair the comparison can
 * be pointed at composes.
 */
describe('every pair of machines composes', () => {
  // Deliberately wide and machine-agnostic: keywords several dialects have, and
  // a byte range covering the low control codes every escape table claims.
  const anyProgram = vocabulary(
    'any',
    ['PRINT', 'LET', 'GOTO', 'POKE', 'PEEK', 'CLR', 'CLEAR', 'GET', 'PLOT'],
    [0x0d, 0x11, 0x93, 0x16],
  );

  it.each(machines.map((m) => m.id))('from %s to every other', (fromId) => {
    for (const to of machines) {
      const report = describePort(side(fromId), side(to.id), anyProgram);
      expect(
        report.startsWith('PORTING THIS PROGRAM\n'),
        `${fromId}→${to.id}`,
      ).toBe(true);
    }
  });
});
