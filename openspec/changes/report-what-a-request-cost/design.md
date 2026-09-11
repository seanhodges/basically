## Context

Every provider reports what a request cost alongside the reply, and the IDE reads
none of it. `StreamResult` — the shape all three backends return through the
single seam in `src/ai/aiClient.ts` — carries the answer's text, why it stopped,
and any tools the model asked to run. Nothing else survives.

The three backends do not report the same things, and they do not divide the way
one might expect. All three report how much of a request was served from cache:
Anthropic as `cache_read_input_tokens`, OpenAI within `prompt_tokens_details`,
Gemini as `cachedContentTokenCount`. Only Anthropic reports what was *written* to
the cache, because only Anthropic is asked to cache anything — on the other two it
happens implicitly or not at all, and there is no write for the caller to be told
about. So the shape this change adds is one where absence is normal, must be
representable, and can apply to one half of caching and not the other.

The providers also disagree, several-fold, about how large a request must be
before they will cache it. Below that floor a request silently never caches: no
error, just a cache figure that is honestly nought and reads like a fault.

See `docs/contributing/architecture.md` for where the assistant sits.

## Goals / Non-Goals

**Goals:**

- What a request cost survives the seam instead of being dropped where it is
  known.
- The user can see what an answer cost them and what the session has cost so far.
- "The provider did not say" is distinguishable from "the answer is nought".
- The figures are trustworthy on a turn that took several exchanges, which is the
  turn most likely to be expensive.

**Non-Goals:**

- Money. Prices are per-model, per-provider and change without notice.
- Prediction. Nothing is estimated before sending.
- Enforcement. No caps, no warnings, no refusals.

## Decisions

**1. Every figure is optional, and absence is a value.**

The obvious shape — four numbers defaulting to zero — quietly asserts something
false on two of the three backends: that nothing was cached. Absent and zero are
different claims and the type says so, which forces the panel to decide how to
render each rather than letting a default decide for it.

**2. Cost accumulates across the rounds of a turn, in the seam.**

A turn that drives the machine makes several requests inside one exchange loop,
and the loop already exists in one place for all three backends. Summing there
means each backend reports one exchange and knows nothing about turns, and it
means a tool-using turn cannot silently report only its last round — which is the
round that did the least.

Cache reads accumulate the same way and are the interesting figure: the second and
later exchanges of a turn are the ones that should be reading a warm prefix, so a
turn's total is also the clearest evidence the prefix is stable.

**3. The store keeps the per-answer figure and the running total.**

The total is derivable from the answers, but only for answers still in the thread
— and the thread is cleared when the program changes while the total is about the
session. Keeping both is a small redundancy that avoids the total silently meaning
something different from what the user thinks it means.

Both persist with the conversation. A restored conversation that resets its total
to nothing would misreport the cheapest possible session as a fresh start, which
is the opposite of the point.

**4. The panel states it quietly.**

This is reference information for a user who chooses to look, not something to put
between them and the reply. Per-answer figures sit with the answer and stay out of
the way; the running total belongs where the conversation's own controls are. The
existing panel already carries several kinds of secondary state — an answer being
checked, an answer that was cut short, a screen that was shown — and this follows
whatever those do rather than inventing a new register.

**5. What the figures are called.**

The provider's own vocabulary is not the user's. "Newly processed", "served from
cache" and "the answer" say what happened; input and output tokens say how the
API bills. The unit is tokens because that is the only unit the IDE actually
knows, but the labels describe the request, not the invoice.

**6. A request too small to cache is a stated reason, not a zero.**

Each provider sets a floor below which it will not cache, and they differ
several-fold. A request under that floor reports nothing served from cache, which
is true and useless: it looks identical to a cache that has broken. Stating the
reason separates "there was nothing to serve" from "the prefix stopped matching",
which are the two things anyone reading this figure is trying to tell apart.

This stays a property of the chosen provider, declared alongside what it accepts
and whether it supports tools, rather than something derived per request.

**7. It does not touch the seam.**

No `Dialect` and no `MachineEmulator` is involved. This is entirely inside the
assistant's own provider boundary, which is a different seam and one this change
widens by exactly one optional field.

## Risks / Trade-offs

- **Three providers, three shapes, and each missing something different** → the
  optional-everywhere type, and a test per backend that a missing figure arrives
  missing rather than as nought. Two of the three report reads but not writes,
  which is the case most likely to be mishandled by a type that treats caching as
  one thing. The distinction is the whole point of the change, so it is worth a
  test each rather than one shared one.
- **A stopped answer may report nothing** → aborting a stream can leave the final
  usage unavailable, in which case the answer states what it can and marks the
  rest unavailable. The spec requires the statement "where the provider reports
  it" for exactly this reason; what it forbids is silently reporting nought.
- **Persisted totals grow the conversation's storage** → four small numbers per
  answer, against a budget already carrying the answers themselves. Negligible,
  but it shares a quota with the autosaved program, so persistence stays
  best-effort as everything else there is.
- **The figure is expected to look good, which is its own risk** → the prefix was
  stabilised and measured by hand, so a healthy conversation should report most of
  its request served from cache from the second turn. A change that only ever
  confirms good news is easy to build wrong and never notice, so the tests drive
  the unhappy shapes directly — a withheld figure, a request under the floor, a
  turn that ended early — rather than relying on live use to produce them.
- **Showing cost could read as discouraging use** → it is secondary by design,
  and the alternative is a user who discovers the cost somewhere the IDE cannot
  show them. In a bring-your-own-key product the honest number is the kinder one.
