/**
 * Pins the short spellings the reference pages show to the machines that would
 * read them.
 *
 * Every spelling here is derived rather than authored, so the risk is not a
 * typo but a wrong *model*: a resolution order read the wrong way round would
 * produce a page full of plausible spellings that resolve to the neighbouring
 * keyword, and a reader typing one would get a program that runs and does
 * something else. So each spelling is fed to the machine's own tokenizer and
 * required to produce the same bytes the full spelling produces.
 *
 * Like the other crosschecks here, this file reaches the dialect registry
 * freely: vitest runs it in node, and no bundle includes a `*.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { getDialect } from '../dialects/registry';
import { shortSpellingsFor } from '../dialects/keywordSpellings';
import { machinesOnPage } from './abbreviations';
import { referencePages as PAGES } from './pages';

const PAGE_LIST = Object.entries(PAGES);

/**
 * A one-line program using `text` where a statement opens, as bytes.
 *
 * The line is the whole probe: a spelling is entry notation, so what it must
 * prove is that the machine stores the same thing either way. A keyword that
 * takes an argument is given none - the tokenizers here store what they read
 * and report the rest as a lint finding, which the byte comparison ignores
 * because both arms carry it equally.
 */
const bytes = (dialectId: string, text: string): string =>
  Array.from(getDialect(dialectId).tokenize(`10 ${text}\n`).image).join(',');

/**
 * Whether `text` opens a comment on this machine - the rest of the line stored
 * as typed rather than tokenized.
 *
 * The one spelling that is not byte-identical to the keyword it stands for is
 * the comment apostrophe, and it is not identical for real reasons: the TRS-80
 * stores `'` as its genuine `:REM'` triple and the Amstrads give it a token of
 * its own. What makes it the same command is what it does to the rest of the
 * line, so that is what is asked.
 *
 * Measured by tokenizing a following keyword and a following non-keyword of the
 * same length: a comment stores both as text and comes out the same size, while
 * anything that tokenizes turns the keyword into one byte and does not.
 */
function opensComment(dialectId: string, text: string): boolean {
  const size = (tail: string) =>
    getDialect(dialectId).tokenize(`10 ${text} ${tail}\n`).image.length;
  return size('PRINT') === size('PRINU');
}

describe('the short spellings shown on each reference page', () => {
  it.each(PAGE_LIST)('%s tokenizes to the keyword', (page, data) => {
    const ids = machinesOnPage(page);
    let checked = 0;
    for (const entry of data.entries) {
      for (const spelling of entry.abbreviations ?? []) {
        for (const id of entry.onlyOn ?? ids) {
          // The spelling the *tokenizer* knows the keyword by, which is the
          // row's name except for the BBC's print formatters: its ROM holds the
          // bracket that is part of the token (`TAB(`) and its reference row
          // drops it, so `TAB.` has to be measured against `TAB(`.
          const word = shortSpellingsFor(id).has(entry.name)
            ? entry.name
            : `${entry.name}(`;
          const same =
            bytes(id, spelling) === bytes(id, word) ||
            (opensComment(id, spelling) && opensComment(id, word));
          expect(
            same,
            `${id}: "${spelling}" does not tokenize as ${word}`,
          ).toBe(true);
          checked += 1;
        }
      }
    }
    // A page that silently stopped deriving anything would otherwise pass this
    // by checking nothing; the Sinclairs genuinely have none.
    expect(checked > 0, `${page} shows no short spellings`).toBe(
      ids.some((id) => shortSpellingsFor(id).size > 0),
    );
  });

  it.each(PAGE_LIST)(
    '%s shows every spelling its machines have',
    (page, data) => {
      // The other direction: a keyword the machine abbreviates but the page does
      // not say so about is a reader left unable to look up what they are
      // reading. Matched on the row's own name, and on the bracketed spelling the
      // BBC's tokenizer keeps for its print formatters.
      const named = new Set(
        data.entries.flatMap((e) => [e.name, `${e.name}(`]),
      );
      for (const id of machinesOnPage(page)) {
        for (const keyword of shortSpellingsFor(id).keys()) {
          expect(named, `${id}: ${keyword} has no row on the ${page} page`) //
            .toContain(keyword);
        }
      }
    },
  );
});

describe('the spellings a machine has', () => {
  it('gives a Commodore keyword both notations it can be typed in', () => {
    // PRINT is unreachable by prefix - PRINT# is always found first - which is
    // exactly why `?` exists, and POKE is reachable by prefix and has no
    // symbol. One row shows whichever of the two the machine offers.
    const c64 = shortSpellingsFor('commodore64');
    expect(c64.get('PRINT')).toEqual(['?']);
    expect(c64.get('POKE')).toEqual(['pO']);
    expect(c64.get('GOSUB')).toEqual(['goS']);
    // GO is its own whole spelling, so it abbreviates to nothing at all.
    expect(c64.get('GO')).toBeUndefined();
  });

  it('gives an Acorn keyword its dotted prefix, shortest that resolves', () => {
    expect(shortSpellingsFor('bbcmicro').get('PRINT')).toEqual(['P.']);
    expect(shortSpellingsFor('atom').get('PRINT')).toEqual(['P.']);
    expect(shortSpellingsFor('atom').get('GOSUB')).toEqual(['GOS.']);
  });

  it('gives a machine with only symbol spellings just those', () => {
    expect([...shortSpellingsFor('trs80')]).toEqual([
      ['PRINT', ['?']],
      ['REM', ["'"]],
    ]);
  });

  it('gives a Sinclair machine nothing: a keystroke is not a spelling', () => {
    expect(shortSpellingsFor('zxspectrum').size).toBe(0);
    expect(shortSpellingsFor('zx81').size).toBe(0);
  });
});

describe('rows whose machines read them differently', () => {
  it('shows a machine-scoped row its own machine’s spelling', () => {
    // The PET's disk commands are abbreviable and the C64 has never heard of
    // them; EDIT is `ED.` on a Master sharing a page with a Micro that has no
    // EDIT at all. Both are scoped rows, so both keep their spelling.
    const concat = PAGES.commodore!.entries.find((e) => e.name === 'CONCAT');
    expect(concat?.onlyOn).toEqual(['pet']);
    expect(concat?.abbreviations).toEqual(['conC']);

    const edit = PAGES.bbc!.entries.find((e) => e.name === 'EDIT');
    expect(edit?.onlyOn).toEqual(['bbcmaster']);
    expect(edit?.abbreviations).toEqual(['ED.']);
  });

  it('shows a shared row nothing when its machines disagree', () => {
    // Nothing on the pages today does, and the rule is what keeps it that way:
    // a spelling shown against the wrong machine is worse than none shown.
    for (const [page, data] of PAGE_LIST) {
      const ids = machinesOnPage(page);
      for (const entry of data.entries) {
        if (entry.onlyOn || !entry.abbreviations) continue;
        const readings = ids.map((id) =>
          (shortSpellingsFor(id).get(entry.name) ?? []).join(' '),
        );
        expect(new Set(readings).size, `${page} ${entry.name}`).toBe(1);
      }
    }
  });
});
