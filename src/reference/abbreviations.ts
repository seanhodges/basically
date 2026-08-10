// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The short spellings each reference row's keyword can be typed as, noted
 * against the row.
 *
 * Archive listings are written in those notations, so a reader looking a
 * keyword up has usually arrived from one: someone reading `P.` in a BBC
 * listing needs the reference page to answer "what is `P.`?", not only "what is
 * PRINT?". The page therefore shows each keyword's short spellings beside it
 * and searches them alongside the name.
 *
 * Derived, never authored. The spellings come from each machine's own
 * resolution order (`src/dialects/keywordSpellings.ts`), so a keyword added to
 * a machine changes its neighbours' abbreviations here the same turn it changes
 * them on the machine - which is the whole reason this is not fifteen hundred
 * hand-typed strings. That is a *value* import from `src/dialects/`, unlike the
 * type-only ones in ./compare.ts: the keyword tables are leaf data modules
 * importing nothing but a type, so the documentation bundle takes the data and
 * reaches no registry and no emulator core. `docs/reference/compare.md` already
 * imports the memory maps the same way.
 *
 * `abbreviations.test.ts` pins every spelling this produces against the
 * machine's own tokenizer.
 */
import { shortSpellingsFor } from '../dialects/keywordSpellings';
import { machines } from './machines';
import type { ReferenceEntry, ReferenceTableData } from './types';

/** The registered machines a reference page covers, in the sidebar's order. */
export function machinesOnPage(page: string): string[] {
  return machines.filter((m) => m.page === page).map((m) => m.id);
}

/**
 * The short spellings for one row, or undefined where it has none.
 *
 * Read against the machines the *row* exists on, not the whole page: the PET's
 * disk commands are abbreviable and the C64 has never heard of them, and the
 * Master's EDIT is `ED.` on a page it shares with a Micro that has no EDIT at
 * all. A row whose machines disagree contributes nothing rather than picking
 * one of them - a spelling shown against the wrong machine is worse than a
 * spelling not shown.
 */
function spellingsForRow(
  entry: ReferenceEntry,
  pageMachines: string[],
): string[] | undefined {
  const ids = entry.onlyOn ?? pageMachines;
  if (ids.length === 0) return undefined;
  // The BBC's tokenizer holds the print formatters with the bracket that is
  // part of their token (`TAB(`), while its editor and reference row drop it;
  // the Commodore pages keep it on both sides. Ask for the row's own spelling
  // and then for the bracketed one, so `TAB` finds its `TA.` either way.
  const readings = ids.map((id) => {
    const table = shortSpellingsFor(id);
    return (table.get(entry.name) ?? table.get(`${entry.name}(`) ?? []).join(
      ' ',
    );
  });
  const [first] = readings;
  if (first === undefined || first === '') return undefined;
  if (readings.some((r) => r !== first)) return undefined;
  return first.split(' ');
}

/**
 * A reference page with each row's short spellings noted on it.
 *
 * Applied where the page's data is exported, so every consumer - the docs
 * table, the app's own drawer, the porting comparison - sees the same rows. A
 * page whose machines abbreviate nothing comes back unchanged, which is what
 * the Sinclair pages do: their keywords arrive by keystroke, and a keystroke is
 * not a spelling.
 */
export function withAbbreviations<T extends ReferenceTableData>(
  page: string,
  data: T,
): T {
  const pageMachines = machinesOnPage(page);
  return {
    ...data,
    entries: data.entries.map((entry) => {
      const abbreviations = spellingsForRow(entry, pageMachines);
      return abbreviations ? { ...entry, abbreviations } : entry;
    }),
  };
}
