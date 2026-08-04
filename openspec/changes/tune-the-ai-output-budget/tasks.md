## 1. Settle the numbers before writing code

- [x] 1.1 Look up the maximum output tokens each of the three providers accepts
      for its configured model, and record the figures in `design.md`
      — Anthropic 128,000 and OpenAI 16,384 confirmed from vendor docs; **Gemini
      65,536 is an assumption**, recorded as such (no credentials here to confirm it,
      and Google's preview model pages carry no specifications table)
- [x] 1.2 Look up the reasoning-effort levels the configured Anthropic model
      accepts, and which one corresponds to "leave it unset"
      — `low`/`medium`/`high`/`xhigh`/`max`; unset behaves as `high`
- [ ] 1.3 Token-count a worst-case listing (a ~20KB ZX Spectrum program, the
      largest size any dialect prompt asks for) to get the real cost of the visible
      answer, rather than a characters-per-token estimate
      — **NOT DONE**: needs API credentials this environment does not have. A 20,489-byte
      listing was built and estimated at ~6,400–7,000 tokens; see design.md. The
      estimate would have to be wrong by >2x to change 1.4, so this does not block.
- [x] 1.4 Settle `DEFAULT_AI_MAX_TOKENS` from 1.1 and 1.3 — must clear the listing
      with reasoning headroom, and sit within every provider's ceiling — and settle
      `DEFAULT_AI_EFFORT` from 1.2
      — 16384 (also exactly the tightest provider's ceiling) and `medium`

## 2. Remove the budget from the dialect seam

- [x] 2.1 Remove `maxTokens` from `AiProfile` in `src/dialects/types.ts`
- [x] 2.2 Remove the `maxTokens` line from all 14 `src/dialects/*/aiProfile.ts`
      files; `npm run typecheck` must come back clean
- [x] 2.3 Check `src/dialects/registry.test.ts` and any other dialect test for
      assertions on `maxTokens`, and remove them
      — verified: no dialect test asserts on `maxTokens`
- [x] 2.4 Remove the `maxTokens` mention from
      `.claude/skills/adding-a-target-system/plan-template.md` so new dialects stop
      being told to set a field that no longer exists

## 3. Provider capabilities and the request

- [x] 3.1 Add the declared output ceiling and effort support to `ProviderMeta`
      (`src/ai/providers/types.ts`), documented in the style of `acceptsImages`
- [x] 3.2 Fill both in for all three entries in `src/ai/providers/registry.ts`
      using the figures from 1.1 and 1.2
- [x] 3.3 Add optional `effort` to `StreamOptions`
- [x] 3.4 Send it as the effort setting in `src/ai/providers/anthropic.ts`; leave
      `openai.ts` and `gemini.ts` ignoring it
- [x] 3.5 Clamp the requested budget to the provider's declared ceiling, so a
      configured value above it cannot turn into a rejected request
      — done once in `aiClient.streamChat`, the single seam every request passes
      through, rather than three times in the backends; it also drops a stale effort
      for a backend that has none
- [x] 3.6 Colocated tests: the Anthropic backend sends the effort setting, the
      other two do not, and each clamps a too-large budget

## 4. Per-provider settings storage

- [x] 4.1 Add `DEFAULT_AI_MAX_TOKENS` and `DEFAULT_AI_EFFORT` to
      `src/storage/settings.ts` alongside the other defaults
- [x] 4.2 Add per-provider budget and effort accessors beside
      `getProviderApiKey`/`setProviderApiKey`, keyed by provider id; clearing a
      value removes the entry and restores the default
- [x] 4.3 Extend the `KEYS` comment noting that per-provider values are not listed
      in the map
- [x] 4.4 Colocated tests: round-trip each accessor; an unset value falls back to
      the default; **a value set on one provider survives switching to another and
      back, and does not leak into the other provider**

## 5. One resolution point

- [x] 5.1 Add `resolveAiTuning(providerId)` returning the effective budget and
      effort, applying the per-provider override over the default
- [x] 5.2 Replace all five `dialect.aiProfile.maxTokens` reads with it —
      `AiPanel.tsx` (both the request and the fix paths), `DocsDrawer.tsx`,
      `NewProjectDialog.tsx`, and the unattended path in `aiStore.ts`
- [x] 5.3 Test that the unattended correction path resolves the same values as a
      user-made request, so the two cannot drift

## 6. Settings UI

- [x] 6.1 Add the budget control to the AI tab of
      `src/components/SettingsForm.tsx`, following the existing numeric-field
      pattern, bounded by the selected provider's declared ceiling
- [x] 6.2 Add the effort control, shown only for a provider that supports one
- [x] 6.3 Extend the existing provider-change handler to swap both fields, as it
      already swaps the API key field
- [x] 6.4 Give both controls a way back to the default, and show the effective
      value when no override is stored

## 7. Report the reason a reply was cut short

- [x] 7.1 Carry the cut-off reason alongside `incomplete` on the displayed message,
      absent on complete answers; leave every existing consumer of `incomplete`
      untouched
- [x] 7.2 Set it for all three cases — stopped by the user, connection failed,
      reached the output limit
- [x] 7.3 Handle out-of-room-with-no-text **before** the empty-reply branch in
      `src/ai/aiStore.ts`, so it is no longer retried as a formatting mistake
- [x] 7.4 Word each case distinctly in `src/components/AiPanel.tsx`; the
      output-limit case points at the setting that governs it
- [x] 7.5 Extend `src/ai/aiStore.test.ts`: each reason is recorded correctly, and
      an out-of-room empty reply spends no second request

## 8. Continue a cut-off answer

- [x] 8.1 Add the continuation request, using the mid-array assistant turn shape
      the empty-reply retry already uses — **not** a trailing assistant turn, which
      current Claude models reject
- [x] 8.2 Stitch at a line boundary: drop the partial's incomplete trailing line
      and resume from the following line
- [x] 8.3 Make the stitched program the continuation reply's content, so block
      extraction, the run check, and staleness all work unchanged on the last
      message
- [x] 8.4 Carry the original answer's staleness fingerprint onto the continuation,
      not a fresh one
- [x] 8.5 Offer the control in `AiPanel.tsx` only for the output-limit case
- [x] 8.6 Tests: stitching drops the incomplete line and joins cleanly; a continued
      answer is run-checked like any other; an edit made while it was cut off still
      flags the continued answer as stale; a continuation that is itself cut off can
      be continued again

## 9. Quality gates

- [x] 9.1 `npm run typecheck`
- [x] 9.2 `npm test` — 4792 passed, 0 failed
- [x] 9.3 `npm run lint`
- [x] 9.4 `npm run format:check` (or `npm run format` to fix)
- [x] 9.5 `npm run e2e:chromium -- e2e/ai-assistant` — passing (31/31 together with
      9.6). First run had 2 cold-start flakes, both failing at `page.goto('/')`
      before any assertion; they pass on re-run and in the combined run.
- [x] 9.6 `npm run e2e:chromium -- e2e/shell` if the settings form is covered there
      — run and passing
