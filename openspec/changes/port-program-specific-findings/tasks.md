## 1. Character-set repertoire as a porting fact

- [x] 1.1 Add `unsupportedCharacters: string[]` to `PortingFacts` in `src/reference/types.ts`, documented in the hand-authored language-rules block beside `statementSeparator`
- [x] 1.2 Author the list for every machine in `src/reference/facts.ts`, letting relatives inherit through the existing `extends` mechanism
- [x] 1.3 Extend `src/reference/facts-crosscheck.test.ts` with the glyph-sweep derivation (`charset.glyph(0x00..0xFF)`, keeping single printable-ASCII glyphs and unescaping the backslash-escaped spellings) and assert each machine's authored list equals printable ASCII minus the reachable set
- [x] 1.4 Pin both failure directions by name in that test: the ZX81 reports `!` missing, and the Spectrum does **not** report `\` missing (its `0x5C` glyph is the escaped spelling)

## 2. What the program uses that the target will reject

- [x] 2.1 Add `characters: string[]` and `multiStatementLines: number[]` to `ProgramVocabulary` in `src/app/programVocabulary.ts`, and mirror them on the structurally identical interface in `src/reference/compare.ts`
- [x] 2.2 Collect the program's distinct printable characters from string literals and from `scannable(body)`, skipping whatever `probeFor(dialect.id).parseUnit` consumes as an escape unit so escapes are not double-counted as characters
- [x] 2.3 Collect the lines carrying more than one statement, splitting on the *source* machine's separator outside strings and REM tails, ignoring empty statements, and yielding nothing where it has none
- [x] 2.3a Add `statementSeparator: string | null` to `Dialect` and declare it on every registered dialect; pin `PortingFacts.statementSeparator` to it in `facts-crosscheck.test.ts`. Needed because the analyser runs in `src/app/`, which may not statically import `src/reference/`, and `memoryWrites.statementSep` cannot express "this machine has none" — see design decision 3
- [x] 2.4 Extend `ProgramVocabularyReply` and the iframe parse in `DialectCompare.vue` with both fields, defaulting to empty so an older cached docs bundle still works
- [x] 2.5 Cover both scans in `src/app/programVocabulary.test.ts`: a ZX81 program's literal colon is not a statement break, a C64 `A=1:B=2` reports one line, and a block graphic is reported as an escape code and not as a character

## 3. Narrowing helpers

- [x] 3.1 Add `unsupportedCharactersForProgram(targetFacts, vocabulary)` to `src/reference/compare.ts`
- [x] 3.2 Add `StatementLayoutChange` and `statementLayoutForProgram(sourceFacts, targetFacts, vocabulary)`, distinguishing splitting from re-separating and returning `null` where the two machines agree
- [x] 3.3 Narrow `behaviourChanged` in `escapeDiffForProgram` the same way `mustReplace` is narrowed
- [x] 3.4 Cover all three in `src/reference/compare.test.ts`, including a target that represents printable ASCII in full reporting nothing

## 4. The comparison page

- [x] 4.1 Add a `Characters` fact row to `factRows` in `docs/.vitepress/theme/components/DialectCompare.vue`, with the language rules
- [x] 4.2 Add a narrowed "Characters to replace" section, absent when empty, falling back to the target's full set when there is no program to narrow to
- [x] 4.3 Add a narrowed "Statement layout" section as a section of its own — not a bullet in **Before you start**, which is never narrowed
- [x] 4.4 Render `escapeDiff.behaviourChanged` in the control-codes section, naming what each code stores on each machine
- [x] 4.5 Add all three new buckets to the `heldBack` count so the narrowing stays honest
- [x] 4.6 Add a sentence on character sets to `docs/reference/porting-basics.md`

## 5. What the assistant is told

- [x] 5.1 Add a character-set section to `describeMachine` in `src/reference/machineDescription.ts`, omitted entirely for a machine with a full printable-ASCII repertoire
- [x] 5.2 Add an escape-spelling section built from the machine's escape table, and pass that table into `describeMachine` from `src/ai/machineReference.ts` (it is already loaded there for the port path)
- [x] 5.3 Confirm the system prompt stays byte-stable per dialect — the existing `src/ai/promptBuilder.test.ts` guarantee
- [x] 5.4 Extend `src/reference/machineDescription.test.ts` (or add it) to sweep every registered dialect for both sections

## 6. The port report

- [x] 6.1 Add `describeLanguageRuleChanges(from, to)` to `src/reference/portDescription.ts` — the fact rows that differ, from the same `PortingFacts` the guide's fact table reads
- [x] 6.2 Add the characters to replace and the statement-layout change, naming the affected line numbers
- [x] 6.3 Send the `behaviourChanged` control codes alongside those that must be replaced
- [x] 6.4 Extend `src/reference/portDescription.test.ts` so each new section appears only when the program is subject to it, keeping the existing "a command the program never used must never reach a request" guarantee

## 7. Quality gates

- [x] 7.1 `npm run typecheck`
- [x] 7.2 `npm test`
- [x] 7.3 `npm run lint` and `npm run format:check`
- [x] 7.4 `npm run docs:build` (docs/ changes in task group 4)
- [x] 7.5 `npm run e2e:chromium -- e2e/porting-guidance`
- [x] 7.6 `npm run e2e:chromium -- e2e/ai-assistant`
