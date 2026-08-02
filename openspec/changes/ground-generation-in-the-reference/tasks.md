## 1. Move the reference data and the comparison logic into `src/`

- [x] 1.1 `git mv docs/reference/data` → `src/reference` (data modules, the
      `escapes/` subfolder and every colocated crosscheck test move together);
      fix only the imports *inside* the moved tree.
- [x] 1.2 `git mv docs/.vitepress/theme/dialectCompare.ts` →
      `src/reference/compare.ts`, together with `dialectCompare.test.ts` and
      `perMachineCompare.test.ts`; repoint its data imports at their new
      siblings.
- [x] 1.3 Move `sortEntries` out of `docs/.vitepress/theme/referenceTable.ts`
      into the shared tree and re-export it from `referenceTable.ts`, leaving
      `filterEntries`/`findEntryByName` (page search, `?name=` deep link) in the
      docs theme.
- [x] 1.4 Update the moved crosscheck tests' relative imports of
      `src/dialects/**` (they climbed three levels out of `docs/`, and now sit
      next door).

## 2. Rewire the documentation site to the new home

- [x] 2.1 Repoint the theme components — `ReferenceTable.vue`,
      `EscapeTable.vue`, `DialectCompare.vue` — at `src/reference/**`.
- [x] 2.2 Repoint the remaining theme modules and their tests:
      `referenceTable.ts`, `escapeTable.ts`, `domainMeta.ts`, `kindMeta.ts`,
      `referenceTable.test.ts`, `escapeTable.test.ts`.
- [x] 2.3 Repoint the two scaffold generators, `scripts/gen-reference-scaffold.mts`
      and `scripts/gen-escape-scaffold.mts`, and confirm each still runs
      (`npm run gen:reference`, `npm run gen:escapes`) and emits what it did.
- [x] 2.4 Widen `tsconfig.docs.json`'s `include` to cover `src/reference/**/*.ts`
      so the crosscheck tests stay typechecked, with a comment saying why (the
      app project excludes `src/**/*.test.ts`).

## 3. Prove the move changed nothing

- [x] 3.1 Build the docs from the pre-move tree and keep
      `docs/.vitepress/dist` aside for comparison.
- [x] 3.2 Rebuild after the rewire and diff the two trees; rendered HTML must be
      identical, with only hashed asset filenames allowed to differ. Record what
      differed and why.
- [x] 3.3 Open the comparison page, a multi-machine reference page and an escape
      page in `npm run docs:preview` and confirm by eye that filtering, sorting,
      the machine picker and the `?name=` deep link still work — the `.vue`
      script blocks are not typechecked, so nothing else covers them.
- [x] 3.4 Run the full unit suite; the crosscheck tests must pass unchanged from
      their new location.

## 4. Compose the machine description from the shared data

- [ ] 4.1 Add `src/ai/machineReference.ts` with per-page deferred importers
      (`Record<slug, () => Promise<…>>`, mirroring `src/ai/aiClient.ts`'s
      provider map) and a per-dialect memo of the composed block.
- [ ] 4.2 Compose **THIS MACHINE**: name, manufacturer, year, `basicDialect`,
      free RAM, program start, screen base.
- [ ] 4.3 Compose **LANGUAGE RULES** from `PortingFacts`: line-number range,
      statement separator, `ELSE`, `LET`, variable naming, number handling,
      exponent operator, memory-write syntax, address notation, hex prefix.
- [ ] 4.4 Compose **SCREEN, COLOUR AND SOUND** from the three prose capability
      facts.
- [ ] 4.5 Compose **COMMANDS, FUNCTIONS AND OPERATORS** from
      `tableForMachine(page, dialect.id)`, grouped by capability domain in
      `KEYWORD_DOMAINS` order and sorted within each group by `sortEntries`; one
      line per row carrying name, kind, syntax, description and tag.
- [ ] 4.6 Compose **WHERE THIS MACHINE IS SHORT** from the `domainGuidance` cells
      for this machine's page whose `support` is `partial` or `none`, carrying
      each `instead` and its worked `example` verbatim.
- [ ] 4.7 Add `src/ai/machineReference.test.ts`: every registered dialect
      composes without throwing; every name in a dialect's keyword table appears
      in its composed block (the completeness assertion, made of what the
      assistant is actually sent); two compositions for the same dialect are
      byte-identical; a machine with a `none`/`partial` domain carries its
      `instead` text.
- [ ] 4.8 Record the composed block's size per machine in the change notes, so
      the prompt cost is a measured number.

## 5. Send it with every request

- [ ] 5.1 Give `buildSystemPrompt` the composed block as a parameter, keeping it
      pure and synchronous, and add `loadSystemPrompt(dialect)` that performs the
      deferred import and calls it.
- [ ] 5.2 Await it at the three call sites — `AiPanel.tsx` (send and pending-fix),
      `DocsDrawer.tsx` (convert), `NewProjectDialog.tsx` (describe) — making each
      handler async; nothing else about `aiStore.send` changes.
- [ ] 5.3 Extend `src/ai/promptBuilder.test.ts` for the new parameter: the block
      lands in the composed prompt, and the existing blocks keep their order.
- [ ] 5.4 Add the ESLint `no-restricted-imports` rule banning static imports of
      `src/reference/**` from `src/` outside the reference tree and `*.test.ts`,
      so the deferred boundary fails `npm run lint` rather than quietly growing
      the main bundle.
- [ ] 5.5 Confirm the split: build and check that `src/reference` lands in
      dynamically-imported chunks, not the entry chunk.

## 6. Thin the thirteen prose descriptions

Each edit removes the keyword/function lists and the language rules the block now
states, keeps the machine's quirks, performance advice, escape/graphics-character
conventions, `#BIN` rules and OUTPUT FORMAT, and is reviewed against that
machine's composed block before it is checked off.

- [ ] 6.1 Sinclair: `zx80`, `zx81`.
- [ ] 6.2 Sinclair: `zxspectrum`, `zxspectrum128`.
- [ ] 6.3 Acorn: `atom`, `bbcmicro`, `bbcmaster`.
- [ ] 6.4 Commodore: `pet`, `vic20`, `commodore64`.
- [ ] 6.5 Amstrad: `cpc464`, `cpc6128`.
- [ ] 6.6 Tandy: `trs80`.
- [ ] 6.7 Re-run the completeness test and spot-check two thinned machines'
      full composed prompts end to end for contradiction between prose and data.

## 7. Point the contributor documentation at the new home

- [ ] 7.1 Update `docs/contributing/glyph-sources.md` and
      `docs/contributing/dialect-roadmap.md`.
- [ ] 7.2 Update the `adding-a-target-system` and `dialect-reference-docs` skills
      (`SKILL.md` and `plan-template.md`) where they name `docs/reference/data`.
- [ ] 7.3 Add the shared reference tree to `docs/contributing/architecture.md`'s
      component map, noting that it is consumed by both the docs site and the
      assistant, and that the app reaches it only through a deferred import.

## 8. Quality gates

- [ ] 8.1 `npm run typecheck`
- [ ] 8.2 `npm test`
- [ ] 8.3 `npm run lint`
- [ ] 8.4 `npm run format:check` (or `npm run format`)
- [ ] 8.5 `npm run docs:build`
- [ ] 8.6 `npm run e2e:chromium -- e2e/ai-assistant`
- [ ] 8.7 `npm run e2e:chromium -- e2e/porting-guidance`
- [ ] 8.8 `npm run e2e:chromium -- e2e/project-setup`
