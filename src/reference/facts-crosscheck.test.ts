/**
 * Pins the hand-authored porting facts to the dialect sources, so the hardware
 * facts in the comparison tool cannot silently drift from the code. Only the
 * fields with a structured source of truth on the `Dialect` are checked here;
 * the prose fields (line-number range, ELSE/LET, variable naming, colour,
 * sound) have no machine-readable source and are reviewed against the hardware
 * page and aiProfile by hand.
 *
 * Every registered machine has its own entry, pinned to its own `Dialect`.
 * There used to be a REPRESENTATIVE map here, sending each docs *page* to the
 * one machine whose hardware its facts described - which is precisely how a
 * reader porting to a VIC-20 came to be told the C64's 38911 bytes free rather
 * than its own 3583. Its deletion is what makes the facts per-machine; if a map
 * like it reappears, the fold has come back with it.
 *
 * Like the keyword crosscheck, this file may reach the dialect registry freely:
 * vitest runs it in node, and neither the VitePress bundle nor the IDE's own
 * bundle includes *.test.ts.
 */
import { describe, expect, it } from 'vitest';
import type { Dialect } from '../dialects/types';
import { dialects, getDialect } from '../dialects/registry';
import type { PortingFacts } from './types';
import { portingFacts } from './facts';

const PAIRS: [string, PortingFacts, Dialect][] = portingFacts.map((facts) => [
  facts.id,
  facts,
  getDialect(facts.id),
]);

/** Start of the dialect's first region of a kind, or undefined if it has none. */
const regionStart = (
  d: Dialect,
  kind: 'screen' | 'program',
): number | undefined =>
  d.memoryMap?.regions.find((r) => r.kind === kind)?.start;

/** Parse an authored address string ("$4000", "&C000", "0x1900") to a number. */
const parseAddr = (s: string): number =>
  parseInt(s.replace(/^0x/i, '').replace(/^[$&]/, ''), 16);

/** Printable ASCII, the range `unsupportedCharacters` is defined over. */
const PRINTABLE = Array.from({ length: 0x7f - 0x20 }, (_, i) =>
  String.fromCharCode(0x20 + i),
);

/**
 * The printable ASCII this machine can actually display, read off its charset.
 *
 * `glyph` rather than `toMachine`: a `toMachine` sweep asks "does this character
 * parse", which is a different question and over-reports badly - `%` opens
 * inverse video on the Sinclairs, `\` opens a graphics escape, `{` opens a
 * PETSCII escape, and all three throw for reasons that have nothing to do with
 * whether the machine has the character. Sweeping the bytes instead asks what
 * the machine can put on screen, which is what a porter needs to know.
 *
 * The unescape arm is load-bearing in the other direction. A glyph is a *source
 * spelling*, so a character that has to be escaped in source comes back as its
 * escape: the Spectrum's 0x5C is a real backslash whose glyph is `\\`. Without
 * this arm the derivation would claim the Spectrum has no backslash and the
 * authored data would faithfully repeat it. It fires for exactly that one byte
 * across every registered machine today.
 */
function displayableAscii(dialect: Dialect): Set<string> {
  const found = new Set<string>();
  for (let byte = 0x00; byte <= 0xff; byte++) {
    const glyph = dialect.charset.glyph(byte);
    if (glyph.length === 1 && PRINTABLE.includes(glyph)) {
      found.add(glyph);
    } else if (
      glyph.length === 2 &&
      glyph[0] === '\\' &&
      PRINTABLE.includes(glyph[1]!)
    ) {
      found.add(glyph[1]!);
    }
  }
  return found;
}

describe('facts crosscheck', () => {
  it('has one facts entry per registered machine', () => {
    const ids = portingFacts.map((f) => f.id).sort();
    expect(ids).toEqual(dialects.map((d) => d.id).sort());
  });

  it('has no duplicate machine ids', () => {
    const ids = portingFacts.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // Prose like the other hand-authored fields, so there is nothing in src/ to
  // pin it to - but it is the fact the porting guidance leans on hardest, so
  // every page has to answer it in the same terms rather than leave it vague.
  it('every machine says whether it has floating point or is integer-only', () => {
    for (const facts of portingFacts) {
      expect(facts.numberHandling, facts.id).toMatch(
        /floating point|integer only/i,
      );
    }
  });

  it('an integer-only machine states the range it holds', () => {
    for (const facts of portingFacts) {
      if (!/^integer only/i.test(facts.numberHandling)) continue;
      expect(facts.numberHandling, facts.id).toMatch(/-?\d+ to -?\d+/);
    }
  });

  // The structured form is what the comparison computes the truncation finding
  // from; the prose is what the fact row shows. There is no behavioural probe
  // for this short of running a program on the emulator, so the pin is
  // prose-to-structured only - stated plainly rather than dressed up.
  it('the structured number handling says what the prose says', () => {
    for (const facts of portingFacts) {
      const integerOnly = /^integer only/i.test(facts.numberHandling);
      expect(
        facts.numbers.fractions,
        `${facts.id}: "${facts.numberHandling}" and the structured form disagree about fractions`,
      ).toBe(!integerOnly);
    }
  });

  it('an integer-only machine quotes the same range in both forms', () => {
    for (const facts of portingFacts) {
      if (facts.numbers.fractions) {
        expect(facts.numbers.range, facts.id).toBeUndefined();
        continue;
      }
      const range = facts.numbers.range;
      expect(
        range,
        `${facts.id} has no fractions and names no range`,
      ).toBeDefined();
      expect(facts.numberHandling, facts.id).toContain(
        `${range!.min} to ${range!.max}`,
      );
      expect(range!.min, facts.id).toBeLessThan(range!.max);
    }
  });

  // The sweep above is only as good as its two arms, and each has a way of
  // failing that leaves a plausible-looking list behind. These name the machine
  // that catches each, so a rewrite that drops an arm fails here saying which.
  it('reports a character the machine genuinely lacks', () => {
    const zx81 = portingFacts.find((f) => f.id === 'zx81')!;
    expect(zx81.unsupportedCharacters).toContain('!');
  });

  it('does not report a character that only has to be escaped in source', () => {
    // The Spectrum's 0x5C is a backslash, spelled `\\`. Losing the unescape arm
    // makes this list it, and the guide would tell a reader to rewrite working
    // code.
    const spectrum = portingFacts.find((f) => f.id === 'zxspectrum')!;
    expect(spectrum.unsupportedCharacters).not.toContain('\\');
    expect(spectrum.unsupportedCharacters).toContain('^');
  });

  it('reports nothing for a machine that covers printable ASCII', () => {
    for (const id of ['trs80', 'atom']) {
      const facts = portingFacts.find((f) => f.id === id)!;
      expect(facts.unsupportedCharacters, id).toEqual([]);
    }
  });

  it('spells every line-number range the same way', () => {
    // An en dash on twelve machines and a hyphen on the thirteenth is not a
    // difference between the machines, but the guide compares these rows as
    // strings and would report one.
    for (const facts of portingFacts) {
      expect(facts.lineNumberRange, facts.id).toMatch(/^\d+–\d+$/);
    }
  });
});

/**
 * The line-number range, re-derived from each dialect's own tokenizer rather
 * than trusted as prose - the same discipline `unsupportedCharacters` is held
 * to above, and for the same reason: a range the guide gets wrong is advice to
 * renumber a program that did not need it, or silence about one that did.
 *
 * The band checked is the one the tokenizer accepts with no complaint of any
 * kind, which is the range a machine's own *editor* takes - what a porter must
 * renumber into. Several tokenizers deliberately accept a wider band with a
 * non-fatal note, for line numbers that exist in loaded programs and run but
 * that the ROM's line editor refuses at the keyboard (the BBC's 32768-65279,
 * the Spectrum's 0 and 10000-16383). Those are not this row.
 *
 * Every band below was confirmed against the real ROM by typing a line at the
 * machine's own keyboard and listing it back: the Commodore trio store 63999
 * and refuse 64000; the BBC Micro and Master store `0REM` and answer
 * `Syntax error` at 32768; the Atom stores 32767 and drops 32768; the CPC
 * refuses 0 and stores 65535; the ZX81 and Spectrum store 9999 and mark 10000
 * with the error cursor. The TRS-80 (an interpreter, no ROM) and the Altair
 * (whose ROM cannot be redistributed) are pinned to their tokenizers only.
 */
describe('line-number ranges are the tokenizer’s own', () => {
  /** True when the tokenizer takes this line number without any complaint. */
  const accepts = (dialect: Dialect, n: number): boolean =>
    !dialect
      .tokenize(`${n} PRINT 1\n`)
      .errors.some((e) => /line number/i.test(e.message));

  it.each(PAIRS)('%s', (id, facts, dialect) => {
    const [min, max] = facts.lineNumberRange
      .split('–')
      .map((s) => parseInt(s, 10));

    // The structured form is what the comparison compares; the prose is what it
    // shows. One derivation covers both, so a range corrected in one place and
    // not the other fails here rather than reporting two different machines.
    expect({ min, max }, `${id}: prose and structured range disagree`).toEqual(
      facts.lineNumbers,
    );

    expect(accepts(dialect, min!), `${id} rejects its own minimum ${min}`).toBe(
      true,
    );
    expect(accepts(dialect, max!), `${id} rejects its own maximum ${max}`).toBe(
      true,
    );
    // The endpoints have to be the edges, or the row understates the machine.
    if (min! > 0) {
      expect(
        accepts(dialect, min! - 1),
        `${id} also takes ${min! - 1}, below the ${min} it claims`,
      ).toBe(false);
    }
    expect(
      accepts(dialect, max! + 1),
      `${id} also takes ${max! + 1}, above the ${max} it claims`,
    ).toBe(false);
  });
});

/**
 * Variable-name significance, re-derived from each dialect's own `lint()` rather
 * than only read back off the prose beside it.
 *
 * Prose-to-structured equality would only prove the table agrees with itself, and
 * this rule is the one the comparison reports *collisions* from: a machine
 * authored as keeping more of a name than it does hides the port's silent
 * failure, and one authored as keeping less invents renames the reader does not
 * need. So the check is behavioural, in the spirit of the `unsupportedCharacters`
 * re-derivation above.
 *
 * The probe is a pair of names sharing their first `n` characters and differing
 * at `n + 1`. Every dialect that enforces a significance rule at all does so
 * through `variableLint.ts`, which the machine's own `lint()` calls, so the
 * smallest `n` at which it complains *is* the machine's significance. A machine
 * whose lint never complains enforces no rule the probe can see, and must be
 * authored either as fully significant or as keeping more characters than any
 * name here reaches - which the Amstrad's 40 does, and no program's name does.
 *
 * `Q` is the filler because no keyword on any page here spells `QQ`, so a
 * crunching ROM cannot split a probe name; `X`/`Y` distinguish the pair. The
 * n = 0 control (`X` against `Y`) is what proves that: two names the rule keeps
 * apart on every machine must lint clean, so a filler that accidentally spelled
 * a keyword would fail there rather than silently reading as significance 1.
 */
describe('variable-name significance is the one each lint enforces', () => {
  /** Characters of shared prefix the probe goes up to. See the Amstrad note above. */
  const PROBE_LIMIT = 8;

  /** Two names sharing `shared` characters and differing at the next one. */
  const probe = (shared: number, marker: string): string => {
    const stem = 'Q'.repeat(shared);
    return `10 LET ${stem}X${marker}=1\n20 LET ${stem}Y${marker}=2\n`;
  };

  /** Whether the machine's own linter objects to a program. */
  const flags = (dialect: Dialect, source: string): boolean =>
    dialect.lint(source).length > 0;

  /**
   * The shortest shared prefix at which this machine treats two names as one,
   * or null where it never does within {@link PROBE_LIMIT}.
   */
  const observed = (dialect: Dialect, marker: string): number | null => {
    for (let n = 1; n <= PROBE_LIMIT; n++) {
      if (flags(dialect, probe(n, marker))) return n;
    }
    return null;
  };

  /** What the authored rule predicts {@link observed} will find. */
  const predicted = (significant: number | null): number | null =>
    significant === null || significant > PROBE_LIMIT ? null : significant;

  it.each(PAIRS)('%s', (id, facts, dialect) => {
    const rule = facts.variableSignificance;
    const marker = rule.markers[0] ?? '';

    // The control: two names nothing here can confuse. A machine failing this
    // is linting the probe for some reason other than significance, and every
    // reading below it would be noise.
    expect(
      flags(dialect, probe(0, '')),
      `${id} rejects two distinct names`,
    ).toBe(false);

    expect(
      observed(dialect, ''),
      `${id}: the lint and the authored plain-name rule disagree`,
    ).toBe(predicted(rule.plain));

    if (marker !== '') {
      expect(
        flags(dialect, probe(0, marker)),
        `${id} rejects two distinct "${marker}" names`,
      ).toBe(false);
      expect(
        observed(dialect, marker),
        `${id}: the lint and the authored "${marker}" rule disagree`,
      ).toBe(predicted(rule.marked));
    }

    // Whether the marker is part of the name, asked of the machine: a name and
    // the same name with a marker are two variables where it is. Only probed on
    // the machines that keep more than one character and treat every name
    // alike - elsewhere the longer name is refused for a different reason, and
    // the answer would be about that instead. (An Amstrad name one character
    // past its 40 is refused for its *length*, which is not this question.)
    if (
      marker !== '' &&
      rule.plain !== null &&
      rule.plain === rule.marked &&
      rule.plain > 1 &&
      rule.plain <= PROBE_LIMIT
    ) {
      const stem = 'Q'.repeat(rule.plain + 1);
      const both = `10 LET ${stem}=1\n20 LET ${stem}${marker}=2\n`;
      expect(
        flags(dialect, both),
        `${id}: "${stem}" and "${stem}${marker}" are not two variables here`,
      ).toBe(!rule.markerDistinguishes);
    }
  });
});

describe.each(PAIRS)('facts crosscheck: %s', (_id, facts, dialect) => {
  // The one name a machine's own registration already gives: every dialect's
  // blurb names the BASIC it runs ("Runs BBC BASIC IV", "Locomotive BASIC
  // 1.1"), so the guide's name for it is pinned to that rather than authored
  // twice. A machine whose blurb is reworded away from its BASIC fails here,
  // which is the point - the picker and the comparison must not disagree about
  // what a machine runs.
  it('basicDialect is the BASIC the dialect blurb names', () => {
    expect(dialect.blurb).toContain(facts.basicDialect);
  });

  it('freeRamBytes matches the dialect program RAM budget', () => {
    expect(facts.freeRamBytes).toBe(dialect.programRamBytes);
  });

  it('addressNotation matches the dialect (default hex)', () => {
    expect(facts.addressNotation).toBe(dialect.addressNotation ?? 'hex');
  });

  it('hexPrefix matches the dialect memory-write syntax', () => {
    expect(facts.hexPrefix).toBe(dialect.memoryWrites?.hexPrefix);
  });

  it('statementSepChar matches the dialect memory-write syntax', () => {
    expect(facts.statementSepChar).toBe(dialect.memoryWrites?.statementSep);
  });

  // Distinct from the row above, which is about parsing a memory-write form.
  // This is the language rule: whether the machine takes several statements on
  // a line at all, and what separates them if it does.
  it('statementSeparator matches the dialect', () => {
    expect(facts.statementSeparator).toBe(dialect.statementSeparator);
  });

  it('memoryWriteSyntax matches the dialect write forms', () => {
    const forms = dialect.memoryWrites?.forms;
    // No declared forms means the dialect writes memory with POKE.
    if (!forms || forms.includes('poke')) {
      expect(facts.memoryWriteSyntax).toMatch(/POKE/);
    }
    if (forms?.includes('indirection')) {
      expect(facts.memoryWriteSyntax).toMatch(/[?!]/);
    }
  });

  it('screenBase matches the dialect screen region, or is absent when it has none', () => {
    const start = regionStart(dialect, 'screen');
    if (start === undefined) {
      // ZX80/ZX81 (display file folded into program RAM) and the TRS-80
      // (no memory map) have no screen region, so they carry no screenBase.
      expect(facts.screenBase).toBeUndefined();
    } else {
      expect(facts.screenBase).toBeDefined();
      expect(parseAddr(facts.screenBase!)).toBe(start);
    }
  });

  it('unsupportedCharacters is exactly the printable ASCII the charset cannot show', () => {
    // Case-folded: the uppercase-only machines reach `a` through `A`, and a
    // program that types either gets the same byte.
    const shown = displayableAscii(dialect);
    const missing = PRINTABLE.filter(
      (c) => !shown.has(c) && !shown.has(c.toUpperCase()),
    );
    expect(facts.unsupportedCharacters).toEqual(missing);
  });

  it('unsupportedCharacters is sorted, distinct and printable ASCII only', () => {
    const authored = facts.unsupportedCharacters;
    expect(new Set(authored).size).toBe(authored.length);
    expect([...authored].sort()).toEqual(authored);
    for (const c of authored)
      expect(PRINTABLE, `${facts.id} ${c}`).toContain(c);
  });

  it('programStart matches the dialect program region, tolerating the C64 zero byte', () => {
    const start = regionStart(dialect, 'program');
    if (start === undefined) {
      // Only the TRS-80 lacks a program region (it has no memory map at all).
      expect(facts.programStart).toBeUndefined();
    } else {
      expect(facts.programStart).toBeDefined();
      // The C64 region starts at 0x0800 but BASIC text begins at 0x0801.
      expect([start, start + 1]).toContain(parseAddr(facts.programStart!));
    }
  });
});
