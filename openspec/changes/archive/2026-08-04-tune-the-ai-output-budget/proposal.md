## Why

The assistant regularly cuts its own answers short. The panel says "This answer
was cut off, so the code is unfinished - ask again to get the rest" on replies
the user never stopped, at moments they were not touching the app at all.

The cause is a budget the user cannot see or change. Every request asks for
adaptive thinking under a fixed 8192-token output ceiling, and that ceiling is
spent on the assistant's deliberation *and* its answer together. A whole BASIC
listing is a large answer by the standards of that budget, so a long think leaves
too little room to finish the program. It bites hardest on the requests the IDE
raises for itself - correcting a failed run, judging a screen - which happen after
a run finishes, with nobody at the keyboard. That is why it reads as spontaneous.

Three things then compound it: a reply whose whole budget went to thinking comes
back empty and is misread as a formatting problem, so a second request is spent on
a formatting nudge; the panel gives the same sentence whether the user pressed
Stop, the connection dropped, or the answer ran out of room; and the only offered
remedy - ask again - throws away the partial answer and starts from nothing.

## What Changes

- **BREAKING** (internal): `AiProfile.maxTokens` is removed from the `Dialect`
  seam. The output budget stops being a per-machine constant - how long an answer
  may be is a property of the model and the user's preference, not of which
  microcomputer is selected.
- The output budget and the reasoning effort become **settings**, with one
  app-wide default each and a **per-provider override** stored alongside that
  provider's API key, so switching backends preserves each one's tuning.
- The default budget is raised, and reasoning effort is set explicitly rather than
  left at the provider's default, so answers stop running out of room.
- Providers declare their own output ceiling and whether they support an effort
  setting. The UI only offers a control a provider can honour, and a request is
  clamped to what the provider accepts.
- A reply cut off by the output limit is distinguished from one the user stopped
  and one the connection dropped. Each is reported for what it is.
- A reply that spent its whole budget thinking is reported as out of room instead
  of being retried as a formatting mistake.
- A reply cut off by the output limit can be **continued** - the partial answer is
  kept and the assistant carries on from it - instead of only being re-asked from
  scratch.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ai-assistant`: two requirements change.
  - *Bring-your-own-key, multiple providers* gains the output budget and effort as
    per-provider settings kept alongside the key, and providers declaring their own
    ceiling and effort support.
  - *An incomplete or declined reply is not offered as finished code* gains the
    distinction between the reasons a reply was cut short, and the ability to
    continue one that ran out of room rather than only re-ask it.

`project-setup` is **not** affected: it covers machine choice and starting a
project, and specifies nothing about the AI settings surface.

## Non-goals

- **Recording token usage per answer.** Useful for diagnosing the next report of
  this, but it is an observability refactor with no behavioural change and should
  not ride along.
- **Changing what the assistant is asked to write.** The dialect system prompts,
  their stated program-size targets, and the returned-code rules are untouched.
- **Making the budget vary per machine.** The whole point is that it stops doing
  that. A per-dialect override is not being replaced by a cleverer per-dialect
  override.
- **Changing the automatic-correction budget.** How many corrections the assistant
  may attempt unasked is a separate bound and is unchanged.
- **Adding a model picker.** Each provider keeps its single fixed model.

## Impact

Affected code:

- `src/dialects/types.ts` - `AiProfile.maxTokens` removed; all 14
  `src/dialects/*/aiProfile.ts` files updated.
- `src/ai/providers/types.ts` - `StreamOptions` gains an optional effort;
  `ProviderMeta` gains a declared output ceiling and effort support, alongside the
  existing `acceptsImages`.
- `src/ai/providers/anthropic.ts` - sends the effort setting; `openai.ts` and
  `gemini.ts` ignore it and clamp to their own ceilings.
- `src/storage/settings.ts` - per-provider budget and effort accessors beside the
  existing per-provider API key accessors.
- `src/ai/aiStore.ts` - out-of-room replies handled before the empty-reply retry;
  cut-off reason carried on the message; continuation.
- `src/components/SettingsForm.tsx` - the AI tab gains the two controls and swaps
  them on provider change, as it already does for the key.
- `src/components/AiPanel.tsx` - reports the cut-off reason and offers to continue.
- `src/components/DocsDrawer.tsx`, `src/components/NewProjectDialog.tsx` - follow
  the new resolver instead of reading the dialect's profile.

Also updated: `.claude/skills/adding-a-target-system/plan-template.md`, which
currently tells a new dialect to set `maxTokens`.

No dependency changes. No user data migration: an absent stored override simply
means the default, which is what every existing browser will have.
