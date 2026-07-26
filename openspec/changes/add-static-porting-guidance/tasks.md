## 1. Keyword equivalences

- [ ] 1.1 Add a `KeywordEquivalence` type to `docs/reference/data/types.ts` — a
      group of spellings that mean the same command, with the pages each
      spelling belongs to left implicit (derived from the reference tables).
- [ ] 1.2 Create `docs/reference/data/porting.ts` with the hand-authored
      equivalence groups. Seed it from the known cases (`GOTO`/`GO TO`,
      `GOSUB`/`GO SUB`, `CLEAR`/`CLR`) and work outward by scanning the eight
      reference tables for same-concept spellings.
- [ ] 1.3 Teach `diffKeywords` in `docs/.vitepress/theme/dialectCompare.ts` to
      treat grouped spellings as the same command, classifying them as a rename
      rather than as a missing plus a newly-gained command. Keep the file's
      no-`src/`-imports rule.
- [ ] 1.4 Extend `docs/.vitepress/theme/dialectCompare.test.ts` to cover: a
      renamed command appears in neither the missing nor the newly-gained list;
      a genuinely absent command is still reported as one to replace.

## 2. Porting content

- [ ] 2.1 Add `portingNotes: string[]` and
      `substitutions: { keyword: string; note: string }[]` to the `PortingFacts`
      type in `docs/reference/data/types.ts`, documenting in the type that
      substitutions are best-effort rather than exhaustive.
- [ ] 2.2 Draft and hand-edit the per-dialect content for all eight entries in
      `docs/reference/data/facts.ts` — a handful of notes each, plus roughly
      10–20 substitutions per dialect. Written as end-user documentation: no
      `src/` paths, no internal symbols.
- [ ] 2.3 Write the shared, machine-independent porting guide as prose in
      `docs/reference/compare.md`, covering line numbers and statement
      separators, `LET`/`ELSE`, variable naming and type suffixes, string
      function spellings, why memory addresses and machine-code calls do not
      travel, and why graphics, colour and sound are rewritten rather than
      translated.

## 3. Rendering

- [ ] 3.1 Render the target dialect's `portingNotes` in `DialectCompare.vue` as
      a guidance section, placed before the keyword difference sections and
      **not** gated on `embedded`.
- [ ] 3.2 Show each matching `substitutions` note against its command inside the
      existing keyword difference lists; commands without a note render exactly
      as they do today.
- [ ] 3.3 Confirm the guidance renders on a standalone docs visit (outside the
      IDE iframe) and that `?from=`/`?to=` deep links still select the pair.

## 4. Remove the AI explain action

- [ ] 4.1 Delete `diffSummaryText()`, `explainWithAi()`, `EXPLAIN_MESSAGE` and
      the Explain button from `DialectCompare.vue`, keeping `convertWithAi` and
      its message intact.
- [ ] 4.2 Delete `COMPARE_EXPLAIN_MESSAGE`, `explainPorting()` and its listener
      branch from `src/components/DocsDrawer.tsx`, leaving `convertProgram`
      untouched.
- [ ] 4.3 Verify in the IDE drawer that "Convert my program to \<machine\>"
      still works and still opens AI settings when no key is configured.

## 5. Staleness guards

- [ ] 5.1 Create `docs/reference/data/porting-crosscheck.test.ts` asserting that
      every substitution names a command present on at least one reference page,
      and names one the target dialect does **not** already provide.
- [ ] 5.2 In the same suite, assert that every equivalence group names spellings
      that exist somewhere, and that no group contains two spellings both
      present on the same page.
- [ ] 5.3 Extend the existing id-set assertion in
      `docs/reference/data/facts-crosscheck.test.ts` so a page missing
      `portingNotes` fails, rather than duplicating that check.

## 6. Quality gates

- [ ] 6.1 `npm run typecheck && npm test && npm run lint && npm run format:check`
- [ ] 6.2 `npm run docs:build` (this change edits `docs/`)
- [ ] 6.3 `npm run e2e:chromium -- e2e/shell` — the docs drawer is covered by
      `e2e/shell/docs-drawer.spec.ts`, and task 4.2 changes it. Only check this
      off when the run passes; if it fails, leave it unchecked with a note on
      what failed.
