/**
 * Pins the hand-authored cross-dialect porting data to the reference tables, so
 * it cannot drift as keyword tables are edited or dialects added.
 *
 * The two central assertions are mirror images, and that is the point:
 *
 *  - a KeywordEquivalence claims two pages spell one command differently, so
 *    each named page MUST have its spelling and MUST NOT have another page's;
 *  - a FalseFriend claims two pages spell one command alike, so every named page
 *    MUST have that exact spelling.
 *
 * Unlike the sibling crosschecks this file needs no `src/` import: the
 * reference tables are themselves already pinned to `src/dialects/` by
 * keyword-crosscheck.test.ts, so pinning to them transitively pins to the code.
 */
import { describe, expect, it } from 'vitest';
import { referencePages as PAGES } from './pages';
import { falseFriends, keywordEquivalences, pairPortingNotes } from './porting';
import { portingFacts } from './facts';
import { dialects } from '../dialects/registry';
import { referencePageOf } from '../dialects/referencePage';

const namesOn = (page: string): Set<string> =>
  new Set(PAGES[page]!.entries.map((e) => e.name));

const NAMES: Record<string, Set<string>> = Object.fromEntries(
  Object.keys(PAGES).map((p) => [p, namesOn(p)]),
);

/**
 * Page slug for a machine, and the machines on a page. `keywordEquivalences`,
 * `falseFriends` and `pairPortingNotes` stay keyed by *page*, because a
 * spelling is a property of the BASIC and every machine on a page shares it -
 * while `portingFacts` is keyed by *machine*, because free RAM and colour are
 * not. Both are right, so this file crosses between them.
 */
const pageOf = (dialectId: string): string => {
  const dialect = dialects.find((d) => d.id === dialectId);
  if (!dialect) throw new Error(`unknown dialect: ${dialectId}`);
  return referencePageOf(dialect);
};

const machinesOn = (page: string): string[] =>
  dialects.filter((d) => referencePageOf(d) === page).map((d) => d.id);

/**
 * Command names one machine has - its page's rows less those scoped to a
 * relative. Narrower than `NAMES[page]`, and deliberately: advice on what to use
 * instead of `FILL` is redundant on a CPC 6128 but useful on a 464.
 */
const namesForMachine = (dialectId: string): Set<string> => {
  const page = PAGES[pageOf(dialectId)]!;
  return new Set(
    page.entries
      .filter((e) => !e.onlyOn || e.onlyOn.includes(dialectId))
      .map((e) => e.name),
  );
};

describe('keyword equivalences', () => {
  it.each(keywordEquivalences.map((e) => [e.concept, e] as const))(
    '%s names only real pages, with at least two spellings',
    (_concept, group) => {
      const pages = Object.keys(group.spellings);
      expect(pages.length).toBeGreaterThanOrEqual(2);
      for (const page of pages) expect(Object.keys(PAGES)).toContain(page);
      // A group whose pages all agree describes no rename at all.
      expect(new Set(Object.values(group.spellings)).size).toBeGreaterThan(1);
    },
  );

  it.each(keywordEquivalences.map((e) => [e.concept, e] as const))(
    '%s: every page really uses the spelling claimed for it',
    (_concept, group) => {
      for (const [page, spelling] of Object.entries(group.spellings)) {
        expect(
          NAMES[page]!.has(spelling),
          `${page} has no "${spelling}" row, so it cannot be that page's spelling`,
        ).toBe(true);
      }
    },
  );

  it.each(keywordEquivalences.map((e) => [e.concept, e] as const))(
    "%s: no page also has another page's spelling for the same command",
    (_concept, group) => {
      const spellings = new Set(Object.values(group.spellings));
      for (const [page, spelling] of Object.entries(group.spellings)) {
        for (const other of spellings) {
          if (other === spelling) continue;
          // If a page had both spellings they would be two distinct commands,
          // and renaming one into the other would be wrong.
          expect(
            NAMES[page]!.has(other),
            `${page} has both "${spelling}" and "${other}", so they are not the same command there`,
          ).toBe(false);
        }
      }
    },
  );

  it('does not claim the same spelling for two different concepts on one page', () => {
    const seen = new Map<string, string>();
    for (const group of keywordEquivalences) {
      for (const [page, spelling] of Object.entries(group.spellings)) {
        const key = `${page}:${spelling}`;
        expect(
          seen.get(key),
          `${key} is claimed by both "${seen.get(key)}" and "${group.concept}"`,
        ).toBeUndefined();
        seen.set(key, group.concept);
      }
    }
  });
});

/**
 * Pages left out of a group on purpose, keyed `<group>:<page>` with the reason.
 *
 * The two assertions below are the completeness half of the mirror the file
 * opens with: the checks above prove every page a group *names* really has the
 * spelling, and these prove every page that *has* the spelling is named. Without
 * them a machine registered after the group was written simply never appeared in
 * it, and the porting comparison reported its GOTO as a command the target has
 * not got.
 */
const NOT_IN_GROUP: Record<string, string> = {
  // The Atom's CLEAR selects a screen mode; it has no discard-variables command
  // at all, which is what the CLEAR false friend below exists to say.
  'discard-variables:atom': 'CLEAR means something else entirely there',
  // Atari BASIC has GOTO and GO TO as separate tokens and lists each back the
  // way it was typed, so it holds both of the group's spellings and there is
  // nothing to rename in either direction.
  'unconditional-jump:atari': "it spells the jump both of the group's ways",
};

describe('porting data completeness', () => {
  it.each(keywordEquivalences.map((e) => [e.concept, e] as const))(
    '%s names every page that spells the command one of its ways',
    (concept, group) => {
      const spellings = [...new Set(Object.values(group.spellings))];
      const missing = Object.keys(PAGES).filter(
        (page) =>
          !(page in group.spellings) &&
          !NOT_IN_GROUP[`${concept}:${page}`] &&
          spellings.some((spelling) => NAMES[page]!.has(spelling)),
      );
      expect(
        missing,
        `these pages have one of ${concept}'s spellings but are not in the ` +
          'group - add them to porting.ts, or excuse them in NOT_IN_GROUP',
      ).toEqual([]);
    },
  );

  it.each(falseFriends.map((f) => [f.keyword, f] as const))(
    '%s names every page that has the keyword',
    (keyword, friend) => {
      const missing = Object.keys(PAGES).filter(
        (page) =>
          !(page in friend.meanings) &&
          !NOT_IN_GROUP[`${keyword}:${page}`] &&
          NAMES[page]!.has(keyword),
      );
      expect(
        missing,
        `these pages have "${keyword}" but say nothing about what it means ` +
          'there - add them to porting.ts, or excuse them in NOT_IN_GROUP',
      ).toEqual([]);
    },
  );

  // An exemption that excuses nothing is a leftover, and it would go on
  // excusing nothing silently.
  it('excuses only a real page from a real group', () => {
    const groups = new Set([
      ...keywordEquivalences.map((e) => e.concept),
      ...falseFriends.map((f) => f.keyword),
    ]);
    for (const key of Object.keys(NOT_IN_GROUP)) {
      const [group, page] = key.split(':');
      expect(groups, `${key} names no group`).toContain(group);
      expect(Object.keys(PAGES), `${key} names no page`).toContain(page);
    }
  });
});

describe('false friends', () => {
  it.each(falseFriends.map((f) => [f.keyword, f] as const))(
    '%s names only real pages, at least two, with differing meanings',
    (_keyword, friend) => {
      const pages = Object.keys(friend.meanings);
      expect(pages.length).toBeGreaterThanOrEqual(2);
      for (const page of pages) expect(Object.keys(PAGES)).toContain(page);
      expect(
        new Set(Object.values(friend.meanings)).size,
        'every listed meaning is identical, so this is not a false friend',
      ).toBeGreaterThan(1);
    },
  );

  it.each(falseFriends.map((f) => [f.keyword, f] as const))(
    '%s: every page listed actually has that keyword',
    (keyword, friend) => {
      for (const page of Object.keys(friend.meanings)) {
        expect(
          NAMES[page]!.has(keyword),
          `${page} has no "${keyword}" row, so it cannot mean anything by it`,
        ).toBe(true);
      }
    },
  );

  it('has no duplicate keywords', () => {
    const keywords = falseFriends.map((f) => f.keyword);
    expect(new Set(keywords).size).toBe(keywords.length);
  });
});

// The reading budget from the change proposal, made mechanical. The comparison
// already renders the fact rows and the full keyword lists, so prose that
// restates them would spend the whole budget adding nothing.
const MAX_NOTES = 6;
const MAX_NOTE_CHARS = 220;
const MAX_SUBSTITUTION_CHARS = 160;

describe.each(portingFacts.map((f) => [f.id, f] as const))(
  'porting guidance: %s',
  (id, facts) => {
    it('has a few short notes, within the reading budget', () => {
      expect(facts.portingNotes.length).toBeGreaterThan(0);
      expect(facts.portingNotes.length).toBeLessThanOrEqual(MAX_NOTES);
      for (const { text } of facts.portingNotes) {
        expect(text.trim()).not.toBe('');
        expect(text.length, `too long to scan: "${text}"`).toBeLessThanOrEqual(
          MAX_NOTE_CHARS,
        );
      }
    });

    // An untagged note could never be superseded by a pair note, so it would
    // silently reintroduce the duplication the topics exist to remove.
    it('says what each note is about', () => {
      for (const { text, topics } of facts.portingNotes) {
        expect(topics.length, `untagged note: "${text}"`).toBeGreaterThan(0);
        expect(new Set(topics).size, `topic repeated: "${text}"`).toBe(
          topics.length,
        );
      }
    });

    it('only advises on commands this machine does not have', () => {
      const has = namesForMachine(id);
      for (const { keyword } of facts.substitutions) {
        expect(
          has.has(keyword),
          `${id} already has "${keyword}", so advice on what to use instead is redundant`,
        ).toBe(false);
      }
    });

    it('only advises on commands that exist somewhere', () => {
      for (const { keyword } of facts.substitutions) {
        const pages = Object.keys(PAGES).filter((p) => NAMES[p]!.has(keyword));
        expect(
          pages.length,
          `no reference page has "${keyword}", so nobody can arrive here needing it`,
        ).toBeGreaterThan(0);
      }
    });

    it('keeps each substitution to a sentence, and names each once', () => {
      const seen = new Set<string>();
      for (const { keyword, note } of facts.substitutions) {
        expect(seen.has(keyword), `${keyword} advised twice`).toBe(false);
        seen.add(keyword);
        expect(note.length, `too long: "${note}"`).toBeLessThanOrEqual(
          MAX_SUBSTITUTION_CHARS,
        );
      }
    });

    // Bridges the per-command substitutions to the per-capability domain
    // guidance: every keyword advised on here must carry a domain wherever it
    // exists, so the two forms of advice can never disagree about which
    // capability group a command belongs to.
    it('every substitution keyword carries a capability domain', () => {
      for (const { keyword } of facts.substitutions) {
        const carrier = Object.values(PAGES).find((page) =>
          page.entries.some((e) => e.name === keyword),
        );
        const entry = carrier?.entries.find((e) => e.name === keyword);
        expect(
          entry?.domain,
          `"${keyword}" exists without a capability domain`,
        ).toBeDefined();
      }
    });
  },
);

describe('pair porting notes', () => {
  it.each(pairPortingNotes.map((p) => [`${p.from}→${p.to}`, p] as const))(
    '%s names real pages, is directional, and stays within budget',
    (_label, pair) => {
      expect(Object.keys(PAGES)).toContain(pair.from);
      expect(Object.keys(PAGES)).toContain(pair.to);
      expect(
        pair.from,
        'a pair note must compare two different pages',
      ).not.toBe(pair.to);
      expect(pair.notes.length).toBeGreaterThan(0);
      expect(pair.notes.length).toBeLessThanOrEqual(MAX_NOTES);
      for (const { text } of pair.notes) {
        expect(text.trim()).not.toBe('');
        expect(text.length, `too long to scan: "${text}"`).toBeLessThanOrEqual(
          MAX_NOTE_CHARS,
        );
      }
    },
  );

  // A `covers` tag exists to drop one of the target's own bullets. Naming a
  // topic that target never writes about drops nothing, so the tag is either a
  // typo or a leftover from a bullet that has since been reworded - either way
  // it is claiming to have said something the reader will never miss.
  it.each(pairPortingNotes.map((p) => [`${p.from}→${p.to}`, p] as const))(
    '%s only claims to cover topics its target writes about',
    (_label, pair) => {
      // Pair notes name pages; facts name machines. A topic counts as written
      // about if any machine on the target page writes about it - within a
      // family the notes are shared, so in practice they all do.
      const written = new Set(
        machinesOn(pair.to)
          .flatMap(
            (id) => portingFacts.find((f) => f.id === id)?.portingNotes ?? [],
          )
          .flatMap((n) => n.topics),
      );
      for (const note of pair.notes) {
        for (const topic of note.covers ?? []) {
          expect(
            written.has(topic),
            `no ${pair.to} note is about "${topic}", so covering it drops nothing`,
          ).toBe(true);
        }
      }
    },
  );

  it('has no duplicate ordered pair', () => {
    const keys = pairPortingNotes.map((p) => `${p.from}→${p.to}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
