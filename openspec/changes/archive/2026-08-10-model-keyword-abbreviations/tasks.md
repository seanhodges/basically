## 1. The Commodore tokenizer

- [x] 1.1 `src/dialects/commodore64/tokenizer.ts`: after the existing
      case-blind full-keyword match fails, match a shifted-letter abbreviation
      — letters ending in one upper-case letter preceded by a lower-case one,
      or the equivalent shift escape — resolved to the first keyword in token
      order whose spelling starts with the prefix plus the final letter,
      emitting that keyword's token. Shared through the variant seam so the
      PET and VIC-20 resolve against their own tables.
- [x] 1.2 `src/dialects/commodore64/tokenizer.test.ts`: a sweep of every
      keyword's shortest abbreviation against the machine's own table;
      the order ties (`gO`, `pO`); abbreviations inert inside strings, REM
      tails and DATA; full spellings in every case unchanged; the mixed-case
      variable trade (`pO` becomes `POKE`) named in a test so it is chosen,
      not discovered. Equivalent coverage for the PET and VIC-20 variants.
- [x] 1.3 `src/dialects/commodore64/detokenizer.test.ts`: a program entered
      with abbreviations lists back with full spellings, byte-identical to the
      full-spelling entry.
- [x] 1.4 `docs/reference/commodore/escapes.md`: the caveat narrows to the
      lower-case display bank; tokenizer abbreviations are no longer listed as
      unmodelled.

## 2. The abbreviated-entry fact

- [x] 2.1 `src/reference/types.ts` + `src/reference/facts.ts`: every machine
      states its abbreviated entry — dot, shifted-letter, or none — the symbol
      spellings its tokenizer accepts as keywords, and whether short spellings
      shrink the stored program. Acorns dot; Commodores shifted with `?`;
      the Microsoft-family machines none with their symbols; Sinclairs none
      with none (keystroke entry is not a spelling).
- [x] 2.2 `src/reference/facts-crosscheck.test.ts`: the entry style is pinned
      behaviourally — an abbreviated program fed to each machine's own
      tokenizer produces the keyword's token, or on the Atom passes its lint,
      and a machine authored "none" rejects the notation; the symbol list
      agrees with the keyword tables' alias entries; the shrinks-the-program
      fact is pinned by sizing the same line spelled short and in full.

## 3. Reading the program

- [x] 3.1 `src/app/programVocabulary.ts`: abbreviated and symbol spellings
      resolve against the source machine's own tables; resolved keywords join
      the keyword list, and the spelling–keyword pairs are carried so the
      report can name both. A machine that resolves no alias for a symbol
      contributes nothing for it.
- [x] 3.2 `src/app/programVocabulary.test.ts`: `?` on a Commodore machine
      yields PRINT in the keywords and the pair in the spellings; `?` on the
      Atom yields neither; a dotted BBC program yields the resolved keywords;
      spellings inside strings are inert.
- [x] 3.3 `src/components/DocsDrawer.tsx` + `DocsDrawer.test.ts`: the new
      field crosses the boundary and the field lists agree by string.

## 4. Reporting

- [x] 4.1 `src/reference/compare.ts` + `compare.test.ts`: a pure finding —
      spellings used that the target does not read as the same command — plus
      the different-meaning warning where the target's own reference gives the
      symbol another meaning, and the fit-gated short-spellings measure on
      targets whose fact says spelling shrinks the program.
- [x] 4.2 `src/reference/portDescription.ts` + its test: expansions reported
      among the mechanical work, before the renames; the measure with the fit
      report, ending in its posed decision; both absent exactly when their
      findings are absent, and the language-rules section stays silent about
      abbreviated entry.
- [x] 4.3 `docs/.vitepress/theme/components/DialectCompare.vue`: the narrowed
      finding beside the renames, and an abbreviated-entry fact row in the
      language table.
- [x] 4.4 `src/ai/portReport.ts` + its test: expansions and the warning join
      the hand-over; the accepted-spellings direction is never handed over.

## 6. The language reference tables

- [x] 6.1 `src/dialects/keywordSpellings.ts`: keyed by dialect id rather than by
      `Dialect`, so the documentation bundle reaches it without a registry;
      `shortSpellingsFor` derives each keyword's short spellings — the shortest
      prefix that resolves to it, plus the symbol spellings — from the
      machine's own resolution order.
- [x] 6.2 `src/reference/abbreviations.ts` + `src/reference/types.ts`: every
      BASIC page's rows carry the spellings their machines read, against the
      machines the *row* exists on, and nothing where a shared row's machines
      disagree.
- [x] 6.3 `docs/.vitepress/theme/referenceTable.ts` + its test: the search
      matches a keyword's short spellings from their start as well as its name.
- [x] 6.4 `docs/.vitepress/theme/components/ReferenceTable.vue`: the spellings
      show beside the keyword, and the search says it looks for them — on the
      pages that have any.
- [x] 6.5 `src/reference/abbreviations.test.ts` and
      `src/dialects/keywordSpellings.test.ts`: every spelling shown tokenizes to
      its keyword on the machine that shows it, every abbreviable keyword has a
      row, and the id-keyed tables cover the registry.
- [x] 6.6 `docs/reference/<page>.md`: each page whose machines take a short
      spelling explains the notation once, in its notes.

## 5. Quality gates

- [x] 5.1 `npm run typecheck`
- [x] 5.2 `npm test`
- [x] 5.3 `npm run lint` and `npm run format:check`
- [x] 5.4 `npm run docs:build`
- [x] 5.5 `npm run e2e:chromium -- e2e/dialect-toolchain` — a pasted
      shifted-letter listing runs on a Commodore machine. Only check off when
      the run passes.
- [x] 5.6 `npm run e2e:chromium -- e2e/porting-guidance` — a dotted program's
      comparison reports the expansions. Only check off when the run passes.
