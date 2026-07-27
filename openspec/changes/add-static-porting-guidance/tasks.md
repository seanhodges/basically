## 1. Stop the comparison reporting operators

- [x] 1.1 Exclude `kind: 'operator'` entries from `diffKeywords` in
      `docs/.vitepress/theme/dialectCompare.ts`, so operators appear in neither
      `mustReplace`, `newlyAvailable` nor `behaviourChanged`. Keep the file's
      no-`src/`-imports rule.
- [x] 1.2 Extend `docs/.vitepress/theme/dialectCompare.test.ts`: no operator
      reaches any bucket; a real command difference is unaffected; the
      `unchanged` count stays consistent.

## 2. Keyword equivalences

- [x] 2.1 Add a `KeywordEquivalence` type to `docs/reference/data/types.ts` — a
      group of spellings meaning the same command.
- [x] 2.2 Create `docs/reference/data/porting.ts` with the equivalence groups,
      seeded from the known cases (`GOTO`/`GO TO`, `GOSUB`/`GO SUB`,
      `CLEAR`/`CLR`, `CONT`/`CONTINUE`, `RAND`/`RANDOMIZE`/`RANDOMISE`) and
      extended by scanning the eight reference tables.
- [x] 2.3 Teach `diffKeywords` to treat grouped spellings as the same command,
      reporting them as a rename rather than a loss plus an unrelated gain.
- [x] 2.4 Cover in `dialectCompare.test.ts`: a renamed command appears in
      neither the missing nor the newly-gained list; a genuinely absent command
      still does.

## 3. False friends

- [x] 3.1 Add a `FalseFriend` type to `types.ts` — a keyword with a page→meaning
      map — and the data to `porting.ts`. Draft from the mechanical candidate
      list (same name, same kind, divergent description); confirm each against
      the reference tables before keeping it. Known: `LOG`, `CLEAR`, `GET`,
      `UNTIL`, `RND`, `CMD`.
- [x] 3.2 Add the lookup to `dialectCompare.ts`: given source and target page
      slugs, return the false friends both list whose meanings differ.
- [x] 3.3 Cover in `dialectCompare.test.ts`: fires when meanings differ; silent
      when they match or when either page is absent from the map.

## 4. Porting content

- [x] 4.1 Add `portingNotes: string[]` and
      `substitutions: { keyword: string; note: string }[]` to `PortingFacts` in
      `types.ts`, documenting that substitutions are best-effort. Classify the
      new fields in the type's crosschecked/hand-authored doc block.
- [ ] 4.2 Add the optional interpolatable address fields to `PortingFacts`
      (screen base, program start), documented as optional because ZX80/ZX81
      have no screen region and the TRS-80 has no memory map at all.
- [x] 4.3 Fill `portingNotes` and `substitutions` for all eight entries in
      `docs/reference/data/facts.ts` — 3–5 notes each, roughly 10–20
      substitutions each, within the character caps. End-user documentation: no
      `src/` paths, no internal symbols.
- [x] 4.4 Add a `PairPortingNotes` type and the sparse pair notes to
      `porting.ts` — the Sinclair family pairs, `commodore↔trs80`, `atom↔bbc`,
      and the carrier traps (`#BIN` versus `.TAP`, the ZX80/ZX81 escape-byte
      remapping).
- [x] 4.5 Write the generic guide in `docs/reference/compare.md` — about 450
      words, covering only what the tables cannot show. Do not narrate the fact
      rows.

## 5. Rendering

- [x] 5.1 Add `composeGuidance()` to `dialectCompare.ts` returning the guide,
      target notes, pair notes and false friends for a chosen pair.
- [x] 5.2 Render in `DialectCompare.vue`: guide → target notes → pair notes →
      false friends as their own section → per-row substitutions inside the
      existing keyword lists. **Not** gated on `embedded`.
- [x] 5.3 Confirm the guidance renders on a standalone docs visit (outside the
      IDE iframe) and that `?from=`/`?to=` deep links still select the pair.

## 6. Remove the AI explain action

- [x] 6.1 Delete `diffSummaryText()`, `explainWithAi()`, `EXPLAIN_MESSAGE` and
      the Explain button from `DialectCompare.vue`, keeping `convertWithAi` and
      its message intact.
- [x] 6.2 Delete `COMPARE_EXPLAIN_MESSAGE`, `explainPorting()` and its listener
      branch from `src/components/DocsDrawer.tsx`, leaving `convertProgram`
      untouched.
- [x] 6.3 Verify in the IDE drawer that "Convert to \<machine\> using AI"
      still works and still opens AI settings when no key is configured.

## 7. Staleness guards

- [x] 7.1 Create `docs/reference/data/porting-crosscheck.test.ts`: every
      substitution names a command present on some page and **absent** from the
      dialect it is attached to.
- [x] 7.2 Every false friend names only real pages, lists at least two, names a
      command each of those pages actually **has**, and gives at least two
      differing meanings.
- [x] 7.3 Every equivalence group names spellings that exist somewhere, and no
      group holds two spellings present on the same page.
- [x] 7.4 Every pair note names real page slugs, has `from !== to`, and no pair
      is duplicated.
- [x] 7.5 Character caps and bullet counts hold for every note, so the
      five-minute budget cannot rot.
- [x] 7.6 Extend the id-set assertion in `facts-crosscheck.test.ts` so a page
      missing `portingNotes` fails, rather than duplicating that check.

## 8. Quality gates

- [x] 8.1 `npm run typecheck && npm test && npm run lint && npm run format:check`
- [x] 8.2 `npm run docs:build` (this change edits `docs/`)
- [x] 8.3 `npm run e2e:chromium -- e2e/shell` — the docs drawer is covered by
      `e2e/shell/docs-drawer.spec.ts`, and task 6.2 changes it. Only check this
      off when the run passes; if it fails, leave it unchecked with a note on
      what failed.
