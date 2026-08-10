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
import { atomReference } from './atom';
import { bbcReference } from './bbc';
import { commodoreReference } from './commodore';
import { cpcReference } from './cpc';
import { altair8800Reference } from './altair8800';
import { trs80Reference } from './trs80';
import { zx80Reference } from './zx80';
import { zx81Reference } from './zx81';
import { zxspectrumReference } from './zxspectrum';
import { atomEscapes } from './escapes/atom';
import { bbcEscapes } from './escapes/bbc';
import { commodoreEscapes } from './escapes/commodore';
import { cpcEscapes } from './escapes/cpc';
import { trs80Escapes } from './escapes/trs80';
import { zx80Escapes } from './escapes/zx80';
import { zx81Escapes } from './escapes/zx81';
import { zxspectrumEscapes } from './escapes/zxspectrum';
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
import type { EscapeTableData, ReferenceTableData } from './types';
import type { MemoryMap } from '../dialects/types';
import { c64MemoryMap } from '../dialects/commodore64/memoryMap';
import { spectrumMemoryMap } from '../dialects/zxspectrum/memoryMap';
import { zx81MemoryMap } from '../dialects/zx81/memoryMap';

const REFERENCES: Record<string, ReferenceTableData> = {
  atom: atomReference,
  bbc: bbcReference,
  commodore: commodoreReference,
  cpc: cpcReference,
  altair8800: altair8800Reference,
  trs80: trs80Reference,
  zx80: zx80Reference,
  zx81: zx81Reference,
  zxspectrum: zxspectrumReference,
};

const ESCAPES: Record<string, EscapeTableData> = {
  atom: atomEscapes,
  bbc: bbcEscapes,
  commodore: commodoreEscapes,
  cpc: cpcEscapes,
  trs80: trs80Escapes,
  zx80: zx80Escapes,
  zx81: zx81Escapes,
  zxspectrum: zxspectrumEscapes,
};

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
  } = {},
): ProgramVocabulary {
  return {
    dialectId,
    keywords,
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
    const program = vocabulary('commodore64', ['PRINT'], [], [], [3, 7]);
    const s = section(describePort(c64, zx81, program), HEADING);
    expect(s).toContain('takes one statement per line');
    expect(s).toContain('Editor lines to change: 3, 7');
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
