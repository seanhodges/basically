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

## 7. Keeping a program offers the comparison

- [ ] 7.1 Add `docsProgramTopic: string | null` (a docs topic belonging to one program) and `docsHintRequest: number` (a request counter, matching the `runRequest`/`stopRequest` convention) to the store
- [ ] 7.2 In the `'keep'` branch of `confirmDialectSwitch` (`src/app/store.ts`), build the comparison topic from the machine being left to the machine chosen — both are in scope there and nowhere afterwards. Open the drawer on it outright on a wide viewport; on a narrow one remember it and bump the hint request instead, so a full-width drawer does not bury the program being ported. Use the same `isMobileViewport()` one-shot `applyDialectSwitch` already uses for `mobileTab`
- [ ] 7.3 Leave the `'new'` branch, cancel, and the silent compatible switch untouched
- [ ] 7.4 Add `openingTopicFor(state)` to `src/app/docsTopic.ts` — the remembered comparison, else `referenceTopicFor` — and switch the three openers to it: the drawer handle (`DocsDrawer.tsx`), the toolbar book button (`Toolbar.tsx`) and F1 (`src/app/useGlobalShortcuts.ts`). Cover it in `src/app/docsTopic.test.ts`
- [ ] 7.5 Add a `clearProgramDocs(s)` helper and spread it into the three sites that bump `aiResetSeq` — `applyDialectSwitch`, the named-load branch of `replaceDocument`, and `loadUnsavedDocument` — so a different program forgets the comparison and closes the drawer if that comparison is what it is showing, leaving a drawer on any other page alone. Comment that the `'keep'` branch spreads `applyDialectSwitch` first and sets its own fields after, so its own switch does not clear it
- [ ] 7.6 Extend the existing `confirmDialectSwitch / cancelDialectSwitch` block in `src/app/store.test.ts` to pin all four switch cases at both viewport widths (stub `matchMedia`)
- [ ] 7.7 Add store tests for `clearProgramDocs` following the existing `memory blocks reset on document identity changes` block, which already enumerates the same path list: New / named Open / Import clear and close; a drawer on another page stays open; an in-place AI apply changes neither
- [ ] 7.8 Give `e2e/helpers.ts`'s `selectDialect` a way to answer the switch dialog, which it has never had to handle before
- [ ] 7.9 Simplify `openPortingGuide` in `e2e/porting-guidance/convert-program.spec.ts` to use the new entry point, and drop the comment saying the guide has none

## 8. The indicator

- [ ] 8.1 Render it as a third sibling in `DocsDrawer`'s existing fragment, beside the open handle it points at, shown on a change of `docsHintRequest` and hidden after five seconds by a `useEffect`-held timer cleared on dismissal, on the drawer opening, and on unmount
- [ ] 8.2 Dismiss it with `useDismiss` (`src/app/useDismiss.ts`) with the ref attached to the indicator root, so clicks inside reach it and every other pointerdown dismisses in the capture phase; keep `onDismiss` `useCallback`-stable or the effect re-subscribes each render
- [ ] 8.3 Make it a `<button>` that opens the drawer on the remembered comparison, so the hint is actionable rather than a sign pointing elsewhere
- [ ] 8.4 Style it in `DocsDrawer.module.css`: fixed to the right edge, vertically centred on the 32×64px handle, with a triangle pointing at it, at a z-index in the free 91–99 band between the handle/drawer and the dialog backdrops. Add it to the existing `prefers-reduced-motion` block
- [ ] 8.5 Cover it in `src/components/DocsDrawer.test.ts`: appears on a hint request, goes after five seconds, dismisses on an outside pointerdown and on Escape, opens the drawer on the remembered comparison when activated, and never appears while the drawer is already open

## 9. End-to-end coverage

- [ ] 9.1 Add `e2e/porting-guidance/filter-by-program.spec.ts`: at a desktop viewport, with a Commodore 64 program containing escapes open, switch to a machine that will not run it and choose "Keep my code"; assert the drawer opens on the comparison for that pair, narrowed, and *not* reporting the program as unreadable — the case that only passes if the program is read in the source machine's language
- [ ] 9.2 Assert the recognised and held-back counts are stated, and that turning the control on restores the full comparison
- [ ] 9.3 At a narrow viewport, assert the same switch leaves the drawer closed and shows the indicator, that acting on it opens the drawer on that comparison, and that a pointerdown elsewhere dismisses it
- [ ] 9.4 Assert that loading a different program with the comparison on screen closes the drawer

## 10. Documentation

- [ ] 10.1 Update the porting guide's page intro (`docs/reference/compare.md`) to say what reading it in the IDE with a program open now does, keeping it free of internal references
- [ ] 10.2 Note the new consumer in the doc comments of `docs/reference/data/keyword-crosscheck.test.ts` and `docs/reference/data/escapes/escape-crosscheck.test.ts` — they now guard the IDE↔docs contract as well as the tables

## 11. Quality gates

- [ ] 11.1 `npm run typecheck`
- [ ] 11.2 `npm test`
- [ ] 11.3 `npm run lint`
- [ ] 11.4 `npm run format:check` (or `npm run format`)
- [ ] 11.5 `npm run docs:build`
- [ ] 11.6 `npm run e2e:chromium -- e2e/porting-guidance`
- [ ] 11.7 `npx openspec validate --specs`
