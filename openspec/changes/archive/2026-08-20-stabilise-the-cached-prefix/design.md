## Context

A provider's prompt cache is a prefix match: the request is compared against what
was sent before, byte for byte, from the front, and everything after the first
difference is processed afresh. Anthropic renders a request as tools, then the
system prompt, then the conversation, and the IDE marks one breakpoint at the end
of the whole thing.

The IDE therefore needs three properties, and has none of them: the tool set must
not change within a conversation, the system prompt must not change within a
conversation, and a turn once sent must be replayed unchanged.

Composed system prompt sizes, measured per registered machine, run from 19,223
characters (ZX80) to 37,544 (BBC Master). The default model's minimum cacheable
prefix is 1,024 tokens, so every machine clears it comfortably — the opposite of
what the code's comments claim. Cache writes cost 1.25x an ordinary input token
and reads cost about a tenth, so a prefix that never matches costs about twelve
times what a prefix that always matches would.

See `docs/contributing/architecture.md` for where the assistant sits in the app.

## Goals / Non-Goals

**Goals:**

- The request the provider receives on turn N+1 begins with the exact bytes it
  received on turn N.
- A caller cannot construct a differently-composed system prompt by accident.
- Both properties are pinned by tests, per registered machine, so they cannot
  regress silently — which is how they were lost.
- The per-machine size of what a request carries is a recorded number.

**Non-Goals:**

- Reducing what a request carries. Explicitly deferred; see the proposal.
- Caching on the providers that do not offer it. OpenAI and Gemini get no
  breakpoint and no benefit here; they are unaffected either way.
- Cross-reload cache continuity. The cache's own lifetime is measured in minutes,
  so a reload is usually past it regardless.

## Decisions

**1. The thread keeps both the sent text and the shown text.**

The store's messages are the panel's render model and the wire's history at once,
and the two want different things: the panel wants the sentence the user typed,
the provider wants the request that was actually made. Keeping one and deriving
the other is what broke — the derivation is lossy in the direction that matters.
So the turn carries both, the panel reads one and the wire reads the other.

The alternative — send only the short form, and carry the program somewhere
outside the conversation — does not exist. Everything in the conversation is
replayed, so there is nowhere to put a per-turn payload that is not also history.

**2. The consequence is accepted deliberately: the program appears once per turn.**

Today the program is sent only on the newest turn, which looks thrifty and is the
reason nothing matches. With the fix, an N-turn conversation carries N copies.
That is the right trade by a wide margin and it is worth writing down why: sample
programs run 153 to 3,605 bytes, median 418, so a copy is on the order of a
hundred tokens against a system prompt of several thousand — and the copies sit in
the matched part of the prefix, read at a tenth price, while the thing they buy
back is the whole prefix at a tenth instead of 1.25x.

**3. Storage keeps the sent text too, unless the budget says otherwise.**

Persisting only the shown text would reproduce the original defect after a reload.
Persisting both roughly doubles what a user turn costs in storage, against a
budget shared with the autosaved program. Measure a realistic conversation before
choosing; if it does not fit, persist the shown text only and accept a cold prefix
after a reload, which is what happens today past the cache's lifetime anyway.
Whichever way it goes, storage failures stay best-effort — a full quota must never
break a conversation.

**4. The capability flags become required parameters.**

The bug is a defaulted argument: a two-argument call compiles and silently
composes a different prompt from a three-argument one. Making both required moves
it to compile time. Resolving them once, from the provider, means every caller in
a conversation agrees by construction rather than by discipline.

The flags remain a legitimate axis of variation — the composed prompt differs by
`(dialect, canShowScreen, canDrive)` and always will, because two of them describe
what the chosen provider can actually do. What must not happen is variation
*within* a conversation, and neither flag can change without the user changing
provider, which starts a different conversation anyway.

**5. Tools are offered per conversation, not per turn — and a call outside the
window is refused, not dropped.**

Tools render ahead of the system prompt, so they are the most expensive thing to
get wrong. The bound that matters is unchanged: a cache breakpoint walks back
twenty content blocks and each round of tool use appends two, which is what fixes
the exchange loop's limit at eight rounds. Offering tools on a turn that does not
use one costs their definitions in the prefix — a few hundred tokens, paid once
per conversation — and removes an invalidation that costs the whole prefix on
every turn that follows a drive turn.

The risk this creates is narrow but real. Driving is asked for in the reply, not
by calling a tool: the rules tell the assistant to add `DRIVE` to a block and wait
to be given the machine, and the IDE grants it only once the program has been run.
So a tool call on an ordinary turn is off-protocol rather than expected. But the
seam today returns the answer's text and discards tool calls when no runner was
supplied, which turns an off-protocol call into an answer that silently did
nothing — the one failure nothing downstream can diagnose, and the exact thing the
seam's own comments say a backend must never do.

So a turn that offers tools without granting the machine answers any call with a
refusal the assistant can read, in the shape the exchange loop already uses when a
turn runs out of rounds. The alternative — supplying a runner on every turn — is
rejected: it would let the assistant take the machine on a turn where nothing has
been run, which is a different product, not a caching fix.

**5a. The capability flags stop lying on the user's own turns.**

Resolving the flags consistently is not neutral, and the proposal says so. On a
provider that can be given the machine, a user's turn currently composes
`The machine CANNOT be driven on this setup, so do not ask to drive it` while the
IDE's own check turns compose the full driving rules. Making them agree means
choosing which is true, and the true one is that the machine can be driven.

That is the right correction on its own terms, independent of caching: the turn
being told the machine cannot be driven is the turn on which the assistant writes
the program, and a program written in the belief that nothing can ever type at it
is a worse program. The spec delta records this as a guarantee so it cannot drift
back.

**6. Two properties, two tests, both driven from the registry.**

Byte-stability and size are different failures and deserve separate tests, but
both must sweep every registered dialect rather than a sample — the defect this
change fixes is exactly the kind that a hand-picked machine list would miss. The
pattern already used for the graphics palette applies: enumerate from the
registry, assert per machine.

The size test asserts per-section figures as well as a total, so a failure names
the section that grew instead of leaving someone to bisect a 30 KB string.

**7. TTL and the second breakpoint are deferred to measurement, not decided here.**

Holding the cache for an hour costs 2x on write against 1.25x and pays from the
third read. A second breakpoint at the end of the system prompt would give an
anchor that survives history churn. Both are plausible; neither is measurable
while the cache never reads at all. They are tasks in this change, gated on the
readout the fix makes meaningful, and it is a legitimate outcome to change
neither.

**8. The seam is untouched.**

Nothing here reaches a `Dialect` or a `MachineEmulator` beyond what
`loadSystemPrompt` already reads to compose a description. No machine boundary
moves.

## Risks / Trade-offs

- **Conversation storage grows** → decision 3, measured before choosing, with a
  documented fallback that degrades to today's behaviour rather than failing.
- **The wire history now contains the program many times, and a long conversation
  approaches the context window** → far less pressing than it sounds: the
  conversation resets when a different program is opened, and the model's window
  is measured in hundreds of thousands of tokens against a program measured in
  hundreds. If it ever bites, trimming history is a change of its own and a much
  easier one to reason about once the prefix is stable.
- **Offering tools on every turn changes when the model may call one** → the
  reply path already collects tool calls rather than dropping them, and the turns
  that offer no runner cannot execute one. Worth watching in review that a turn
  which never intended to drive does not start driving; if it does, the fix is the
  system prompt's own rules, which already say when driving is appropriate.
- **The fix cannot be proven by unit tests** → they pin composition, not what the
  provider does with it. The only real check reads the cache figures off a live
  response, which is why `report-what-a-request-cost` exists and why this change
  names a manual verification task rather than pretending the suite covers it.
- **Correcting a comment that is load-bearing elsewhere** → the claim about the
  minimum cacheable size also appears in the reasoning of an archived change.
  Archived changes are the record of what was decided at the time and are not
  edited; the correction belongs in the code, where someone will read it next.
