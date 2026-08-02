## 1. Character-set repertoire as a porting fact

- [ ] 1.1 Add `unsupportedCharacters: string[]` to `PortingFacts` in `src/reference/types.ts`, documented in the hand-authored language-rules block beside `statementSeparator`
- [ ] 1.2 Author the list for every machine in `src/reference/facts.ts`, letting relatives inherit through the existing `extends` mechanism
- [ ] 1.3 Extend `src/reference/facts-crosscheck.test.ts` with the glyph-sweep derivation (`charset.glyph(0x00..0xFF)`, keeping single printable-ASCII glyphs and unescaping the backslash-escaped spellings) and assert each machine's authored list equals printable ASCII minus the reachable set
- [ ] 1.4 Pin both failure directions by name in that test: the ZX81 reports `!` missing, and the Spectrum does **not** report `\` missing (its `0x5C` glyph is the escaped spelling)

## 2. What the program uses that the target will reject

- [ ] 2.1 Add `characters: string[]` and `multiStatementLines: number[]` to `ProgramVocabulary` in `src/app/programVocabulary.ts`, and mirror them on the structurally identical interface in `src/reference/compare.ts`
- [ ] 2.2 Collect the program's distinct printable characters from string literals and from `scannable(body)`, skipping whatever `probeFor(dialect.id).parseUnit` consumes as an escape unit so escapes are not double-counted as characters
- [ ] 2.3 Collect the lines carrying more than one statement, splitting on the *source* machine's `PortingFacts.statementSeparator` outside strings and REM tails, ignoring empty statements, and yielding nothing for a `null` separator
- [ ] 2.4 Extend `ProgramVocabularyReply` and the iframe parse in `DialectCompare.vue` with both fields, defaulting to empty so an older cached docs bundle still works
- [ ] 2.5 Cover both scans in `src/app/programVocabulary.test.ts`: a ZX81 program's literal colon is not a statement break, a C64 `A=1:B=2` reports one line, and a block graphic is reported as an escape code and not as a character

## 3. Narrowing helpers

- [ ] 3.1 Add `unsupportedCharactersForProgram(targetFacts, vocabulary)` to `src/reference/compare.ts`
- [ ] 3.2 Add `StatementLayoutChange` and `statementLayoutForProgram(sourceFacts, targetFacts, vocabulary)`, distinguishing splitting from re-separating and returning `null` where the two machines agree
- [ ] 3.3 Narrow `behaviourChanged` in `escapeDiffForProgram` the same way `mustReplace` is narrowed
- [ ] 3.4 Cover all three in `src/reference/compare.test.ts`, including a target that represents printable ASCII in full reporting nothing

## 4. The comparison page

- [ ] 4.1 Add a `Characters` fact row to `factRows` in `docs/.vitepress/theme/components/DialectCompare.vue`, with the language rules
- [ ] 4.2 Add a narrowed "Characters to replace" section, absent when empty, falling back to the target's full set when there is no program to narrow to
- [ ] 4.3 Add a narrowed "Statement layout" section as a section of its own — not a bullet in **Before you start**, which is never narrowed
- [ ] 4.4 Render `escapeDiff.behaviourChanged` in the control-codes section, naming what each code stores on each machine
- [ ] 4.5 Add all three new buckets to the `heldBack` count so the narrowing stays honest
- [ ] 4.6 Add a sentence on character sets to `docs/reference/porting-basics.md`

## 5. What the assistant is told

- [ ] 5.1 Add a character-set section to `describeMachine` in `src/reference/machineDescription.ts`, omitted entirely for a machine with a full printable-ASCII repertoire
- [ ] 5.2 Add an escape-spelling section built from the machine's escape table, and pass that table into `describeMachine` from `src/ai/machineReference.ts` (it is already loaded there for the port path)
- [ ] 5.3 Confirm the system prompt stays byte-stable per dialect — the existing `src/ai/promptBuilder.test.ts` guarantee
- [ ] 5.4 Extend `src/reference/machineDescription.test.ts` (or add it) to sweep every registered dialect for both sections

## 6. The port report

- [ ] 6.1 Add `describeLanguageRuleChanges(from, to)` to `src/reference/portDescription.ts` — the fact rows that differ, from the same `PortingFacts` the guide's fact table reads
- [ ] 6.2 Add the characters to replace and the statement-layout change, naming the affected line numbers
- [ ] 6.3 Send the `behaviourChanged` control codes alongside those that must be replaced
- [ ] 6.4 Extend `src/reference/portDescription.test.ts` so each new section appears only when the program is subject to it, keeping the existing "a command the program never used must never reach a request" guarantee

## 7. Quality gates

- [ ] 7.1 `npm run typecheck`
- [ ] 7.2 `npm test`
- [ ] 7.3 `npm run lint` and `npm run format:check`
- [ ] 7.4 `npm run docs:build` (docs/ changes in task group 4)
- [ ] 7.5 `npm run e2e:chromium -- e2e/porting-guidance`
- [ ] 7.6 `npm run e2e:chromium -- e2e/ai-assistant`
