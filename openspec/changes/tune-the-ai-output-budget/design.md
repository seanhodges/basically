## Context

The assistant's request path is described in `docs/contributing/architecture.md`
(the AI section); this document covers only what changes.

Today every request carries a per-dialect `maxTokens` (8192 everywhere except
Altair's 4096) and asks for adaptive thinking with no effort setting. The
provider spends that one budget on reasoning and on the visible answer together,
and the effort default is the provider's own - the highest. When the two together
exceed the budget the provider returns a successful response whose stop reason is
the output limit, which the app records as a truncated answer.

Three consequences follow, and all three are in scope:

1. The user has no way to see or raise the budget.
2. `incomplete` conflates three unrelated events - the user pressed Stop, the
   connection dropped, the answer ran out of room - and only the last leaves no
   error message, which is why it reads as unprompted.
3. The only remedy offered discards the partial answer.

### Impact on the Dialect / MachineEmulator seam

The seam **shrinks**: `AiProfile.maxTokens` is removed from `Dialect`. Nothing is
added to it. This is the right direction - how many tokens a model may emit is a
fact about the model and the user's preference, not about a 1982 microcomputer,
and having it sit on the dialect meant thirteen copies of one number that no
dialect had a reason to differ on. `AiProfile.systemPrompt` stays: what to teach
the model about a machine genuinely is per-machine.

No emulator, tokenizer, or transfer code is touched.

## Goals / Non-Goals

**Goals:**

- Answers stop being cut off in ordinary use, including on the requests the IDE
  raises for itself after a run.
- The budget and the reasoning effort are visible and adjustable, per provider.
- A cut-off answer says which of the three things happened to it.
- A cut-off answer can be continued rather than only re-asked.
- One resolution point for the budget, so the unattended paths cannot drift from
  the user-facing ones.

**Non-Goals:**

- Recording token usage per answer (see the proposal's Non-goals).
- Any change to what the assistant is asked to write, or to the bound on
  automatic corrections.
- Per-machine budgets in any form.

## Decisions

### D1. One default, per-provider overrides - not per-dialect, not one global value

Two constants (`DEFAULT_AI_MAX_TOKENS`, `DEFAULT_AI_EFFORT`) apply to every
machine. The **override** is stored per provider, beside that provider's API key,
because the ceilings and the meaning of "effort" differ per provider and a user
who tunes one backend should not lose it by trying another.

*Alternatives considered.* Keeping the value on `AiProfile` and layering an
override on top - rejected: it preserves thirteen identical constants and leaves
the dialect as a spurious input to a decision it has no stake in. A single global
override with no per-provider dimension - rejected: the providers do not share an
output ceiling, so one number is either unsafe on the smallest or wasteful on the
largest.

*Storage shape.* Per-provider values are keyed by provider id rather than by a
declared name field on `ProviderMeta`. `apiKeyStorageKey` is a declared field
because those key names predate any scheme; there is no such legacy here, so
deriving the key means a fourth backend costs nothing. Clearing an override
removes the entry, mirroring how clearing an API key removes it.

### D2. Providers declare their ceiling and their capabilities

`ProviderMeta` gains the largest output the provider accepts and whether it
supports an effort setting, alongside the existing `acceptsImages`. That field's
rationale applies unchanged: the settings form and the request builder both need
to know before a request is made, and neither may load a vendor SDK to find out.

Requests are clamped to the provider's ceiling. Without this, raising the default
converts a truncated answer on one backend into a rejected request on a tighter
one - trading a bad outcome for a worse one.

**The ceilings must be looked up, not assumed, when this is implemented.** They
differ substantially between the three backends and they change with model
revisions. Same for the effort levels the Anthropic model accepts.

### D3. Effort is set explicitly, and set below the provider default

Leaving effort unset is what makes reasoning consume the budget, because the
provider's default is its highest setting. The tasks here are small and
well-specified - a short BASIC program for an 8-bit machine, against a system
prompt that already carries the machine's full reference - so a middle setting is
the right default. Raising it stays one control away.

This is the half of the fix that costs nothing; raising the budget alone would
make answers succeed by spending more tokens on reasoning that was not needed.

### D4. Deriving the default budget from what the assistant is asked to write

The binding case is the largest program the assistant is asked to produce. The
dialect prompts state their own targets, and the largest is the ZX Spectrum's -
programs "comfortably under 20KB of source"; ZX81 says 10KB. BASIC listings
tokenize poorly (line numbers, keywords, punctuation, few long words), so the
worst-case listing is several thousand tokens on its own, before the prose and
the stated-expectations block, and before any reasoning.

The default must clear that with room for reasoning on top. **Confirm the figure
with a token count against a real listing of that size rather than a
characters-per-token estimate**, and confirm it sits within every provider's
ceiling (D2). The proposal's suggested value is a starting point for that check,
not a measured result.

### D5. One resolver, not five call sites

The budget is read in five places today, one of which is the unattended
correction path. That path is where the truncation hurts most and where nobody is
watching, so it is exactly the one that must not drift. A single resolver taking
the provider id returns both values; all five call sites use it. None of them
needs the dialect afterwards.

### D6. Reporting the reason, without a second flag to keep in sync

`incomplete` stays as the "cannot be applied as finished" signal - every consumer
of it keeps working, including the run-check gate and the judgement settling. The
reason rides alongside it as an optional field, absent on complete answers. Code
that only asks "is this finished" is unchanged; only the panel's wording and the
new continuation affordance read the reason.

The out-of-room-and-empty case is checked **before** the empty-reply branch.
Today such a reply falls through to a formatting retry, which spends a second
request, sends a longer history, and hits the same ceiling - a formatting nudge
for a budget problem. It is reported for what it is instead.

### D7. Continuation reuses the existing retry shape - and must not use a prefill

The obvious implementation - append the partial as the final assistant turn and
let the model carry on - **is rejected by current Claude models**, which return a
400 for a trailing assistant turn. The supported shape is the one the app already
uses for its empty-reply retry: the assistant turn sits mid-array with a user turn
after it. Continuation follows that precedent exactly.

*Stitching.* The cut-off falls mid-line, so the partial's trailing incomplete line
is dropped and the continuation is asked to resume from the following line. The
join therefore happens at a line boundary, which is the only boundary a BASIC
listing has and the only one that can be tested deterministically.

*Where the joined answer lives.* The stitched program becomes the content of the
continuation's reply, not a retroactive edit of the partial. The thread then reads
in order, and everything downstream - block extraction, the run check, the
staleness fingerprint - operates on the last message exactly as it does for an
answer that was never cut off. No downstream code learns that continuation exists,
which is what makes the "checked on the same terms" requirement hold by
construction rather than by a parallel code path.

*Staleness.* The continuation carries the **original** answer's fingerprint, not a
fresh one. Staleness asks whether the user has moved on since the answer was
written, and the answer was written before the interruption.

*The visible request.* The continuation appears in the thread as a request, the
way automatic corrections already do. Hiding it would require splitting the
display list from the wire history, which are deliberately the same array.

## Risks / Trade-offs

- **A raised budget costs more per answer.** → It is the user's key and their
  setting; the effort default (D3) pulls the other way, and a truncated answer is
  already paid for and then thrown away. Not raising it is not free.
- **A ceiling looked up today drifts as models change.** → Declared per provider
  in one place (D2) rather than scattered, and clamping means drift degrades to a
  smaller answer rather than a failed request.
- **Removing `AiProfile.maxTokens` touches every dialect.** → Mechanical, and the
  compiler finds all of them. The skill template that instructs new dialects to set
  it is updated in the same change, or the field grows back.
- **Stitching could duplicate or drop a line.** → The join is at a line boundary
  with the incomplete line dropped, and it is unit-testable without a network call.
  A duplicated line number is also recoverable: merging by line number is
  idempotent for identical lines.
- **Continuation could itself run out of room.** → It is an ordinary answer and can
  be continued again. Nothing special-cases the first continuation.
- **Per-provider settings multiply what the settings form holds.** → The form
  already swaps a field on provider change for the API key; the two new fields
  follow that same path rather than introducing another.

## Migration Plan

No data migration. An absent override means the default, which is the state every
existing browser is already in - so existing users move to the new defaults on
first load, which is the intended fix. Stored API keys are untouched.

Rollback is a revert: the settings entries left behind are inert.

## Open Questions

- The exact output ceiling of each provider, and the effort levels the Anthropic
  model accepts (D2) - to be looked up, not assumed.
- The measured token count of a worst-case 20KB listing, which settles the default
  budget (D4).
- Whether the continuation control should also appear for a reply the user stopped
  themselves. It would work, but "stopped" and "ran out of room" are different
  intents and only the second is a fault the user did not choose.
