## 1. Tokenizer accepts unnumbered direct-mode lines

- [x] 1.1 Add `src/dialects/apple1/directLine.ts`: parse one physical line as one of the nine `APPLE1_DIRECT_ONLY` commands with its own argument grammar, tolerating the spaces the interpreter skips inside a keyword. Kept out of `tokenizer.ts` because the block lint needs the declared workspace on every keystroke and cannot afford to tokenize a program for it
- [x] 1.2 Add `MIN_LOMEM`/`MAX_HIMEM` to `addresses.ts`
- [x] 1.3 Widen `TokenizedProgram` with the workspace the source declares, defaulted to the stock pair
- [x] 1.4 In the top-level loop, try the direct-line parse before emitting `Missing line number`; a direct line stores no bytes and does not touch `prevLineNo`
- [x] 1.5 Apply `LOMEM=`/`HIMEM=` (last wins) and validate the pair fatally, reporting at the later of the two lines and falling back to the stock workspace so no caller can build an image from an impossible one
- [x] 1.6 Accept the other seven in silence — the run gate counts non-fatal errors too, so a note would refuse to run a listing for ending the way listings end
- [x] 1.7 Leave `rejectDirectOnly()` untouched: all nine stay refused inside a numbered line
- [x] 1.8 `directLine.test.ts` (new) and the `unnumbered direct-mode lines` block in `tokenizer.test.ts`; the existing `STORED` and `REJECTED` tables pass unchanged

## 2. The declared workspace reaches the image

- [x] 2.1 `index.ts` `tokenize()`: pass the workspace to `buildBasicImage` and budget the program against it
- [x] 2.2 `audio/aciEncoder.ts` `buildCassetteImage`: same
- [x] 2.3 `detokenize`/`detokenizeWithReport` restate a non-stock workspace as the preamble — without it an imported program rebuilds into the stock workspace, which the round-trip requirement forbids
- [x] 2.4 Make `audio.loadInstructions` optionally a function of the program text and render the monitor range the program's own bounds describe; reword `saveInstructions` to say how to read those bounds off a real machine
- [x] 2.5 `basicImage.test.ts`: a declared workspace sizes the image, recovers as a preamble, re-tokenizes byte-exactly, and is what the size budget is measured against
- [x] 2.6 Tighten `loadProgram`'s workspace guard with the floor it lacked, and add the real-ROM end-to-end plus the malformed-image case to `apple1Machine.test.ts`

## 3. The editor stops renumbering these lines

- [x] 3.1 Add `Dialect.unnumberedLineKey`, absent on every machine that requires a number
- [x] 3.2 Implement it on `apple1` from the same command table the tokenizer parses with
- [x] 3.3 Thread an optional predicate through `lineNumbering.ts` beside the `#BIN` guard; generalise the directive side-channel to carry unnumbered lines, anchored to the numbered line they sit above
- [x] 3.4 Carry it to the keymap handlers through the numbering facet, and fix the `renumberFile` cursor rank, which counted rows renumbering does not number
- [x] 3.5 Confirm the highlighter and the read-only consumers (`programOutline`, `pokeAddresses`, `runProfile`, `programVocabulary`, `variables`) need no change
- [x] 3.6 `lineNumbering.test.ts`: kept in place, references still rewritten, and — with no predicate — the very same lines numbered as before

## 4. AI merge preserves them

- [x] 4.1 Carry unnumbered lines through `mergePlan` anchored to the line below them, sorted ahead of it
- [x] 4.2 The program's own win over a fragment's, so a partial merge can neither drop nor duplicate one; a different value for the same command reads as a change, a new one as an addition
- [x] 4.3 Stop a preamble-only program reading as nothing to merge into, which would have replaced it outright
- [x] 4.4 Add an `apple1` wording to `LINE_NUMBER_RULES` — the shared one asserts the tokeniser needs a leading digit, which is no longer true here — and fit it inside the per-machine prompt budget by cutting a duplicated RAM reminder. `RETURNING_CODE_RULES` untouched, so the prompt cache prefix is unchanged
- [x] 4.5 Update the Apple I profile's trap and block-window bullets
- [x] 4.6 `codeExtractor.test.ts`, including the no-key case that pins the old behaviour this fixes

## 5. Blocks, reference and docs

- [x] 5.1 `MemoryBlocksSupport.programArea` takes the program text optionally; the Apple I reads its declared bounds, `lintBlocks` and `EmulatorPane` pass it through
- [x] 5.2 `memoryBlocks.test.ts` for the moved workspace
- [x] 5.3 `src/reference/apple1.ts`: each of the nine says what it does unnumbered as well as inside a numbered line
- [x] 5.4 `docs/reference/apple1.md` gains a worked preamble section; `apple1/formats.md` and `apple1/hardware.md` stop implying the ranges and the block window are fixed. Sidebar untouched
- [x] 5.5 No sample gains a preamble: two use the low RAM a lowered LOMEM would swallow, and the starter must stay the simplest listing on the machine

## 6. Browser check

- [ ] 6.1 `npm run e2e:chromium -- e2e/code-editor` as a regression check on the shared numbering path. No new spec: the only browser-shaped fact here is that Enter does not number one of these lines, which is `insertNumberedLineBelow` returning null and is already unit-tested from both sides

## 7. Quality gates

- [x] 7.1 `npm run typecheck`
- [x] 7.2 `npm test`
- [x] 7.3 `npm run lint`
- [x] 7.4 `npm run format:check`
- [x] 7.5 `npm run docs:build`
- [x] 7.6 `npx openspec validate --specs`
