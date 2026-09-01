## 1. Key the porting spellings and notes by machine

- [ ] 1.1 Add the shared machine lists (`COMMODORES`, `CPCS`, `BBCS`, `ATARIS`, `SPECTRUMS`) to `src/reference/porting.ts` as named constants, exported for `domain-guidance.ts` to reuse, each with a one-line comment saying what its members share
- [ ] 1.2 Re-key `keywordEquivalences.spellings` and `falseFriends.meanings` in `src/reference/porting.ts` from page slug to machine id, spreading the shared lists so every machine reading a slug's value today reads the same text after, and keeping the deliberate absences (the Atom's `discard-variables`, the Sinclairs' machine-code command) with their comments
- [ ] 1.3 Widen `pairPortingNotes.from` and `.to` to take a machine id or several, re-key the eighteen pairs to machine ids via the same constants, and confirm the `zx81 ↔ zxspectrum` pairs are machine pairs rather than page pairs
- [ ] 1.4 Update `src/reference/compare.ts` to look equivalences, false friends and pair notes up by machine id, keeping `tableForMachine` narrowing for the rows themselves
- [ ] 1.5 Extend `src/reference/porting-crosscheck.test.ts` to check spellings and meanings against each machine's own rows, and to require that every registered machine resolves to a spelling or is deliberately absent — a machine silently missing from a concept is the failure this replaces

## 2. Key the domain guidance by machine

- [ ] 2.1 Widen `domainGuidance.to` in `src/reference/domain-guidance.ts` to take a machine id or several, and re-key the cells so each machine reads the advice its page gives it today
- [ ] 2.2 Update `src/reference/machineDescription.ts` and `portDescription.ts` to select guidance by machine id rather than by `page`
- [ ] 2.3 Narrow `domain-guidance-crosscheck.test.ts` to the machine: `domainsOnTarget` and `losableDomains` read `tableForMachine(PAGES[pageOf(id)], id)`, and `reachFor` names are pinned to the target machine's own rows
- [ ] 2.4 Memoise the narrowed table per machine alongside the existing losable-set memo, and check the file's runtime against the suite budget before moving on — the sweep grows from fourteen targets against thirteen sources to twenty-one against twenty
- [ ] 2.5 Do the same narrowing in `escape-guidance-crosscheck.test.ts`
- [ ] 2.6 Work the defects the narrowed crosschecks report, one commit each, grounded in the machine's own rows; where a cell is coarse rather than wrong, split it deliberately and say so in the commit rather than letting a crosscheck decide it
- [ ] 2.7 `npx vitest run src/reference/` green, and `npm run typecheck && npm run lint` — the re-keying ships here, before any page moves

## 3. Merge the Integer BASIC pages

- [ ] 3.1 Merge `src/reference/apple1.ts` and `apple2.ts` into `integer-basic.ts`, listing both machines on the table and scoping the Apple II's additions with `onlyOn: ['apple2']` and a badge
- [ ] 3.2 Merge `src/reference/escapes/apple1.ts` and `escapes/apple2.ts` into `escapes/integer-basic.ts` the same way
- [ ] 3.3 Merge `docs/reference/apple1.md` and `apple2.md` into `docs/reference/integer-basic.md`, and their `hardware.md`, `escapes.md` and `formats.md` into `docs/reference/integer-basic/`, keeping each machine's hardware material in its own section
- [ ] 3.4 Set `docsReference: 'integer-basic'` on the `apple1` and `apple2` dialects

## 4. Merge the Sinclair BASIC pages

- [ ] 4.1 Merge `src/reference/zx81.ts` and `zxspectrum.ts` into `sinclair.ts`: list all three machines, scope Spectrum-only rows with `onlyOn: ['zxspectrum', 'zxspectrum128']`, scope ZX81-only rows to `['zx81']`, and carry the existing 128K-only tags through unchanged
- [ ] 4.2 Note on any row the machines share but behave differently in what the difference is, rather than presenting one machine's behaviour as the page's
- [ ] 4.3 Merge `src/reference/escapes/zx81.ts` and `escapes/zxspectrum.ts` into `escapes/sinclair.ts` with the same scoping
- [ ] 4.4 Merge `docs/reference/zx81.md` and `zxspectrum.md` into `docs/reference/sinclair.md`, and their sub-pages into `docs/reference/sinclair/`, with a section per machine in `hardware.md` — a ZX81 and a Spectrum 128 share almost no hardware and must not be blended into one table
- [ ] 4.5 Set `docsReference: 'sinclair'` on the `zx81`, `zxspectrum` and `zxspectrum128` dialects
- [ ] 4.6 Run `npx vitest run src/reference/` and fix every row the crosscheck batteries report as scoped to the wrong machines, before polishing any prose

## 5. Rewire the page registry and the docs shell

- [ ] 5.1 Update the imports and both maps in `src/reference/pages.ts` to the new slugs, and confirm `pages.test.ts` and `src/app/docsTopic.test.ts` pass — they fail until every registered machine's page exists, which is the guard that steps 3 and 4 are complete
- [ ] 5.2 Retitle the Altair page "Microsoft BASIC" in `docs/reference/altair8800.md`, naming Altair 8K BASIC as the version it runs in the opening prose
- [ ] 5.3 Rewrite the "BASIC dialects" list in `docs/reference/index.md` to the twelve families, each naming the machines it covers
- [ ] 5.4 Update the `Language reference` section of the sidebar in `docs/.vitepress/config.ts` from fourteen entries to twelve, retitled to family names — the one sidebar edit this change is authorised to make
- [ ] 5.5 Add the three redirect stubs (`docs/reference/zxspectrum.md`, `apple1.md`, `apple2.md`): frontmatter `meta http-equiv="refresh"` to the new URL, a one-sentence body linking there, and no sidebar or index entry
- [ ] 5.6 Fix cross-links to the moved slugs in `docs/reference/compare.md`, `z80-assembly.md`, `file-formats.md`, `porting-basics.md` and `docs/contributing/`, so nothing but a stub points at an old address
- [ ] 5.7 Confirm `src/app/docsNavigation.test.ts` passes: every registered machine's page is in the sidebar and the index, and no stub is

## 6. Keep the authoring guidance current

- [ ] 6.1 Update the page list and the shared-page rule in `.claude/skills/dialect-reference-docs/SKILL.md` to the twelve family pages
- [ ] 6.2 Add to that skill and to `.claude/skills/adding-a-target-system/SKILL.md` that a new machine's porting guidance, spellings and pair notes are written for the machine, not inherited from the page it joins

## 7. Quality gates

- [ ] 7.1 `npx vitest run src/reference/ src/app/ src/dialects/registry.test.ts`
- [ ] 7.2 `npm test` — the re-keying and the slug move both reach batteries outside `src/reference/`, and neither can name every test it touches
- [ ] 7.3 `npm run typecheck && npm run lint && npm run format:check`
- [ ] 7.4 `npm run docs:build` — the dead-link check is what catches anything left pointing at a moved slug
- [ ] 7.5 `npm run e2e:chromium -- e2e/porting-guidance`
- [ ] 7.6 `npm run e2e:chromium -- e2e/dialect-toolchain e2e/shell`
- [ ] 7.7 `npx openspec validate --specs`
- [ ] 7.8 By hand in `npm run docs:dev`: the merged Sinclair page offers a ZX81 reader no Spectrum-only keyword, `/reference/zxspectrum` lands on `/reference/sinclair`, and the porting guide answers a ZX81 target in the ZX81's own spellings while still reporting 48K against 128 Sinclair BASIC as a difference between the two Spectrums
