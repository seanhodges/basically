/**
 * Pins what pressing "convert with AI" actually sends.
 *
 * Three properties, in the order they matter:
 *
 * - **A port with nothing to work from is declined, not attempted.** An empty
 *   editor and an unreadable program both stop, with a message naming the
 *   obstacle. Carrying on would send the assistant's recollection of two
 *   machines wearing the comparison's authority.
 * - **A gap in the app's own data degrades instead.** No source machine, a
 *   machine ported to itself, an unregistered reference page: the offer still
 *   works, sending exactly the message it sent before any of this existed. That
 *   byte-identical fallback is pinned here as a regression test.
 * - **Otherwise the findings travel**, after the program and before the ask.
 */
import { describe, expect, it } from 'vitest';
import { getDialect } from '../dialects/registry';
import type { Block } from '../dialects/types';
import type { ProgramVocabulary as AppVocabulary } from '../app/programVocabulary';
import type { ProgramVocabulary as SharedVocabulary } from '../reference/compare';
import { buildUserMessage } from './promptBuilder';
import { buildConversionMessage, loadPortReport } from './portReport';

const c64 = getDialect('commodore64');
const spectrum = getDialect('zxspectrum');

/** The Commodore program the porting e2e is written around. */
const PROGRAM = '10 PRINT "{clr}HI"';

/** The message this button sent before it carried any findings. */
function todaysMessage(source: string, label: string): string {
  return buildUserMessage(
    `Translate this program to ${label}, keeping the behaviour identical ` +
      `where the hardware allows and noting any lines that cannot be ` +
      `ported. Return the complete converted program.`,
    source,
    [],
  );
}

function convert(input: {
  from?: ReturnType<typeof getDialect> | null;
  to?: ReturnType<typeof getDialect>;
  toLabel?: string;
  source?: string;
  blocks?: Block[];
}) {
  return buildConversionMessage({
    from: input.from === undefined ? c64 : input.from,
    to: input.to ?? spectrum,
    toLabel: input.toLabel ?? 'Spectrum',
    source: input.source ?? PROGRAM,
    blocks: input.blocks ?? [],
  });
}

describe('a port with nothing to work from', () => {
  it('declines an empty editor, naming what is missing', async () => {
    const result = await convert({ source: '   \n\n' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problem).toBe('empty');
    expect(result.message).toContain('nothing to convert');
  });

  it('declines an empty editor even with no source machine', async () => {
    // Nothing written is nothing written whichever machine it is read as, and
    // the check needs no dialect to make it.
    const result = await convert({ from: null, source: '' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problem).toBe('empty');
  });

  it('declines a program it cannot read, naming the machine it read it as', async () => {
    // A half-typed escape is a framing error: the line cannot be turned into a
    // program at all. Which BASIC it was read as is the actionable part - the
    // user has just moved away from that machine.
    const result = await convert({ source: '10 PRINT "{whi"' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problem).toBe('unreadable');
    expect(result.message).toContain('C64 BASIC');
  });

  it('converts a program whose only findings are variable lint', async () => {
    // The trap: those findings do not set `fatal: false`, so deciding this from
    // `lint()` would read every one of them as fatal and refuse to convert a
    // perfectly readable program.
    const source = '10 LET A=1\n20 PRINT COUNTER,COUNTED';
    expect(c64.lint(source).length).toBeGreaterThan(0);
    const result = await convert({ source });
    expect(result.ok).toBe(true);
  });
});

describe('a gap in the app’s own data degrades', () => {
  it('sends today’s message when no source machine resolved', async () => {
    const result = await convert({ from: null });
    expect(result).toEqual({
      ok: true,
      userContent: todaysMessage(PROGRAM, 'Spectrum'),
    });
  });

  it('sends today’s message when the port is to the same machine', async () => {
    const result = await convert({ to: c64, toLabel: 'C64' });
    expect(result).toEqual({
      ok: true,
      userContent: todaysMessage(PROGRAM, 'C64'),
    });
  });

  it('sends today’s message when the source has no reference page', async () => {
    const unregistered = { ...c64, id: 'dragon32', docsReference: 'dragon32' };
    const result = await convert({ from: unregistered });
    expect(result).toEqual({
      ok: true,
      userContent: todaysMessage(PROGRAM, 'Spectrum'),
    });
  });

  it('composes no report for a machine ported to itself', async () => {
    expect(
      await loadPortReport(c64, c64, {
        dialectId: 'commodore64',
        keywords: ['PRINT'],
        escapeCodes: [],
        characters: [],
        multiStatementLines: [],
      }),
    ).toBeNull();
  });
});

describe('the turn a port actually sends', () => {
  it('reads program, then findings, then the ask', async () => {
    const result = await convert({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const program = result.userContent.indexOf('Current program in my editor');
    const report = result.userContent.indexOf('PORTING THIS PROGRAM');
    const ask = result.userContent.indexOf(
      'Translate this program to Spectrum',
    );
    expect(program).toBeGreaterThanOrEqual(0);
    expect(report).toBeGreaterThan(program);
    expect(ask).toBeGreaterThan(report);
  });

  it('names the machine being ported from', async () => {
    const result = await convert({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The single most-missing fact in the old message: the assistant was told
    // where the program was going and never where it came from.
    expect(result.userContent).toContain('Commodore C64 (1982)');
    expect(result.userContent).toContain('Commodore BASIC V2');
  });

  it('carries the control code the target has no equivalent of', async () => {
    const result = await convert({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.userContent).toContain('{clr}');
  });

  it('carries the spellings to write out, and the trap on one of them', async () => {
    // A Commodore program printing with `?`, ported to a BBC - where `?` is
    // byte indirection, so leaving it changes what the program does rather
    // than stopping it.
    const result = await convert({
      source: '10 ?"HI"',
      to: getDialect('bbcmicro'),
      toLabel: 'BBC Micro',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.userContent).toContain('? → PRINT');
    expect(result.userContent).toContain('byte indirection');
  });

  it('carries where the program’s reads land on the target', async () => {
    // 56320 is the C64's keyboard port; the Spectrum has RAM there. Nothing
    // else in the report can say so - PEEK exists on both machines, so the
    // line survives the port and quietly returns the wrong number.
    const result = await convert({ source: '10 IF PEEK(56320)=0 THEN STOP' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.userContent).toContain("WHERE THIS PROGRAM'S READS LAND");
    expect(result.userContent).toContain('56320');
    expect(result.userContent).toContain('CIA 1 on C64');
  });

  it('carries the machine code, with the routine question posed', async () => {
    const result = await convert({
      source: '10 SYS 49155',
      blocks: [
        {
          id: 'b1',
          name: 'SCROLL',
          address: 49152,
          bytes: new Uint8Array(64),
          kind: 'code',
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.userContent).toContain('MACHINE CODE THIS PROGRAM REACHES');
    expect(result.userContent).toContain('SYS 49155');
    expect(result.userContent).toContain('attached block "SCROLL"');
    expect(result.userContent).toContain('Decide: establish what this routine');
  });

  it('carries the values the target cannot hold, and the decision they force', async () => {
    // Atom to ZX80: 32-bit integers to 16-bit ones. Nothing divides and nothing
    // is fractional, so no other number finding fires and 100000 would simply
    // arrive wrong.
    const result = await convert({
      from: getDialect('atom'),
      source: '10 A=100000\n20 PRINT A',
      to: getDialect('zx80'),
      toLabel: 'ZX80',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.userContent).toContain('VALUES ZX80 CANNOT HOLD');
    expect(result.userContent).toContain('100000');
    expect(result.userContent).toContain('Decide: rescale these values');
  });

  it('carries a type marker the target takes and then fails on', async () => {
    const result = await convert({
      from: getDialect('trs80'),
      source: '10 COUNT%=1\n20 PRINT COUNT%',
      to: getDialect('altair8800'),
      toLabel: 'Altair 8800',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.userContent).toContain(
      'TYPE MARKERS ALTAIR 8800 DOES NOT HAVE',
    );
    expect(result.userContent).toContain('?SN ERROR when the line runs');
  });

  it('tells the assistant to settle each posed decision and say which it chose', async () => {
    // A report can pose a decision; handing it over is only worth anything if
    // the assistant is told not to settle it in silence.
    const result = await convert({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.userContent).toContain(
      'Where a finding above says "Decide:"',
    );
    expect(result.userContent).toContain('say which reading you chose');
  });

  it('leaves the decision rule out of the message that carries no findings', async () => {
    // No source machine, so no report - and nothing above for the rule to refer
    // to.
    const result = await convert({ from: null });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.userContent).not.toContain('Decide:');
  });

  it('never hands over the short spellings the target would accept', async () => {
    // The other direction is deliberately absent: converted programs are
    // written in full spellings, whatever the target would also read.
    const result = await convert({
      source: '10 PRINT "HI"',
      to: getDialect('bbcmicro'),
      toLabel: 'BBC Micro',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.userContent).not.toContain('SPELLINGS TO WRITE OUT IN FULL');
    expect(result.userContent).not.toContain('Dotted prefix');
  });

  /**
   * The turn is not prefix-cached, so its size is a real cost - and unlike the
   * machine description it is bounded by the program rather than by the distance
   * between the machines. Sixty keywords is a large program by the standards of
   * these machines; the bound is what makes "bounded by the program" checkable.
   */
  it('stays bounded for a program using sixty commands', async () => {
    const keywords = [...new Set(c64.keywords.map((k) => k.word.toUpperCase()))]
      .filter((w) => /^[A-Z]/.test(w))
      .slice(0, 60);
    expect(keywords.length).toBe(60);
    const report = await loadPortReport(c64, spectrum, {
      dialectId: 'commodore64',
      keywords,
      spellings: [],
      // The rest of what a program this size carries. The Spectrum keeps every
      // character of a name and has fractions, so neither silent-failure
      // finding fires on this pair - the bound below is the command list's.
      variables: Array.from({ length: 60 }, (_, i) => `NAME${i}`),
      divides: true,
      fractionalLiteral: true,
      largeNumbers: [],
      escapeCodes: [],
      // A large program's text: every printable character it could plausibly
      // contain, and a hundred lines carrying two statements. The findings this
      // drives are what the bound is being checked against.
      characters: [
        ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 "$%&\'()*+,-./:;<=>?',
      ],
      multiStatementLines: Array.from({ length: 100 }, (_, i) => i + 1),
      extraStatements: 100,
      lineNumbers: { lowest: 10, highest: 1000, count: 100 },
      // Writes spread across three of the C64's areas, so the landing verdicts
      // are inside the bound too. Grouped by what they reach on the target,
      // they are a few lines rather than one per address - which is the
      // property the bound would catch the loss of.
      writeSites: [1024, 1025, 1026, 53280, 53281, 54272, 54273].map(
        (address) => ({
          address,
          expr: String(address),
          computed: false,
          approximate: false,
        }),
      ),
      // Reads of two more areas, and a routine in each of the two ways a
      // program reaches one - so both new sections are inside the bound too.
      readSites: [56320, 56321, 40960].map((address) => ({
        address,
        expr: `PEEK ${address}`,
        computed: false,
        approximate: false,
      })),
      callSites: [
        {
          address: 49155,
          expr: 'SYS 49155',
          computed: false,
          approximate: false,
        },
      ],
      codeBlocks: [
        { name: 'SCROLL', address: 49152, size: 64, kind: 'code' as const },
        { name: 'MUSIC', address: 32768, size: 512, kind: 'code' as const },
      ],
      screenModes: null,
      // A Commodore states no print position - it lays its screen out by
      // printing and by POKEing - so the only display finding this pair can
      // raise is the timing one, and the delays are inside the bound.
      positions: null,
      emptyLoopLines: [12, 34, 56],
    });
    expect(report).not.toBeNull();
    // Around 6,400 characters today. The bound is loose enough to survive
    // ordinary edits to the tables and tight enough to catch a section that
    // started listing what the target adds.
    expect(report!.length).toBeLessThan(8000);
  });
});

describe('memory the target holds beyond the program area', () => {
  const atom = getDialect('atom');
  const HEADING = 'MEMORY THE ATOM HOLDS';
  /** A C64 program, which selects no Atom screen mode and so meets the condition. */
  const program: AppVocabulary = {
    dialectId: 'commodore64',
    keywords: ['PRINT'],
    spellings: [],
    variables: [],
    divides: false,
    fractionalLiteral: false,
    largeNumbers: [],
    escapeCodes: [],
    characters: [...'PRINT'],
    multiStatementLines: [],
    extraStatements: 0,
    lineNumbers: { lowest: 10, highest: 10, count: 1 },
    writeSites: [],
    readSites: [],
    callSites: [],
    codeBlocks: [],
    screenModes: null,
    positions: null,
    emptyLoopLines: [],
  };

  // An Atom has 4,864 bytes free, so the second of these is under pressure and
  // the first is not. The gate lives in the comparison; this pins that the
  // hand-over asks it rather than deciding for itself.
  it('carries the finding exactly when the comparison reports it', async () => {
    const size = (bytes: number) => ({ dialectId: 'atom', bytes, clean: true });
    const comfortable = await loadPortReport(c64, atom, program, size(500));
    const pressed = await loadPortReport(c64, atom, program, size(4500));
    expect(comfortable).not.toContain(HEADING);
    expect(pressed).toContain(HEADING);
    expect(pressed).toContain('free while the program stays in text mode');
  });

  it('sizes the program for the target so the gate can be asked at all', async () => {
    // The whole path, from source text to finding: `buildConversionMessage`
    // measures the program on the *target*, which is what the fit pressure is
    // judged from. A source with no size would silently never report this.
    const long = Array.from(
      { length: 120 },
      (_, i) => `${(i + 1) * 10} PRINT "${'X'.repeat(40)}"`,
    ).join('\n');
    const result = await buildConversionMessage({
      from: c64,
      to: atom,
      toLabel: 'Atom',
      source: long,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.userContent).toContain(HEADING);

    const short = await buildConversionMessage({
      from: c64,
      to: atom,
      toLabel: 'Atom',
      source: '10 PRINT "HI"',
    });
    expect(short.ok).toBe(true);
    if (!short.ok) return;
    expect(short.userContent).not.toContain(HEADING);
  });
});

/**
 * The whole path for the two findings the scan had to learn to read: the
 * program's own text, through the app-side vocabulary, into the request. Both
 * are findings about numbers rather than commands, so a field lost anywhere
 * along this path would leave the request silently complete-looking.
 */
describe('what the program says about display and timing reaches the request', () => {
  it('carries the delays a program counts out', async () => {
    const result = await buildConversionMessage({
      from: getDialect('zx81'),
      to: getDialect('atom'),
      toLabel: 'Atom',
      source: '10 PRINT "HI"\n20 FOR I=1 TO 500\n30 NEXT I',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.userContent).toContain('LOOPS THAT ONLY PASS TIME');
    // Line 20 - the FOR - named by the number the listing prints, not by the
    // editor line it happens to sit on.
    expect(result.userContent).toContain('does nothing else: 20.');
  });

  it('carries a layout the target’s screen cannot hold', async () => {
    const result = await buildConversionMessage({
      from: getDialect('zxspectrum'),
      to: getDialect('vic20'),
      toLabel: 'VIC-20',
      source: '10 PRINT AT 5,30;"HELLO"',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.userContent).toContain('WHERE THIS PROGRAM PRINTS');
    expect(result.userContent).toContain('row 5, column 30');
  });

  it('says nothing about either where the program raises neither', async () => {
    const result = await buildConversionMessage({
      from: getDialect('zxspectrum'),
      to: getDialect('vic20'),
      toLabel: 'VIC-20',
      source: '10 PRINT AT 5,3;"HI"',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.userContent).not.toContain('WHERE THIS PROGRAM PRINTS');
    expect(result.userContent).not.toContain('LOOPS THAT ONLY PASS TIME');
  });
});

it('shares one vocabulary shape with the reference layer', () => {
  // Declared in both `src/app/programVocabulary.ts` and `src/reference/
  // compare.ts`, because the reference tree never imports from `src/`. This
  // assignment is the guard against the two drifting apart silently: it stops
  // compiling before anything reaches a user.
  const app: AppVocabulary = {
    dialectId: 'commodore64',
    keywords: ['PRINT'],
    escapeCodes: [0x93],
  };
  const shared: SharedVocabulary = app;
  expect(shared).toBe(app);
});
