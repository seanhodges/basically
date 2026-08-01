## 1. Seam groundwork

- [ ] 1.1 Add an optional `crunched?: boolean` to `Dialect` in `src/dialects/types.ts`, documenting it as "the ROM tokenizer ignores spaces outside strings/REM and matches the longest keyword at every position"
- [ ] 1.2 Set it on the four dialects whose `language.ts` already passes `crunched: true` to `buildBasicLanguage` (`commodore64`, `vic20`, `pet`, `trs80`), and have each `language.ts` read the dialect's flag so the fact is stated once
- [ ] 1.3 Add `parseUnit(text, i): { codes: number[]; length: number }` to `CharsetProbe` in `src/dialects/charsetProbes.ts`, wiring each family to the per-unit parser `parseAll`/`parseAllMulti` already drive, and add this feature to the consumer list in the module's doc comment
- [ ] 1.4 Extend `src/dialects/charsetProbes.test.ts` so a family whose `parseUnit` disagrees with its `parse` over a whole string fails

## 2. The app-side analyser

- [ ] 2.1 Create `src/app/programVocabulary.ts` exporting `ProgramVocabulary { dialectId, keywords, escapeCodes }` and `programVocabulary(source, dialect)`
- [ ] 2.2 Extract keywords: per line strip the line number, skip machine-code block lines, blank strings and REM tails with `scannable` from `src/editor/programOutline.ts`, and walk the result with `makeCrunchMatcher` from `src/editor/crunch.ts` — matching anywhere for a `crunched` dialect and only at an identifier boundary otherwise
- [ ] 2.3 Extract escape bytes: collect the string-literal spans, drive each through the dialect's `parseUnit`, and record the first byte of every unit whose source form spans more than one character or whose canonical decode is an escape form; catch `CharsetError` so a half-typed program yields a partial vocabulary rather than throwing
- [ ] 2.4 Return an empty vocabulary (no keywords) for an empty or unrecognisable program, so callers can treat it as "no program"
- [ ] 2.5 Write `src/app/programVocabulary.test.ts`: crunched C64 entry (`10 FORI=1TO10:PRINTI:NEXT`); a BBC program with long variable names that must not yield `TO` or `IF`; keywords inside strings and after `REM` ignored; a braced-escape dialect (`{clr}{white}`); an operand-carrying Spectrum escape (`{INK 2}` recording only the leading byte); a Sinclair backslash-escape dialect; an empty program; a program that raises `CharsetError`

## 3. The IDE↔docs message contract

- [ ] 3.1 In `src/components/DocsDrawer.tsx`, export the request and reply message constants and a `PROGRAM_VOCABULARY_FIELDS` tuple, mirroring the existing `COMPARE_CONVERT_MESSAGE` / `COMPARE_CONVERT_FIELDS` pattern and its cross-referencing comments
- [ ] 3.2 Handle the request in the existing `onMessage` switch: resolve the requested `from` to a registered dialect (falling back to the selected one), derive the vocabulary from `useIdeStore.getState()`, and post the reply with the dialect id it answered for
- [ ] 3.3 Decide the reply's `status` with `hasFatalErrors(tokenize(source).errors)` against that same `from` dialect — never `dialect.lint(source)`, whose variable-lint findings do not set `fatal: false` and so read as fatal. Comment both traps at the call site
- [ ] 3.4 Re-push the vocabulary when `source` or `dialect` changes while the drawer is open, debounced (the cadence `src/app/useProgramStats.ts` uses), and only once a request has been received
- [ ] 3.5 Extend `src/components/DocsDrawer.test.ts`: request → reply round trip, the field names, the debounced re-push, nothing posted before a request arrives, each of the three statuses, a request naming a `from` other than the selected machine, and that a program whose only findings are variable-lint warnings still answers `ready`

## 4. The docs-side filter

- [ ] 4.1 In `docs/.vitepress/theme/dialectCompare.ts` add a `ProgramVocabulary` type and the pure filters `diffForProgram`, `escapeDiffForProgram` and `falseFriendsForProgram` — narrowing `mustReplace`, `renamed` and `behaviourChanged` by name and escape `mustReplace` by claimed byte, with a used byte no row claims falling to the table's catch-all row
- [ ] 4.2 Leave `newlyAvailable` and the unchanged count untouched, and comment why: narrowing the source table before the diff would report every unused command as newly available on the target
- [ ] 4.3 Extend `docs/.vitepress/theme/dialectCompare.test.ts` to cover each filter, the catch-all escape row, and explicitly that `newlyAvailable` and the unchanged count are not narrowed

## 5. The comparison page

- [ ] 5.1 In `DialectCompare.vue`, hold the received reply, post the request on mount when embedded, and listen for the reply
- [ ] 5.2 Re-post the request whenever the source machine changes, so the program is re-read in that machine's language
- [ ] 5.3 Derive whether narrowing is active — the reply is `ready`, the control is off, and the reply answers for the current source machine — and route the keyword diff, the false friends and the escape diff through the filters when it is
- [ ] 5.4 On first receipt, select the program's machine as the source machine unless the URL named one, and sync the link
- [ ] 5.5 Add the page-level control inside the notice, labelled with what turning it on reveals, off by default, present only while narrowing applies
- [ ] 5.6 State how much of the program was recognised and how many differences are held back, and give the summary sentence a program-aware form
- [ ] 5.7 Include the narrowing state in the truncated lists' reset key so toggling the control re-collapses them

## 6. The notice

- [ ] 6.1 Add a pure `noticeState(...)` resolver beside the filters in `dialectCompare.ts`, returning the standalone invitation, the nothing-open invitation, the cannot-be-read notice, or the narrowed state
- [ ] 6.2 Cover it in `docs/.vitepress/theme/dialectCompare.test.ts` — every combination of embedded, status, source machine and control
- [ ] 6.3 Render the notice as one block under the summary in `DialectCompare.vue`, styled on the existing `cmp-note` / `cmp-toggle` classes; give no error count, since the status bar's count is the full lint count and this one is fatal-only

## 7. Keeping a program opens the comparison

- [ ] 7.1 In the `'keep'` branch of `confirmDialectSwitch` (`src/app/store.ts`), open the docs drawer on the comparison from the machine being left to the machine chosen — both are in scope there and nowhere afterwards. Leave the `'new'` branch, cancel, and the silent compatible switch untouched
- [ ] 7.2 Extend the existing `confirmDialectSwitch / cancelDialectSwitch` block in `src/app/store.test.ts` to pin all four cases
- [ ] 7.3 Give `e2e/helpers.ts`'s `selectDialect` a way to answer the switch dialog, which it has never had to handle before
- [ ] 7.4 Simplify `openPortingGuide` in `e2e/porting-guidance/convert-program.spec.ts` to use the new entry point, and drop the comment saying the guide has none

## 8. End-to-end coverage

- [ ] 8.1 Add `e2e/porting-guidance/filter-by-program.spec.ts`: with a Commodore 64 program containing escapes open, switch to a machine that will not run it and choose "Keep my code"; assert the drawer opens on the comparison for that pair, narrowed, and *not* reporting the program as unreadable — the case that only passes if the program is read in the source machine's language
- [ ] 8.2 Assert the recognised and held-back counts are stated, and that turning the control on restores the full comparison

## 9. Documentation

- [ ] 9.1 Update the porting guide's page intro (`docs/reference/compare.md`) to say what reading it in the IDE with a program open now does, keeping it free of internal references
- [ ] 9.2 Note the new consumer in the doc comments of `docs/reference/data/keyword-crosscheck.test.ts` and `docs/reference/data/escapes/escape-crosscheck.test.ts` — they now guard the IDE↔docs contract as well as the tables

## 10. Quality gates

- [ ] 10.1 `npm run typecheck`
- [ ] 10.2 `npm test`
- [ ] 10.3 `npm run lint`
- [ ] 10.4 `npm run format:check` (or `npm run format`)
- [ ] 10.5 `npm run docs:build`
- [ ] 10.6 `npm run e2e:chromium -- e2e/porting-guidance`
- [ ] 10.7 `npx openspec validate --specs`
