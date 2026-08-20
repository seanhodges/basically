import { describe, expect, it } from 'vitest';
import type { BasicReferenceTableData } from './types';
import { KEYWORD_DOMAINS } from './domains';
import { CORE_PLACEHOLDERS, placeholderTokens } from './placeholders';
import { zx81Reference } from './zx81';
import { zx80Reference } from './zx80';
import { zxspectrumReference } from './zxspectrum';
import { bbcReference } from './bbc';
import { commodoreReference } from './commodore';
import { atomReference } from './atom';
import { trs80Reference } from './trs80';
import { cpcReference } from './cpc';
import { altair8800Reference } from './altair8800';
import { pmd85Reference } from './pmd85';

const SETS: [string, BasicReferenceTableData][] = [
  ['zx81', zx81Reference],
  ['zx80', zx80Reference],
  ['zxspectrum', zxspectrumReference],
  ['bbc', bbcReference],
  ['commodore', commodoreReference],
  ['atom', atomReference],
  ['trs80', trs80Reference],
  ['cpc', cpcReference],
  ['altair8800', altair8800Reference],
  ['pmd85', pmd85Reference],
];

describe.each(SETS)('reference data: %s', (_id, data) => {
  it('has a title, machine list and entries', () => {
    expect(data.title).toBeTruthy();
    expect(data.machines.length).toBeGreaterThan(0);
    expect(data.entries.length).toBeGreaterThan(0);
  });

  it('every entry is structurally complete', () => {
    for (const e of data.entries) {
      expect(e.name, 'name').toBeTruthy();
      expect(['command', 'function', 'operator']).toContain(e.kind);
      expect(e.syntax, `syntax for ${e.name}`).toBeTruthy();
      expect(e.description.length, `description for ${e.name}`).toBeGreaterThan(
        0,
      );
      expect(KEYWORD_DOMAINS, `domain for ${e.name}`).toContain(e.domain);
    }
  });

  it('has no duplicate names', () => {
    const names = data.entries.map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

// A dead domain (in the vocabulary, used by nobody) and a drifted one (used by
// a table but absent from the vocabulary) are both authoring mistakes the
// per-entry check above cannot see, since it only ever looks at one table.
describe('reference data: the capability vocabulary', () => {
  it('is used in full across the BASIC tables, and nothing beyond it', () => {
    const used = new Set(
      SETS.flatMap(([, d]) => d.entries.map((e) => e.domain)),
    );
    expect([...used].sort()).toEqual([...KEYWORD_DOMAINS].sort());
  });
});

// The repetition marker, kept as a named constant so the rules below read as rules
// rather than as a wall of escaped punctuation.
const ELLIPSIS = '…';

/**
 * The mechanically safe half of the notation rules in `placeholders.ts` - the ones
 * with no conceivable R0 exception, so a machine's real syntax can never be forced to
 * break them. Spacing around `=`, whether a literal is quoted, and whether a fragment
 * keyword is expanded are all deliberately *not* here: each has legitimate exceptions
 * (the Atom really does require `?<addr>=<byte>`), and asserting them would force a
 * suppression comment into the data, which is worse than a reviewer reading the rules.
 */
const STRUCTURAL_RULES: [string, (syntax: string) => boolean][] = [
  ['is trimmed', (y) => y === y.trim()],
  ['has no double space', (y) => !/ {2}/.test(y)],
  ['spells repetition with a single character', (y) => !/\.\.\./.test(y)],
  ['puts no space before a comma', (y) => !/ ,/.test(y)],
  [
    // The `|` case is a separator group like `[;|,|']`, where the comma is one of the
    // alternatives a PRINT item may end with rather than something separating two
    // arguments.
    'follows a separating comma with a space, a bracket or the repetition mark',
    (y) => !new RegExp(`,(?![ |\\]${ELLIPSIS}])`).test(y),
  ],
  [
    'attaches the repetition mark to what repeats',
    (y) => !new RegExp(`[,\\s]${ELLIPSIS}`).test(y),
  ],
  ['binds a channel marker to its placeholder', (y) => !/#\s+</.test(y)],
];

/**
 * Every `<` that is not a placeholder must be a relational operator, which on these
 * pages is only ever `<`, `<=` or `<>` followed by a space or the end of the string.
 * This is the assertion that catches a mistyped placeholder - `<Number>`, `<num var>`,
 * `<x >` - which the tokeniser itself would silently skip.
 */
function strayAngle(syntax: string): string | undefined {
  const rest = syntax.replace(/<[a-z][a-z0-9]*>/g, '');
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] !== '<') continue;
    const from = rest.slice(i);
    if (!/^<[=>]?(\s|$)/.test(from)) return from.slice(0, 16);
  }
  return undefined;
}

describe.each(SETS)('argument notation: %s', (_id, data) => {
  const known = new Set([
    ...CORE_PLACEHOLDERS.map((p) => p.id),
    ...data.placeholders.map((p) => p.id),
  ]);

  it('writes every argument as a placeholder the page can explain', () => {
    for (const e of data.entries) {
      for (const token of placeholderTokens(e.syntax)) {
        expect(
          known.has(token),
          `${e.name}: <${token}> is in neither the shared vocabulary nor this page's own`,
        ).toBe(true);
      }
    }
  });

  it('leaves no bare placeholder behind', () => {
    for (const e of data.entries) {
      const outside = e.syntax.replace(/<[a-z][a-z0-9]*>/g, '');
      expect(
        /[a-z]/.test(outside),
        `${e.name}: "${e.syntax}" has a lower-case word outside <…>, so it is a placeholder that was never bracketed`,
      ).toBe(false);
    }
  });

  it('has no stray angle bracket', () => {
    for (const e of data.entries) {
      expect(strayAngle(e.syntax), `${e.name}: "${e.syntax}"`).toBeUndefined();
    }
  });

  it.each(STRUCTURAL_RULES)('%s', (_rule, holds) => {
    for (const e of data.entries) {
      expect(holds(e.syntax), `${e.name}: "${e.syntax}"`).toBe(true);
    }
  });

  // Operator rows are exempt: the `(` and `)` rows on the ZX80 are literally a lone
  // bracket, which is the row being correct rather than unbalanced.
  it('balances its brackets', () => {
    for (const e of data.entries) {
      if (e.kind === 'operator') continue;
      const count = (ch: string) =>
        [...e.syntax].filter((c) => c === ch).length;
      expect(count('['), `${e.name}: "${e.syntax}"`).toBe(count(']'));
      expect(count('('), `${e.name}: "${e.syntax}"`).toBe(count(')'));
    }
  });

  it('declares only placeholders it uses, and never redefines a shared one', () => {
    const used = new Set(
      data.entries.flatMap((e) => placeholderTokens(e.syntax)),
    );
    const coreIds = new Set<string>(CORE_PLACEHOLDERS.map((p) => p.id));
    for (const p of data.placeholders) {
      expect(used.has(p.id), `<${p.id}> is declared but never used`).toBe(true);
      expect(
        coreIds.has(p.id),
        `<${p.id}> is declared here and already shared`,
      ).toBe(false);
      expect(p.id, `page placeholder id "${p.id}"`).toMatch(/^[a-z][a-z0-9]*$/);
      expect(p.meaning.length, `meaning for <${p.id}>`).toBeGreaterThan(0);
    }
  });
});

// The exact dual of the capability-vocabulary check above, and for the same reason: a
// shared placeholder nobody uses is dead weight, and one a page uses without the
// vocabulary knowing it is drift. Neither is visible from inside one table.
describe('reference data: the argument vocabulary', () => {
  it('is used in full across the BASIC tables, and nothing beyond it', () => {
    const pageOwn = new Set(
      SETS.flatMap(([, d]) => d.placeholders.map((p) => p.id)),
    );
    const shared = new Set(
      SETS.flatMap(([, d]) =>
        d.entries.flatMap((e) => placeholderTokens(e.syntax)),
      ),
    );
    for (const id of pageOwn) shared.delete(id);
    expect([...shared].sort()).toEqual(
      CORE_PLACEHOLDERS.map((p) => p.id).sort(),
    );
  });

  it('reads as lower-case glosses, so the legend renders as a sentence', () => {
    for (const p of CORE_PLACEHOLDERS) {
      expect(p.id, 'placeholder id').toMatch(/^[a-z][a-z0-9]*$/);
      expect(p.meaning[0], `meaning for <${p.id}>`).toBe(
        p.meaning[0].toLowerCase(),
      );
    }
  });

  // The porting comparison shows two pages' usage side by side, so a reader can meet
  // one page's placeholder next to another's with neither legend in view. Two pages
  // are free to name a slot differently; they are not free to mean different things
  // by one name.
  it('gives one meaning to any placeholder two pages both declare', () => {
    const meanings = new Map<string, string>();
    for (const [id, data] of SETS) {
      for (const p of data.placeholders) {
        const seen = meanings.get(p.id);
        if (seen === undefined) meanings.set(p.id, p.meaning);
        else expect(p.meaning, `<${p.id}> on ${id}`).toBe(seen);
      }
    }
  });
});

// The hazard the whole scan rests on. A relational operator's own row contains a
// literal `<`, so a naive `<[^>]*>` sweep reads `<number> < <number>` as one
// placeholder named `number> < <number` - silently, and the conformance checks above
// would then pass while asserting nothing. Pinned here on the real rows rather than a
// fixture, so it keeps holding as the pages change.
describe('reference data: relational operators are not read as placeholders', () => {
  const rowsNamed = (name: string) =>
    SETS.flatMap(([id, d]) =>
      d.entries.filter((e) => e.name === name).map((e) => [id, e] as const),
    );

  it.each(['<', '<=', '<>'])('reads %s as its operands only', (name) => {
    const rows = rowsNamed(name);
    expect(rows.length, `no page has a ${name} row`).toBeGreaterThan(0);
    for (const [id, e] of rows) {
      const tokens = placeholderTokens(e.syntax);
      expect(tokens.length, `${id}: "${e.syntax}"`).toBeGreaterThan(0);
      for (const t of tokens) {
        expect(t, `${id}: "${e.syntax}"`).toMatch(/^[a-z][a-z0-9]*$/);
      }
    }
  });

  it('reads the operands of a comparison, not the comparison itself', () => {
    expect(
      placeholderTokens('<number> < <number> | <string> < <string>'),
    ).toEqual(['number', 'number', 'string', 'string']);
    expect(placeholderTokens('<number> <= <number>')).toEqual([
      'number',
      'number',
    ]);
    expect(placeholderTokens('<number> <> <number>')).toEqual([
      'number',
      'number',
    ]);
  });
});
