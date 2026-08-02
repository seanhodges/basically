## 1. Compose the port report from the shared comparison data

Every task here writes into `src/reference/portDescription.ts`, which is pure
and imports only its siblings — the rule `compare.ts` and `machineDescription.ts`
are written under. The composition mirrors `DialectCompare.vue` call for call;
where the two could diverge, the test in group 2 is what holds them together.

- [ ] 1.1 Add `src/reference/portDescription.ts` with `PortSide` (extending
      `MachineIdentity` with the machine's `table` and optional `escapes`) and
      `describePort(from, to, vocabulary)`. Header comment in the house style:
      why it sits beside `machineDescription.ts`, and that
      `DialectCompare.vue` is the recipe it mirrors.
- [ ] 1.2 Compute the diffs once at the top of `describePort`:
      `tableForMachine` per side, `diffKeywords(source, target, { from: from.page,
      to: to.page, equivalences: keywordEquivalences })`, `composeGuidance(...)`
      and `diffEscapes(...)`, then narrow with `diffForProgram`,
      `falseFriendsForProgram` and `escapeDiffForProgram` when `vocabulary` is
      not `null`. Take the page slug from `MachineIdentity.page` and the machine
      id from `.id` — `diffKeywords` and `composeGuidance` want the page,
      `tableForMachine` wants the id, and several machines share a page.
- [ ] 1.3 Compose `PORTING THIS PROGRAM`: both machines with manufacturer and
      year, the BASIC each runs from `PortingFacts.basicDialect`, and the
      sentence saying these findings come from the project's reference data,
      narrowed to this program, and are to be preferred to recollection. Omit
      the `, running <BASIC>` clause rather than throwing when a machine has no
      facts entry — `facts-crosscheck.test.ts` makes that unreachable today, but
      this runs on a click.
- [ ] 1.4 Compose `BEFORE YOU START` from `composeGuidance().pairNotes` followed
      by `.targetNotes`, unnarrowed (guidance prose states rules that hold for
      any program).
- [ ] 1.5 Compose `SAME WORD, DIFFERENT MEANING` from the narrowed
      `FalseFriendWarning[]`, naming what the word means on each machine.
- [ ] 1.6 Compose `COMMANDS THIS PROGRAM USES THAT <TARGET> DOES NOT HAVE` from
      `capabilitySections(diff.mustReplace, [], targetTable, KEYWORD_DOMAINS,
      domainGuidance, to.page)` — one line per capability naming its commands in
      a run, then that capability's `instead` line, then one line per command
      that has a `PortingFacts.substitutions` entry. Pass `[]` for
      `newlyAvailable` rather than filtering afterwards, so what the target adds
      cannot reach the request by accident. Leave `DomainGuidance.example` code
      blocks out: `describeMachine` already puts them in the system prompt.
- [ ] 1.7 Compose `COMMANDS TO RENAME` from `diff.renamed` (`FROM → TO`).
- [ ] 1.8 Compose `COMMANDS WHOSE USAGE DIFFERS` from `diff.behaviourChanged`:
      the `parens` changes named together in one run, `kind` and `arguments`
      changes one line each giving both usages.
- [ ] 1.9 Compose `CONTROL CODES THIS PROGRAM USES THAT <TARGET> DOES NOT HAVE`
      from `escapeSections(escapeDiff.mustReplace, from.escapes)`, guarded on
      both sides having an escape table. `mustReplace` only — narrowing
      `behaviourChanged` would be new comparison logic.
- [ ] 1.10 Join with `sections.filter((s) => s !== '').join('\n\n')` as
      `describeMachine` does, and return the header plus one line saying the
      comparison found nothing this machine lacks, renames or treats
      differently, when every other section is empty. That is a finding, not an
      absence.

## 2. Pin the composer with tests

- [ ] 2.1 Add `src/reference/portDescription.test.ts` covering, for real pairs
      (`commodore64` → `zxspectrum`, `zx81` → `bbcmicro`): both machine names
      and both BASIC names present; `CLR → CLEAR` under `COMMANDS TO RENAME`;
      `{clr}` under the control-codes section; a substitution for a command the
      program uses appears and one for a command it does not use is absent.
- [ ] 2.2 Narrowing assertions: a keyword in `mustReplace` but not in the
      vocabulary never appears anywhere in the output; a capability whose
      commands the program does not use is absent; a `null` vocabulary reports
      every difference.
- [ ] 2.3 Exclusion assertions: no keyword from `diff.newlyAvailable` and no
      escape from the escape diff's `newlyAvailable` appears; no
      `DomainGuidance.example` code line appears.
- [ ] 2.4 Shape assertions: a side with `escapes: undefined` omits the
      control-codes section and nothing else; a pair with nothing to report
      yields the header plus the single "nothing to report" line; two calls with
      the same input are byte-identical.
- [ ] 2.5 A sweep over every ordered pair in `src/reference/machines.ts` that
      composes without throwing, in the style of `perMachineCompare.test.ts` —
      the assertion that this cannot break on a machine nobody thought to try.

## 3. Reach the reference data from the app on demand

- [ ] 3.1 Add `ESCAPE_PAGES` to `src/ai/machineReference.ts` beside
      `REFERENCE_PAGES`, one `import('../reference/escapes/<page>')` per slug, so
      the escape tables are code-split exactly as the reference pages are.
- [ ] 3.2 Export `loadReferencePage(page)` and `loadEscapePage(page)` from that
      module, each returning `undefined` for an unregistered slug. Leave
      `loadMachineReference` throwing as it does — it is swept by
      `machineReference.test.ts`, whereas these two sit on a click path that must
      degrade.
- [ ] 3.3 Extend `src/ai/machineReference.test.ts`: every registered dialect's
      page resolves an escape table, or is named in an explicit list of pages
      that have none.
- [ ] 3.4 Add `src/ai/portReport.ts` with `loadPortReport(from, to, vocabulary)`:
      resolve `docsReference ?? id` per side, load the four tables, `import()`
      `../reference/portDescription`, and return `null` when either page is
      unregistered or `from.id === to.id`. Do not memoise the composed report —
      it varies with the program; the `import()`s are already memoised by the
      module system.
- [ ] 3.5 Add `buildConversionMessage({ from, to, toLabel, source })` to the same
      module: `vocabularyReply` for the status, `loadPortReport` for the
      findings, then `buildUserMessage(`${report}\n\n${instruction}`, source,
      [])` so the turn reads program → findings → ask. Move the instruction
      sentence here byte-identical to the one in `DocsDrawer.tsx`. This is the
      seam a future non-guide entry point uses.
- [ ] 3.6 Add `src/ai/portReport.test.ts`: `from: null`, `from === to` and an
      unregistered page each produce a message byte-identical to today's
      (constructed from `buildUserMessage` directly, as a regression pin); a
      `commodore64` → `zxspectrum` program produces program, report and
      instruction in that order; the report names the source machine; an empty
      and an unreadable program both carry the un-narrowed report, matching what
      the guide shows them; a program using sixty keywords stays under an agreed
      size bound; a type-level assertion that `programVocabulary.ts`'s
      `ProgramVocabulary` is assignable to `compare.ts`'s.

## 4. Carry the source machine across the boundary

- [ ] 4.1 Add `'fromId'` to `COMPARE_CONVERT_FIELDS` in
      `src/components/DocsDrawer.tsx`, with a comment on why the port's source
      travels with the request rather than being inferred.
- [ ] 4.2 Emit `fromId` from `convertWithAi` in
      `docs/.vitepress/theme/components/DialectCompare.vue`, guarded on the
      source selection resolving.
- [ ] 4.3 Add the source-resolution chain as a pure exported helper — `fromId`,
      then the machine the guide last named in its vocabulary request, then
      `null` — so it is testable without a click, and so "no source" is a value
      the caller must handle rather than a fallback it cannot see.
- [ ] 4.4 Extend `src/components/DocsDrawer.test.ts`: the existing
      `postedFields('CONVERT_MESSAGE')` assertion now covers `fromId`; add an
      explicit case naming it and why (a convert with no source machine silently
      loses the entire report), and cases for each step of the resolution chain,
      including that it never returns the target and never falls back to the
      selected dialect.

## 5. Hand the report to the assistant

- [ ] 5.1 Rewrite `convertProgram` in `src/components/DocsDrawer.tsx` to resolve
      the source dialect *before* `openSharedInIde` (the switch changes the
      selected dialect), then `Promise.all` `buildConversionMessage(...)` with
      `loadSystemPrompt(target)` so the click does not serialise two chains of
      dynamic imports.
- [ ] 5.2 Leave the rest byte-identical and check each against the requirement:
      `aiCredentials()` consulted first, `openSharedInIde({ dialectId, source })`
      then `showAiPanel()`, `displayRequest` still `Convert this program to
      <label>`, `maxTokens` and `baseSource` unchanged.
- [ ] 5.3 Comment recording that a wrongly guessed source machine is worse than
      none, which is why the chain ends in "no report" rather than in the
      selected dialect.

## 6. Prove it end to end

- [ ] 6.1 Add a test to `e2e/porting-guidance/convert-program.spec.ts` that
      captures `route.request().postData()` for `**/api.anthropic.com/**`
      instead of aborting it, converts `10 PRINT "{clr}HI"` from `commodore64`
      to `zxspectrum`, and asserts the user turn names the Commodore 64 and the
      `{clr}` control code. Only a real click proves the two sides of the iframe
      still agree, and the suite stays offline.
- [ ] 6.2 Assert in that same test that the turn does not carry what the
      Spectrum adds and the program never used.
- [ ] 6.3 Re-run the three existing tests in that file unchanged — the switch,
      the variant targeting and the unconfigured-assistant path are the
      "everything else stays identical" guard.

## 7. Point the contributor documentation at it

- [ ] 7.1 Extend the `src/reference/` and AI-path sections of
      `docs/contributing/architecture.md` with the port-report path, and note
      that `src/ai/machineReference.ts` now serves escape pages too.

## 8. Quality gates

- [ ] 8.1 `npm run typecheck`
- [ ] 8.2 `npm test`
- [ ] 8.3 `npm run lint`
- [ ] 8.4 `npm run format:check`
- [ ] 8.5 `npm run docs:build` (`DialectCompare.vue` and
      `docs/contributing/architecture.md` both change)
- [ ] 8.6 `npm run e2e:chromium -- e2e/porting-guidance`
- [ ] 8.7 `npm run e2e:chromium -- e2e/ai-assistant`
