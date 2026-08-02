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
}) {
  return buildConversionMessage({
    from: input.from === undefined ? c64 : input.from,
    to: input.to ?? spectrum,
    toLabel: input.toLabel ?? 'Spectrum',
    source: input.source ?? PROGRAM,
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
      escapeCodes: [],
      // A large program's text: every printable character it could plausibly
      // contain, and a hundred lines carrying two statements. The findings this
      // drives are what the bound is being checked against.
      characters: [
        ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 "$%&\'()*+,-./:;<=>?',
      ],
      multiStatementLines: Array.from({ length: 100 }, (_, i) => i + 1),
    });
    expect(report).not.toBeNull();
    // Around 3,800 characters today. The bound is loose enough to survive
    // ordinary edits to the tables and tight enough to catch a section that
    // started listing what the target adds.
    expect(report!.length).toBeLessThan(6000);
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
