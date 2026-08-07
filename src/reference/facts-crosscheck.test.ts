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
