## 1. Tokenizer accepts unnumbered direct-mode lines

- [ ] 1.1 In `src/dialects/apple1/tokenizer.ts`, add a `directLine()` entry point on the existing `LineParser` that parses one of the nine `APPLE1_DIRECT_ONLY` commands and returns what it asks for, reusing `eat`/`expression`/`fail` so error positions and messages match the rest of the tokenizer
- [ ] 1.2 Widen `TokenizedProgram` with the workspace the source declares, defaulted to the stock `DEFAULT_LOMEM`/`DEFAULT_HIMEM`
- [ ] 1.3 In the top-level loop, try `directLine()` before emitting `Missing line number`; a direct line contributes no program bytes and does not touch `prevLineNo`
- [ ] 1.4 Apply `LOMEM=`/`HIMEM=` (last declaration wins) and validate the bounds fatally: `lomem < himem`, `himem <= RAM_TOP + 1`, `lomem` at or above the byte after the monitor's input buffer
- [ ] 1.5 Emit the non-fatal notes: each command that cannot affect a stored program, a repeated bound, `SCR`/`CLR` after a numbered line, and a declared lower bound below the stock one (it covers the machine-code block window)
- [ ] 1.6 Leave `rejectDirectOnly()` untouched so all nine stay refused inside a numbered line
- [ ] 1.7 Add the cases to `src/dialects/apple1/tokenizer.test.ts`: an accepted preamble, a trailing `RUN`, the declared workspace coming back, each fatal bounds failure, each non-fatal note, an unnumbered `PRINT 1` still fatal, and the `Missing line number` case this dialect currently has no test for. The existing `STORED` and `REJECTED` tables must pass unchanged

## 2. The declared workspace reaches the image

- [ ] 2.1 `src/dialects/apple1/index.ts` `tokenize()`: pass the workspace to `buildBasicImage`, and budget-check the program against `himem - lomem`, rewording the message to name the workspace the program asked for
- [ ] 2.2 `src/dialects/apple1/audio/aciEncoder.ts` `buildCassetteImage`: same
- [ ] 2.3 Reword the Apple I's cassette `loadInstructions`/`saveInstructions` so the monitor range is stated as coming from the program's own bounds, with the stock pair as the example
- [ ] 2.4 Extend `src/dialects/apple1/basicImage.test.ts`: a non-stock workspace builds, and `parseBasicImage` recovers the same bounds
- [ ] 2.5 Add a ROM-booted case to `src/dialects/apple1/samples.test.ts` (via the existing boot harness): a program declaring a larger workspace runs on the real ROM and the machine reports the larger workspace
- [ ] 2.6 Confirm `src/dialects/apple1/audio/aci.test.ts` still round-trips, and extend it with a non-stock workspace

## 3. The editor stops renumbering these lines

- [ ] 3.1 Add one optional member to `Dialect` in `src/dialects/types.ts` letting a dialect say a physical line is a legal unnumbered line, documented as absent on every machine that requires a number
- [ ] 3.2 Implement it on `apple1` from the same command table the tokenizer parses with
- [ ] 3.3 Thread it into `src/editor/lineNumbering.ts` as an optional parameter alongside the existing `isBinaryDirective` guard, at every guard site plus `parseLines` and `renumberProgram`; every new parameter defaults to today's behaviour
- [ ] 3.4 Pass it from `src/components/CodeMirrorHost.tsx` (the only non-test caller of the mutating functions) into renumber-file, renumber-line and auto-number-on-Enter
- [ ] 3.5 Check `src/editor/basicLanguage.ts` does not mis-tag an unnumbered line, and that the nine commands highlight as the keywords they already are
- [ ] 3.6 Confirm the read-only consumers (`programOutline`, `pokeAddresses`, `runProfile`, `programVocabulary`, `variables`) degrade acceptably and need no change
- [ ] 3.7 Extend `src/editor/lineNumbering.test.ts`: renumber, number-in-place and insert-below leave an accepted unnumbered line alone when the predicate is supplied, and behave exactly as today when it is not. Every existing case must pass unchanged

## 4. AI merge preserves them

- [ ] 4.1 In `src/ai/codeExtractor.ts`, collect accepted unnumbered lines with an anchor (the number of the next numbered line below, or past the end for a trailing line) and emit them as context rows sorted ahead of that line, reusing the `#BIN` side-channel and its priority ordering
- [ ] 4.2 Make the existing program's unnumbered lines win over a fragment's, as `#BIN` directives already do, so a partial merge can neither drop nor duplicate them
- [ ] 4.3 Check `classifyBlock`/`classifyByLineNumbers` still classify correctly for a program whose only unnumbered lines are these
- [ ] 4.4 Add an Apple I wording to `LINE_NUMBER_RULES` in `src/ai/aiProfileComposer.ts` and point the dialect's `aiProfile` at it; leave `RETURNING_CODE_RULES` in `src/ai/promptBuilder.ts` untouched so the prompt cache prefix is unchanged
- [ ] 4.5 Update the Apple I `aiProfile` trap bullet that currently says these commands are direct-mode only, so it also says what an unnumbered line does
- [ ] 4.6 Extend `src/ai/codeExtractor.test.ts`: a partial merge preserves a preamble and a trailing `RUN` in place, and neither is shown as a change

## 5. Sample, reference and docs

- [ ] 5.1 Give `src/dialects/apple1/samples/hello.bas` a preamble; leave `circles.bas` and `kaleido.bas` alone (both use the free RAM below LOMEM that a lowered bound would swallow)
- [ ] 5.2 Update `src/reference/apple1.ts` entries for the nine commands so each says what it does on an unnumbered line as well as inside a numbered one
- [ ] 5.3 Update `docs/reference/apple1.md` the same way, and leave the sidebar in `docs/.vitepress/config.ts` untouched
- [ ] 5.4 Check the reference crosscheck tests still pass

## 6. Browser check

- [ ] 6.1 Extend an existing journey in `e2e/code-editor/editor-shortcuts.spec.ts` (no new cold `page.goto('/')`) to prove renumber and Enter leave a preamble alone — CodeMirror keymap and transaction behaviour a unit test cannot reach

## 7. Quality gates

- [ ] 7.1 `npm run typecheck`
- [ ] 7.2 `npm test`
- [ ] 7.3 `npm run lint`
- [ ] 7.4 `npm run format:check` (or `npm run format`)
- [ ] 7.5 `npm run docs:build` (docs/ changed)
- [ ] 7.6 `npm run e2e:chromium -- e2e/code-editor e2e/dialect-toolchain`
- [ ] 7.7 `npx openspec validate --specs`
