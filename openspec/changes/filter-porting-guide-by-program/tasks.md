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
- [ ] 3.2 Handle the request in the existing `onMessage` switch: compute the vocabulary from `useIdeStore.getState()` and post the reply into the frame
- [ ] 3.3 Re-push the vocabulary when `source` or `dialect` changes while the drawer is open, debounced (the cadence `src/app/useProgramStats.ts` uses), and only once a request has been received
- [ ] 3.4 Extend `src/components/DocsDrawer.test.ts`: request → reply round trip, the field names, the debounced re-push, and that nothing is posted before a request arrives

## 4. The docs-side filter

- [ ] 4.1 In `docs/.vitepress/theme/dialectCompare.ts` add a `ProgramVocabulary` type and the pure filters `diffForProgram`, `escapeDiffForProgram` and `falseFriendsForProgram` — narrowing `mustReplace`, `renamed` and `behaviourChanged` by name and escape `mustReplace` by claimed byte, with a used byte no row claims falling to the table's catch-all row
- [ ] 4.2 Leave `newlyAvailable` and the unchanged count untouched, and comment why: narrowing the source table before the diff would report every unused command as newly available on the target
- [ ] 4.3 Extend `docs/.vitepress/theme/dialectCompare.test.ts` to cover each filter, the catch-all escape row, and explicitly that `newlyAvailable` and the unchanged count are not narrowed

## 5. The comparison page

- [ ] 5.1 In `DialectCompare.vue`, hold the received vocabulary, post the request on mount when embedded, and listen for the reply
- [ ] 5.2 Derive whether narrowing is active — a vocabulary is present, the control is off, and the source machine is the program's machine — and route the keyword diff, the false friends and the escape diff through the filters when it is
- [ ] 5.3 On first receipt, select the program's machine as the source machine unless the URL named one, and sync the link
- [ ] 5.4 Add the page-level control near the summary, labelled with what turning it on reveals, off by default, present only while narrowing applies
- [ ] 5.5 State how many differences are being held back wherever the narrowing applies, and give the summary sentence a program-aware form
- [ ] 5.6 Include the narrowing state in the truncated lists' reset key so toggling the control re-collapses them

## 6. Reaching the guide from the IDE

- [ ] 6.1 Add a "Porting guide…" item to the File menu's second group in `src/components/Toolbar.tsx`, opening the comparison and leaving the program and machine as they were
- [ ] 6.2 Simplify `openPortingGuide` in `e2e/porting-guidance/convert-program.spec.ts` to use the new entry point, and drop the comment saying the guide has none

## 7. End-to-end coverage

- [ ] 7.1 Add `e2e/porting-guidance/filter-by-program.spec.ts`: open a Commodore 64 program containing escapes, open the guide, assert the source machine is the C64 and that a capability group and an escape group are narrowed to what the program uses
- [ ] 7.2 Assert the held-back count is stated, that turning the control on restores the full comparison, and that selecting a different source machine removes the control

## 8. Documentation

- [ ] 8.1 Update the porting guide's page intro (`docs/reference/compare.md`) to say what reading it in the IDE with a program open now does, keeping it free of internal references
- [ ] 8.2 Note the new consumer in the doc comments of `docs/reference/data/keyword-crosscheck.test.ts` and `docs/reference/data/escapes/escape-crosscheck.test.ts` — they now guard the IDE↔docs contract as well as the tables

## 9. Quality gates

- [ ] 9.1 `npm run typecheck`
- [ ] 9.2 `npm test`
- [ ] 9.3 `npm run lint`
- [ ] 9.4 `npm run format:check` (or `npm run format`)
- [ ] 9.5 `npm run docs:build`
- [ ] 9.6 `npm run e2e:chromium -- e2e/porting-guidance`
- [ ] 9.7 `npx openspec validate --specs`
