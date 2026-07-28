## 1. Merge plan, deletion and classification

- [x] 1.1 Add `mergePlan(existing, fragment)` to `src/ai/codeExtractor.ts`, returning the ordered change set (`context` / `added` / `removed` / `changed` rows with line number and text) derived from the existing keyed `parse()`
- [x] 1.2 Re-express `mergeBasicLines` in terms of `mergePlan` so the preview and the apply cannot drift, keeping the existing `#BIN` ordering behaviour (directives taken from the existing source, ahead of an equal-numbered text line)
- [x] 1.3 Teach the plan that a fragment line matching a bare line number deletes that line; gate deletion on the caller passing "this is a fragment", and exclude `#BIN` record numbers so a directive can never be deleted
- [x] 1.4 Handle the degenerate results: a fragment that deletes every line, and a fragment whose plan contains no changes at all
- [x] 1.5 Extend `CodeBlock` with the kind declared by the fence tag (`basic` vs `basic-partial`), derived in `extractCodeBlocks` — its regex already admits hyphens, so no parser change
- [x] 1.6 Add `classifyBlock(block, source)` returning `full` / `partial` / `unknown`: declared tag wins when the line-number heuristic agrees or is inconclusive; a direct conflict, or no tag with an inconclusive heuristic, gives `unknown`; an empty editor gives `full`
- [x] 1.7 Extend `src/ai/codeExtractor.test.ts`: fence-tag parsing; `classifyBlock` across each case **including a full rewrite that shrinks the program, which must not classify as partial**; bare-number deletion; deletion suppressed for a full listing; deletion leaving `#BIN` records intact; all-lines-deleted
- [x] 1.8 Add `mergePlan` tests: each row kind; `#BIN` records appear as context and never as changes; a no-op fragment yields no change rows; **applying the plan reproduces `mergeBasicLines`' output** so preview and apply are pinned together

## 2. Prompt rules

- [x] 2.1 Move the shared OUTPUT FORMAT rules out of the 13 `src/dialects/*/aiProfile.ts` copies and compose them in `buildSystemPrompt` (`src/ai/promptBuilder.ts`), leaving only genuinely machine-specific bullets in each profile; the result must stay byte-stable per dialect for prompt caching
- [x] 2.2 Write the new shared rules: prefer a fragment when the change affects notably fewer lines than the program, a complete listing for a new program or a large rewrite; the two fence tags; the bare-line-number delete convention
- [x] 2.3 Update `FORMAT_RETRY_MESSAGE` (`src/ai/promptBuilder.ts`), which hard-codes "the complete program"
- [x] 2.4 Fix the `#BIN` bullets in `src/dialects/zx81/aiProfile.ts` and `src/dialects/zx80/aiProfile.ts` — they say to repeat each record verbatim "when returning the complete program"; a fragment must omit them entirely
- [x] 2.5 Extend `src/ai/promptBuilder.test.ts`: the composed prompt carries the shared rules, and `FORMAT_RETRY_MESSAGE` stays consistent with them
- [x] 2.6 Add a test asserting every dialect registered in `src/dialects/registry.ts` composes a prompt containing the shared rules exactly once — nothing references `aiProfile` in any test today, so the prompts are currently unverified

## 3. Stale-base fingerprint

- [x] 3.1 Record a fingerprint of the source a reply was written against when the reply finalises in `src/ai/aiStore.ts`
- [x] 3.2 Carry it through `persist()` and `PersistedMessage` (`src/storage/settings.ts`) so it survives a reload; treat its absence in an older stored thread as an unknown base that raises no warning
- [x] 3.3 Add `src/ai/aiStore.test.ts` coverage that the fingerprint is recorded and survives a persist/load round trip

## 4. Reply completion state

- [x] 4.1 Surface why generation stopped from the Anthropic adapter (`src/ai/providers/anthropic.ts`), which currently concatenates text blocks and never inspects it
- [x] 4.2 Mark a reply truncated at the output limit as incomplete in `src/ai/aiStore.ts`, reusing the existing `incomplete` display flag, so it is not offered as a finished applicable answer
- [x] 4.3 Report a declined request as declined rather than letting it fall into the empty-reply retry path
- [x] 4.4 Add `src/ai/aiStore.test.ts` cases for both: a truncated reply is not applicable, and a decline does not trigger the empty-reply retry

## 5. Panel UI

- [x] 5.1 Render the button set from the classification in `src/components/AiPanel.tsx`: fragment → merge and merge-and-run; full listing → replace and replace-and-run; unknown → both, labelled as a choice
- [x] 5.2 Add `applyMergeAndRun`, mirroring the existing `applyReplaceAndRun` (`showEmulator()` + `requestAiRun()` already exist)
- [x] 5.3 Render a fragment as the inline unified diff in place of the plain `<pre>`, with a toggle back to the block as the assistant wrote it; a full listing keeps the plain rendering
- [x] 5.4 Show a few lines of context around each change and collapse the untouched stretches between them
- [x] 5.5 Warn above the actions when a fragment's base fingerprint does not match the current source, without disabling the merge
- [x] 5.6 Add the diff styles to `src/components/AiPanel.module.css` (added / removed / context rows, the collapsed-stretch marker) using the existing theme variables, legible in both light and dark themes

## 6. Prompt caching

- [x] 6.1 Add a top-level ephemeral `cache_control` at the default 5-minute TTL to the request in `src/ai/providers/anthropic.ts`, so the breakpoint lands at the end of the whole prefix — **not** on the system prompt alone, which sits under the model's minimum cacheable size on most dialects and would silently never cache
- [ ] 6.2 Confirm against a live provider that `usage.cache_read_input_tokens` is non-zero from the second turn of a thread onward; if it stays zero, find the invalidator before checking this off
  - NOT RUN: needs a real API key, which this environment does not have. The parameter typechecks against the SDK and the prefix is byte-stable by construction, but the cache-read count is unverified.

## 7. End-to-end coverage

- [x] 7.1 Establish whether seeding a conversation into storage is enough to drive the apply buttons in `e2e/ai-assistant/` without a live provider; if it is not practical, say so explicitly rather than leaving the gap silent
- [x] 7.2 If practical: cover the fragment button set, the full-listing button set, and the unknown case offering both

## 8. Docs

- [x] 8.1 Update the button names and the AI apply flow in `docs/contributing/architecture.md`

## 9. Quality gates

- [x] 9.1 `npm run typecheck`
- [x] 9.2 `npm test`
- [x] 9.3 `npm run lint`
- [x] 9.4 `npm run format:check`
- [x] 9.5 `npm run docs:build` (docs change in task 8)
- [x] 9.6 `npm run e2e:chromium -- e2e/ai-assistant`
- [x] 9.7 `npx openspec validate --changes`
- [ ] 9.8 NOT RUN (no API key in this environment; the apply surface is covered by e2e/ai-assistant/apply-actions.spec.ts, but the model's own tagging behaviour is unverified). Manual pass with a real API key (the apply path needs a live provider): a one-line tweak to a ~40-line program returns a tagged fragment shown as a diff, offering only merge and merge-and-run, and merging produces exactly what the diff showed; a full rewrite offers only replace and replace-and-run with the plain listing; an edit that removes a line shows a removed row and applies; editing the program between the reply arriving and merging raises the stale warning; diff colours are legible in both themes
