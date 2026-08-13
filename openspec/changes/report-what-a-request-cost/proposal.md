## Why

The assistant runs on the user's own key. Every request spends their money, and
the IDE currently says nothing about how much. Neither does it capture the
figures: the seam every request passes through returns the answer's text and why
it stopped, and discards the usage the provider reports alongside it.

That silence has cost something concrete. When the machine's full language
definition replaced a prose summary, the design behind that change undertook that
"sizes per machine are recorded during implementation so the cost is a number
rather than a feeling". No number was ever recorded. The same change argued the
larger description would pay for itself through the provider's cache — and because
nothing reads the cache figures back, nobody noticed the cache has never once been
read.

A user cannot see any of this either. They can see an answer arrive; they cannot
see that it re-processed several thousand tokens that a working cache would have
served at a tenth of the price, and they have no way to tell a cheap conversation
from an expensive one until the bill arrives somewhere the IDE cannot show them.

## What Changes

- The seam every request passes through SHALL carry back what the request cost, so
  it stops being discarded at the point it is known.
- Each answer SHALL state what it cost: how much of the request was newly
  processed, how much was served from the provider's cache, and how large the
  answer itself was.
- A figure the chosen provider does not report SHALL be shown as unavailable
  rather than as zero. Only one of the three backends reports cache figures at
  all, and showing a missing figure as nought would read as "nothing was cached"
  — which is a claim, and a different one.
- A conversation SHALL state its running total, so the cost of a session is
  visible without adding up answers.
- An answer that did not finish — stopped by the user, cut off by the output
  budget, or failed — SHALL still state what it spent where the provider reports
  it. A stopped answer is not a free one.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ai-assistant`: gains a requirement that what an answer cost is stated to the
  user, including how much of it the provider served from cache, and that a figure
  the provider does not report is shown as unavailable rather than as zero.

## Non-goals

- **Estimating money.** Prices change, differ per model and per provider, and are
  not something the IDE can know. It reports what the provider reports and leaves
  the arithmetic to whoever set the key up.
- **Counting tokens before sending.** No client-side estimator and no
  count-tokens call. This reports what a request actually cost, after the fact.
- **Budgets, warnings or caps.** Nothing here refuses or throttles a request. The
  output budget the user already tunes is a separate control and is unaffected.
- **Making anything cheaper.** This measures; `stabilise-the-cached-prefix` is
  what moves the figure.
- **Settling whether the machine's full command set is worth carrying.** These
  figures are the evidence that question needs, and it stays open until there is
  some. Whether a request should carry less, or reach for it through a tool
  instead, is a later change and a bigger one — it would rewrite a requirement
  that six scenarios are pinned to, and it would leave the two providers without
  tool support with no machine description at all.

## Impact

- `src/ai/providers/types.ts` — `StreamResult` gains what a request cost. Every
  field optional, because only one backend reports cache figures and none of them
  is obliged to report anything.
- `src/ai/providers/anthropic.ts`, `openai.ts`, `gemini.ts` — each reads the usage
  its own API returns and fills in what it has. The Anthropic backend is the only
  one with cache figures to report.
- `src/ai/aiClient.ts` — the exchange loop accumulates cost across the rounds of
  one turn rather than reporting only the last, or a turn that used tools would
  under-report.
- `src/ai/aiStore.ts` — an answer keeps what it cost; the thread keeps a running
  total. Both persist with the conversation, or a restored conversation reports a
  total that is missing everything before the reload.
- `src/components/AiPanel.tsx` and its stylesheet — the per-answer figures and the
  conversation total. Quiet by default: this is reference information, not
  something to put between the user and the answer.
- Colocated tests for the accumulation across tool rounds, for the
  unavailable-versus-zero distinction, and for the restore path.

No dialect, emulator or machine-boundary changes, and no new dependencies.

This supersedes an earlier intention to verify the cache with temporary logging
behind a development-only branch. A temporary instrument answers the question once
and then rots; the same information is worth something permanent to a user who is
paying for every turn.
