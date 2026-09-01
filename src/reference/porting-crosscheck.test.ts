/**
 * Pins the hand-authored cross-dialect porting data to the reference tables, so
 * it cannot drift as keyword tables are edited or dialects added.
 *
 * The two central assertions are mirror images, and that is the point:
 *
 *  - a KeywordEquivalence claims two machines spell one command differently, so
 *    each named machine MUST have its spelling and MUST NOT have another's;
 *  - a FalseFriend claims two machines spell one command alike, so every named
 *    machine MUST have that exact spelling.
 *
 * Both halves read the machine's *own* rows - its page's rows less those scoped
 * to a relative - rather than the page's. A page covers a family, and a family
 * is where the spellings start to differ: checked against the page, a claim that
 * the ZX81 spells the jump `GO TO` would pass on the Spectrum's row.
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

/** The reference page a machine reads from. */
const pageOf = (dialectId: string): string => {
  const dialect = dialects.find((d) => d.id === dialectId);
  if (!dialect) throw new Error(`unknown dialect: ${dialectId}`);
  return referencePageOf(dialect);
};

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

/** Every registered machine, which is what the porting data is keyed by. */
const MACHINE_IDS = dialects.map((d) => d.id);

const HAS: Record<string, Set<string>> = Object.fromEntries(
  MACHINE_IDS.map((id) => [id, namesForMachine(id)]),
);

/** A pair side names one machine or several; both forms expand to a list. */
const sideIds = (side: string | readonly string[]): readonly string[] =>
  typeof side === 'string' ? [side] : side;

describe('keyword equivalences', () => {
  it.each(keywordEquivalences.map((e) => [e.concept, e] as const))(
    '%s names only real machines, with at least two spellings',
    (_concept, group) => {
      const ids = Object.keys(group.spellings);
      expect(ids.length).toBeGreaterThanOrEqual(2);
      for (const id of ids) expect(MACHINE_IDS).toContain(id);
      // A group whose machines all agree describes no rename at all.
      expect(new Set(Object.values(group.spellings)).size).toBeGreaterThan(1);
    },
  );

  it.each(keywordEquivalences.map((e) => [e.concept, e] as const))(
    '%s: every machine really uses the spelling claimed for it',
    (_concept, group) => {
      for (const [id, spelling] of Object.entries(group.spellings)) {
        expect(
          HAS[id]!.has(spelling),
          `${id} has no "${spelling}" row of its own, so it cannot be that machine's spelling`,
        ).toBe(true);
      }
    },
  );

  it.each(keywordEquivalences.map((e) => [e.concept, e] as const))(
    "%s: no machine also has another machine's spelling for the same command",
    (_concept, group) => {
      const spellings = new Set(Object.values(group.spellings));
      for (const [id, spelling] of Object.entries(group.spellings)) {
        for (const other of spellings) {
          if (other === spelling) continue;
          // If a machine had both spellings they would be two distinct
          // commands, and renaming one into the other would be wrong.
          expect(
            HAS[id]!.has(other),
            `${id} has both "${spelling}" and "${other}", so they are not the same command there`,
          ).toBe(false);
        }
      }
    },
  );

  it('does not claim the same spelling for two different concepts on one machine', () => {
    const seen = new Map<string, string>();
    for (const group of keywordEquivalences) {
      for (const [id, spelling] of Object.entries(group.spellings)) {
        const key = `${id}:${spelling}`;
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
 * Machines left out of a group on purpose, keyed `<group>:<machine>` with the
 * reason.
 *
 * The two assertions below are the completeness half of the mirror the file
 * opens with: the checks above prove every machine a group *names* really has
 * the spelling, and these prove every machine that *has* the spelling is named.
 * Without them a machine registered after the group was written simply never
 * appeared in it, and the porting comparison reported its GOTO as a command the
 * target has not got - which is exactly what a machine joining a relative's
 * page used to do silently.
 */
const NOT_IN_GROUP: Record<string, string> = {
  // The Atom's CLEAR selects a screen mode; it has no discard-variables command
  // at all, which is what the CLEAR false friend below exists to say.
  'discard-variables:atom': 'CLEAR means something else entirely there',
  // Atari BASIC has GOTO and GO TO as separate tokens and lists each back the
  // way it was typed, so it holds both of the group's spellings and there is
  // nothing to rename in either direction.
  'unconditional-jump:atari800': "it spells the jump both of the group's ways",
  'unconditional-jump:atari400': "it spells the jump both of the group's ways",
};

describe('porting data completeness', () => {
  it.each(keywordEquivalences.map((e) => [e.concept, e] as const))(
    '%s names every machine that spells the command one of its ways',
    (concept, group) => {
      const spellings = [...new Set(Object.values(group.spellings))];
      const missing = MACHINE_IDS.filter(
        (id) =>
          !(id in group.spellings) &&
          !NOT_IN_GROUP[`${concept}:${id}`] &&
          spellings.some((spelling) => HAS[id]!.has(spelling)),
      );
      expect(
        missing,
        `these machines have one of ${concept}'s spellings but are not in the ` +
          'group - add them to porting.ts, or excuse them in NOT_IN_GROUP',
      ).toEqual([]);
    },
  );

  it.each(falseFriends.map((f) => [f.keyword, f] as const))(
    '%s names every machine that has the keyword',
    (keyword, friend) => {
      const missing = MACHINE_IDS.filter(
        (id) =>
          !(id in friend.meanings) &&
          !NOT_IN_GROUP[`${keyword}:${id}`] &&
          HAS[id]!.has(keyword),
      );
      expect(
        missing,
        `these machines have "${keyword}" but say nothing about what it means ` +
          'there - add them to porting.ts, or excuse them in NOT_IN_GROUP',
      ).toEqual([]);
    },
  );

  // An exemption that excuses nothing is a leftover, and it would go on
  // excusing nothing silently.
  it('excuses only a real machine from a real group', () => {
    const groups = new Set([
      ...keywordEquivalences.map((e) => e.concept),
      ...falseFriends.map((f) => f.keyword),
    ]);
    for (const key of Object.keys(NOT_IN_GROUP)) {
      const [group, id] = key.split(':');
      expect(groups, `${key} names no group`).toContain(group);
      expect(MACHINE_IDS, `${key} names no machine`).toContain(id);
    }
  });
});

describe('false friends', () => {
  it.each(falseFriends.map((f) => [f.keyword, f] as const))(
    '%s names only real machines, at least two, with differing meanings',
    (_keyword, friend) => {
      const ids = Object.keys(friend.meanings);
      expect(ids.length).toBeGreaterThanOrEqual(2);
      for (const id of ids) expect(MACHINE_IDS).toContain(id);
      expect(
        new Set(Object.values(friend.meanings)).size,
        'every listed meaning is identical, so this is not a false friend',
      ).toBeGreaterThan(1);
    },
  );

  it.each(falseFriends.map((f) => [f.keyword, f] as const))(
    '%s: every machine listed actually has that keyword',
    (keyword, friend) => {
      for (const id of Object.keys(friend.meanings)) {
        expect(
          HAS[id]!.has(keyword),
          `${id} has no "${keyword}" row of its own, so it cannot mean anything by it`,
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
    '%s names real machines, is directional, and stays within budget',
    (_label, pair) => {
      const from = sideIds(pair.from);
      const to = sideIds(pair.to);
      for (const id of [...from, ...to]) expect(MACHINE_IDS).toContain(id);
      // A machine on both sides would make the note a pair with itself, which
      // the comparison can never ask for.
      for (const id of from) {
        expect(
          to,
          'a pair note must compare two different machines',
        ).not.toContain(id);
      }
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
      // Both sides name machines now, so a topic counts as written about only
      // where every target the note serves writes about it: dropping a bullet
      // one of them still needs would leave that reader without it.
      const written = sideIds(pair.to)
        .map(
          (id) =>
            new Set(
              (
                portingFacts.find((f) => f.id === id)?.portingNotes ?? []
              ).flatMap((n) => n.topics),
            ),
        )
        .reduce((all, one) => new Set([...all].filter((t) => one.has(t))));
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

  // Expanded to machine pairs, because two entries naming overlapping lists
  // would leave the comparison picking whichever came first.
  it('has no duplicate ordered pair', () => {
    const keys = pairPortingNotes.flatMap((p) =>
      sideIds(p.from).flatMap((from) =>
        sideIds(p.to).map((to) => `${from}→${to}`),
      ),
    );
    expect(new Set(keys).size).toBe(keys.length);
  });
});
